// 📁 routes/bookings.js
const express = require('express');
const router = express.Router();
const db = require('../index');

// ✅ Get all bookings for 2025
router.get('/2025', (req, res) => {
  const query = `
    SELECT b.booked_date, b.mahal_id, m.name AS mahal_name, m.price
    FROM bookings b
    JOIN banquet_halls m ON b.mahal_id = m.id
    WHERE YEAR(b.booked_date) = 2025
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    res.json(results);
  });
});

// ✅ Get bookings for a specific mahal
router.get('/2025/:mahalId', (req, res) => {
  const { mahalId } = req.params;
  db.query(
    'SELECT booked_date FROM bookings WHERE YEAR(booked_date) = 2025 AND mahal_id = ?',
    [mahalId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      res.json(results.map(r => r.booked_date));
    }
  );
});

// ✅ Create booking
router.post('/', (req, res) => {
  const { mahalId, userId, dates } = req.body;
  if (!mahalId || !userId || !Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid input' });
  }
  const values = dates.map(date => [userId, mahalId, date]);
  db.query(
    'INSERT INTO bookings (user_id, mahal_id, booked_date) VALUES ?',
    [values],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Booking failed' });
      res.json({ success: true, message: 'Booking successful', affectedRows: result.affectedRows });
    }
  );
});

module.exports = router;
