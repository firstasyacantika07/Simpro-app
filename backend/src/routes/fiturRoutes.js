const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Semua role yang sudah login boleh READ data MOS & Progress
router.get('/mos', verifyToken, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM material_on_site');
    res.json(rows);
});

router.get('/progress', verifyToken, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM laporan_progress');
    res.json(rows);
});

// HANYA Logistik & Admin Proyek yang boleh Create/Update/Delete MOS
router.post(
    '/mos',
    verifyToken,
    authorizeRoles('Logistik', 'Admin Proyek'),
    async (req, res) => {
        const { proyek_id, kode_material, nama_material, satuan, jumlah_masuk, tanggal_update } = req.body;
        await db.query(
            'INSERT INTO material_on_site (proyek_id, kode_material, nama_material, satuan, jumlah_masuk, tanggal_update) VALUES (?, ?, ?, ?, ?, ?)',
            [proyek_id, kode_material, nama_material, satuan, jumlah_masuk, tanggal_update]
        );
        res.status(201).json({ message: 'Data MOS berhasil ditambahkan' });
    }
);

// HANYA QS (Quantity Surveyor) yang boleh Create/Update/Delete Laporan Progress Harian
router.post(
    '/progress',
    verifyToken,
    authorizeRoles('QS (Quantity Surveyor)'),
    async (req, res) => {
        const { proyek_id, tanggal_laporan, uraian_pekerjaan, bobot_rencana, bobot_realisasi, kendala } = req.body;
        await db.query(
            'INSERT INTO laporan_progress (proyek_id, tanggal_laporan, uraian_pekerjaan, bobot_rencana, bobot_realisasi, kendala, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [proyek_id, tanggal_laporan, uraian_pekerjaan, bobot_rencana, bobot_realisasi, kendala, req.user.id]
        );
        res.status(201).json({ message: 'Laporan progress harian berhasil disimpan' });
    }
);

module.exports = router;