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
  let decimals = 18;
  try {
    decimals = await token.decimals();
  } catch {
    console.warn("decimals() failed, defaulting to 18");
  }
  return ethers.parseUnits(amount.toString(), decimals);
}

// async function safeApprove(token, spender, amount) {
//   const allowance = await token.allowance(wallet.address, spender);
//   if (allowance < amount) {
//     await (await token.approve(spender, 0)).wait();
//     await (await token.approve(spender, amount)).wait();
//   }
// }
async function safeApprove(token, spender, amount) {
  try {
    console.log(`🔄 Force approving ${token.target}`);

    // Always reset
    const resetTx = await token.approve(spender, 0n);
    await resetTx.wait();

    // Fresh approve
    const approveTx = await token.approve(spender, amount);
    await approveTx.wait();

    console.log("✅ Approved successfully");
  } catch (err) {
    console.error("❌ Approve failed:", err);
    throw err;
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
// dexServiceSonic.js - Updated autoLiquidityAndLock function
export const autoLiquidityAndLock = async (tokenA, tokenB, amountA, amountB) => {
  try {
    console.log("🚀 AUTO LIQUIDITY START Sonic");
    console.log("PARAMS:", { tokenA, tokenB, amountA, amountB });

    const A = ethers.getAddress(tokenA);
    const B = ethers.getAddress(tokenB);
    console.log("✅ ADDRESSES:", { A, B });

    // Create contracts
    const tokenAContract = new ethers.Contract(A, ERC20_ABI, wallet);
    const tokenBContract = new ethers.Contract(B, ERC20_ABI, wallet);
    console.log('✅ Contracts created');

    // 🔥 STEP 1: VALIDATE CONTRACTS & GET DECIMALS
    console.log("🔍 Validating contracts...");
    let decimalsA = 18, decimalsB = 18;
    
    try {
      decimalsA = await tokenAContract.decimals();
      console.log("✅ TokenA decimals:", decimalsA);
    } catch (e) {
      console.warn("⚠️ TokenA decimals() failed, using 18");
    }
    
    try {
      decimalsB = await tokenBContract.decimals();
      console.log("✅ TokenB decimals:", decimalsB);
    } catch (e) {
      console.warn("⚠️ TokenB decimals() failed, using 18");
    }

    // 🔥 STEP 2: PARSE AMOUNTS PROPERLY
    const amtA = ethers.parseUnits(amountA.toString(), decimalsA);
    const amtB = ethers.parseUnits(amountB.toString(), decimalsB);
    console.log("💰 Parsed amounts:", {
      amtA: ethers.formatUnits(amtA, decimalsA),
      amtB: ethers.formatUnits(amtB, decimalsB)
    });

    // 🔥 STEP 3: BALANCE CHECKS (CRITICAL)
    console.log("💳 Checking balances...");
    const balA = await tokenAContract.balanceOf(wallet.address);
    const balB = await tokenBContract.balanceOf(wallet.address);
    
    console.log("📊 BALANCES vs REQUIRED:", {
      tokenA: { bal: ethers.formatUnits(balA, decimalsA), req: amountA },
      tokenB: { bal: ethers.formatUnits(balB, decimalsB), req: amountB }
    });

    if (balA < amtA) {
      throw new Error(`❌ TokenA Insufficient balance: need ${ethers.formatUnits(amtA, decimalsA)} got ${ethers.formatUnits(balA, decimalsA)}`);
    }
    if (balB < amtB) {
      throw new Error(`❌ TokenB Insufficient balance: need ${ethers.formatUnits(amtB, decimalsB)} got ${ethers.formatUnits(balB, decimalsB)}`);
    }
    console.log("✅ Balance checks PASSED");

    // 🔥 STEP 4: SEQUENTIAL APPROVALS (TokenA FIRST)
    console.log("🔑 STEP 1/2: Approving TokenA...");
    await safeApprove(tokenAContract, ROUTER_ADDRESS, amtA);
    console.log("✅ TokenA APPROVED");

    console.log("🔑 STEP 2/2: Approving TokenB...");
    await safeApprove(tokenBContract, ROUTER_ADDRESS, amtB);
    console.log("✅ TokenB APPROVED");

    // 🔥 STEP 5: VERIFY APPROVALS (CRITICAL CHECK)
    console.log("🔍 Verifying approvals...");
    const allowanceA = await tokenAContract.allowance(wallet.address, ROUTER_ADDRESS);
    const allowanceB = await tokenBContract.allowance(wallet.address, ROUTER_ADDRESS);
    
    console.log("📋 APPROVAL STATUS:", {
      tokenA: ethers.formatUnits(allowanceA, decimalsA),
      tokenB: ethers.formatUnits(allowanceB, decimalsB),
      requiredA: ethers.formatUnits(amtA, decimalsA),
      requiredB: ethers.formatUnits(amtB, decimalsB)
    });

    if (allowanceA < amtA) {
      throw new Error(`❌ TokenA approval failed: allowance ${ethers.formatUnits(allowanceA, decimalsA)} < required ${ethers.formatUnits(amtA, decimalsA)}`);
    }
    if (allowanceB < amtB) {
      throw new Error(`❌ TokenB approval failed: allowance ${ethers.formatUnits(allowanceB, decimalsB)} < required ${ethers.formatUnits(amtB, decimalsB)}`);
    }
    console.log("✅ Approvals VERIFIED");

    // 🔥 STEP 6: ADD LIQUIDITY
    const minA = (amtA * 98n) / 100n; // 2% slippage
    const minB = (amtB * 98n) / 100n;
    
    console.log("🛢️ ADDING LIQUIDITY:", {
      amountA: ethers.formatUnits(amtA, decimalsA),
      amountB: ethers.formatUnits(amtB, decimalsB),
      minA: ethers.formatUnits(minA, decimalsA),
      minB: ethers.formatUnits(minB, decimalsB)
    });

    const gasPrice = await provider.getFeeData().then(f => f.gasPrice);
    console.log("⛽ Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");

// 🔥 NATIVE TOKEN CHECK
const nativeBal = await provider.getBalance(wallet.address);
const gasEst = 1500000n * gasPrice;
console.log("💰 Native balance:", ethers.formatEther(nativeBal), "vs gas needed:", ethers.formatEther(gasEst));

if (nativeBal < gasEst) {
  throw new Error(`Insufficient native tokens for gas: ${ethers.formatEther(nativeBal)} < ${ethers.formatEther(gasEst)}`);
}

// 🔥 REAL TX with MAX GAS
console.log("🚀 SENDING REAL addLiquidity...");
    const tx = await router.addLiquidity(
      A, B, amtA, amtB, minA, minB,
      wallet.address, deadline(),
      { 
    gasLimit: 1500000n,        // MAX GAS
    gasPrice: gasPrice * 12n / 10n  // 20% higher
  }
    );

    console.log("📤 Liquidity TX sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Liquidity TX confirmed:", receipt.transactionHash);

    // 🔥 STEP 7: GET PAIR ADDRESS
    console.log("🔗 Waiting for pair creation...");
    let pair = ethers.ZeroAddress;
    for (let i = 0; i < 15; i++) {
      pair = await factory.getPair(A, B);
      if (pair !== ethers.ZeroAddress) {
        console.log("✅ Pair found:", pair);
        break;
      }
      console.log(`⏳ Waiting for pair... (${i + 1}/15)`);
      await new Promise(r => setTimeout(r, 3000));
    }

    if (pair === ethers.ZeroAddress) {
      throw new Error("❌ Pair not created after 45s");
    }

    // 🔥 STEP 8: LOCK LP TOKENS
    console.log("🔒 Locking LP tokens...");
    const lp = new ethers.Contract(pair, LP_ABI, wallet);
    const lpBal = await lp.balanceOf(wallet.address);

    if (lpBal === 0n) {
      throw new Error("❌ No LP tokens received");
    }

    console.log("💼 LP Balance:", ethers.formatEther(lpBal));
    await safeApprove(lp, LOCK_CONTRACT, lpBal);

    const locker = new ethers.Contract(LOCK_CONTRACT, LOCK_ABI, wallet);
    const name = await tokenAContract.symbol();
    
    const lockTx = await locker.createLock(name, pair, wallet.address, lpBal);
    const lockRcpt = await lockTx.wait();

    console.log("🎉 ALL DONE!");
    return {
      success: true,
      liquidityTx: receipt.transactionHash,
      pairAddress: pair,
      lpLocked: lpBal.toString(),
      lockTx: lockRcpt.transactionHash,
      amounts: {
        tokenA: ethers.formatUnits(amtA, decimalsA),
        tokenB: ethers.formatUnits(amtB, decimalsB)
      }
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
