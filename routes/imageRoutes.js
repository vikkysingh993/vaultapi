const express = require("express");
const { getImage } = require("../controllers/imageController");
const router = express.Router();

router.get("/:id", getImage);

module.exports = router;
