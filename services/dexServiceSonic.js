import { ethers } from "ethers";

/* ================= ENV ================= */

const RPC_URL = process.env.RPC_URL_SONIC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS_SONIC;
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS_SONIC;
const LOCK_CONTRACT = process.env.LOCK_CONTRACT_SONIC;

const STABLE_POOL = false;
const SLIPPAGE = 1;

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

/* ================= HELPERS ================= */

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

export const autoLiquidityAndLock = async (A, B, amtA, amtB, treasuryWallet) => {
  try {
    console.log("START AUTO LIQUIDITY SONIC");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const lpRecipient = treasuryWallet || wallet.address;

    const tokenA = new ethers.Contract(A, ERC20_ABI, wallet);
    const tokenB = new ethers.Contract(B, ERC20_ABI, wallet);

    const decimalsA = await tokenA.decimals();
    const decimalsB = await tokenB.decimals();

    const amountADesired = ethers.parseUnits(amtA.toString(), decimalsA);
    const amountBDesired = ethers.parseUnits(amtB.toString(), decimalsB);
    const amountAMin = amountADesired * BigInt(100 - SLIPPAGE) / 100n;
    const amountBMin = amountBDesired * BigInt(100 - SLIPPAGE) / 100n;

    await checkAndApprove(A, wallet, ROUTER_ADDRESS, amountADesired);
    await checkAndApprove(B, wallet, ROUTER_ADDRESS, amountBDesired);

    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
    const deadline = () => Math.floor(Date.now() / 1000) + 60 * 10;

    console.log("🚀 Adding liquidity...");

    const tx = await router.addLiquidity(
      A,
      B,
      STABLE_POOL,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      wallet.address,   // LP tokens go to backend wallet so it can approve & lock
      deadline()
    );

    console.log("📨 addLiquidity tx:", tx.hash);
    const receipt = await tx.wait();
    console.log("🎉 Liquidity added");

    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
    const pair = await factory.getPair(A, B, STABLE_POOL);

    if (pair === ethers.ZeroAddress) {
      throw new Error("Pair not found");
    }
    console.log("📌 Pair Address:", pair);

    const lp = new ethers.Contract(pair, LP_ABI, wallet);
    const lpBalance = await lp.balanceOf(wallet.address);

    if (lpBalance === 0n) throw new Error("LP balance zero");
    console.log("💰 LP Balance:", lpBalance.toString());

    const lpAllowance = await lp.allowance(wallet.address, LOCK_CONTRACT);
    if (lpAllowance < lpBalance) {
      console.log("🔐 Approving LP for Lock...");
      await (await lp.approve(LOCK_CONTRACT, lpBalance)).wait();
    }
    console.log("✅ LP Approved for Lock Contract", LOCK_CONTRACT);

    const locker = new ethers.Contract(LOCK_CONTRACT, LOCK_ABI, wallet);
    const symbol = await tokenA.symbol();

    console.log("🔒 Locking LP Data...", "symbol:", symbol, "pair:", pair, "beneficiary:", lpRecipient, "amount:", lpBalance);

    const lockTx = await locker.createLock(symbol, pair, lpRecipient, lpBalance);
    const lockReceipt = await lockTx.wait();

    console.log("✅ LP Locked:", lockReceipt.hash);

    return {
      success: true,
      liquidityTx: receipt.transactionHash,
      pairAddress: pair,
      lpLocked: lpBalance.toString(),
      lockTx: lockReceipt.hash
    };

  } catch (error) {
    console.error("DEX ERROR:", error);

    let errorType = "UNKNOWN_ERROR";
    let userMessage = "Transaction failed. Please try again.";
    let debugMessage = error.message || "No message";

    if (error.code === "INSUFFICIENT_FUNDS") {
      errorType = "INSUFFICIENT_GAS";
      userMessage = "Platform wallet does not have enough native token to pay gas.";
    }
    if (error.code === "CALL_EXCEPTION") {
      errorType = "CONTRACT_REVERT";
      userMessage = error.receipt?.status === 0
        ? "Blockchain rejected the liquidity transaction."
        : "Liquidity validation failed. Please verify token amounts and pool type.";
    }
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
      userMessage = "Liquidity was added but LP tokens were not received.";
    }
    if (error.message?.includes("Pair not")) {
      errorType = "PAIR_NOT_CREATED";
      userMessage = "Liquidity pair was not created. Please verify stable pool setting.";
    }

    return { success: false, errorType, userMessage, debugMessage };
  }
};

export default { autoLiquidityAndLock };
