require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const { authenticateToken } = require('./middleware/authMiddleware');
const proyekRoutes = require('./routes/proyekRoutes');
const fiturRoutes = require('./routes/fiturRoutes');
const mosRoutes = require('./routes/mosRoutes');
const progressRoutes = require('./routes/progressRoutes');
const mosExportRoutes = require('./routes/mosExportRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

const allowedOrigins = String(
  process.env.CLIENT_URL || 'http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} tidak diizinkan oleh CORS.`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Endpoint autentikasi & verifikasi undangan registrasi
app.use('/api/auth', authRoutes);

// Endpoint SuperAdmin
app.use('/api/superadmin', superAdminRoutes);

// Endpoint terproteksi
app.use('/api/proyek', authenticateToken, proyekRoutes);
app.use('/api/fitur', authenticateToken, mosExportRoutes);
app.use('/api/fitur', authenticateToken, progressRoutes);
app.use('/api/fitur', authenticateToken, fiturRoutes);
app.use('/api', authenticateToken, mosRoutes);
app.use('/api', authenticateToken, progressRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SIMPRO API' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled Express error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err?.status || 500).json({
    message: err?.message || 'Internal server error',
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

app.listen(PORT, () => {
  console.log(`SIMPRO Backend berjalan di port ${PORT}`);
});
