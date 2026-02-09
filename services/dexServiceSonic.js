import { ethers } from "ethers";

/* ================= ENV ================= */
const RPC_URL = process.env.RPC_URL_SONIC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS_SONIC;
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS_SONIC;
const LOCK_CONTRACT = process.env.LOCK_CONTRACT_SONIC;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

/* ================= ABIs ================= */
const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function totalSupply() view returns (uint256)"
];

const ROUTER_ABI = [
  "function addLiquidity(address,address,uint,uint,uint,uint,address,uint)",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256) returns (uint256[])"
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

/* ================= VALIDATION HELPER ================= */
async function validateERC20Contract(tokenContract, address, tokenName) {
  try {
    // Check if it's actually a contract (has bytecode)
    const code = await wallet.provider.getCode(address);
    if (code === "0x") {
      throw new Error(`${tokenName} (${address}) is not a contract - empty bytecode`);
    }

    // Try to call decimals() - most reliable ERC20 check
    await tokenContract.decimals();
    console.log(`✅ ${tokenName} validated: ${address}`);
  } catch (error) {
    throw new Error(`${tokenName} (${address}) is not a valid ERC20 contract. Error: ${error.shortMessage || error.message}`);
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

  const A = ethers.getAddress(tokenA);
  const B = ethers.getAddress(tokenB);

  const tokenAContract = new ethers.Contract(A, ERC20_ABI, wallet);
  const tokenBContract = new ethers.Contract(B, ERC20_ABI, wallet);

  /* ---- VALIDATE CONTRACTS FIRST ---- */
  await validateERC20Contract(tokenAContract, A, "TokenA");
  await validateERC20Contract(tokenBContract, B, "TokenB");

  /* ---- PARSE AMOUNTS ---- */
  const amtA = await parseAmount(tokenAContract, 1);
  const amtB = await parseAmount(tokenBContract, 1);

  /* ---- BALANCE CHECKS ---- */
  const balA = await tokenAContract.balanceOf(wallet.address);
  const balB = await tokenBContract.balanceOf(wallet.address);

  if (balA < amtA) throw new Error(`Insufficient TokenA balance: need ${ethers.formatEther(amtA)} got ${ethers.formatEther(balA)}`);
  if (balB < amtB) throw new Error(`Insufficient TokenB balance: need ${ethers.formatEther(amtB)} got ${ethers.formatEther(balB)}`);

  /* ---- APPROVE SAFE ---- */
  await safeApprove(tokenAContract, ROUTER_ADDRESS, amtA);
  await safeApprove(tokenBContract, ROUTER_ADDRESS, amtB);

  /* ---- ADD LIQUIDITY ---- */
  const tx = await router.addLiquidity(
    A,
    B,
    amtA,
    amtB,
    0,  // minAmountA
    0,  // minAmountB
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
    throw new Error("Pair not created after 20s");
  }

  /* ---- LOCK LP ---- */
  const lp = new ethers.Contract(pair, LP_ABI, wallet);
  const lpBal = await lp.balanceOf(wallet.address);

  if (lpBal <= 0n) throw new Error("No LP tokens received");

  await safeApprove(lp, LOCK_CONTRACT, lpBal);

  const locker = new ethers.Contract(LOCK_CONTRACT, LOCK_ABI, wallet);
  const name = await tokenAContract.symbol();

  const lockTx = await locker.createLock(
    name,
    pair,
    wallet.address,
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

/* ================= SWAP FUNCTION ================= */
export const swapToken = async (tokenInAddress, tokenOutAddress, amountIn, recipient, res) => {
  try {
    console.log("SWAP TOKEN:", tokenInAddress, tokenOutAddress, amountIn, recipient);
    
    const IN = ethers.getAddress(tokenInAddress);
    const OUT = ethers.getAddress(tokenOutAddress);  

    const tokenInContract = new ethers.Contract(IN, ERC20_ABI, wallet);
    await validateERC20Contract(tokenInContract, IN, "TokenIn");

    const pair = await factory.getPair(IN, OUT);
    if (pair === ethers.ZeroAddress) {
      return res.status(400).json({ error: "Liquidity pair not found" });
    }

    const amtIn = await parseAmount(tokenInContract, amountIn);
    const balance = await tokenInContract.balanceOf(wallet.address);
    
    if (balance < amtIn) {
      return res.status(400).json({
        error: `Insufficient balance: need ${ethers.formatEther(amtIn)} got ${ethers.formatEther(balance)}`
      });
    }

    await safeApprove(tokenInContract, ROUTER_ADDRESS, amtIn);

    const swapTx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
      amtIn,
      0, // minAmountOut
      [IN, OUT],
      recipient || wallet.address,
      deadline()
    );

    const receipt = await swapTx.wait();

    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    console.error("Swap error:", err);
    res.status(500).json({ error: err.message });
  }
};

export default {
  autoLiquidityAndLock,
  swapToken
};
