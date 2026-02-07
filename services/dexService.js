import { ethers } from "ethers";

/* ================= ENV ================= */

const RPC_URL = process.env.RPC_URL_ETH;
let PRIVATE_KEY = process.env.PRIVATE_KEY;

// Ensure private key has 0x prefix
if (PRIVATE_KEY && !PRIVATE_KEY.startsWith('0x')) {
  PRIVATE_KEY = '0x' + PRIVATE_KEY;
}

const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS_ETH;
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS_ETH;
const LOCK_CONTRACT = process.env.LOCK_CONTRACT_ETH;

// Initialize provider lazily to avoid errors
let provider = null;
const getProvider = () => {
  if (!provider && RPC_URL) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return provider;
};

// Initialize wallet lazily to avoid errors if key is invalid
let wallet = null;

const getWallet = () => {
  if (!wallet && PRIVATE_KEY && getProvider()) {
    try {
      wallet = new ethers.Wallet(PRIVATE_KEY, getProvider());
    } catch (error) {
      console.error('❌ Failed to initialize wallet:', error.message);
      throw error;
    }
  }
  return wallet;
};

/* ================= ABIs ================= */

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)"
];

const ROUTER_ABI = [
  "function addLiquidity(address,address,uint,uint,uint,uint,address,uint)"
];

const FACTORY_ABI = [
  "function getPair(address,address) view returns (address)"
];

const LP_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)"
];

const LOCK_ABI = [
  "function createLock(string,address,address,uint256)"
];

/* ================= CONTRACTS ================= */

let router = null;
let factory = null;

const getRouter = () => {
  if (!router) {
    router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, getWallet());
  }
  return router;
};

const getFactory = () => {
  if (!factory) {
    factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, getProvider());
  }
  return factory;
};

/* ================= HELPERS ================= */

const deadline = () => Math.floor(Date.now() / 1000) + 1200;

async function parseAmount(token, amount) {
  const decimals = await token.decimals();
  return ethers.parseUnits(amount.toString(), decimals);
}

async function safeApprove(token, spender, amount) {
  const w = getWallet();
  const allowance = await token.allowance(w.address, spender);
  if (allowance < amount) {
    await (await token.approve(spender, 0)).wait();
    await (await token.approve(spender, amount)).wait();
  }
}

/* ================= MAIN ================= */

export const autoLiquidityAndLock = async (
  tokenA,
  tokenB,
  amountA,
  amountB
) => {
  console.log("AUTO LIQUIDITY START");
  const w = getWallet();
  const A = ethers.getAddress(tokenA);
  const B = ethers.getAddress(tokenB);

  const tokenAContract = new ethers.Contract(A, ERC20_ABI, w);
  const tokenBContract = new ethers.Contract(B, ERC20_ABI, w);

  /* ---- PRE CHECKS (NO GAS WASTE) ---- */

  const ethBal = await getProvider().getBalance(w.address);
  if (ethBal < ethers.parseEther("0.01")) {
    throw new Error("Backend wallet ETH too low for liquidity");
  }

  const amtA = await parseAmount(tokenAContract, amountA);
  const amtB = await parseAmount(tokenBContract, amountB);

  const balA = await tokenAContract.balanceOf(w.address);
  const balB = await tokenBContract.balanceOf(w.address);

  if (balA < amtA) throw new Error("Insufficient TokenA balance");
  if (balB < amtB) throw new Error("Insufficient TokenB balance");

  /* ---- APPROVE SAFE ---- */

  await safeApprove(tokenAContract, ROUTER_ADDRESS, amtA);
  await safeApprove(tokenBContract, ROUTER_ADDRESS, amtB);

  /* ---- ADD LIQUIDITY ---- */

  const tx = await getRouter().addLiquidity(
    A,
    B,
    amtA,
    amtB,
    0,
    0,
    w.address,
    deadline()
  );
  const receipt = await tx.wait();

  /* ---- GET PAIR ---- */

  let pair = ethers.ZeroAddress;
  for (let i = 0; i < 10; i++) {
    pair = await getFactory().getPair(A, B);
    if (pair !== ethers.ZeroAddress) break;
    await new Promise(r => setTimeout(r, 2000));
  }

  if (pair === ethers.ZeroAddress) {
    throw new Error("Pair not created");
  }

  /* ---- LOCK LP ---- */

  const lp = new ethers.Contract(pair, LP_ABI, w);
  const lpBal = await lp.balanceOf(w.address);

  if (lpBal <= 0n) throw new Error("LP balance zero");

  await (await lp.approve(LOCK_CONTRACT, lpBal)).wait();

  const locker = new ethers.Contract(LOCK_CONTRACT, LOCK_ABI, w);
  const name = await tokenAContract.symbol();

  const lockTx = await locker.createLock(
    name,
    pair,
    w.address,
    lpBal
  );
  const lockRcpt = await lockTx.wait();

  return {
    success: true,
    liquidityTx: receipt.transactionHash,
    pairAddress: pair,
    lpLocked: lpBal.toString(),
    lockTx: lockRcpt.transactionHash
  };
};
export const swapToken = async (tokenInAddress, tokenOutAddress, amountIn, recipient) => {
  try {
    console.log("SWAP TOKEN:", tokenInAddress, tokenOutAddress, amountIn, recipient);
    const w = getWallet();
    const IN = ethers.getAddress(tokenInAddress);
    const OUT = ethers.getAddress(tokenOutAddress);  
    const pair = await getFactory().getPair(IN, OUT);
    if (pair === ethers.ZeroAddress) {
      throw new Error("Liquidity pair not found");
    }

    const tokenInContract = new ethers.Contract(IN, ERC20_ABI, w);
    const amtIn = await parseAmount(tokenInContract, amountIn);

    const balance = await tokenInContract.balanceOf(w.address);
    if (balance < amtIn) {
      throw new Error("Insufficient token balance in wallet");
    }

    await safeApprove(tokenInContract, ROUTER_ADDRESS, amtIn);

    const tx = await getRouter().swapExactTokensForTokensSupportingFeeOnTransferTokens(
      amtIn,
      0,
      [IN, OUT],
      w.address,
      Math.floor(Date.now() / 1000) + 1200
    );

    const receipt = await tx.wait();

    return { success: true, txHash: receipt.transactionHash };

  } catch (err) {
    throw err;
  }
};
export default {
  autoLiquidityAndLock,
  swapToken
};        
