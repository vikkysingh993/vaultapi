const jwt = require("jsonwebtoken");
const db = require("../models");
const User = db.User;

/**
 * 🔐 Protect middleware
 * - Verifies JWT
 * - Attaches user to req
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1️⃣ Token check
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token provided",
      });
    }

    // 2️⃣ Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired",
          code: "JWT_EXPIRED",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // 3️⃣ Get user from DB
    const user = await User.findById(decoded.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // 4️⃣ Attach user & continue
    req.user = user;
    next();

  } catch (error) {
    console.error("❌ Auth error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

/**
 * 👑 Admin middleware
 * - Requires role === 1
 */
const admin = (req, res, next) => {
  if (req.user && req.user.role === 1) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Not authorized, admin access required",
    });
  }
};

module.exports = { protect, admin };
