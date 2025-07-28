  // 📁 server.js
  const express = require('express');
  const mysql = require('mysql2');
  const cors = require('cors');
  const bcrypt = require('bcrypt');
  const nodemailer = require('nodemailer');
  const dotenv = require('dotenv');
  dotenv.config();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static('uploads'));



  // ✅ MySQL Connection Pool
  const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // ✅ Test DB Connection
  db.getConnection((err, connection) => {
    if (err) {
      console.error('❌ DB pool connection error:', err);
    } else {
      console.log('✅ Connected to Railway DB via pool!');
      connection.release();
    }
  });

  // ✅ Nodemailer Setup
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // ✅ Routes
  // const availabilityRoute = require('./routes/availablity');
  // app.use('/api/availability', availabilityRoute);

  // ✅ User Signup
  app.post('/api/signup', async (req, res) => {
    const { fullName, phone, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
      if (err) return res.status(500).json({ success: false });
      if (results.length > 0) return res.json({ success: false, message: 'User already exists' });

      db.query(
        'INSERT INTO users (full_name, phone, email, password) VALUES (?, ?, ?, ?)',
        [fullName, phone, email, hashedPassword],
        err => {
          if (err) return res.json({ success: false, message: 'Signup failed' });
          res.json({ success: true });
        }
      );
    });
  });

  // ✅ User Login & OTP
  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err || results.length === 0) return res.json({ success: false, message: 'User not found' });

      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.json({ success: false, message: 'Incorrect password' });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60000);

      db.query(
        'INSERT INTO otp_verification (email, otp, expires_at) VALUES (?, ?, ?)',
        [email, otp, expiresAt],
        err => {
          if (err) return res.json({ success: false });

          transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your OTP - KUMBAM',
            text: `Your OTP is ${otp}`,
          }, (err) => {
            if (err) return res.json({ success: false });
            res.json({ success: true, token: otp, phone: user.phone, username: user.full_name });
          });
        }
      );
    });
  });

  // ✅ OTP Verification
  app.post('/api/verify-email-otp', (req, res) => {
    const { email, otp } = req.body;
    db.query('SELECT * FROM otp_verification WHERE email = ? ORDER BY id DESC LIMIT 1', [email], (err, results) => {
      if (err || results.length === 0) return res.json({ success: false });
      const record = results[0];
      const now = new Date();
      if (record.otp !== otp || now > record.expires_at) return res.json({ success: false });
      res.json({ success: true });
    });
  });

  // ✅ Forgot & Reset Password
  app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);

    db.query('INSERT INTO otp_verification (email, otp, expires_at) VALUES (?, ?, ?)', [email, otp, expiresAt], (err) => {
      if (err) return res.json({ success: false });

      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your KUMBAM Password Reset OTP',
        text: `Your OTP is ${otp}`,
      }, (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
      });
    });
  });

  app.post('/api/reset-password', async (req, res) => {
    const { email, otp, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query('SELECT * FROM otp_verification WHERE email = ? ORDER BY id DESC LIMIT 1', [email], (err, results) => {
      if (err || results.length === 0) return res.json({ success: false });
      const record = results[0];
      const now = new Date();
      if (record.otp !== otp || now > record.expires_at) return res.json({ success: false });

      db.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
      });
    });
  });
  app.post('/api/resend-email-otp', (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ success: false, message: 'Email required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60000); // 5 minutes

  db.query(
    'INSERT INTO otp_verification (email, otp, expires_at) VALUES (?, ?, ?)',
    [email, otp, expiresAt],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'DB Error' });

      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Resend OTP - KUMBAM',
        text: `Your OTP is ${otp}`,
      }, (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Failed to send OTP' });
        res.json({ success: true, message: 'OTP sent successfully' });
      });
    }
  );
});


  // ✅ Banquet Endpoints
  app.get('/api/banquets', (req, res) => {
    db.query('SELECT * FROM banquet_halls', (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
    });
  });

  app.get('/api/categories', (req, res) => {
    db.query('SELECT DISTINCT category FROM banquet_halls', (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results.map(r => r.category));
    });
  });

  // ✅ Booking Insert
  app.get('/banquets/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM banquet_halls WHERE id = ?', [id], (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.json(result[0]);
    });
  });

  // Get Booked Dates
  // app.get('/api/bookings', (req, res) => {
  //   const { mahalId, month, year } = req.query;
  //   const start = `${year}-${month.padStart(2, '0')}-01`;
  //   const end = `${year}-${month.padStart(2, '0')}-31`;

  //   db.query(
  //     `SELECT booked_date FROM bookings WHERE mahal_id = ? AND booked_date BETWEEN ? AND ?`,
  //     [mahalId, start, end],
  //     (err, result) => {
  //       if (err) return res.status(500).json({ error: err });
  //       res.json(result.map(r => r.booked_date));
  //     }
  //   );
  // });

  // // Post Booking
  // app.post('/api/bookings', (req, res) => {
  //   const { mahalId, userId, dates } = req.body;
  //   const insertValues = dates.map(date => [userId, mahalId, date]);

  //   db.query(
  //     'INSERT INTO bookings (user_id, mahal_id, booked_date) VALUES ?',
  //     [insertValues],
  //     (err, result) => {
  //       if (err) return res.status(500).json({ error: err });
  //       res.json({ success: true, message: 'Booking confirmed' });
  //     }
  //   );
  // });

//   app.post('/api/initiate-payment', (req, res) => {
//   const { hallId, hallName, amount, selectedDates } = req.body;

//   if (!hallId || !amount || !hallName || !selectedDates) {
//     return res.status(400).json({ success: false, message: 'Missing required fields.' });
//   }

//   const transactionId = `TXN_${Date.now()}`;
//   const merchantId = process.env.PHONEPE_CLIENT_ID;
//   const saltKey = process.env.PHONEPE_CLIENT_SECRET;
//   const callbackUrl = process.env.CALLBACK_URL;

//   const payload = {
//     merchantId,
//     merchantTransactionId: transactionId,
//     merchantUserId: `USER_${hallId}`,
//     amount: parseInt(amount * 100),
//     redirectUrl: callbackUrl,
//     redirectMode: 'POST',
//     callbackUrl,
//     paymentInstrument: {
//       type: 'UPI_INTENT',
//     },
//   };

//   const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
//   const xVerify = crypto
//     .createHash('sha256')
//     .update(base64Payload + '/pg/v1/pay' + saltKey)
//     .digest('hex') + '###1';

//   const upiUrl = `upi://pay?pa=phonepe@upi&pn=${hallName}&tid=${transactionId}&tr=${transactionId}&am=${amount}&cu=INR`;

//   res.json({
//     success: true,
//     paymentUrl: upiUrl,
//     transactionId,
//   });
// });

  // ✅ Book Now Endpoint
app.post('/api/book-now', (req, res) => {
  const { hallId, name, phone, email, eventType, address, dates, totalPrice } = req.body;

  // ✅ 1. Basic field validation
  if (!hallId || !name || !phone || !email || !eventType || !address || !dates || !totalPrice) {
    return res.status(400).json({ success: false, message: 'Please fill all fields.' });
  }

  // ✅ 2. Phone number format check (10 digits)
  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ success: false, message: 'Invalid phone number.' });
  }

  // ✅ 3. Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email format.' });
  }

  // ✅ 4. Prevent duplicate bookings on same hall & date(s)
  const dateList = dates.split(',').map(d => d.trim());

  const checkQuery = `
    SELECT * FROM bookings 
    WHERE hall_id = ? AND booking_dates IN (${dateList.map(() => '?').join(',')})
  `;

  db.query(checkQuery, [hallId, ...dateList], (checkErr, existing) => {
    if (checkErr) {
      console.error('❌ Duplicate Check Error:', checkErr);
      return res.status(500).json({ success: false, message: 'Server error checking existing bookings.' });
    }

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Selected date(s) already booked.' });
    }

    // ✅ 5. Insert into bookings table
    const insertQuery = `
      INSERT INTO bookings (hall_id, name, phone, email, event_type, address, booking_dates, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(insertQuery, [hallId, name, phone, email, eventType, address, dates, totalPrice], (insertErr, result) => {
      if (insertErr) {
        console.error('❌ Booking Error:', insertErr);
        return res.status(500).json({ success: false, message: 'Failed to save booking.' });
      }

      // ✅ 6. Send confirmation email to admin (optional)
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.NOTIFY_EMAIL || 'youradmin@example.com',
        subject: 'New Booking - Kumbam',
        text: `New booking by ${name} (${email}) on ${dates} for ${eventType}. Contact: ${phone}.`,
      });

      res.status(200).json({
        success: true,
        message: 'Booking successful',
        bookingId: result.insertId,
      });
    });
  });
});


  app.get('/api/muhurtham-2025/:id', (req, res) => {
  const { id } = req.params;

  db.query(
    'SELECT valarpirai_dates, theipirai_dates FROM muhurtham_dates_2025 WHERE mahal_id = ?',
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });

      if (result.length === 0) {
        return res.status(404).json({ message: 'No muhurtham dates found' });
      }

      const valarpirai = JSON.parse(result[0].valarpirai_dates);
      const theipirai = JSON.parse(result[0].theipirai_dates);

      res.json({ valarpirai, theipirai });
    }
  );
});


const crypto = require('crypto');
const axios = require('axios');

const SALT_KEY = process.env.PHONEPE_SALT_KEY;
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const MERCHANT_USER_ID = process.env.PHONEPE_USER_ID;
const CALLBACK_URL = process.env.PHONEPE_CALLBACK_URL;
const BASE_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox';

// ✅ INITIATE PAYMENT
app.post('/api/initiate-payment', async (req, res) => {
  const { amount, phone, email, hallId, bookingId } = req.body;

  if (!amount || !phone || !email || !hallId || !bookingId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const transactionId = `TXN_${Date.now()}`;

  const payload = {
    merchantId: MERCHANT_ID,
    merchantTransactionId: transactionId,
    merchantUserId: MERCHANT_USER_ID,
    amount: amount * 100,
    redirectUrl: `${CALLBACK_URL}?transactionId=${transactionId}&bookingId=${bookingId}`,
    redirectMode: 'POST',
    mobileNumber: phone,
    paymentInstrument: {
      type: 'UPI_INTENT',
    },
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const stringToSign = base64Payload + '/pg/v1/pay' + SALT_KEY;
  const xVerify = crypto.createHash('sha256').update(stringToSign).digest('hex') + '###1';

  try {
    const response = await axios.post(
      `${BASE_URL}/pg/v1/pay`,
      { request: base64Payload },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          accept: 'application/json',
        },
      }
    );

    const redirectUrl = response?.data?.data?.instrumentResponse?.redirectInfo?.url;

    if (!redirectUrl) {
      console.error('❌ Missing redirect URL in PhonePe response:', response?.data);
      return res.status(502).json({ success: false, message: 'Payment link not received from PhonePe' });
    }

    await db.promise().query(
      `INSERT INTO payments (transaction_id, booking_id, status, amount, method, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [transactionId, bookingId, 'PENDING', amount, 'UPI', email, phone]
    );

    res.json({ success: true, paymentUrl: redirectUrl });

  } catch (err) {
    console.error('❌ Payment Initiation Error:', JSON.stringify(err?.response?.data || err.message || err, null, 2));
    res.status(500).json({ success: false, message: 'Failed to initiate payment' });
  }
});

// ✅ CHECK PAYMENT STATUS
app.get('/api/check-payment-status/:transactionId', async (req, res) => {
  const { transactionId } = req.params;

  const xVerify = crypto
    .createHash('sha256')
    .update(`/pg/v1/status/${MERCHANT_ID}/${transactionId}` + SALT_KEY)
    .digest('hex') + '###1';

  try {
    const response = await axios.get(
      `${BASE_URL}/pg/v1/status/${MERCHANT_ID}/${transactionId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'X-MERCHANT-ID': MERCHANT_ID,
        },
      }
    );

    const status = response.data.data.transactionStatus;

    await db.promise().query(
      `UPDATE payments SET status = ? WHERE transaction_id = ?`,
      [status, transactionId]
    );

    res.json({ success: true, status });
  } catch (err) {
    console.error('❌ Status Check Error:', err?.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch payment status' });
  }
});


// ✅ MARK PAYMENT SUCCESSFUL (after callback)
app.post('/api/payment-success', async (req, res) => {
  const { transactionId, bookingId } = req.body;

  if (!transactionId || !bookingId) {
    return res.status(400).json({ success: false, message: 'Missing transaction or booking ID' });
  }

  try {
    const [result] = await db.promise().query(
      `UPDATE payments SET status = 'COMPLETED' WHERE transaction_id = ? AND booking_id = ?`,
      [transactionId, bookingId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found or already updated' });
    }

    res.json({ success: true, message: 'Payment marked as completed' });
  } catch (error) {
    console.error('❌ Payment Success Handler Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


  // ✅ Start Server
  app.listen(5000, '0.0.0.0', () => {
    console.log('✅ Server running on port 5000');
  });
