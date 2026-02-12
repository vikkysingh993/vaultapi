const express = require("express");
const router = express.Router();
const { getPageBySlug, getAllPages } = require("../controllers/staticPageController");
const { getLaunchpadTokens }  = require("../controllers/tokenFlowController");
const { getAllFaqs } = require("../controllers/faqController");


// 🔥 PUBLIC CMS PAGE
router.get("/pages", getAllPages);
router.get("/pages/:slug", getPageBySlug);
router.get("/launchpad/tokens", getLaunchpadTokens);
router.get("/faqs", getAllFaqs);


module.exports = router;
