const db = require("../models");
const StaticPage = db.StaticPage;

// LIST
exports.getPages = async (req, res) => {
  const pages = await StaticPage.findAll({ order: [["id", "DESC"]] });
  res.json(pages);
};

// CREATE
exports.createPage = async (req, res) => {
  const { title, slug, content } = req.body;
  const page = await StaticPage.create({ title, slug, content });
  res.json(page);
};

// GET SINGLE
exports.getPageById = async (req, res) => {
  const page = await StaticPage.findById(req.params.id);
  res.json(page);
};

// UPDATE
exports.updatePage = async (req, res) => {
  const { title, slug, content } = req.body;
  await StaticPage.update(req.params.id,
    { title, slug, content }
  );
  res.json({ success: true });
};

// DELETE
exports.deletePage = async (req, res) => {
  await StaticPage.delete(req.params.id);
  res.json({ success: true });
};
// PUBLIC PAGE BY SLUG
exports.getPageBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const page = await StaticPage.findOne({
      where: { slug },
    });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Page not found",
      });
    }

    res.json(page);
  } catch (error) {
    console.error("STATIC PAGE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getAllPages = async (req, res) => {
  try {
    const pages = await StaticPage.findAll({
      attributes: ["id", "slug"],
      order: [["id", "ASC"]],
    });

    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5000";

    const data = pages.map((page) => ({
      id: page.id,
      url: `${baseUrl}/${page.slug}`,
    }));

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

