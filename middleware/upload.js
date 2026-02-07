const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: "uploads/profile",
  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
});

module.exports = upload;
