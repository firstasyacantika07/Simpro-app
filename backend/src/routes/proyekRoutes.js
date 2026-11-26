const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');

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

const createMailTransporter = () => {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');

    if (!host || !user || !pass) {
        return null;
    }

    const port = Number(process.env.SMTP_PORT) || 587;
    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass,
        },
    });
};

// Ambil data proyek sesuai hak akses
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (isProjectManager(req.user?.posisi || req.user?.role)) {
            const [rows] = await db.query('SELECT * FROM proyek ORDER BY created_at DESC');
            return res.json(rows);
        }

        const [rows] = await db.query(
            `SELECT DISTINCT p.*, pa.role_proyek AS role_di_proyek, pa.status AS status_keanggotaan
             FROM proyek p
             INNER JOIN proyek_anggota pa ON pa.proyek_id = p.id
             WHERE (pa.user_id = ? OR LOWER(pa.email) = LOWER(?))
               AND pa.status IN ('active', 'accepted')
             ORDER BY p.created_at DESC`,
            [req.user.id, req.user.email || '']
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data proyek', error: error.message });
    }
});

// Ambil daftar bangunan pada suatu proyek 
router.get('/:id/bangunan', authenticateToken, async (req, res) => {
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
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Gagal memuat daftar bangunan', error: error.message });
    }
});

// Tambah bangunan baru pada suatu proyek (Khusus PM)
router.post('/:id/bangunan', authenticateToken, async (req, res) => {
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

        res.status(201).json({
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
        res.status(500).json({ message: 'Gagal menambah bangunan', error: error.message });
    }
});

// Hapus bangunan pada suatu proyek (Khusus PM)
router.delete('/:id/bangunan/:bangunanId', authenticateToken, async (req, res) => {
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
        res.json({ message: 'Bangunan berhasil dihapus.' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menghapus bangunan', error: error.message });
    }
});

// Ambil riwayat progress_harian per proyek
router.get('/:id/progress-harian', authenticateToken, async (req, res) => {
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
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Gagal memuat progress harian', error: error.message });
    }
});

// Ambil daftar anggota / undangan pada suatu proyek
router.get('/:id/anggota', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT pa.id, pa.proyek_id, pa.user_id, pa.email, pa.role_proyek, pa.status, pa.created_at,
                    COALESCE(u.nama, pa.email) AS nama,
                    COALESCE(u.posisi, pa.role_proyek) AS posisi
             FROM proyek_anggota pa
             LEFT JOIN users u ON u.id = pa.user_id
             WHERE pa.proyek_id = ?
             ORDER BY pa.created_at DESC`,
            [id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Gagal memuat anggota proyek', error: error.message });
    }
});

// Invite anggota tim ke site proyek berdasarkan email (Khusus PM)
router.post('/:id/invite', authenticateToken, async (req, res) => {
    if (!isProjectManager(req.user?.posisi || req.user?.role)) {
        return res.status(403).json({
            message: 'Hanya Project Manager / PM yang berwenang mengundang tim ke proyek.',
        });
    }

    const { id } = req.params;
    const rawEmail =
        typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const roleProyek =
        typeof req.body?.role_proyek === 'string' && req.body.role_proyek.trim() !== ''
            ? req.body.role_proyek.trim()
            : null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!rawEmail || !emailRegex.test(rawEmail)) {
        return res.status(400).json({ message: 'Format email undangan tidak valid.' });
    }

    try {
        const [proyekRows] = await db.query(
            'SELECT id, nama_proyek, lokasi FROM proyek WHERE id = ?',
            [id]
        );
        if (proyekRows.length === 0) {
            return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
        }
        const proyek = proyekRows[0];

        const [userRows] = await db.query(
            'SELECT id, nama, email, posisi FROM users WHERE LOWER(email) = ? LIMIT 1',
            [rawEmail]
        );
        const matchedUser = userRows[0] || null;
        const status = matchedUser ? 'active' : 'pending';
        const finalRole = roleProyek || matchedUser?.posisi || null;

        await db.query(
            `INSERT INTO proyek_anggota (proyek_id, user_id, email, role_proyek, status, invited_by)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               user_id = COALESCE(VALUES(user_id), user_id),
               role_proyek = COALESCE(VALUES(role_proyek), role_proyek),
               status = CASE WHEN status = 'active' THEN 'active' ELSE VALUES(status) END,
               invited_by = VALUES(invited_by)`,
            [
                id,
                matchedUser ? matchedUser.id : null,
                rawEmail,
                finalRole,
                status,
                req.user.id || null,
            ]
        );

        let emailSent = false;
        let emailError = null;

        const transporter = createMailTransporter();
        if (!transporter) {
            emailError = 'Konfigurasi SMTP_HOST, SMTP_USER, atau SMTP_PASS belum terbaca di .env.';
            console.warn('[SIMPRO MAIL]', emailError);
        } else {
            try {
                const appUrl = process.env.APP_URL || 'http://localhost:5173';
                const info = await transporter.sendMail({
                    from: `"SIMPRO" <${process.env.SMTP_USER.trim()}>`,
                    to: rawEmail,
                    subject: `Undangan Tim Proyek: ${proyek.nama_proyek}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
                            <h2>Undangan Bergabung ke Proyek SIMPRO</h2>
                            <p>Halo,</p>
                            <p>
                                <strong>${req.user?.nama || 'Project Manager'}</strong> mengundang Anda untuk bergabung ke tim proyek:
                            </p>
                            <ul>
                                <li><strong>Nama Proyek:</strong> ${proyek.nama_proyek}</li>
                                <li><strong>Lokasi:</strong> ${proyek.lokasi || '-'}</li>
                                <li><strong>Status Undangan:</strong> ${status === 'active' ? 'Aktif' : 'Pending (daftar/login menggunakan email ini)'}</li>
                            </ul>
                            <p>
                                <a href="${appUrl}" style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;">
                                    Buka Aplikasi SIMPRO
                                </a>
                            </p>
                        </div>
                    `,
                });
                emailSent = true;
                console.log('[SIMPRO MAIL] Terkirim ke:', rawEmail, '| messageId:', info.messageId);
            } catch (mailErr) {
                emailError = mailErr.message;
                console.error('[SIMPRO MAIL ERROR]:', mailErr);
            }
        }

        res.status(201).json({
            message: matchedUser
                ? `${matchedUser.nama} (${rawEmail}) berhasil ditambahkan ke proyek ${proyek.nama_proyek}.${emailSent ? ' Email notifikasi telah dikirim.' : ''}`
                : `Undangan dicatat untuk ${rawEmail}.${emailSent ? ' Email undangan telah dikirim.' : ''}`,
            status,
            emailSent,
            ...(emailError ? { emailError } : {}),
        });
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengundang anggota tim', error: error.message });
    }
});

// Tambah proyek baru (Khusus PM)
router.post('/', authenticateToken, async (req, res) => {
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

        res.status(201).json({
            id: result.insertId,
            message: 'Proyek berhasil ditambahkan',
        });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menambah proyek', error: error.message });
    }
});

// Update proyek berdasarkan ID (Khusus PM)
router.put('/:id', authenticateToken, async (req, res) => {
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

        res.json({ message: 'Proyek berhasil diperbarui.' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal memperbarui proyek', error: error.message });
    }
});

// Hapus proyek berdasarkan ID (Khusus PM)
router.delete('/:id', authenticateToken, async (req, res) => {
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
        res.json({ message: 'Proyek berhasil dihapus.' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menghapus proyek', error: error.message });
    }
});


module.exports = router;