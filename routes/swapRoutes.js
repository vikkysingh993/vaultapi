const express = require("express");
const { saveSwap } = require("../controllers/swapController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, saveSwap);

module.exports = router;
