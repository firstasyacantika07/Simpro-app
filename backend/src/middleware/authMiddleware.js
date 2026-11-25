const jwt = require('jsonwebtoken');

// Verifikasi apakah user sudah login
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

    if (!token) {
        return res.status(401).json({ message: 'Akses ditolak. Silakan login terlebih dahulu.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Berisi { id, nama, email, posisi }
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token tidak valid atau telah kedaluwarsa.' });
    }
};

// Verifikasi Role (RBAC)
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.posisi)) {
            return res.status(403).json({
                message: `Akses ditolak. Role '${req.user?.posisi}' tidak memiliki izin untuk aksi ini.`,
            });
        }
        next();
    };
};

module.exports = { verifyToken, authorizeRoles };