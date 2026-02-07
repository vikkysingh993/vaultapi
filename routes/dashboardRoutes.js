const express = require("express");
const router = express.Router();

const { getDashboardStats } = require("../controllers/dashboardController");
const { protect, admin } = require("../middleware/authMiddleware");

// 📊 Dashboard stats
router.get("/dashboard", protect, admin, getDashboardStats);

module.exports = router;
