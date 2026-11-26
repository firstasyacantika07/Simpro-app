const { verifyAccessToken } = require('../services/tokenService');

function normalizeRole(role = '') {
    return String(role).trim().toLowerCase().replace(/\s+/g, ' ');
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

function authenticateToken(req, res, next) {
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
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role || decoded.posisi,
            posisi: decoded.posisi || decoded.role,
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

        const userRole = req.user.role || req.user.posisi || '';
        const isAuthorized = allowedRoles.some((role) => matchesAllowedRole(userRole, role));

        if (!isAuthorized) {
            return res.status(403).json({
                message: 'Anda tidak memiliki hak akses untuk melakukan tindakan ini.',
            });
        }

        return next();
    };
}

module.exports = {
    authenticateToken,
    authorizeRoles,
    normalizeRole,
};