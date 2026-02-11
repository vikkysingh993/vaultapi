import { ethers } from "ethers";

/* ================= ENV ================= */

const RPC_URL = process.env.RPC_URL_SONIC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS_SONIC;
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS_SONIC;
const LOCK_CONTRACT = process.env.LOCK_CONTRACT_SONIC;


const STABLE_POOL = false;   // true if stable pool
const SLIPPAGE = 1;          // %

/* ================= ABIs ================= */

const ROUTER_ABI = [
  "function addLiquidity(address tokenA,address tokenB,bool stable,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256,uint256,uint256)"
];

const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const FACTORY_ABI = [
  "function getPair(address,address,bool) view returns (address)"
];

const LP_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)"
];

const LOCK_ABI = [
  "function createLock(string,address,address,uint256)"
];

/* ================= CONTRACTS ================= */

// const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
// const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

// /* ================= HELPERS ================= */

// const deadline = () => Math.floor(Date.now() / 1000) + 1200;

// async function approveIfNeeded(tokenAddress, spender, amount) {
//   const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
//   const allowance = await token.allowance(wallet.address, spender);

//   if (allowance >= amount) return;

//   console.log(" Approving:", tokenAddress);
//   const tx = await token.approve(spender, ethers.MaxUint256);
//   await tx.wait();
// }

/* =============================
   HELPERS
============================= */

async function checkAndApprove(tokenAddress, wallet, spender, amount) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const allowance = await token.allowance(wallet.address, spender);

  console.log(`🔍 ${symbol} allowance:`, ethers.formatUnits(allowance, decimals));

  if (allowance >= amount) {
    console.log(`✅ ${symbol} allowance sufficient`);
    return;
  }

  console.log(`⏳ Approving ${symbol}...`);

  const tx = await token.approve(spender, ethers.MaxUint256);
  console.log(`📨 Approve tx: ${tx.hash}`);

  await tx.wait();
  console.log(`✅ ${symbol} approved`);
}


/* ================= MAIN FUNCTION ================= */

export const autoLiquidityAndLock = async (
  A,
  B,
  amtA,
  amtB
) => {
  try {

    console.log(" START AUTO LIQUIDITY");

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

//     const A = ethers.getAddress(tokenA);
//     const B = ethers.getAddress(tokenB);


  const tokenA = new ethers.Contract(A, ERC20_ABI, wallet);
  const tokenB = new ethers.Contract(B, ERC20_ABI, wallet);

    const tokenAContract = new ethers.Contract(A, ERC20_ABI, wallet);
    const tokenBContract = new ethers.Contract(B, ERC20_ABI, wallet);

//     const decimalsA = await tokenAContract.decimals();
//     const decimalsB = await tokenBContract.decimals();

  const decimalsA = await tokenA.decimals();
  const decimalsB = await tokenB.decimals();
const amountA = 1; // for testing, use 1 unit of each token. In production, these should come from the request body or be calculated based on supply and desired ratio.  
const amountB =1;

    const amountADesired = ethers.parseUnits(amountA.toString(), decimalsA);
    const amountBDesired = ethers.parseUnits(amountB.toString(), decimalsB);
  const amountAMin =
    amountADesired * BigInt(100 - SLIPPAGE) / 100n;
  const amountBMin =
    amountBDesired * BigInt(100 - SLIPPAGE) / 100n;
  
  // 1️⃣ Allowance + Approve
  await checkAndApprove(tokenA, wallet, ROUTER_ADDRESS, amountADesired);
  await checkAndApprove(tokenB, wallet, ROUTER_ADDRESS, amountBDesired);

    /* ========= BALANCE CHECK ========= */

//     const balA = await tokenA.balanceOf(wallet.address);
//     const balB = await tokenB.balanceOf(wallet.address);

//     if (balA < amountADesired) throw new Error("Insufficient TokenA balance");
//     if (balB < amountBDesired) throw new Error("Insufficient TokenB balance");

//     /* ========= APPROVE TOKEN A ========= */
//     await approveIfNeeded(tokenA, ROUTER_ADDRESS, amountADesired);

//     /* ========= APPROVE TOKEN B ========= */
//     await approveIfNeeded(tokenB, ROUTER_ADDRESS, amountBDesired);

//     /* ========= SLIPPAGE ========= */

//     const amountAMin = amountADesired * BigInt(100 - SLIPPAGE) / 100n;
//     const amountBMin = amountBDesired * BigInt(100 - SLIPPAGE) / 100n;

    /* ========= ADD LIQUIDITY ========= */

    // 2️⃣ addLiquidity
    const router = new ethers.Contract(
      ROUTER_ADDRESS,
      ROUTER_ABI,
      wallet
    );

    const deadline = () => Math.floor(Date.now() / 1000) + 60 * 10;

    console.log("🚀 Adding liquidity...");


//     console.log(" Simulating addLiquidity...");
//     await router.addLiquidity.staticCall(
//       tokenA,
//       tokenB,
//       STABLE_POOL,
//       amountADesired,
//       amountBDesired,
//       amountAMin,
//       amountBMin,
//       wallet.address,
//       deadline()
//     );

//     console.log(" Simulation Passed");

    const tx = await router.addLiquidity(
      tokenA,
      tokenB,
      STABLE_POOL,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      wallet.address,
      deadline(),
//       { gasLimit: 3000000 }
    );
    
  console.log("📨 addLiquidity tx:", tx.hash);

  const receipt = await tx.wait();
  console.log("🎉 Liquidity added");

  
    const factory = new ethers.Contract(
    FACTORY_ADDRESS,
    FACTORY_ABI,
    provider
  );

  const pair = await factory.getPair(
    tokenA,
    tokenB,
    STABLE_POOL
  );

  if (pair === ethers.ZeroAddress) {
    throw new Error("Pair not found");
  }

  console.log("📌 Pair Address:", pair);

  // 4️⃣ LP Balance
  const lp = new ethers.Contract(pair, LP_ABI, wallet);

  const lpBalance = await lp.balanceOf(wallet.address);

  if (lpBalance === 0n) {
    throw new Error("LP balance zero");
  }

  console.log("💰 LP Balance:", lpBalance.toString());

  // 5️⃣ Approve LP to Lock Contract
  const lpAllowance = await lp.allowance(wallet.address, LOCK_CONTRACT);

  if (lpAllowance < lpBalance) {
    console.log("🔐 Approving LP for Lock...");
    await (await lp.approve(LOCK_CONTRACT, lpBalance)).wait();
  }

  // 6️⃣ Lock LP
  const locker = new ethers.Contract(
    LOCK_CONTRACT,
    LOCK_ABI,
    wallet
  );

  const symbol = await tokenA.symbol();

  console.log("🔒 Locking LP...");

  const lockTx = await locker.createLock(
    symbol,
    pair,
    wallet.address,
    lpBalance
  );

  const lockReceipt = await lockTx.wait();

  console.log("✅ LP Locked:", lockReceipt.transactionHash);
  return {
        success: true,
        liquidityTx: receipt.transactionHash,
        pairAddress: pair,
        lpAmount: lpBalance.toString(),
        lockTx: lockReceipt.transactionHash
      };
//     const receipt = await tx.wait();
//     console.log(" Liquidity Added:", receipt.transactionHash);

    /* ========= GET PAIR ========= */

//     let pair = ethers.ZeroAddress;

//     for (let i = 0; i < 10; i++) {
//       pair = await factory.getPair(A, B, STABLE_POOL);
//       if (pair !== ethers.ZeroAddress) break;
//       await new Promise(r => setTimeout(r, 2000));
//     }

//     if (pair === ethers.ZeroAddress)
//       throw new Error("Pair not created. Check stable flag.");

//     console.log(" Pair:", pair);

//     /* ========= LP BALANCE CHECK ========= */

//     const lp = new ethers.Contract(pair, LP_ABI, wallet);
//     const lpBal = await lp.balanceOf(wallet.address);

//     if (lpBal === 0n) throw new Error("LP balance zero");

//     console.log(" LP Balance:", lpBal.toString());

//     /* ========= LP APPROVE ========= */

//     console.log(" Approving LP...");
//     const approveLpTx = await lp.approve(LOCK_CONTRACT, lpBal);
//     await approveLpTx.wait();

//     /* ========= CREATE LOCK ========= */

//     const locker = new ethers.Contract(LOCK_CONTRACT, LOCK_ABI, wallet);
//     const tokenSymbol = await tokenAContract.symbol();

//     console.log(" Locking LP...");
//     const lockTx = await locker.createLock(
//       tokenSymbol,        // string
//       pair,               // LP token address
//       wallet.address,     // beneficiary
//       lpBal
//     );

//     const lockReceipt = await lockTx.wait();
//     console.log(" LP Locked:", lockReceipt.transactionHash);

//     return {
//       success: true,
//       liquidityTx: receipt.transactionHash,
//       pairAddress: pair,
//       lpAmount: lpBal.toString(),
//       lockTx: lockReceipt.transactionHash
//     };

  } catch (error) {

  console.error("DEX ERROR:", error);

  let errorType = "UNKNOWN_ERROR";
  let userMessage = "Transaction failed. Please try again.";
  let debugMessage = error.message || "No message";

  /* ================= WALLET ERRORS ================= */

  if (error.code === 4001) {
    errorType = "USER_REJECTED";
    userMessage = "Transaction was rejected in wallet.";
  }

  if (error.code === "INSUFFICIENT_FUNDS") {
    errorType = "INSUFFICIENT_GAS";
    userMessage = "Platform wallet does not have enough native token to pay gas.";
  }

  if (error.code === "NONCE_EXPIRED") {
    errorType = "NONCE_ERROR";
    userMessage = "Transaction nonce error. Please retry.";
  }

  /* ================= SMART CONTRACT REVERT ================= */

  if (error.code === "CALL_EXCEPTION") {

    errorType = "CONTRACT_REVERT";

    // If staticCall failed before tx
    if (error.action === "call") {
      userMessage =
        "Liquidity validation failed. Please verify token amounts and pool type.";
    }

    // If tx reverted after sending
    if (error.receipt?.status === 0) {
      userMessage =
        "Blockchain rejected the liquidity transaction.\n\n" +
        "Possible reasons:\n" +
        "• Token ratio invalid\n" +
        "• Token decimals mismatch\n" +
        "• Pool type (stable/volatile) incorrect\n" +
        "• Router configuration mismatch\n" +
        "• Token not transferable\n\n" +
        "Please verify settings and try again.";
    }
  }

  /* ================= BALANCE ERRORS ================= */

  if (error.message?.includes("Insufficient TokenA balance")) {
    errorType = "TOKEN_A_BALANCE_LOW";
    userMessage = "Platform wallet does not have enough Token A.";
  }

  if (error.message?.includes("Insufficient TokenB balance")) {
    errorType = "TOKEN_B_BALANCE_LOW";
    userMessage = "Platform wallet does not have enough Token B.";
  }

  if (error.message?.includes("LP balance zero")) {
    errorType = "LP_ZERO";
    userMessage =
      "Liquidity was added but LP tokens were not received. Check router configuration.";
  }

  if (error.message?.includes("Pair not created")) {
    errorType = "PAIR_NOT_CREATED";
    userMessage =
      "Liquidity pair was not created. Please verify stable pool setting.";
  }

  /* ================= SLIPPAGE ================= */

  if (error.message?.toLowerCase().includes("slippage")) {
    errorType = "SLIPPAGE_TOO_LOW";
    userMessage =
      "Slippage too low. Increase slippage tolerance and try again.";
  }

  /* ================= LOCK ERROR ================= */

  if (error.message?.toLowerCase().includes("lock")) {
    errorType = "LP_LOCK_FAILED";
    userMessage =
      "Liquidity was added but LP locking failed. Please contact support.";
  }

  /* ================= RETURN STRUCTURED ERROR ================= */

  return {
    success: false,
    errorType,
    userMessage,
    debugMessage // useful for logs only
  };
}
};

export default {
  autoLiquidityAndLock
};