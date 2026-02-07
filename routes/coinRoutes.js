const express = require("express");
const router = express.Router();
const uploadLogo = require("../middleware/uploadLogo");
const { createCoin } = require("../controllers/coinController");

router.post("/create-token", uploadLogo.single("logo"), createCoin);

module.exports = router;
