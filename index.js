// 📁 server.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
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

// ✅ DB Connection Test
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ DB pool connection error:', err);
  } else {
    console.log('✅ Connected to DB!');
    connection.release();
  }
});

// ✅ Global Error Handlers
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});

// ✅ Root Route
app.get('/', (req, res) => {
  res.send('✅ KUMBAM API is running...');
});

// ✅ Modular Routes
const authRoutes = require('./routes/auth');
const banquetRoutes = require('./routes/banquets');
const bookingRoutes = require('./routes/booking');
const muhurthamRoutes = require('./routes/muhurtham');

app.use('/api', authRoutes);
app.use('/api', banquetRoutes);
app.use('/api', bookingRoutes);
app.use('/api', muhurthamRoutes);

// ✅ Keep-alive ping (Railway)
setInterval(() => {
  console.log('⏳ Server still alive...');
}, 1000 * 60 * 5);

// ✅ Start Server
const PORT = process.env.PORT || 5000; // ✅ Default fallback to 5000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// ✅ Export DB for route use
module.exports = db;
