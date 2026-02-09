import { ethers } from "ethers";

/* ================= ENV ================= */

const RPC_URL = process.env.RPC_URL_ETH;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS_ETH;
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS_ETH;
const LOCK_CONTRACT = process.env.LOCK_CONTRACT_ETH;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

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

const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

/* ================= HELPERS ================= */

const deadline = () => Math.floor(Date.now() / 1000) + 1200;

async function parseAmount(token, amount) {
  const decimals = await token.decimals();
  return ethers.parseUnits(amount.toString(), decimals);
}

async function safeApprove(token, spender, amount) {
  const allowance = await token.allowance(wallet.address, spender);
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
  console.log("AUTO LIQUIDITY START ETH", tokenA, tokenB, amountA, amountB);

  const A = ethers.getAddress(tokenA);
  const B = ethers.getAddress(tokenB);

  const tokenAContract = new ethers.Contract(A, ERC20_ABI, wallet);
  const tokenBContract = new ethers.Contract(B, ERC20_ABI, wallet);

  /* ---- PRE CHECKS (NO GAS WASTE) ---- */

  const ethBal = await provider.getBalance(wallet.address);
  if (ethBal < ethers.parseEther("0.01")) {
    throw new Error("Backend wallet ETH too low for liquidity");
  }

  const amtA = await parseAmount(tokenAContract, 0.001);
  const amtB = await parseAmount(tokenBContract, 0.001);

  const balA = await tokenAContract.balanceOf(wallet.address);
  const balB = await tokenBContract.balanceOf(wallet.address);

  if (balA < amtA) throw new Error("Insufficient TokenA balance");
  if (balB < amtB) throw new Error("Insufficient TokenB balance");

  /* ---- APPROVE SAFE ---- */

  await safeApprove(tokenAContract, ROUTER_ADDRESS, amtA);
  await safeApprove(tokenBContract, ROUTER_ADDRESS, amtB);

  /* ---- ADD LIQUIDITY ---- */

  const tx = await router.addLiquidity(
    A,
    B,
    amtA,
    amtB,
    0,
    0,
    wallet.address,
    deadline()
  );
  const receipt = await tx.wait();

  /* ---- GET PAIR ---- */

  let pair = ethers.ZeroAddress;
  for (let i = 0; i < 10; i++) {
    pair = await factory.getPair(A, B);
    if (pair !== ethers.ZeroAddress) break;
    await new Promise(r => setTimeout(r, 2000));
  }

  if (pair === ethers.ZeroAddress) {
    throw new Error("Pair not created");
  }

  /* ---- LOCK LP ---- */

  const lp = new ethers.Contract(pair, LP_ABI, wallet);
  const lpBal = await lp.balanceOf(wallet.address);

  if (lpBal <= 0n) throw new Error("LP balance zero");

  await (await lp.approve(LOCK_CONTRACT, lpBal)).wait();

  const locker = new ethers.Contract(LOCK_CONTRACT, LOCK_ABI, wallet);
  const name = await tokenAContract.symbol();

  const lockTx = await locker.createLock(
    name,
    pair,
    wallet.address,
    lpBal,
  {
    gasLimit: 3_000_000n, // 🔥 IMPORTANT
  }
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
    const IN = ethers.getAddress(tokenInAddress);
    const OUT = ethers.getAddress(tokenOutAddress);  
    const pair = await factory.getPair(IN, OUT);
    if (pair === ethers.ZeroAddress) {
      return res.status(400).json({ error: "Liquidity pair not found" });
    }

    const tokenInContract = new ethers.Contract(IN, ERC20_ABI, wallet);
    const amtIn = await parseAmount(tokenInContract, amountIn);

    const balance = await tokenInContract.balanceOf(wallet.address);
    if (balance < amtIn) {
      return res.status(400).json({
        error: "Insufficient token balance in wallet"
      });
    }

    await approveIfNeeded(tokenInContract, ROUTER_ADDRESS, amtIn);

    const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
      amtIn,
      0,
      [IN, OUT],
      wallet.address,
      Math.floor(Date.now() / 1000) + 1200
    );

    const receipt = await tx.wait();

    res.json({ success: true, txHash: receipt.transactionHash });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export default {
  autoLiquidityAndLock,
  swapToken
};        
