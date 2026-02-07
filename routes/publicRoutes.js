const express = require("express");
const router = express.Router();
const { getPageBySlug, getAllPages } = require("../controllers/staticPageController");
const { getLaunchpadTokens }  = require("../controllers/tokenFlowController");


// 🔥 PUBLIC CMS PAGE
router.get("/pages", getAllPages);
router.get("/pages/:slug", getPageBySlug);
router.get("/launchpad/tokens", getLaunchpadTokens);


module.exports = router;
