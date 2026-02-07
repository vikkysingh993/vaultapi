const express = require("express");
const router = express.Router();

const {
  authLogin,
  connectWallet,
  disconnectWallet,
  adminLogin,
  getProfile,
  updateProfile,
  changePassword,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");
const uploadProfileImage = require("../middleware/uploadProfileImage");

router.post("/auth-login", authLogin);
router.post("/connect-wallet", connectWallet);
router.post("/disconnect-wallet", protect, disconnectWallet);
router.post("/admin-login", adminLogin);

router.get("/profile", protect, getProfile);
router.put(
  "/profile",
  protect,
  uploadProfileImage.single("profileImage"),// ✅ now function
  updateProfile
);

router.post("/change-password", protect, changePassword);

module.exports = router;
