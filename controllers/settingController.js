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

    // Helper: convert empty string / undefined to null for numeric fields
    const toNum = (v) => (v === "" || v === undefined || v === null) ? null : parseFloat(v);
    const toStr = (v) => (v === undefined ? null : v);

    const safeTokenFee           = toNum(tokenFee);
    const safeProcessingFee      = toNum(processingFee);
    const safeMarketCapMultiplier = toNum(marketCapMultiplier);
    const safeReceiveWallet      = toStr(receiveWallet);

    // Check if a settings row exists
    const existing = await Setting.findById(1);

    if (existing) {
      // Only update fields that were actually provided
      const updateData = {};
      if (safeTokenFee !== null)            updateData.tokenFee = safeTokenFee;
      if (safeProcessingFee !== null)       updateData.processingFee = safeProcessingFee;
      if (safeReceiveWallet !== null)       updateData.receiveWallet = safeReceiveWallet;
      if (safeMarketCapMultiplier !== null) updateData.marketCapMultiplier = safeMarketCapMultiplier;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, message: "No fields to update" });
      }

      await Setting.update(1, updateData);
    } else {
      // No settings row yet — create one with safe defaults
      await Setting.create({
        tokenFee:            safeTokenFee            ?? 0,
        processingFee:       safeProcessingFee       ?? 0,
        receiveWallet:       safeReceiveWallet       ?? "",
        marketCapMultiplier: safeMarketCapMultiplier ?? 1.0,
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
