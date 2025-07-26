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
const availabilityRoute = require('./routes/availablity');
app.use('/api/availability', availabilityRoute);

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
app.post('/api/bookings', (req, res) => {
  const { name, phone, event_type, address, mahal_name, location, price, dates } = req.body;
  const sql = `INSERT INTO bookings (name, phone, event_type, address, mahal_name, location, price, dates) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [name, phone, event_type, address, mahal_name, location, price, dates], (err) => {
    if (err) return res.status(500).json({ message: 'Booking failed' });
    res.status(200).json({ message: 'Booking successful' });
  });
});

// ✅ Single Hall by ID
app.get('/api/banquet_halls/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM banquet_halls WHERE id = ?', [id], (err, result) => {
    if (err || result.length === 0) return res.status(404).json({ message: 'Hall not found' });
    res.json(result[0]);
  });
});

// ✅ Start Server
app.listen(5000, '0.0.0.0', () => {
  console.log('✅ Server running on port 5000');
});
