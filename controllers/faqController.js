const { Faq } = require("../models");

/* ======================
   GET ALL FAQS
====================== */
exports.getAllFaqs = async (req, res) => {
  try {
    const faqs = await Faq.findAll({
      order: [["id", "DESC"]],
    });

    res.json({
      success: true,
      data: faqs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ======================
   CREATE FAQ
====================== */
exports.createFaq = async (req, res) => {
  try {
    const { question, answer, status } = req.body;

    const faq = await Faq.create({
      question,
      answer,
      status,
    });

    res.json({
      success: true,
      message: "FAQ added successfully",
      data: faq,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ======================
   UPDATE FAQ
====================== */
exports.updateFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, status } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "FAQ id is required",
      });
    }

    // 🔍 check exists
    const faq = await Faq.findById(id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    // ✅ pg-style update
    const updatedFaq = await Faq.update(id, {
      question,
      answer,
      status,
    });

    res.json({
      success: true,
      message: "FAQ updated successfully",
      data: updatedFaq,
    });
  } catch (err) {
    console.error("❌ updateFaq error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


/* ======================
   DELETE FAQ
====================== */
exports.deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "FAQ id is required",
      });
    }

    // 🔍 check exists
    const faq = await Faq.findById(id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    // ❌ Sequelize destroy() nahi
    await Faq.delete(id);

    res.json({
      success: true,
      message: "FAQ deleted successfully",
    });
  } catch (err) {
    console.error("❌ deleteFaq error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

