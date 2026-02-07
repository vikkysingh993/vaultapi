const db = require("../models");
const User = db.User;

// 🔹 GET ALL USERS
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
        where: {
        role: 0, // ✅ ONLY normal users (exclude admin)
      },
      attributes: [
        "id",
        "name",
        "email",
        "walletAddress",
        "primaryWallet",
        "chainId",
        "chainName",
        "walletType",
        "role",
        "occTokenBalance",
        "createdAt",
      ],
      order: [["id", "DESC"]],
    });

    return res.json({
      success: true,
      total: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};
