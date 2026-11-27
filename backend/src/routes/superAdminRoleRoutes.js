const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireSuperAdmin } = require('../middleware/authMiddleware');
const { logActivity } = require('../services/invitationService');

router.use(authenticateToken, requireSuperAdmin);

router.get('/roles', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, role_name, description, is_active, created_at FROM project_roles ORDER BY id ASC'
        );
        return res.json({ data: rows });
    } catch (err) {
        return res.status(500).json({ message: 'Gagal memuat daftar role.', error: err.message });
    }
});

router.post('/roles', async (req, res) => {
    const roleName = String(req.body?.role_name || '').trim();
    const description = String(req.body?.description || '').trim() || null;

    if (!roleName) {
        return res.status(400).json({ message: 'Nama role wajib diisi.' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO project_roles (role_name, description, is_active) VALUES (?, ?, 1)',
            [roleName, description]
        );
        await logActivity(db, {
            actorUserId: req.user.id,
            actorRole: req.user.role,
            action: 'PROJECT_ROLE_CREATED',
            entityType: 'project_roles',
            entityId: result.insertId,
            details: { role_name: roleName, description },
            ipAddress: req.ip,
        });
        return res.status(201).json({
            id: result.insertId,
            role_name: roleName,
            description,
            message: 'Role baru berhasil ditambahkan.',
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Nama role sudah terdaftar.' });
        }
        return res.status(500).json({ message: 'Gagal menambah role.', error: err.message });
    }
});

router.put('/roles/:id', async (req, res) => {
    const { id } = req.params;
    const roleName = String(req.body?.role_name || '').trim();
    const description =
        req.body?.description !== undefined ? String(req.body.description || '').trim() || null : undefined;
    const isActive = req.body?.is_active !== undefined ? (req.body.is_active ? 1 : 0) : undefined;

    if (!roleName) {
        return res.status(400).json({ message: 'Nama role wajib diisi.' });
    }

    try {
        const updates = ['role_name = ?'];
        const values = [roleName];

        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        if (isActive !== undefined) {
            updates.push('is_active = ?');
            values.push(isActive);
        }

        values.push(Number(id));
        const [result] = await db.query(
            `UPDATE project_roles SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Data role tidak ditemukan.' });
        }

        await logActivity(db, {
            actorUserId: req.user.id,
            actorRole: req.user.role,
            action: 'PROJECT_ROLE_UPDATED',
            entityType: 'project_roles',
            entityId: Number(id),
            details: { role_name: roleName, description, is_active: isActive },
            ipAddress: req.ip,
        });

        return res.json({ message: 'Role berhasil diperbarui.' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Nama role sudah digunakan.' });
        }
        return res.status(500).json({ message: 'Gagal memperbarui role.', error: err.message });
    }
});

router.delete('/roles/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT role_name FROM project_roles WHERE id = ? LIMIT 1', [Number(id)]);
        if (!rows.length) {
            return res.status(404).json({ message: 'Data role tidak ditemukan.' });
        }

        const roleName = rows[0].role_name;
        const [inUse] = await db.query(
            `SELECT COUNT(*) AS cnt FROM project_members WHERE LOWER(role_code) = LOWER(?) AND status = 'active'`,
            [roleName]
        );
        if (Number(inUse[0]?.cnt || 0) > 0) {
            return res.status(409).json({
                message: `Role "${roleName}" masih dipakai oleh anggota proyek aktif. Nonaktifkan role terlebih dahulu.`,
            });
        }

        await db.query('DELETE FROM project_roles WHERE id = ?', [Number(id)]);
        await logActivity(db, {
            actorUserId: req.user.id,
            actorRole: req.user.role,
            action: 'PROJECT_ROLE_DELETED',
            entityType: 'project_roles',
            entityId: Number(id),
            details: { role_name: roleName },
            ipAddress: req.ip,
        });
        return res.json({ message: 'Role berhasil dihapus.' });
    } catch (err) {
        return res.status(500).json({ message: 'Gagal menghapus role.', error: err.message });
    }
});

module.exports = router;