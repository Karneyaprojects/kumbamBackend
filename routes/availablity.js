const express = require('express');
const router = express.Router();
const db = require('../index'); // Assuming db = mysql.createPool(...).promise()

router.get('/:hallId/:month/:year', async (req, res) => {
  const { hallId, month, year } = req.params;

  console.log("📥 Incoming Request:", hallId, month, year);

  try {
    const [hallRows] = await db.query(
      'SELECT * FROM banquet_halls WHERE id = ?', [hallId]
    );
    console.log("🏛️ Hall Rows:", hallRows);

    if (hallRows.length === 0) {
      console.log("❌ No hall found for id:", hallId);
      return res.status(404).json({ message: 'Hall not found' });
    }

    const [bookings] = await db.query(
      `SELECT _booking_date AS booking_date 
       FROM bookings 
       WHERE hall_id = ? 
         AND MONTH(_booking_date) = ? 
         AND YEAR(_booking_date) = ?`,
      [hallId, month, year]
    );

    console.log("📆 Bookings:", bookings);

    res.json({ hall: hallRows[0], bookings });

  } catch (err) {
    console.error('🔥 Full Error in availability route:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
