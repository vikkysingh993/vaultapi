const express = require("express");
const uploadTokenLogo = require("../middleware/uploadLogo");

const { createTokenFlow,getAllTokens, getTokenByAddress} = require("../controllers/tokenFlowController");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

router.post(
  "/create-token-flow",
  protect,
  uploadTokenLogo.single("logo"),
  createTokenFlow
);
router.get("/tokens", protect, getAllTokens);
router.get("/tokens/by-address/:address", getTokenByAddress);



module.exports = router;
