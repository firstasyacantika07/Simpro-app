require('dotenv').config();
const express = require('express');
const cors = require('cors');


const proyekRoutes = require('./routes/proyekRoutes');
const authRoutes = require('./routes/authRoutes');
const fiturRoutes = require('./routes/fiturRoutes');
const progressRoutes = require('./routes/progressRoutes');
const mosRoutes = require('./routes/mosRoutes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));


app.use('/api/proyek', proyekRoutes);
app.use('/api/auth', authRoutes);
app.use('api/fitur', fiturRoutes);
app.use('/api/fitur', progressRoutes);
app.use('/api/fitur', mosRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server backend SIMPRO berjalan di http://localhost:${PORT}`);
});