const db = require('../config/db');

// GET /mos
const getAllMos = async (req, res) => {
    const { proyek_id } = req.query;
    try {
        const params = [];
        const whereSql = proyek_id ? 'WHERE proyek_id = ?' : '';
        if (proyek_id) params.push(proyek_id);

        const [rows] = await db.query(
            `SELECT * FROM mos ${whereSql} ORDER BY tanggal_update DESC, id DESC`,
            params
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Gagal memuat data MOS', error: error.message });
    }
};

// POST /mos
const createMos = async (req, res) => {
    const {
        proyek_id,
        kode_material,
        nama_material,
        satuan,
        jumlah_masuk,
        jumlah_terpakai,
        tanggal_update,
    } = req.body;

    if (!proyek_id || !kode_material || !nama_material) {
        return res.status(400).json({
            message: 'Proyek, kode material, dan nama material wajib diisi.',
        });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO mos (proyek_id, kode_material, nama_material, satuan, jumlah_masuk, jumlah_terpakai, tanggal_update)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                Number(proyek_id),
                String(kode_material).trim(),
                String(nama_material).trim(),
                String(satuan || 'Unit').trim(),
                Number(jumlah_masuk) || 0,
                Number(jumlah_terpakai) || 0,
                tanggal_update || new Date().toISOString().split('T')[0],
            ]
        );
        res.status(201).json({ id: result.insertId, message: 'Data MOS berhasil disimpan.' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menyimpan data MOS', error: error.message });
    }
};

// PUT /mos/:id
const updateMos = async (req, res) => {
    const { id } = req.params;
    const {
        proyek_id,
        kode_material,
        nama_material,
        satuan,
        jumlah_masuk,
        jumlah_terpakai,
        tanggal_update,
    } = req.body;

    try {
        const [result] = await db.query(
            `UPDATE mos
             SET proyek_id = ?,
                 kode_material = ?,
                 nama_material = ?,
                 satuan = ?,
                 jumlah_masuk = ?,
                 jumlah_terpakai = ?,
                 tanggal_update = ?
             WHERE id = ?`,
            [
                Number(proyek_id),
                String(kode_material).trim(),
                String(nama_material).trim(),
                String(satuan || 'Unit').trim(),
                Number(jumlah_masuk) || 0,
                Number(jumlah_terpakai) || 0,
                tanggal_update || new Date().toISOString().split('T')[0],
                id,
            ]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Data MOS tidak ditemukan.' });
        }
        res.json({ message: 'Data MOS berhasil diperbarui.' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal memperbarui data MOS', error: error.message });
    }
};

// DELETE /mos/:id
const deleteMos = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM mos WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Data MOS tidak ditemukan.' });
        }
        res.json({ message: 'Data MOS berhasil dihapus.' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menghapus data MOS', error: error.message });
    }
};

module.exports = {
    getAllMos,
    createMos,
    updateMos,
    deleteMos,
};