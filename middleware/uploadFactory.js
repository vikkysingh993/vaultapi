const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createUploader = (folder) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = `uploads/${folder}`;

      // auto create folder if not exists
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
      const unique =
        Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    },
  });

  const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 },
  });
};

module.exports = createUploader;
