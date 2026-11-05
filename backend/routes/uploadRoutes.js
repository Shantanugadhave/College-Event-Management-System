const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No image file uploaded or invalid format',
      errors: ['File is required and must be JPG or PNG under 5MB'],
    });
  }

  const fileUrl = `/uploads/${req.file.filename}`;

  res.status(200).json({
    success: true,
    message: 'Image uploaded successfully',
    data: {
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
  });
});

module.exports = router;
