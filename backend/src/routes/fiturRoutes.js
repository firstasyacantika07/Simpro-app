const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Semua role yang sudah login boleh READ data MOS & Progress
router.get('/mos', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM material_on_site');
        return res.json(rows);
    } catch (error) {
        return res.status(500).json({
            message: 'Gagal mengambil data MOS',
            error: error.message,
        });
    }
});

router.get('/progress', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM laporan_progress');
        return res.json(rows);
    } catch (error) {
        return res.status(500).json({
            message: 'Gagal mengambil data progress',
            error: error.message,
        });
    }
});

// HANYA Logistik & Admin Proyek yang boleh Create/Update/Delete MOS
router.post(
    '/mos',
    authenticateToken,
    authorizeRoles('Logistik', 'Admin Proyek'),
    async (req, res) => {
        try {
            const {
                proyek_id,
                kode_material,
                nama_material,
                satuan,
                jumlah_masuk,
                tanggal_update,
            } = req.body;

            await db.query(
                'INSERT INTO material_on_site (proyek_id, kode_material, nama_material, satuan, jumlah_masuk, tanggal_update) VALUES (?, ?, ?, ?, ?, ?)',
                [proyek_id, kode_material, nama_material, satuan, jumlah_masuk, tanggal_update]
            );

            return res.status(201).json({ message: 'Data MOS berhasil ditambahkan' });
        } catch (error) {
            return res.status(500).json({
                message: 'Gagal menambahkan data MOS',
                error: error.message,
            });
        }
    }
);

// HANYA QS (Quantity Surveyor) yang boleh Create/Update/Delete Laporan Progress Harian
router.post(
    '/progress',
    authenticateToken,
    authorizeRoles('QS (Quantity Surveyor)'),
    async (req, res) => {
        try {
            const {
                proyek_id,
                tanggal_laporan,
                uraian_pekerjaan,
                bobot_rencana,
                bobot_realisasi,
                kendala,
            } = req.body;

            await db.query(
                'INSERT INTO laporan_progress (proyek_id, tanggal_laporan, uraian_pekerjaan, bobot_rencana, bobot_realisasi, kendala, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    proyek_id,
                    tanggal_laporan,
                    uraian_pekerjaan,
                    bobot_rencana,
                    bobot_realisasi,
                    kendala,
                    req.user.id,
                ]
            );

            return res.status(201).json({ message: 'Laporan progress harian berhasil disimpan' });
        } catch (error) {
            return res.status(500).json({
                message: 'Gagal menyimpan laporan progress harian',
                error: error.message,
            });
        }
    }
);

module.exports = router;