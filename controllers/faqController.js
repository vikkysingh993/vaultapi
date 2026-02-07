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

    const faq = await Faq.findByPk(id);
    if (!faq) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }

    await faq.update({ question, answer, status });

    res.json({
      success: true,
      message: "FAQ updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ======================
   DELETE FAQ
====================== */
exports.deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;

    const faq = await Faq.findByPk(id);
    if (!faq) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }

    await faq.destroy();

    res.json({
      success: true,
      message: "FAQ deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
