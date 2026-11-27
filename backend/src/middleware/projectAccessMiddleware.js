const db = require('../config/db');
const { isSuperAdminRole, matchesAllowedRole } = require('./authMiddleware');

function resolveProjectId(req) {
    return (
        req.params?.id ||
        req.params?.projectId ||
        req.body?.proyek_id ||
        req.body?.project_id ||
        req.query?.proyek_id ||
        req.query?.project_id ||
        null
    );
}

function requireProjectAccess(allowedProjectRoles = []) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Pengguna belum terautentikasi.' });
        }

        if (isSuperAdminRole(req.user.role)) {
            req.projectAccess = { isSuperAdmin: true, roleCode: 'SuperAdmin' };
            return next();
        }

        const projectId = resolveProjectId(req);
        if (!projectId) {
            return res.status(400).json({ message: 'ID proyek wajib disertakan.' });
        }

        try {
            const [memberRows] = await db.query(
                `SELECT role_code, status
                 FROM project_members
                 WHERE project_id = ? AND user_id = ? AND status = 'active'
                 LIMIT 1`,
                [Number(projectId), req.user.id]
            );

            let membership = memberRows?.[0] || null;

            // Kompatibilitas mundur dengan proyek_anggota jika belum ada di project_members
            if (!membership) {
                const [legacyRows] = await db.query(
                    `SELECT role_proyek AS role_code, status
                     FROM proyek_anggota
                     WHERE proyek_id = ?
                       AND (user_id = ? OR LOWER(email) = LOWER(?))
                       AND status IN ('active', 'accepted')
                     LIMIT 1`,
                    [Number(projectId), req.user.id, req.user.email || '']
                );
                membership = legacyRows?.[0] || null;
            }

            if (!membership) {
                return res.status(403).json({
                    message: 'Anda tidak terdaftar sebagai anggota aktif pada proyek ini.',
                });
            }

            if (allowedProjectRoles.length > 0) {
                const roleToCheck = membership.role_code || req.user.posisi;
                const ok = allowedProjectRoles.some((r) => matchesAllowedRole(roleToCheck, r));
                if (!ok) {
                    return res.status(403).json({
                        message: 'Role Anda pada proyek ini tidak diizinkan melakukan aksi ini.',
                    });
                }
            }

            req.projectAccess = {
                projectId: Number(projectId),
                roleCode: membership.role_code,
                isSuperAdmin: false,
            };
            return next();
        } catch (err) {
            console.error('Project access check error:', err);
            return res.status(500).json({
                message: 'Gagal memverifikasi hak akses proyek.',
            });
        }
    };
}

module.exports = {
    requireProjectAccess,
    resolveProjectId,
};