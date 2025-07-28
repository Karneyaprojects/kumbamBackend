// 📁 routes/banquets.js
const express = require('express');
const router = express.Router();
const db = require('../index'); // assumes db.js is in config/

// ✅ Get All Banquet Halls
router.get('/', (req, res) => {
  db.query('SELECT * FROM banquet_halls', (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// ✅ Get All Categories
router.get('/categories', (req, res) => {
  db.query('SELECT DISTINCT category FROM banquet_halls', (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results.map(r => r.category));
  });
});

// ✅ Get Mahal by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM banquet_halls WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json(result[0]);
  });
});

module.exports = router;
