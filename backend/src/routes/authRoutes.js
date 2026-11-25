const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

const VALID_ROLES = [
    'Staff Proyek',
    'Admin Proyek',
    'Logistik',
    'QS (Quantity Surveyor)',
    'Project Manager',
];

// 1. REGISTER
router.post('/register', async (req, res) => {
    const { nama, email, posisi, password } = req.body;

    if (!nama || !email || !posisi || !password) {
        return res.status(400).json({ message: 'Semua field wajib diisi.' });
    }

    if (!VALID_ROLES.includes(posisi)) {
        return res.status(400).json({ message: 'Posisi/Role tidak valid.' });
    }

    try {
        // Cek apakah email atau nama sudah terdaftar
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ? OR nama = ?',
            [email, nama]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Nama atau Email sudah digunakan.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (nama, email, posisi, password) VALUES (?, ?, ?, ?)',
            [nama, email, posisi, hashedPassword]
        );

        res.status(201).json({ message: 'Registrasi berhasil! Silakan login.' });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan server', error: error.message });
    }
});

// 2. LOGIN (Bisa pakai Nama atau Email)
router.post('/login', async (req, res) => {
    const { identifier, password } = req.body; // identifier = nama atau email

    if (!identifier || !password) {
        return res.status(400).json({ message: 'Nama/Email dan password wajib diisi.' });
    }

    try {
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ? OR nama = ? LIMIT 1',
            [identifier, identifier]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'Akun tidak ditemukan.' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Password salah.' });
        }

        const payload = {
            id: user.id,
            nama: user.nama,
            email: user.email,
            posisi: user.posisi,
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({
            message: 'Login berhasil',
            token,
            user: payload,
        });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan server', error: error.message });
    }
});

// 3. LUPA PASSWORD (Reset Password Sederhana / Verifikasi Email)
router.post('/forgot-password', async (req, res) => {
    const { email, newPassword } = req.body;
    try {
        const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Email tidak terdaftar di sistem.' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE email = ?', [hashed, email]);

        res.json({ message: 'Password berhasil diperbarui. Silakan login dengan password baru.' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal mereset password', error: error.message });
    }
});

// 4. EDIT PROFILE (Wajib Login)
router.put('/profile', verifyToken, async (req, res) => {
    const { nama, email, password } = req.body;
    const userId = req.user.id;

    if (!nama || !email) {
        return res.status(400).json({ message: 'Nama dan email tidak boleh kosong.' });
    }

    try {
        // Cek duplikasi email/nama milik user lain
        const [existing] = await db.query(
            'SELECT id FROM users WHERE (email = ? OR nama = ?) AND id != ?',
            [email, nama, userId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Nama atau Email sudah digunakan pengguna lain.' });
        }

        if (password && password.trim() !== '') {
            const hashed = await bcrypt.hash(password, 10);
            await db.query(
                'UPDATE users SET nama = ?, email = ?, password = ? WHERE id = ?',
                [nama, email, hashed, userId]
            );
        } else {
            await db.query(
                'UPDATE users SET nama = ?, email = ? WHERE id = ?',
                [nama, email, userId]
            );
        }

        // Buat payload & token baru agar sesi tetap sinkron
        const updatedUser = {
            id: userId,
            nama,
            email,
            posisi: req.user.posisi,
        };
        const newToken = jwt.sign(updatedUser, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({
            message: 'Profil berhasil diperbarui.',
            token: newToken,
            user: updatedUser,
        });
    } catch (error) {
        res.status(500).json({ message: 'Gagal memperbarui profil', error: error.message });
    }
});

module.exports = router;