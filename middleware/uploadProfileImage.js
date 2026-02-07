// middleware/uploadProfileImage.js
const createUploader = require("./uploadFactory");
module.exports = createUploader("profile");
