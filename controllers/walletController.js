const { ethers } = require('ethers');
const db = require('../models');
const { stack } = require('sequelize/lib/utils');
const User = db.User;
const Plan = db.Plan;
const TokenTransfer = db.TokenTransfer;


// RPC URL aur Token Configuration
const RPC_URL = process.env.RPC_URL_SONIC || "https://rpc.soniclabs.com";
const TOKEN_ADDRESS = process.env.VITE_OCC_TOKEN_ADDRESS || "0x307Ad911cF5071be6Aace99Cb2638600212dC657";

// Provider setup with proper network config
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ERC20 ABI
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

// @desc    Get balance of logged-in user
// @route   GET /api/wallet/balance
// @access  Private (Protected)
const getBalance = async (req, res) => {
  try {
    // âœ… wallet address from URL param
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: "walletAddress parameter is required"
      });
    }

    const address = walletAddress.trim();

    // ==========================
    // ADDRESS VALIDATION
    // ==========================
    const isEVMAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
    const isSolanaAddress = /^[1-9A-HJ-NP-Z]{44}$/.test(address);

    if (!isEVMAddress && !isSolanaAddress) {
      return res.status(400).json({
        success: false,
        error:
          "Unsupported address format. Supported chains: Ethereum, Polygon, Base, Sonic Mainnet, Solana"
      });
    }

    // âŒ Solana not supported here
    if (!isEVMAddress) {
      return res.status(400).json({
        success: false,
        error: "Solana balance not supported in this API"
      });
    }

    // ==========================
    // ERC20 BALANCE
    // ==========================
    const token = new ethers.Contract(
      TOKEN_ADDRESS,
      ERC20_ABI,
      provider
    );

    let decimals;
    let balance;

    try {
      decimals = await token.decimals();

      const balanceCall = await provider.call({
        to: TOKEN_ADDRESS,
        data: token.interface.encodeFunctionData("balanceOf", [address])
      });

      const decoded = token.interface.decodeFunctionResult(
        "balanceOf",
        balanceCall
      );

      balance = decoded[0];
    } catch (innerErr) {
      console.log("Fallback balanceOf:", innerErr.message);
      decimals = await token.decimals();
      balance = await token.balanceOf(address);
    }

    return res.json({
      success: true,
      address,
      balance: ethers.formatUnits(balance, decimals),
      rawBalance: balance.toString()
    });

  } catch (err) {
    console.error("Balance error:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};


// @desc    Transfer tokens from logged-in user
// @route   POST /api/wallet/transfer
// @access  Private (Protected)
const transferTokens = async (req, res) => {
  try {
    const { stackId, amount, privateKey } = req.body;

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
    }


    if (!amount || !privateKey) {
      return res.status(400).json({
        success: false,
        error: "amount and privateKey required"
      });
    }

    const plan = await Plan.findById(stackId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: "Invalid plan (stakeId)",
      });
    }

    // 🔹 Calculate endDate = today + plan.months
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.months);
    // 🔒 FORCE NUMBER CONVERSION
    const price = Number(plan.price);
    const apy = Number(plan.apy);
    const months = Number(plan.months);

    // 🛑 HARD GUARD
    if (
      Number.isNaN(price) ||
      Number.isNaN(apy) ||
      Number.isNaN(months)
    ) {
      throw new Error("Invalid plan data for claim calculation");
    }

    // 🧮 CALCULATION
    const interest = price * (apy / 100) * (months / 12);

    // ❗ VERY IMPORTANT: + se pehle ensure number
    const claimableAmount = Number((price + interest).toFixed(2));

    const to = process.env.FIXED_WALLET_ETH;

    if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
      return res.status(400).json({
        success: false,
        error: "Invalid recipient address"
      });
    }

    // ðŸ”‘ Wallet ONLY from private key
    let userWallet;
    try {
      userWallet = new ethers.Wallet(privateKey, provider);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: "Invalid private key"
      });
    }

    const transaction = await TokenTransfer.create({
      stakeId: stackId,
      userId,
      fromAddress: userWallet.address,
      toAddress: to,
      amount: amount.toString(),
      tokenaddress: TOKEN_ADDRESS,
      status: "PENDING",
      startDate,
      endDate,
      claimable_amount : claimableAmount,
    });
    // Token contract
    const token = new ethers.Contract(
      TOKEN_ADDRESS,
      ERC20_ABI,
      userWallet
    );

    const decimals = await token.decimals();

    // ðŸš€ Transfer
    const tx = await token.transfer(
      to,
      ethers.parseUnits(amount.toString(), decimals)
    );

    await tx.wait();

    await TokenTransfer.update(transaction.id,
      {
        status: "SUCCESS",
        txHash: tx.hash
      },
    );

    return res.json({
      success: true,
      from: userWallet.address,
      to,
      amount,
      txHash: tx.hash
    });

  } catch (err) {
    console.error("Transfer error:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};



const updateWalletAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    let { walletAddress, walletAddresses } = req.body;

    let finalAddresses = [];

    // 🔥 Case 1: walletAddresses array aaya
    if (Array.isArray(walletAddresses)) {
      finalAddresses = walletAddresses;
    }

    // 🔥 Case 2: single walletAddress string aaya
    else if (typeof walletAddress === "string") {
      finalAddresses = [walletAddress];
    }

    else {
      return res.status(400).json({
        success: false,
        message: "walletAddress or walletAddresses required",
      });
    }

    // Normalize all addresses
    finalAddresses = finalAddresses
      .map(addr => addr.trim().toLowerCase())
      .filter(Boolean);

    if (finalAddresses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid addresses provided",
      });
    }

    // Save as JSON string
    await User.update(userId, {
      walletAddress: JSON.stringify(finalAddresses),
    });

    return res.json({
      success: true,
      message: "Wallet addresses updated successfully",
      data: {
        walletAddresses: finalAddresses,
      },
    });

  } catch (error) {
    console.error("❌ Wallet update error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




const getTransferHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page || 1);
    const limit = parseInt(req.query.limit || 10);
    const offset = (page - 1) * limit;

    // 🔹 MAIN DATA QUERY
    const dataQuery = `
      SELECT 
        tt.id,
        tt."stakeId",
        tt.amount,
        tt."fromAddress",
        tt."toAddress",
        tt."txHash",
        tt.status,
        tt.chain,
        tt."isClaimed",
        tt."createdAt" AS "startDate",
        tt."endDate",
        tt."claimable_amount",
        p.months,
        p.price,
        p.status AS "planStatus"
      FROM "token_transfers" tt
      LEFT JOIN "plans" p ON p.id = tt."stakeId"
      WHERE tt."userId" = $1
        AND tt.type = 'TRANSFER'
      ORDER BY tt."createdAt" DESC
      LIMIT $2 OFFSET $3
    `;

    // 🔹 COUNT QUERY
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM "token_transfers"
      WHERE "userId" = $1
        AND type = 'TRANSFER'
    `;

    const dataResult = await db.pool.query(dataQuery, [
      userId,
      limit,
      offset,
    ]);

    const countResult = await db.pool.query(countQuery, [userId]);

    return res.json({
      success: true,
      total: countResult.rows[0].total,
      page,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
      data: dataResult.rows.map((t) => ({
        id: t.id,
        stakeId: t.stakeId,
        amount: t.amount,
        fromAddress: t.fromAddress,
        toAddress: t.toAddress,
        txHash: t.txHash,
        status: t.status,
        chain: t.chain,
        isClaimed: t.isClaimed,
        startDate: t.startDate,
        endDate: t.endDate,
        claimable_amount: t.claimable_amount,
        plan: t.months
          ? {
              months: t.months,
              price: t.price,
              status: t.planStatus,
            }
          : null,
      })),
    });

  } catch (err) {
    console.error("❌ History API error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};


const claimTokens = async (req, res) => {
  try {
    const { transferId } = req.body;
    const userId = req.user.id;

    // 1️⃣ Original transfer fetch
    const original = await TokenTransfer.findById(transferId);

    if (!original) {
      return res.status(404).json({
        success: false,
        error: "Transfer not found",
      });
    }

    // 2️⃣ Ownership check
    if (original.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: "Not your transfer",
      });
    }

    // 3️⃣ One-time claim lock
    if (original.isClaimed) {
      return res.status(400).json({
        success: false,
        error: "Already claimed",
      });
    }

    // 4️⃣ Claim only after endDate
    if (!original.endDate || new Date() < new Date(original.endDate)) {
      return res.status(400).json({
        success: false,
        error: "Claim allowed only after plan expiry",
      });
    }

    // 5️⃣ Address swap
    const fromAddress = original.toAddress;   // user
    const toAddress = original.fromAddress;   // company

    // 🔐 6️⃣ Private key backend se
    const privateKey = await getPrivateKeyByWallet(fromAddress);

    if (!privateKey) {
      return res.status(400).json({
        success: false,
        error: "Private key not found for claim wallet",
      });
    }

    const wallet = new ethers.Wallet(privateKey, provider);

    // 7️⃣ Create CLAIM record
    const claimTx = await TokenTransfer.create({
      userId,
      stakeId: original.stakeId,
      fromAddress,
      toAddress,
      amount: original.amount,
      chain: original.chain || "ETH",
      status: "CLAIMED",
      type: "CLAIM",
      isClaimed: true,
    });

    // 8️⃣ Blockchain transfer
    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);
    const decimals = await token.decimals();

    const tx = await token.transfer(
      toAddress,
      ethers.parseUnits(original.amount.toString(), decimals)
    );

    await tx.wait();

    // 9️⃣ Update CLAIM record
    await claimTx.update({
      txHash: tx.hash,
    });

    // 🔟 Lock ORIGINAL transfer
    await original.update({
      isClaimed: true,
      claimTransferId: claimTx.id,
    });

    return res.json({
      success: true,
      message: "Claim successful",
      claimTransferId: claimTx.id,
      txHash: tx.hash,
    });

  } catch (err) {
    console.error("Claim error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};



module.exports = {
  getBalance,
  transferTokens,
  updateWalletAddresses,
  getTransferHistory,
  claimTokens
};
