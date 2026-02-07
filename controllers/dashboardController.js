const db = require("../models");

const User = db.User;
const Token = db.Token;
const TokenTransfer = db.TokenTransfer;

/**
 * GET /api/admin/dashboard
 * 🔐 Admin Dashboard Stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // 👤 Total users
    const totalUsers = await User.count();

    // 🪙 Total launched tokens
    const totalTokens = await Token.count();

    // 🔒 Total claimed stake plans
    const claimedPlans = await TokenTransfer.count({
      where: {
        status: "CLAIMED", // 👈 important
        isClaimed: true,
      },
    });

    return res.json({
      success: true,
      data: {
        users: totalUsers,
        tokens: totalTokens,
        claimedPlans: claimedPlans,
      },
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard data",
    });
  }
};
