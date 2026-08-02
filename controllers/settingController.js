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

    // Check if a settings row exists
    const existing = await Setting.findById(1);

    if (existing) {
      // Update only the fields provided (skip undefined)
      const updateData = {};
      if (tokenFee !== undefined)           updateData.tokenFee = tokenFee;
      if (processingFee !== undefined)      updateData.processingFee = processingFee;
      if (receiveWallet !== undefined)      updateData.receiveWallet = receiveWallet;
      if (marketCapMultiplier !== undefined) updateData.marketCapMultiplier = marketCapMultiplier;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, message: "No fields to update" });
      }

      await Setting.update(1, updateData);
    } else {
      // No settings row yet — create one with defaults
      await Setting.create({
        tokenFee:            tokenFee            ?? 0,
        processingFee:       processingFee       ?? 0,
        receiveWallet:       receiveWallet       ?? "",
        marketCapMultiplier: marketCapMultiplier ?? 1.0,
      });
    }

    return res.json({ success: true, message: "Settings updated successfully" });
  } catch (err) {
    console.error("UPDATE SETTINGS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update settings",
      detail: err.message,
    });
  }
};
