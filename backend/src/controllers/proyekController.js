const db = require('../config/db');
const { isSuperAdminRole } = require('../middleware/authMiddleware');
const {
    createInvitationRequest,
    listInvitationsForPm,
    logActivity,
} = require('../services/invitationService');

const isProjectManager = (posisi = '') => {
    const normalized = String(posisi).trim().toLowerCase();
    return (
        normalized === 'pm' ||
        normalized === 'proyek manager' ||
        normalized === 'project manager' ||
        normalized.includes('project manager') ||
        normalized.includes('proyek manager')
    );
};

async function getAllProjects(req, res) {
    try {
        if (isSuperAdminRole(req.user?.role)) {
            const [rows] = await db.query('SELECT * FROM proyek ORDER BY created_at DESC, id DESC');
            return res.json(rows);
        }

        if (isProjectManager(req.user?.posisi || req.user?.role_di_proyek)) {
            const [rows] = await db.query(
                `SELECT DISTINCT p.*, pm.role_code AS role_di_proyek, pm.status AS status_keanggotaan
         FROM proyek p
         LEFT JOIN project_members pm
           ON pm.project_id = p.id AND pm.user_id = ? AND pm.status = 'active'
         ORDER BY p.created_at DESC, p.id DESC`,
                [req.user.id]
            );
            return res.json(rows);
        }

        const [rows] = await db.query(
            `SELECT DISTINCT p.*,
              COALESCE(pm.role_code, pa.role_proyek) AS role_di_proyek,
              COALESCE(pm.status, pa.status) AS status_keanggotaan
       FROM proyek p
       LEFT JOIN project_members pm
         ON pm.project_id = p.id AND pm.user_id = ? AND pm.status = 'active'
       LEFT JOIN proyek_anggota pa
         ON pa.proyek_id = p.id
        AND (pa.user_id = ? OR LOWER(pa.email) = LOWER(?))
        AND pa.status IN ('active', 'accepted')
       WHERE pm.id IS NOT NULL OR pa.id IS NOT NULL
       ORDER BY p.created_at DESC, p.id DESC`,
            [req.user.id, req.user.id, req.user.email || '']
        );
        return res.json(rows);
    } catch (error) {
        return res.status(500).json({
            message: 'Gagal mengambil data proyek',
            error: error.message,
        });
    }
}

async function getBangunanByProject(req, res) {
    const { id } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT pb.id,
              pb.proyek_id,
              pb.nama_bangunan,
              COALESCE(
                  (
                      SELECT ph.bobot_realisasi
                      FROM progress_harian ph
                      WHERE ph.proyek_id = pb.proyek_id
                        AND (ph.bangunan_id = pb.id OR LOWER(ph.nama_bangunan) = LOWER(pb.nama_bangunan))
                      ORDER BY ph.tanggal_laporan DESC, ph.id DESC
                      LIMIT 1
                  ),
                  pb.persentase_progres,
                  0
              ) AS persentase_progres,
              pb.created_at
       FROM proyek_bangunan pb
       WHERE pb.proyek_id = ?
       ORDER BY pb.id ASC`,
            [id]
        );
        return res.json(rows);
    } catch (error) {
        return res.status(500).json({
            message: 'Gagal memuat daftar bangunan',
            error: error.message,
        });
    }
}

async function createBangunan(req, res) {
    if (!isProjectManager(req.user?.posisi || req.user?.role)) {
        return res.status(403).json({
            message: 'Hanya Project Manager / PM yang berwenang menambahkan bangunan.',
        });
    }

    const { id } = req.params;
    const namaBangunan =
        typeof req.body?.nama_bangunan === 'string' ? req.body.nama_bangunan.trim() : '';
    const bobotAwal =
        req.body?.persentase_progres !== undefined && req.body?.persentase_progres !== ''
            ? Math.min(Math.max(Number(req.body.persentase_progres) || 0, 0), 100)
            : 0;

    if (!namaBangunan) {
        return res.status(400).json({ message: 'Nama bangunan wajib diisi.' });
    }

    try {
        const [proyekRows] = await db.query(
            'SELECT id, nama_proyek FROM proyek WHERE id = ?',
            [id]
        );
        if (proyekRows.length === 0) {
            return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
        }

        const [result] = await db.query(
            `INSERT INTO proyek_bangunan (proyek_id, nama_bangunan, persentase_progres)
       VALUES (?, ?, ?)`,
            [id, namaBangunan, bobotAwal]
        );

        return res.status(201).json({
            id: result.insertId,
            proyek_id: Number(id),
            nama_bangunan: namaBangunan,
            persentase_progres: bobotAwal,
            message: `Bangunan "${namaBangunan}" berhasil ditambahkan ke proyek ${proyekRows[0].nama_proyek}.`,
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Nama bangunan sudah ada di proyek ini.' });
        }
        return res.status(500).json({
            message: 'Gagal menambah bangunan',
            error: error.message,
        });
    }
}

async function deleteBangunan(req, res) {
    if (!isProjectManager(req.user?.posisi || req.user?.role)) {
        return res.status(403).json({
            message: 'Hanya Project Manager / PM yang berwenang menghapus bangunan.',
        });
    }

    const { id, bangunanId } = req.params;
    try {
        const [result] = await db.query(
            'DELETE FROM proyek_bangunan WHERE id = ? AND proyek_id = ?',
            [bangunanId, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Data bangunan tidak ditemukan.' });
        }
        return res.json({ message: 'Bangunan berhasil dihapus.' });
    } catch (error) {
        return res.status(500).json({
            message: 'Gagal menghapus bangunan',
            error: error.message,
        });
    }
}

async function getProgressHarianByProject(req, res) {
    const { id } = req.params;
    const { bangunan_id } = req.query;

    try {
        const params = [id];
        let whereClause = 'WHERE ph.proyek_id = ?';

        if (bangunan_id) {
            whereClause += ' AND ph.bangunan_id = ?';
            params.push(bangunan_id);
        }

        const [rows] = await db.query(
            `SELECT ph.id,
              ph.proyek_id,
              ph.bangunan_id,
              COALESCE(ph.nama_bangunan, pb.nama_bangunan) AS nama_bangunan,
              ph.uraian_pekerjaan,
              ph.tanggal_laporan,
              ph.bobot_realisasi,
              ph.catatan,
              ph.catatan AS kendala,
              ph.cuaca,
              ph.dokumentasi,
              ph.created_by,
              u.nama AS dibuat_oleh,
              ph.created_at,
              ph.updated_at
       FROM progress_harian ph
       LEFT JOIN proyek_bangunan pb ON pb.id = ph.bangunan_id
       LEFT JOIN users u ON u.id = ph.created_by
       ${whereClause}
       ORDER BY ph.tanggal_laporan DESC, ph.id DESC`,
            params
        );
        return res.json(rows);
    } catch (error) {
        return res.status(500).json({
            message: 'Gagal memuat progress harian',
            error: error.message,
        });
    }
}

async function getProjectMembers(req, res) {
    const { id } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT pm.id, pm.project_id AS proyek_id, pm.user_id, u.email,
              pm.role_code AS role_proyek, pm.status, pm.created_at,
              COALESCE(u.nama, u.email) AS nama,
              COALESCE(pm.role_code, u.posisi) AS posisi
       FROM project_members pm
       INNER JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ? AND pm.status = 'active'
       ORDER BY pm.created_at DESC`,
            [id]
        );
        return res.json(rows);
    } catch (error) {
        return res.status(500).json({
            message: 'Gagal memuat anggota proyek',
            error: error.message,
        });
    }
}

async function getMyInvitationRequests(req, res) {
    try {
        const projectId = req.query?.proyek_id || req.query?.project_id || null;
        const rows = await listInvitationsForPm(req.user, projectId);
        return res.json({ data: rows });
    } catch (error) {
        return res.status(500).json({
            message: 'Gagal memuat permintaan undangan',
            error: error.message,
        });
    }
}

async function requestProjectInvitation(req, res) {
    const effectiveRole = req.user?.role_di_proyek || req.user?.posisi || '';
    if (!isSuperAdminRole(req.user?.role) && !isProjectManager(effectiveRole)) {
        return res.status(403).json({
            message: 'Hanya Project Manager yang berwenang mengajukan permintaan undangan proyek.',
        });
    }

    const { id } = req.params;
    const invitedEmail = req.body?.invited_email ?? req.body?.email ?? '';
    const requestedRole =
        req.body?.requested_role_code ?? req.body?.requested_role ?? req.body?.role_proyek ?? '';

    try {
        const result = await createInvitationRequest({
            user: req.user,
            projectId: Number(id),
            invitedEmail,
            requestedRole,
            ipAddress: req.ip,
        });
        return res.status(201).json(result);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ message: error.message });
        }
        return res.status(500).json({
            message: 'Gagal mengajukan permintaan undangan',
            error: error.message,
        });
    }
}

async function createProject(req, res) {
    if (!isProjectManager(req.user?.posisi || req.user?.role)) {
        return res.status(403).json({
            message: 'Hanya Project Manager / PM yang berwenang menambahkan proyek.',
        });
    }

    const {
        nama_proyek,
        lokasi,
        tanggal_mulai,
        target_selesai,
        persentase_progres,
        progress,
        status,
        gambar,
    } = req.body;

    if (!nama_proyek || !lokasi) {
        return res.status(400).json({ message: 'Nama proyek dan lokasi wajib diisi.' });
    }

    try {
        const columns = ['nama_proyek', 'lokasi'];
        const placeholders = ['?', '?'];
        const values = [nama_proyek, lokasi];

        if (tanggal_mulai !== undefined && tanggal_mulai !== '') {
            columns.push('tanggal_mulai');
            placeholders.push('?');
            values.push(tanggal_mulai);
        }
        if (target_selesai !== undefined && target_selesai !== '') {
            columns.push('target_selesai');
            placeholders.push('?');
            values.push(target_selesai);
        }

        const progVal = persentase_progres ?? progress;
        if (progVal !== undefined && progVal !== '') {
            columns.push('persentase_progres');
            placeholders.push('?');
            values.push(Number(progVal) || 0);
        }
        if (status !== undefined && status !== '') {
            columns.push('status');
            placeholders.push('?');
            values.push(status);
        }
        if (gambar !== undefined) {
            columns.push('gambar');
            placeholders.push('?');
            values.push(gambar);
        }

        const [result] = await db.query(
            `INSERT INTO proyek (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
            values
        );

        const projectId = result.insertId;
        if (req.user?.id && isProjectManager(req.user?.posisi || req.user?.role)) {
            await db.query(
                `INSERT INTO project_members (project_id, user_id, role_code, status)
         VALUES (?, ?, 'Project Manager', 'active')
         ON DUPLICATE KEY UPDATE status = 'active'`,
                [projectId, req.user.id]
            );
        }

        await logActivity(db, {
            actorUserId: req.user?.id,
            actorRole: req.user?.role || req.user?.posisi,
            action: 'PROJECT_CREATED',
            entityType: 'proyek',
            entityId: projectId,
            projectId,
            details: { nama_proyek, lokasi },
            ipAddress: req.ip,
        });

        return res.status(201).json({
            id: projectId,
            message: 'Proyek berhasil ditambahkan',
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Gagal menambah proyek',
            error: error.message,
        });
    }
}

async function updateProject(req, res) {
    if (!isProjectManager(req.user?.posisi || req.user?.role)) {
        return res.status(403).json({
            message: 'Hanya Project Manager / PM yang berwenang memperbarui proyek.',
        });
    }

    const { id } = req.params;
    const {
        nama_proyek,
        lokasi,
        tanggal_mulai,
        target_selesai,
        persentase_progres,
        progress,
        status,
        gambar,
    } = req.body;

    try {
        const updates = [];
        const values = [];

        if (nama_proyek !== undefined) {
            updates.push('nama_proyek = ?');
            values.push(nama_proyek);
        }
        if (lokasi !== undefined) {
            updates.push('lokasi = ?');
            values.push(lokasi);
        }
        if (tanggal_mulai !== undefined) {
            updates.push('tanggal_mulai = ?');
            values.push(tanggal_mulai || null);
        }
        if (target_selesai !== undefined) {
            updates.push('target_selesai = ?');
            values.push(target_selesai || null);
        }

        const progVal = persentase_progres ?? progress;
        if (progVal !== undefined) {
            updates.push('persentase_progres = ?');
            values.push(Number(progVal) || 0);
        }
        if (status !== undefined && status !== '') {
            updates.push('status = ?');
            values.push(status);
        }
        if (gambar !== undefined) {
            updates.push('gambar = ?');
            values.push(gambar);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Tidak ada data proyek yang diperbarui.' });
        }

        values.push(id);
        const [result] = await db.query(
            `UPDATE proyek SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
        }

        return res.json({ message: 'Proyek berhasil diperbarui.' });
    } catch (error) {
        return res.status(500).json({
            message: 'Gagal memperbarui proyek',
            error: error.message,
        });
    }
}

async function deleteProject(req, res) {
    if (!isProjectManager(req.user?.posisi || req.user?.role)) {
        return res.status(403).json({
            message: 'Hanya Project Manager / PM yang berwenang menghapus proyek.',
        });
    }

    const { id } = req.params;

    try {
        const [result] = await db.query('DELETE FROM proyek WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
        }
        return res.json({ message: 'Proyek berhasil dihapus.' });
    } catch (error) {
        return res.status(500).json({
            message: 'Gagal menghapus proyek',
            error: error.message,
        });
    }
}

module.exports = {
    getAllProjects,
    getBangunanByProject,
    createBangunan,
    deleteBangunan,
    getProgressHarianByProject,
    getProjectMembers,
    getMyInvitationRequests,
    requestProjectInvitation,
    createProject,
    updateProject,
    deleteProject,
};