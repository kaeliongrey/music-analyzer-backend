const { parseALS } = require('../utils/alsParser');
const { parseFLP } = require('../utils/flpParser');
const path = require('path');
const fs = require('fs');

exports.processFile = async (req, res) => {
  try {
    const filePath = path.join(__dirname, '..', req.file.path);
    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    let plugins = [];

    if (fileExtension === '.als') {
      plugins = await parseALS(filePath);
    } else if (fileExtension === '.flp') {
      plugins = await parseFLP(filePath);
    } else {
      return res.status(400).json({ error: 'Unsupported file type.' });
    }

    fs.unlinkSync(filePath);

    res.status(200).json({ plugins });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process the file.' });
  }
};

