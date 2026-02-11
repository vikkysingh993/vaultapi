const express = require("express");
const router = express.Router();
const {
  getPages,
  createPage,
  getPageById,
  updatePage,
  deletePage,
  getPageBySlug
} = require("../controllers/staticPageController");

const { protect, admin } = require("../middleware/authMiddleware");

router.get("/", protect, admin, getPages);
router.post("/", protect, admin, createPage);
router.get("/:id", protect, admin, getPageById);
router.put("/:id", protect, admin, updatePage);
router.delete("/:id", protect, admin, deletePage);
router.get("/:slug", getPageBySlug);


module.exports = router;
