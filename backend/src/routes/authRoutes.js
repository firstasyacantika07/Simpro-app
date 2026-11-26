const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db'); // sesuaikan dengan export MySQL pool Anda
const {
  REFRESH_COOKIE_NAME,
  hashToken,
  getRefreshCookieOptions,
} = require('../config/auth');
const {
  buildAccessToken,
  buildRefreshToken,
  verifyRefreshToken,
} = require('../services/tokenService');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT id, nama, email, password, posisi FROM users WHERE email = ? LIMIT 1',
      [String(email).trim()]
    );

    const user = rows?.[0];
    if (!user) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const passwordMatch = await bcrypt.compare(String(password), String(user.password));
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const { accessToken, expiresIn, expiresAt } = buildAccessToken(user);
    const { refreshToken, tokenHash, expiresAtDate } = buildRefreshToken(user);

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [
        user.id,
        tokenHash,
        expiresAtDate,
        String(req.headers['user-agent'] || '').slice(0, 255),
        String(req.ip || req.headers['x-forwarded-for'] || '').slice(0, 64),
      ]
    );

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions(req));

    return res.json({
      message: 'Login berhasil.',
      accessToken,
      token: accessToken, // kompatibilitas jika ada bagian lama yang membaca `token`
      expiresIn,
      expiresAt,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        posisi: user.posisi,
        role: user.posisi,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan saat proses login.' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!rawRefreshToken) {
    return res.status(401).json({ message: 'Refresh Token tidak ditemukan.' });
  }

  try {
    const decoded = verifyRefreshToken(rawRefreshToken);
    const tokenHash = hashToken(rawRefreshToken);

    const [rows] = await db.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.nama, u.email, u.posisi
       FROM refresh_tokens rt
       INNER JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = ?
       LIMIT 1`,
      [tokenHash]
    );

    const session = rows?.[0];
    if (!session) {
      return res.status(401).json({ message: 'Sesi Refresh Token tidak dikenali.' });
    }

    if (session.revoked_at !== null) {
      // Jika token yang sudah dicabut dipakai lagi, cabut semua sesi user tersebut (token reuse detection)
      await db.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
        [session.user_id]
      );
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
      return res.status(401).json({
        message: 'Refresh Token sudah dicabut. Silakan login kembali.',
      });
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await db.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL',
        [session.id]
      );
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
      return res.status(401).json({ message: 'Refresh Token telah kedaluwarsa.' });
    }

    const user = {
      id: session.user_id,
      nama: session.nama,
      email: session.email,
      posisi: session.posisi,
    };

    const { accessToken, expiresIn, expiresAt } = buildAccessToken(user);

    return res.json({
      message: 'Access Token berhasil diperbarui.',
      accessToken,
      token: accessToken,
      expiresIn,
      expiresAt,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        posisi: user.posisi,
        role: user.posisi,
      },
    });
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    return res.status(401).json({
      message: 'Refresh Token tidak valid atau kedaluwarsa.',
    });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  try {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await db.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
        [tokenHash]
      );
    }

    res.clearCookie(REFRESH_COOKIE_NAME, {
      ...getRefreshCookieOptions(req),
      maxAge: undefined,
    });

    return res.json({ message: 'Logout berhasil dan sesi token telah dicabut.' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan saat logout.' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, async (req, res) => {
  const { nama, email, password } = req.body || {};

  if (!nama || !email) {
    return res.status(400).json({ message: 'Nama dan email wajib diisi.' });
  }

  try {
    if (password && String(password).trim()) {
      const hashed = await bcrypt.hash(String(password), 10);
      await db.query(
        'UPDATE users SET nama = ?, email = ?, password = ? WHERE id = ?',
        [String(nama).trim(), String(email).trim(), hashed, req.user.id]
      );
    } else {
      await db.query(
        'UPDATE users SET nama = ?, email = ? WHERE id = ?',
        [String(nama).trim(), String(email).trim(), req.user.id]
      );
    }

    const [rows] = await db.query(
      'SELECT id, nama, email, posisi FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    const updatedUser = rows?.[0];

    return res.json({
      message: 'Profil berhasil diperbarui.',
      user: {
        id: updatedUser.id,
        nama: updatedUser.nama,
        email: updatedUser.email,
        posisi: updatedUser.posisi,
        role: updatedUser.posisi,
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui profil.' });
  }
});

module.exports = router;