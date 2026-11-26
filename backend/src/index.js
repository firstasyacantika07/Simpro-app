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

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

app.use(
    cors({
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());

// Endpoint autentikasi
app.use('/api/auth', authRoutes);

// Endpoint terproteksi
app.use('/api/proyek', authenticateToken, proyekRoutes);
app.use('/api/fitur', authenticateToken, fiturRoutes);
app.use('/api', authenticateToken, mosRoutes);
app.use('/api', authenticateToken, progressRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'SIMPRO API' });
});

// 404 handler untuk rute yang tidak ditemukan
app.use((req, res) => {
    res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

// Global error handler Express
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