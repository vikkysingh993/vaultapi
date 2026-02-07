const { TokenSwap } = require("../models");

exports.saveSwap = async (req, res) => {
  try {
    const {
      walletAddress,
      swapType,
      tokenIn,
      tokenOut,
      amountIn,
      txHash,
      chainId
    } = req.body;

    if (!walletAddress || !txHash) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    await TokenSwap.create({
      userId: req.user?.id || null,
      walletAddress,
      swapType,
      tokenIn,
      tokenOut,
      amountIn,
      txHash,
      chainId: chainId || 11155111,
      status: "SUCCESS"
    });

    res.json({ success: true, message: "Swap stored successfully" });
  } catch (err) {
    console.error("SAVE SWAP ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
