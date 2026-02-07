const express = require("express");
const router = express.Router();
const { getAllUsers } = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

// 🔐 Admin users list
router.get("/users", protect, getAllUsers);

module.exports = router;
