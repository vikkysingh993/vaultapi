const express = require("express");
const router = express.Router();

const {
  getAllFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
} = require("../controllers/faqController");

const { protect } = require("../middleware/authMiddleware");

/* ADMIN FAQ ROUTES */
router.get("/faqs", protect, getAllFaqs);
router.post("/faqs", protect, createFaq);
router.put("/faqs/:id", protect, updateFaq);
router.delete("/faqs/:id", protect, deleteFaq);

module.exports = router;
