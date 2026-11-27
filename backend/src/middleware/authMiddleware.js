const db = require('../config/db');
const { verifyAccessToken } = require('../services/tokenService');

function normalizeRole(role = '') {
    return String(role).trim().toLowerCase().replace(/\s+/g, ' ');
}

function isSuperAdminRole(role = '') {
    return normalizeRole(role) === 'superadmin';
}

function matchesAllowedRole(userRole, allowedRole) {
    const u = normalizeRole(userRole);
    const a = normalizeRole(allowedRole);
    if (!u || !a) return false;
    if (u === a) return true;

    const pmAliases = ['pm', 'project manager', 'proyek manager'];
    if (pmAliases.includes(a) && pmAliases.includes(u)) {
        return true;
    }

    return false;
}

async function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({
            message: 'Akses ditolak. Access Token tidak ditemukan.',
            code: 'NO_ACCESS_TOKEN',
        });
    }

    try {
        const decoded = verifyAccessToken(token);
        const [rows] = await db.query(
            `SELECT id, nama, email, posisi, role, is_active
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [decoded.id]
        );

        const dbUser = rows?.[0];
        if (!dbUser) {
            return res.status(401).json({
                message: 'Pengguna tidak ditemukan.',
                code: 'USER_NOT_FOUND',
            });
        }

        if (Number(dbUser.is_active) === 0) {
            return res.status(403).json({
                message: 'Akun Anda sedang dinonaktifkan.',
                code: 'ACCOUNT_INACTIVE',
            });
        }

        req.user = {
            id: dbUser.id,
            nama: dbUser.nama,
            email: dbUser.email,
            role: dbUser.role || 'user',
            posisi: dbUser.posisi || 'Staff Proyek',
            is_active: Number(dbUser.is_active) === 1,
        };
        return next();
    } catch (err) {
        const isExpired = err?.name === 'TokenExpiredError';
        return res.status(401).json({
            message: isExpired
                ? 'Access Token telah kedaluwarsa.'
                : 'Access Token tidak valid.',
            code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        });
    }
}

function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Pengguna belum terautentikasi.' });
        }

        const effectiveRole = isSuperAdminRole(req.user.role)
            ? 'SuperAdmin'
            : req.user.posisi || req.user.role || '';

        const isAuthorized = allowedRoles.some((role) =>
            matchesAllowedRole(effectiveRole, role)
        );

        if (!isAuthorized) {
            return res.status(403).json({
                message: 'Anda tidak memiliki hak akses untuk melakukan tindakan ini.',
            });
        }

        return next();
    };
}

function requireSuperAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ message: 'Pengguna belum terautentikasi.' });
    }
    if (!isSuperAdminRole(req.user.role)) {
        return res.status(403).json({
            message: 'Akses khusus SuperAdmin.',
        });
    }
    return next();
}

module.exports = {
    authenticateToken,
    authorizeRoles,
    requireSuperAdmin,
    normalizeRole,
    isSuperAdminRole,
    matchesAllowedRole,
};