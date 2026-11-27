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
const {
  validateInvitationToken,
  activateInvitationForUser,
  logActivity,
} = require('../services/invitationService');

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

async function getUserProjectMemberships(userId, email = '') {
  const [rows] = await db.query(
    `SELECT pm.project_id, pm.role_code, pm.status, p.nama_proyek, p.lokasi, p.status AS status_proyek
     FROM project_members pm
     INNER JOIN proyek p ON p.id = pm.project_id
     WHERE pm.user_id = ? AND pm.status = 'active'
     ORDER BY pm.project_id ASC`,
    [userId]
  );

  if (rows.length > 0) return rows;

  const [legacyRows] = await db.query(
    `SELECT pa.proyek_id AS project_id, pa.role_proyek AS role_code, pa.status,
            p.nama_proyek, p.lokasi, p.status AS status_proyek
     FROM proyek_anggota pa
     INNER JOIN proyek p ON p.id = pa.proyek_id
     WHERE (pa.user_id = ? OR LOWER(pa.email) = LOWER(?))
       AND pa.status IN ('active', 'accepted')
     ORDER BY pa.proyek_id ASC`,
    [userId, email || '']
  );
  return legacyRows;
}

async function issueAuthSession(req, res, userRow, statusCode = 200, extraPayload = {}) {
  const memberships = await getUserProjectMemberships(userRow.id, userRow.email);
  const primaryMembership = memberships[0] || null;
  const effectivePosition = primaryMembership?.role_code || userRow.posisi || 'Staff Proyek';
  const effectiveRole =
    String(userRow.role || '').toLowerCase() === 'superadmin'
      ? 'SuperAdmin'
      : effectivePosition;

  const user = {
    id: userRow.id,
    nama: userRow.nama,
    email: userRow.email,
    posisi: effectivePosition,
    role: effectiveRole,
    is_active: Number(userRow.is_active) !== 0,
    memberships,
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

  return res.status(statusCode).json({
    message: extraPayload.message || 'Autentikasi berhasil.',
    accessToken,
    token: accessToken,
    expiresIn,
    expiresAt,
    user,
    ...(extraPayload.data ? { data: extraPayload.data } : {}),
  });
}

async function login(req, res) {
  const identifier = String(
    req.body?.identifier ?? req.body?.email ?? req.body?.nama ?? ''
  ).trim();
  const password = String(req.body?.password ?? '');
  const inviteToken = String(req.body?.invite_token ?? req.body?.token ?? '').trim();

  if (!identifier || !password) {
    return res.status(400).json({
      message: 'Nama/email dan password wajib diisi.',
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, nama, email, password, posisi, role, is_active
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
    if (Number(userRow.is_active) === 0) {
      return res.status(403).json({
        message: 'Akun Anda sedang dinonaktifkan.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, String(userRow.password || ''));
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Password tidak sesuai.',
      });
    }

    if (inviteToken) {
      const validated = await validateInvitationToken(inviteToken, userRow.email);
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await activateInvitationForUser(conn, validated.invitation, userRow.id, validated.finalRole);
        await conn.commit();
      } catch (txErr) {
        await conn.rollback();
        throw txErr;
      } finally {
        conn.release();
      }
    }

    await logActivity(db, {
      actorUserId: userRow.id,
      actorRole: userRow.role || userRow.posisi,
      action: 'USER_LOGIN',
      entityType: 'users',
      entityId: userRow.id,
      ipAddress: getClientIp(req),
    });

    return issueAuthSession(req, res, userRow, 200, { message: 'Login berhasil.' });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('Login error:', err);
    return res.status(500).json({
      message: 'Terjadi kesalahan pada server saat login.',
    });
  }
}

async function verifyInvite(req, res) {
  const token = String(req.query?.token ?? req.body?.token ?? '').trim();
  const email = String(req.query?.email ?? req.body?.email ?? '').trim();

  try {
    const validated = await validateInvitationToken(token, email);
    return res.json({
      valid: true,
      invited_email: validated.invitation.invited_email,
      project_id: validated.invitation.project_id,
      nama_proyek: validated.projectName,
      invited_by_nama: validated.inviterName,
      role_code: validated.finalRole,
      expires_at: validated.invitation.expires_at,
    });
  } catch (err) {
    return res.status(err.status || 400).json({
      valid: false,
      message: err.message,
    });
  }
}

async function register(req, res) {
  // Cegah eskalasi role/posisi dari input registrasi publik
  if (req.body?.role !== undefined || req.body?.posisi !== undefined) {
    return res.status(400).json({
      message: 'Penetapan role tidak diperbolehkan pada halaman registrasi.',
    });
  }

  const nama = String(req.body?.nama ?? req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const confirmPassword =
    req.body?.confirmPassword !== undefined ? String(req.body.confirmPassword) : password;
  const inviteToken = String(
    req.body?.invite_token ?? req.body?.token ?? req.query?.token ?? ''
  ).trim();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!nama || !email || !password) {
    return res.status(400).json({
      message: 'Nama lengkap, email, dan password wajib diisi.',
    });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({
      message: 'Format email tidak valid.',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: 'Password minimal 6 karakter.',
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      message: 'Konfirmasi password tidak cocok.',
    });
  }

  if (!inviteToken) {
    return res.status(400).json({
      message:
        'Registrasi memerlukan undangan proyek yang telah disetujui SuperAdmin. Silakan buka tautan undangan pada email Anda atau hubungi Project Manager.',
      code: 'INVITATION_REQUIRED',
    });
  }

  try {
    const validated = await validateInvitationToken(inviteToken, email);

    const [existingRows] = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email]
    );

    if (existingRows && existingRows.length > 0) {
      return res.status(409).json({
        message:
          'Email sudah terdaftar. Silakan login menggunakan akun yang ada untuk menyelesaikan penerimaan undangan proyek.',
        code: 'EMAIL_ALREADY_REGISTERED',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = validated.finalRole;

    const conn = await db.getConnection();
    let createdUserRow;
    try {
      await conn.beginTransaction();
      const [insertResult] = await conn.query(
        `INSERT INTO users (nama, email, password, posisi, role, is_active)
         VALUES (?, ?, ?, ?, 'user', 1)`,
        [nama, email, hashedPassword, assignedRole]
      );

      createdUserRow = {
        id: insertResult.insertId,
        nama,
        email,
        posisi: assignedRole,
        role: 'user',
        is_active: 1,
      };

      await activateInvitationForUser(conn, validated.invitation, createdUserRow.id, assignedRole);
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    await logActivity(db, {
      actorUserId: createdUserRow.id,
      actorRole: 'user',
      action: 'USER_REGISTERED_VIA_INVITATION',
      entityType: 'users',
      entityId: createdUserRow.id,
      projectId: validated.invitation.project_id,
      details: { email, role_code: assignedRole },
      ipAddress: getClientIp(req),
    });

    return issueAuthSession(req, res, createdUserRow, 201, {
      message: 'Registrasi berhasil dan keanggotaan proyek telah diaktifkan.',
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('Register error:', err);
    return res.status(500).json({
      message: 'Terjadi kesalahan pada server saat registrasi.',
    });
  }
}

async function refresh(req, res) {
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
    if (!tokenRecord || tokenRecord.revoked_at) {
      return res.status(401).json({
        message: 'Refresh token tidak valid atau sudah dicabut.',
      });
    }

    if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
      return res.status(401).json({
        message: 'Refresh token sudah kedaluwarsa.',
      });
    }

    const userId = decoded?.id || tokenRecord.user_id;
    const [userRows] = await db.query(
      'SELECT id, nama, email, posisi, role, is_active FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    const userRow = userRows?.[0];
    if (!userRow || Number(userRow.is_active) === 0) {
      return res.status(401).json({
        message: 'Pengguna tidak ditemukan atau tidak aktif.',
      });
    }

    await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [
      tokenRecord.id,
    ]);

    return issueAuthSession(req, res, userRow, 200, {
      message: 'Token berhasil diperbarui.',
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(401).json({
      message: 'Refresh token tidak valid atau kedaluwarsa.',
    });
  }
}

async function logout(req, res) {
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
    return res.json({ message: 'Logout berhasil.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(req));
    return res.status(500).json({ message: 'Terjadi kesalahan saat logout.' });
  }
}

async function getProfile(req, res) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Token autentikasi tidak disertakan.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const [rows] = await db.query(
      'SELECT id, nama, email, posisi, role, is_active, created_at FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    const profile = rows?.[0];
    if (!profile) {
      return res.status(404).json({ message: 'Profil pengguna tidak ditemukan.' });
    }

    const memberships = await getUserProjectMemberships(profile.id, profile.email);
    const effectivePosition = memberships[0]?.role_code || profile.posisi || 'Staff Proyek';
    const effectiveRole =
      String(profile.role || '').toLowerCase() === 'superadmin'
        ? 'SuperAdmin'
        : effectivePosition;

    return res.json({
      user: {
        id: profile.id,
        nama: profile.nama,
        email: profile.email,
        posisi: effectivePosition,
        role: effectiveRole,
        is_active: Number(profile.is_active) !== 0,
        memberships,
        created_at: profile.created_at,
      },
    });
  } catch (err) {
    return res.status(401).json({
      message: 'Token tidak valid atau sudah kedaluwarsa.',
    });
  }
}

module.exports = {
  login,
  register,
  verifyInvite,
  refresh,
  logout,
  getProfile,
};