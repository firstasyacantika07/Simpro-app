require('dotenv').config();
const express = require('express');
const cors = require('cors');


const proyekRoutes = require('./routes/proyekRoutes');
const authRoutes = require('./routes/authRoutes');
const fiturRoutes = require('./routes/fiturRoutes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/proyek', proyekRoutes);
app.use('/api/auth', authRoutes);
app.use('api/fitur', fiturRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server backend SIMPRO berjalan di http://localhost:${PORT}`);
});