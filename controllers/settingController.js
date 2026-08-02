const db = require("../models");
const Setting = db.Setting;

/**
 * GET /api/admin/settings
 */
exports.getSettings = async (req, res) => {
  try {
    const setting = await Setting.findById(1);

    return res.json({
      success: true,
      data: setting,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to load settings",
    });
  }
};

exports.getPublicSettings = async (req, res) => {
  try {
    const setting = await Setting.findById(1);
    return res.json({
      success: true,
      data: {
        marketCapMultiplier: setting ? setting.marketCapMultiplier : 1.0,
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to load public settings" });
  }
};

/**
 * PUT /api/admin/settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const { tokenFee, processingFee, receiveWallet, marketCapMultiplier } = req.body;

    if (!receiveWallet) {
      return res.status(400).json({
        success: false,
        message: "Wallet address is required",
      });
    }

    await Setting.update(1, { tokenFee, processingFee, receiveWallet, marketCapMultiplier });

    return res.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to update settings",
    });
  }
};
