const express = require('express');
const router = express.Router();
const { getBalance, transferTokens, updateWalletAddresses, getTransferHistory, claimTokens } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');
const { route } = require('./authRoutes');

// Balance API - Logged-in user ka balance
router.get("/balance/:walletAddress", protect, getBalance);


// Transfer API - Logged-in user transfer kare
router.post('/transfer', protect, transferTokens);

router.post('/update-addresses', protect, updateWalletAddresses);
router.get("/transfer-history", protect, getTransferHistory);

router.post("/claim", protect, claimTokens);



module.exports = router;
