const crypto = require("crypto");
const db = require('../models');
const Token = db.Coin;


exports.createToken = async (req, res) => {
  try {
    const { name, symbol, supply, chain, owner } = req.body;

    // 🔥 DEMO TOKEN ADDRESS
    const tokenAddress =
      "0x" + crypto.randomBytes(20).toString("hex");

    const txHash =
      "0x" + crypto.randomBytes(32).toString("hex");

    // 👉 DB SAVE (pseudo – model ke hisaab se adjust karna)
    await Token.create({
      name,
      symbol,
      supply,
      chain,
      owner,
      tokenAddress,
      txHash,
      status: "CREATED"
    });

    res.json({
      success: true,
      tokenAddress,
      txHash
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.uploadTokenData = async (req, res) => {
  const { tokenAddress } = req.body;

  await Token.update(
    { image: req.file.path },
    { where: { tokenAddress } }
  );

  res.json({ success: true });
};

// 🔹 GET ALL LAUNCHED TOKENS
exports.getAllTokens = async (req, res) => {
  try {
    const tokens = await Token.findAll({
      attributes: [
        "id",
        "name",
        "symbol",
        "supply",
        "chain",
        "tokenAddress",
        "creatorWallet",
        "feePaid",
        "pairAddress",
        "lpLocked",
        "status",
        "createdAt",
      ],
      order: [["id", "DESC"]],
    });

    return res.json({
      success: true,
      total: tokens.length,
      data: tokens,
    });
  } catch (error) {
    console.error("Get tokens error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch tokens",
    });
  }
};
