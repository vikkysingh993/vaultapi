import { ethers } from "ethers";

/* ================= ENV ================= */

const RPC_URL = process.env.RPC_URL_BASE;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS_BASE;
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS_BASE;
const LOCK_CONTRACT = process.env.LOCK_CONTRACT_BASE;

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
  "function addLiquidity(address tokenA, address tokenB, bool stable, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)"
];



const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, bool stable) view returns (address)"
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
  console.log("Current allowance:", allowance.toString());
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
  try {
  console.log("AUTO LIQUIDITY START ETH", tokenA, tokenB, amountA, amountB);

  const A = ethers.getAddress(tokenA);
  const B = ethers.getAddress(tokenB);

  const tokenAContract = new ethers.Contract(A, ERC20_ABI, wallet);
  const tokenBContract = new ethers.Contract(B, ERC20_ABI, wallet);

  /* ---- PRE CHECKS (NO GAS WASTE) ---- */

  const ethBal = await provider.getBalance(wallet.address);
  // if (ethBal < ethers.parseEther("0.01")) {
  //   throw new Error("Backend wallet ETH too low for liquidity");
  // }

  const amtA = await parseAmount(tokenAContract, amountA);
  const amtB = await parseAmount(tokenBContract, amountB);

  const balA = await tokenAContract.balanceOf(wallet.address);
  const balB = await tokenBContract.balanceOf(wallet.address);

  if (balA < amtA) throw new Error("Insufficient TokenA balance");
  if (balB < amtB) throw new Error("Insufficient TokenB balance");

  /* ---- APPROVE SAFE ---- */

  await safeApprove(tokenAContract, ROUTER_ADDRESS, amtA);
  await safeApprove(tokenBContract, ROUTER_ADDRESS, amtB);
  const STABLE_POOL = false; // USDT pairs ke liye stable=true
    console.log("🏦 Using stable pool:", STABLE_POOL);

    // 🔥 STATIC SIMULATION with stable param
    console.log("🧪 Simulating addLiquidity(stable=", STABLE_POOL, ")");
  console.log("🧪 Testing static call...");
const minA = (amtA * 95n) / 100n; // 5% slippage
const minB = (amtB * 95n) / 100n;

  /* ---- ADD LIQUIDITY ---- */

  const tx = await router.addLiquidity(
    A,
    B,
    STABLE_POOL,  // 🔥 STABLE PARAMETER!
    amtA,
    amtB,
    0,
    0,
    wallet.address,
    deadline(),
    {
    gasLimit: 3_000_000n // 🔥 manually set to avoid estimation failure
  }
  );
  const receipt = await tx.wait();

  /* ---- GET PAIR ---- */

  let pool = ethers.ZeroAddress;

for (let i = 0; i < 10; i++) {
  pool = await factory.getPool(A, B, STABLE_POOL);
  if (pool !== ethers.ZeroAddress) break;
  await new Promise(r => setTimeout(r, 2000));
}

if (pool === ethers.ZeroAddress) {
  throw new Error("Pool not created");
}


  /* ---- LOCK LP ---- */

const lp = new ethers.Contract(pool, LP_ABI, wallet);
  const lpBal = await lp.balanceOf(wallet.address);

  if (lpBal <= 0n) throw new Error("LP balance zero");

  await (await lp.approve(LOCK_CONTRACT, lpBal)).wait();

  const locker = new ethers.Contract(LOCK_CONTRACT, LOCK_ABI, wallet);
  const name = await tokenAContract.symbol();

  const lockTx = await locker.createLock(
    name,
    pool,
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
    pairAddress: pool,
    lpLocked: lpBal.toString(),
    lockTx: lockRcpt.transactionHash
  };
 } catch (error) {
    console.error("💥 DEX SERVICE FAILED:", error);
    
    // Enhanced error with full details
    let errorMessage = error.message || 'Unknown error';
    if (error.code) {
      errorMessage = `${error.code}: ${errorMessage}`;
    }
    if (error.reason) {
      errorMessage += ` | Reason: ${error.reason}`;
    }
    if (error.data) {
      errorMessage += ` | Data: ${error.data}`;
    }

    const detailedError = new Error(errorMessage);
    detailedError.originalError = error;
    detailedError.code = error.code;
    throw detailedError;
  }
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
