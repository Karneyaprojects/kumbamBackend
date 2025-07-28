const express = require('express');
const router = express.Router();
const db = require('../index'); // Adjust if needed

router.get('/muhurtham-2025/:id', (req, res) => {
  const { id } = req.params;

  db.query(
    'SELECT valarpirai_dates, theipirai_dates FROM muhurtham_dates_2025 WHERE mahal_id = ?',
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });

      if (result.length === 0) return res.status(404).json({ message: 'No muhurtham dates found' });

      const valarpirai = JSON.parse(result[0].valarpirai_dates);
      const theipirai = JSON.parse(result[0].theipirai_dates);

      res.json({ valarpirai, theipirai });
    }
  );
});

module.exports = router;
