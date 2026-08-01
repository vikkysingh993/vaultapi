import { ethers } from "ethers";

const RPC_URL        = process.env.RPC_URL_SONIC;
const PRIVATE_KEY    = process.env.PRIVATE_KEY;
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS_SONIC;
const FACTORY_ADDRESS= process.env.FACTORY_ADDRESS_SONIC;
const LOCK_CONTRACT  = process.env.LOCK_CONTRACT_SONIC;

const STABLE_POOL = false;

const ROUTER_ABI = [
  "function addLiquidity(address tokenA,address tokenB,bool stable,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256,uint256,uint256)"
];

const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
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

async function checkAndApprove(tokenAddress, wallet, spender, amount) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const [symbol, decimals, allowance, balance] = await Promise.all([
    token.symbol(),
    token.decimals(),
    token.allowance(wallet.address, spender),
    token.balanceOf(wallet.address),
  ]);
  console.log(`🔍 ${symbol} balance: ${ethers.formatUnits(balance, decimals)}, allowance: ${ethers.formatUnits(allowance, decimals)}, need: ${ethers.formatUnits(amount, decimals)}`);
  if (balance < amount) {
    throw new Error(`Insufficient ${symbol} balance. Have: ${ethers.formatUnits(balance, decimals)}, Need: ${ethers.formatUnits(amount, decimals)}`);
  }
  if (allowance < amount) {
    console.log(`⏳ Approving ${symbol}...`);
    const tx = await token.approve(spender, ethers.MaxUint256);
    console.log(`📨 Approve tx: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ ${symbol} approved`);
  } else {
    console.log(`✅ ${symbol} allowance sufficient`);
  }
}

export const autoLiquidityAndLock = async (A, B, amtA, amtB, treasuryWallet) => {
  try {
    console.log("START AUTO LIQUIDITY SONIC", { A, B, amtA, amtB, treasuryWallet });

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
    const lpRecipient = treasuryWallet || wallet.address;

    const tokenA = new ethers.Contract(A, ERC20_ABI, wallet);
    const tokenB = new ethers.Contract(B, ERC20_ABI, wallet);

    const [decimalsA, decimalsB] = await Promise.all([tokenA.decimals(), tokenB.decimals()]);

    const amountADesired = ethers.parseUnits(amtA.toString(), decimalsA);
    const amountBDesired = ethers.parseUnits(amtB.toString(), decimalsB);

    await checkAndApprove(A, wallet, ROUTER_ADDRESS, amountADesired);
    await checkAndApprove(B, wallet, ROUTER_ADDRESS, amountBDesired);

    const router   = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
    const deadline = Math.floor(Date.now() / 1000) + 600;

    console.log("🚀 Adding liquidity...");
    console.log("  tokenA:", A, "amountA:", amountADesired.toString());
    console.log("  tokenB:", B, "amountB:", amountBDesired.toString());
    console.log("  stable:", STABLE_POOL, "to:", wallet.address, "deadline:", deadline);

    const tx = await router.addLiquidity(
      A, B, STABLE_POOL,
      amountADesired, amountBDesired,
      0n, 0n,           // amountMin = 0 — safe for new pools, avoids ratio revert
      wallet.address,   // LP to backend wallet so it can approve & lock
      deadline
    );

    console.log("📨 addLiquidity tx:", tx.hash);
    const receipt = await tx.wait();
    console.log("🎉 Liquidity added, block:", receipt.blockNumber);

    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
    const pair    = await factory.getPair(A, B, STABLE_POOL);

    if (pair === ethers.ZeroAddress) throw new Error("Pair not found after liquidity add");
    console.log("📌 Pair Address:", pair);

    const lp        = new ethers.Contract(pair, LP_ABI, wallet);
    const lpBalance = await lp.balanceOf(wallet.address);

    if (lpBalance === 0n) throw new Error("LP balance zero after liquidity add");
    console.log("💰 LP Balance:", lpBalance.toString());

    console.log("🔐 Approving LP for Lock...");
    const lpApproveTx = await lp.approve(LOCK_CONTRACT, lpBalance);
    console.log("📨 LP approve tx:", lpApproveTx.hash);
    const lpApproveReceipt = await lpApproveTx.wait();
    console.log("✅ LP approved for lock contract", LOCK_CONTRACT, lpApproveReceipt.hash);

    const locker = new ethers.Contract(LOCK_CONTRACT, LOCK_ABI, wallet);
    const symbol = await tokenA.symbol();

    console.log("🔒 Locking LP...", { symbol, pair, lpRecipient, lpBalance: lpBalance.toString() });
    const lockTx      = await locker.createLock(symbol, pair, lpRecipient, lpBalance);
    const lockReceipt = await lockTx.wait();
    console.log("✅ LP Locked:", lockReceipt.hash);

    return {
      success: true,
      liquidityTx: receipt.hash,
      pairAddress: pair,
      lpLocked: lpBalance.toString(),
      lockTx: lockReceipt.hash
    };

  } catch (error) {
    console.error("DEX ERROR:", error.message);

    let errorType   = "UNKNOWN_ERROR";
    let userMessage = "Transaction failed. Please try again.";
    const debugMessage = error.message || "No message";

    if (error.code === "INSUFFICIENT_FUNDS") {
      errorType   = "INSUFFICIENT_GAS";
      userMessage = "Platform wallet does not have enough S (Sonic) to pay gas.";
    } else if (error.message?.includes("Insufficient") && error.message?.includes("balance")) {
      errorType   = "TOKEN_BALANCE_LOW";
      userMessage = error.message;
    } else if (error.code === "CALL_EXCEPTION") {
      errorType   = "CONTRACT_REVERT";
      userMessage = "Liquidity contract call failed. Check token balances and router address.";
    } else if (error.message?.includes("LP balance zero")) {
      errorType   = "LP_ZERO";
      userMessage = "Liquidity was added but LP tokens were not received.";
    } else if (error.message?.includes("Pair not found")) {
      errorType   = "PAIR_NOT_CREATED";
      userMessage = "Liquidity pair was not created.";
    }

    return { success: false, errorType, userMessage, debugMessage };
  }
};

export default { autoLiquidityAndLock };
