import { ethers } from "ethers";

const RPC_URL        = process.env.RPC_URL_BASE;
const PRIVATE_KEY    = process.env.PRIVATE_KEY;
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS_BASE;
const FACTORY_ADDRESS= process.env.FACTORY_ADDRESS_BASE;
const LOCK_CONTRACT  = process.env.LOCK_CONTRACT_BASE;
const STABLE_POOL    = false;

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

const deadline = () => Math.floor(Date.now() / 1000) + 1200;

async function parseAmount(token, amount) {
  const decimals = await token.decimals();
  return ethers.parseUnits(amount.toString(), decimals);
}

async function safeApprove(token, spender, amount, wallet) {
  const allowance = await token.allowance(wallet.address, spender);
  if (allowance < amount) {
    await (await token.approve(spender, 0)).wait();
    await (await token.approve(spender, amount)).wait();
  }
}

function buildError(error) {
  let errorType   = "UNKNOWN_ERROR";
  let userMessage = error.message || "Transaction failed. Please try again.";
  const debugMessage = error.message || "No message";

  if (error.code === "INSUFFICIENT_FUNDS") {
    errorType   = "INSUFFICIENT_GAS";
    userMessage = "Platform wallet does not have enough ETH to pay gas.";
  } else if (error.message?.includes("Insufficient TokenA")) {
    errorType   = "TOKEN_A_BALANCE_LOW";
    userMessage = "Platform wallet does not have enough USDT for liquidity.";
  } else if (error.message?.includes("Insufficient TokenB")) {
    errorType   = "TOKEN_B_BALANCE_LOW";
    userMessage = "Platform wallet does not have enough of the new token for liquidity.";
  } else if (error.message?.includes("LP balance zero")) {
    errorType   = "LP_ZERO";
    userMessage = "Liquidity was added but LP tokens were not received.";
  } else if (error.message?.includes("Pool not created")) {
    errorType   = "PAIR_NOT_CREATED";
    userMessage = "Liquidity pool was not created.";
  } else if (error.code === "CALL_EXCEPTION") {
    errorType   = "CONTRACT_REVERT";
    userMessage = `Contract reverted: ${error.reason || error.data || debugMessage}`;
  }

  return { success: false, errorType, userMessage, debugMessage };
}

export const autoLiquidityAndLock = async (tokenA, tokenB, amountA, amountB, treasuryWallet) => {
  try {
    console.log("AUTO LIQUIDITY START BASE", tokenA, tokenB, amountA, amountB);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
    const lpRecipient = treasuryWallet || wallet.address;

    const A = ethers.getAddress(tokenA);
    const B = ethers.getAddress(tokenB);

    const tokenAContract = new ethers.Contract(A, ERC20_ABI, wallet);
    const tokenBContract = new ethers.Contract(B, ERC20_ABI, wallet);

    const amtA = await parseAmount(tokenAContract, amountA);
    const amtB = await parseAmount(tokenBContract, amountB);

    const balA = await tokenAContract.balanceOf(wallet.address);
    const balB = await tokenBContract.balanceOf(wallet.address);

    console.log("Wallet balances — A:", balA.toString(), "B:", balB.toString());
    console.log("Required amounts — A:", amtA.toString(), "B:", amtB.toString());

    if (balA < amtA) throw new Error(`Insufficient TokenA balance. Have: ${balA}, Need: ${amtA}`);
    if (balB < amtB) throw new Error(`Insufficient TokenB balance. Have: ${balB}, Need: ${amtB}`);

    await safeApprove(tokenAContract, ROUTER_ADDRESS, amtA, wallet);
    await safeApprove(tokenBContract, ROUTER_ADDRESS, amtB, wallet);

    const router  = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

    const minA = (amtA * 95n) / 100n;
    const minB = (amtB * 95n) / 100n;

    const tx = await router.addLiquidity(
      A, B, STABLE_POOL, amtA, amtB, minA, minB, wallet.address, deadline(),
      { gasLimit: 3_000_000n }
    );
    const receipt = await tx.wait();

    let pool = ethers.ZeroAddress;
    for (let i = 0; i < 10; i++) {
      pool = await factory.getPool(A, B, STABLE_POOL);
      if (pool !== ethers.ZeroAddress) break;
      await new Promise(r => setTimeout(r, 2000));
    }
    if (pool === ethers.ZeroAddress) throw new Error("Pool not created");

    const lp    = new ethers.Contract(pool, LP_ABI, wallet);
    const lpBal = await lp.balanceOf(wallet.address);
    if (lpBal <= 0n) throw new Error("LP balance zero");

    await (await lp.approve(LOCK_CONTRACT, lpBal)).wait();

    const locker = new ethers.Contract(LOCK_CONTRACT, LOCK_ABI, wallet);
    const name   = await tokenAContract.symbol();
    const lockTx = await locker.createLock(name, pool, lpRecipient, lpBal, { gasLimit: 3_000_000n });
    const lockRcpt = await lockTx.wait();

    return {
      success: true,
      liquidityTx: receipt.transactionHash,
      pairAddress: pool,
      lpLocked: lpBal.toString(),
      lockTx: lockRcpt.hash
    };

  } catch (error) {
    console.error("💥 DEX BASE FAILED:", error);
    return buildError(error);
  }
};

export default { autoLiquidityAndLock };
