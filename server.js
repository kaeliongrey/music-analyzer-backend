require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fileRoutes = require('./routes/fileRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/api/files', fileRoutes);

app.get('/', (req, res) => {
  res.send('🎵 Music Analyzer Backend is Running 🚀');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});




