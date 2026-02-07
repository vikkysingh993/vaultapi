const db = require("../models");
const Setting = db.Setting;

/**
 * GET /api/admin/settings
 */
exports.getSettings = async (req, res) => {
  try {
    const setting = await Setting.findOne({ where: { id: 1 } });

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

/**
 * PUT /api/admin/settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const { tokenFee, processingFee, receiveWallet } = req.body;

    if (!receiveWallet) {
      return res.status(400).json({
        success: false,
        message: "Wallet address is required",
      });
    }

    await Setting.update(
      { tokenFee, processingFee, receiveWallet },
      { where: { id: 1 } }
    );

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
