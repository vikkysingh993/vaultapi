import { ethers } from "ethers";

/* ================= ENV ================= */

const RPC_URL = process.env.RPC_URL_SONIC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS_SONIC;
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS_SONIC;
const LOCK_CONTRACT = process.env.LOCK_CONTRACT_SONIC;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const TOKEN_A_AMOUNT = "1"; // 10 tokenA
const TOKEN_B_AMOUNT = "1"; // 20 tokenB

const STABLE_POOL = false; // true only for stable pairs
const SLIPPAGE = 1; // 1%
/* ================= ABIs ================= */

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)"
];

const ROUTER_ABI = [
  "function addLiquidity(address tokenA,address tokenB,bool stable,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256,uint256,uint256)"
];



const FACTORY_HELPER_ABI = [
  "function getPair(address,address,bool) view returns (address)"
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
const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_HELPER_ABI, provider);

/* ================= HELPERS ================= */

const deadline = () => Math.floor(Date.now() / 1000) + 1200;
function isNative(address) {
  return address === ethers.ZeroAddress;
}
async function checkAndApprove(tokenAddress, wallet, spender, amount) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

  const decimals = await token.decimals();
  const allowance = await token.allowance(wallet.address, spender);

  if (allowance >= amount) return;

  const tx = await token.approve(spender, ethers.MaxUint256);
  await tx.wait();
}



async function parseAmount(tokenAddress, tokenContract, amount) {
  if (tokenAddress === ethers.ZeroAddress) {
    // Native SONIC
    return ethers.parseEther(amount.toString()); // 18 decimals
  }

  const decimals = await tokenContract.decimals();
  return ethers.parseUnits(amount.toString(), decimals);
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

    const decimalsA = await tokenAContract.decimals();
    const decimalsB = await tokenBContract.decimals();
    
    // const amtA = await parseAmount(A, tokenAContract, amountA);
    // const amtB = await parseAmount(B, tokenBContract, amountB);
    const amountADesired=ethers.parseUnits("1", decimalsA);
    const amountBDesired=ethers.parseUnits("1", decimalsB);

    const balA = await tokenAContract.balanceOf(wallet.address);
    const balB = await tokenBContract.balanceOf(wallet.address);

    if (balA < amountADesired) throw new Error("Insufficient TokenA balance");
    if (balB < amountBDesired) throw new Error("Insufficient TokenB balance");

    /* ---- APPROVE SAFE ---- */
    await checkAndApprove(A, wallet, ROUTER_ADDRESS, amountADesired);
    await checkAndApprove(B, wallet, ROUTER_ADDRESS, amountBDesired);

    let token0 = A;
    let token1 = B;
    let amount0 = amountADesired;
    let amount1 = amountBDesired;
    if (BigInt(A) > BigInt(B)) {
      token0 = B;
      token1 = A;
      amount0 = amountBDesired;
      amount1 = amountADesired;
    }
      // 🔥 STATIC SIMULATION with stable param
      console.log("🧪 Simulating addLiquidity(stable=", STABLE_POOL, ")");
      console.log("🧪 Testing static call...");
    
    const amountAMin =
      amountADesired * BigInt(100 - SLIPPAGE) / 100n;
    const amountBMin =
      amountBDesired * BigInt(100 - SLIPPAGE) / 100n;

    /* ---- ADD LIQUIDITY ---- */

    const tx = await router.addLiquidity(
      token0,
      token1,
      false,                // ✅ NOT stable
      amount0,
      amount1,
      amount0 * 99n / 100n,
      amount1 * 99n / 100n,
      wallet.address,
      deadline(),
      { gasLimit: 3_000_000 }
    );

    const receipt = await tx.wait();
    console.log("🎉 Liquidity added");
    console.log("⛓ Block:", receipt.blockNumber);
    /* ---- GET PAIR ---- */
    let pair = ethers.ZeroAddress;


    for (let i = 0; i < 10; i++) {
      const pair = await factory.getPair(token0, token1, false);
      if (pair!== ethers.ZeroAddress) break;
      await new Promise(r => setTimeout(r, 2000));
    }

    if (pair=== ethers.ZeroAddress) {
      throw new Error("pairnot created");
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
