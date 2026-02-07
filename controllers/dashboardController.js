const db = require("../models");
const { Sequelize } = require('sequelize'); // 👈 Add this
const User = db.User;
const Token = db.Token;
const TokenTransfer = db.TokenTransfer;

/**
 * GET /api/admin/dashboard
 * 🔐 Admin Dashboard Stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const usersResult = await db.pool.query(
      `SELECT COUNT(*)::int AS total FROM users`
    );

    const tokensResult = await db.pool.query(
      `SELECT COUNT(*)::int AS total FROM tokens`
    );

    const claimedResult = await db.pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM token_transfers
      WHERE status = 'CLAIMED'
        AND "isClaimed" = true
      `
    );

    return res.json({
      success: true,
      data: {
        users: usersResult.rows[0].total,
        tokens: tokensResult.rows[0].total,
        claimedPlans: claimedResult.rows[0].total,
      },
    });

  } catch (error) {
    console.error("❌ Dashboard API Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard data",
    });
  }
};



