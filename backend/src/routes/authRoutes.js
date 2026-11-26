const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const {
  REFRESH_COOKIE_NAME,
  getJwtSecret,
  getRefreshCookieOptions,
  hashToken,
} = require('../config/auth');
const {
  buildAccessToken,
  buildRefreshToken,
  verifyRefreshToken,
} = require('../services/tokenService');

const router = express.Router();

function extractBearerToken(req) {
  const authHeader = String(req.headers.authorization || '').trim();
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim() || null;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  return String(req.ip || '').slice(0, 64);
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const identifier = String(
    req.body?.identifier ?? req.body?.email ?? req.body?.nama ?? ''
  ).trim();
  const password = String(req.body?.password ?? '');

  if (!identifier || !password) {
    return res.status(400).json({
      message: 'Nama/email dan password wajib diisi.',
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, nama, email, password, posisi
       FROM users
       WHERE LOWER(email) = LOWER(?) OR LOWER(nama) = LOWER(?)
       ORDER BY CASE WHEN LOWER(email) = LOWER(?) THEN 0 ELSE 1 END
       LIMIT 1`,
      [identifier, identifier, identifier]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        message: 'Akun tidak ditemukan atau kredensial tidak valid.',
      });
    }

    const userRow = rows[0];
    const isPasswordValid = await bcrypt.compare(password, String(userRow.password || ''));
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Password tidak sesuai.',
      });
    }

    const user = {
      id: userRow.id,
      nama: userRow.nama,
      email: userRow.email,
      posisi: userRow.posisi || 'Staff Proyek',
    };

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
        getClientIp(req),
      ]
    );

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions(req));

    return res.json({
      message: 'Login berhasil.',
      accessToken,
      token: accessToken,
      expiresIn,
      expiresAt,
      user: {
        ...user,
        role: user.posisi,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      message: 'Terjadi kesalahan pada server saat login.',
    });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const nama = String(req.body?.nama ?? req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const posisi =
    String(req.body?.posisi ?? req.body?.role ?? 'Staff Proyek').trim() ||
    'Staff Proyek';

  if (!nama || !email || !password) {
    return res.status(400).json({
      message: 'Nama, email, dan password wajib diisi.',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: 'Password minimal 6 karakter.',
    });
  }

  try {
    const [existingRows] = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email]
    );

    if (existingRows && existingRows.length > 0) {
      return res.status(409).json({
        message: 'Email sudah terdaftar. Silakan gunakan email lain atau login.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [insertResult] = await db.query(
      'INSERT INTO users (nama, email, password, posisi) VALUES (?, ?, ?, ?)',
      [nama, email, hashedPassword, posisi]
    );

    const user = {
      id: insertResult.insertId,
      nama,
      email,
      posisi,
    };

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
        getClientIp(req),
      ]
    );

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions(req));

    return res.status(201).json({
      message: 'Registrasi akun berhasil.',
      accessToken,
      token: accessToken,
      expiresIn,
      expiresAt,
      user: {
        ...user,
        role: user.posisi,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({
      message: 'Terjadi kesalahan pada server saat registrasi.',
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const rawRefreshToken =
    req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken || '';

  if (!rawRefreshToken) {
    return res.status(401).json({
      message: 'Refresh token tidak ditemukan.',
    });
  }

  try {
    const decoded = verifyRefreshToken(rawRefreshToken);
    const currentHash = hashToken(rawRefreshToken);

    const [tokenRows] = await db.query(
      `SELECT id, user_id, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = ?
       LIMIT 1`,
      [currentHash]
    );

    const tokenRecord = tokenRows?.[0];
    if (!tokenRecord) {
      return res.status(401).json({
        message: 'Refresh token tidak dikenali.',
      });
    }

    if (tokenRecord.revoked_at) {
      return res.status(401).json({
        message: 'Refresh token sudah dicabut.',
      });
    }

    if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
      return res.status(401).json({
        message: 'Refresh token sudah kedaluwarsa.',
      });
    }

    const userId = decoded?.id || tokenRecord.user_id;
    const [userRows] = await db.query(
      'SELECT id, nama, email, posisi FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(401).json({
        message: 'Pengguna tidak ditemukan.',
      });
    }

    const user = {
      id: userRows[0].id,
      nama: userRows[0].nama,
      email: userRows[0].email,
      posisi: userRows[0].posisi || 'Staff Proyek',
    };

    // Rotasi refresh token: cabut token lama dan simpan token baru
    await db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?',
      [tokenRecord.id]
    );

    const { accessToken, expiresIn, expiresAt } = buildAccessToken(user);
    const {
      refreshToken: nextRefreshToken,
      tokenHash: nextTokenHash,
      expiresAtDate: nextExpiresAtDate,
    } = buildRefreshToken(user);

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [
        user.id,
        nextTokenHash,
        nextExpiresAtDate,
        String(req.headers['user-agent'] || '').slice(0, 255),
        getClientIp(req),
      ]
    );

    res.cookie(
      REFRESH_COOKIE_NAME,
      nextRefreshToken,
      getRefreshCookieOptions(req)
    );

    return res.json({
      message: 'Token berhasil diperbarui.',
      accessToken,
      token: accessToken,
      expiresIn,
      expiresAt,
      user: {
        ...user,
        role: user.posisi,
      },
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(401).json({
      message: 'Refresh token tidak valid atau kedaluwarsa.',
    });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const rawRefreshToken =
    req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken || '';

  try {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await db.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
        [tokenHash]
      );
    }

    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(req));

    return res.json({
      message: 'Logout berhasil.',
    });
  } catch (err) {
    console.error('Logout error:', err);
    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(req));
    return res.status(500).json({
      message: 'Terjadi kesalahan saat logout.',
    });
  }
});

// GET /api/auth/profile
router.get('/profile', async (req, res) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      message: 'Token autentikasi tidak disertakan.',
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const userId = decoded?.id;

    if (!userId) {
      return res.status(401).json({
        message: 'Payload token tidak valid.',
      });
    }

    const [rows] = await db.query(
      'SELECT id, nama, email, posisi, created_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        message: 'Profil pengguna tidak ditemukan.',
      });
    }

    const profile = rows[0];
    return res.json({
      user: {
        id: profile.id,
        nama: profile.nama,
        email: profile.email,
        posisi: profile.posisi || 'Staff Proyek',
        role: profile.posisi || 'Staff Proyek',
        created_at: profile.created_at,
      },
    });
  } catch (err) {
    return res.status(401).json({
      message: 'Token tidak valid atau sudah kedaluwarsa.',
    });
  }
});

module.exports = router;