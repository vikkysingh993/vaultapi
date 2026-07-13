import { ethers } from "ethers";

const RPC_URL        = process.env.RPC_URL_ETH;
const PRIVATE_KEY    = process.env.PRIVATE_KEY;
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS_ETH;
const FACTORY_ADDRESS= process.env.FACTORY_ADDRESS_ETH;
const LOCK_CONTRACT  = process.env.LOCK_CONTRACT_ETH;

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

export const autoLiquidityAndLock = async (tokenA, tokenB, amountA, amountB, treasuryWallet) => {
  try {
    console.log("AUTO LIQUIDITY START ETH", tokenA, tokenB, amountA, amountB);

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

    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

    const tx = await router.addLiquidity(A, B, amtA, amtB, 0, 0, lpRecipient, deadline());
    const receipt = await tx.wait();

    let pair = ethers.ZeroAddress;
    for (let i = 0; i < 10; i++) {
      pair = await factory.getPair(A, B);
      if (pair !== ethers.ZeroAddress) break;
      await new Promise(r => setTimeout(r, 2000));
    }
    if (pair === ethers.ZeroAddress) throw new Error("Pair not created");

    const lp    = new ethers.Contract(pair, LP_ABI, wallet);
    const lpBal = await lp.balanceOf(wallet.address);
    if (lpBal <= 0n) throw new Error("LP balance zero");

    await (await lp.approve(LOCK_CONTRACT, lpBal)).wait();

    const locker = new ethers.Contract(LOCK_CONTRACT, LOCK_ABI, wallet);
    const name   = await tokenAContract.symbol();
    const lockTx = await locker.createLock(name, pair, lpRecipient, lpBal, { gasLimit: 3_000_000n });
    const lockRcpt = await lockTx.wait();

    return {
      success: true,
      liquidityTx: receipt.transactionHash,
      pairAddress: pair,
      lpLocked: lpBal.toString(),
      lockTx: lockRcpt.hash
    };

  } catch (error) {
    console.error("💥 DEX ETH FAILED:", error);
    return buildError(error);
  }
};

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
  } else if (error.message?.includes("Pair not created")) {
    errorType   = "PAIR_NOT_CREATED";
    userMessage = "Liquidity pair was not created.";
  } else if (error.code === "CALL_EXCEPTION") {
    errorType   = "CONTRACT_REVERT";
    userMessage = `Contract reverted: ${error.reason || error.data || debugMessage}`;
  }

  return { success: false, errorType, userMessage, debugMessage };
}

export const swapToken = async (tokenInAddress, tokenOutAddress, amountIn) => {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
    const factory  = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
    const router   = new ethers.Contract(ROUTER_ADDRESS, [
      "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint,uint,address[],address,uint)"
    ], wallet);

    const IN  = ethers.getAddress(tokenInAddress);
    const OUT = ethers.getAddress(tokenOutAddress);
    const pair = await factory.getPair(IN, OUT);
    if (pair === ethers.ZeroAddress) throw new Error("Liquidity pair not found");

    const tokenInContract = new ethers.Contract(IN, ERC20_ABI, wallet);
    const decimals = await tokenInContract.decimals();
    const amtIn = ethers.parseUnits(amountIn.toString(), decimals);

    const balance = await tokenInContract.balanceOf(wallet.address);
    if (balance < amtIn) throw new Error("Insufficient token balance in wallet");

    await (await tokenInContract.approve(ROUTER_ADDRESS, amtIn)).wait();

    const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
      amtIn, 0, [IN, OUT], wallet.address, Math.floor(Date.now() / 1000) + 1200
    );
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.transactionHash };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export default { autoLiquidityAndLock, swapToken };
