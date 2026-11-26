require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const { authenticateToken } = require('./middleware/authMiddleware');
const proyekRoutes = require('./routes/proyekRoutes');
const fiturRoutes = require('./routes/fiturRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

app.use(
    cors({
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true, // wajib agar cookie HttpOnly dikirim lintas origin dev (5173 <-> 5000)
    })
);
app.use(express.json());
app.use(cookieParser());

// Endpoint autentikasi
app.use('/api/auth', authRoutes);

app.use('/api/proyek', authenticateToken, proyekRoutes);
app.use('/api/fitur', authenticateToken, fiturRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'SIMPRO API' });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`SIMPRO Backend berjalan di port ${PORT}`);
});