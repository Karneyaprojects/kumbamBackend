// 📁 routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const db = require('../index');
const router = express.Router();

// ✅ Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Signup
router.post('/signup', async (req, res) => {
  const { fullName, phone, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
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

// ✅ Login + OTP
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (!results.length) return res.json({ success: false, message: 'User not found' });
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: 'Incorrect password' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);
    db.query('INSERT INTO otp_verification (email, otp, expires_at) VALUES (?, ?, ?)', [email, otp, expiresAt]);

    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP - KUMBAM',
      text: `Your OTP is ${otp}`,
    });

    res.json({ success: true, token: otp, phone: user.phone, username: user.full_name });
  });
});

// ✅ Verify OTP
router.post('/verify-email-otp', (req, res) => {
  const { email, otp } = req.body;
  db.query('SELECT * FROM otp_verification WHERE email = ? ORDER BY id DESC LIMIT 1', [email], (err, results) => {
    const record = results[0];
    if (record.otp !== otp || new Date() > record.expires_at) return res.json({ success: false });
    res.json({ success: true });
  });
});

// ✅ Forgot Password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60000);
  db.query('INSERT INTO otp_verification (email, otp, expires_at) VALUES (?, ?, ?)', [email, otp, expiresAt]);
  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'KUMBAM Password Reset OTP',
    text: `Your OTP is ${otp}`,
  });
  res.json({ success: true });
});

// ✅ Reset Password
router.post('/reset-password', async (req, res) => {
  const { email, otp, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  db.query('SELECT * FROM otp_verification WHERE email = ? ORDER BY id DESC LIMIT 1', [email], (err, results) => {
    const record = results[0];
    if (record.otp !== otp || new Date() > record.expires_at) return res.json({ success: false });

    db.query('UPDATE users SET password = ? WHERE email = ?', [hashed, email]);
    res.json({ success: true });
  });
});

module.exports = router;
