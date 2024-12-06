const multer = require('multer');

const upload = multer({
  storage: multer.diskStorage({}),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.ms-powerpoint'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and PPTX files are allowed.'));
    }
  },
});

module.exports = upload;
