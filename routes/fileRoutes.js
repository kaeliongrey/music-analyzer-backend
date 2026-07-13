const express = require('express');
const multer = require('multer');
const { processFile } = require('../controllers/fileController');

const router = express.Router();

const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.post('/upload', upload.single('file'), processFile);

module.exports = router;



