// 📁 routes/muhurtham.js
const express = require('express');
const router = express.Router();

// ✅ Static muhurtham data for April 2025
router.get('/2025/:mahalId', (req, res) => {
  const valarpirai = [2, 4, 9, 15, 22];
  const theipirai = [5, 11, 17, 23, 28];
  res.json({ valarpirai, theipirai });
});

module.exports = router;
