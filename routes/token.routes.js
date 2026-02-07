const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadLogo");
const { createToken, getAllTokens, uploadTokenData} = require("../controllers/token.controller");

router.post("/create-token", createToken);
router.post(
  "/upload-token",
  upload.single("image"),
  uploadTokenData
);

router.get("/tokens", protect, getAllTokens);


module.exports = router;
