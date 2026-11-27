const db = require('../config/db');

async function syncBuildingAndProjectProgress(proyekId, bangunanId) {
    if (!proyekId) return;

    if (bangunanId) {
        const [latestBuildingRows] = await db.query(
            `SELECT bobot_realisasi
             FROM progress_harian
             WHERE proyek_id = ? AND bangunan_id = ?
             ORDER BY tanggal_laporan DESC, id DESC
             LIMIT 1`,
            [proyekId, bangunanId]
        );

        const buildingProgress =
            latestBuildingRows.length > 0
                ? Number(latestBuildingRows[0].bobot_realisasi) || 0
                : 0;

        await db.query(
            `UPDATE proyek_bangunan
             SET persentase_progres = ?
             WHERE id = ? AND proyek_id = ?`,
            [buildingProgress, bangunanId, proyekId]
        );
    }

    const [buildings] = await db.query(
        `SELECT persentase_progres
         FROM proyek_bangunan
         WHERE proyek_id = ?`,
        [proyekId]
    );

    if (buildings.length > 0) {
        const total = buildings.reduce(
            (sum, row) => sum + (Number(row.persentase_progres) || 0),
            0
        );
        const avgProgress = Number((total / buildings.length).toFixed(2));
        await db.query(
            `UPDATE proyek
             SET persentase_progres = ?
             WHERE id = ?`,
            [avgProgress, proyekId]
        );
    }
}

async function resolveNamaBangunan(proyekId, bangunanId, rawNamaBangunan) {
    const trimmed =
        typeof rawNamaBangunan === 'string' && rawNamaBangunan.trim() !== ''
            ? rawNamaBangunan.trim()
            : null;

    if (bangunanId) {
        const [rows] = await db.query(
            `SELECT nama_bangunan
             FROM proyek_bangunan
             WHERE id = ? AND proyek_id = ?
             LIMIT 1`,
            [bangunanId, proyekId]
        );
        if (rows.length > 0) {
            return rows[0].nama_bangunan;
        }
    }

    return trimmed;
}

// GET /progress (opsional ?proyek_id=... atau ?bangunan_id=...)
const getAllProgress = async (req, res) => {
    const { proyek_id, bangunan_id } = req.query;

    try {
        const conditions = [];
        const params = [];

        if (proyek_id) {
            conditions.push('ph.proyek_id = ?');
            params.push(proyek_id);
        }
        if (bangunan_id) {
            conditions.push('ph.bangunan_id = ?');
            params.push(bangunan_id);
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await db.query(
            `SELECT ph.id,
                    ph.proyek_id,
                    ph.bangunan_id,
                    COALESCE(ph.nama_bangunan, pb.nama_bangunan) AS nama_bangunan,
                    COALESCE(ph.pelaksana, u.nama) AS pelaksana,
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
             ${whereSql}
             ORDER BY ph.tanggal_laporan DESC, ph.id DESC`,
            params
        );

        res.json(rows);
    } catch (error) {
        res.status(500).json({
            message: 'Gagal memuat laporan progress harian',
            error: error.message,
        });
    }
};

// POST /progress
const createProgress = async (req, res) => {
    const proyekId = req.body?.proyek_id ? Number(req.body.proyek_id) : null;
    const bangunanId =
        req.body?.bangunan_id !== undefined &&
            req.body?.bangunan_id !== null &&
            String(req.body.bangunan_id).trim() !== ''
            ? Number(req.body.bangunan_id)
            : null;

    const pelaksana =
        typeof req.body?.pelaksana === 'string' && req.body.pelaksana.trim() !== ''
            ? req.body.pelaksana.trim()
            : req.user?.nama || null;

    const uraianPekerjaan =
        typeof req.body?.uraian_pekerjaan === 'string' ? req.body.uraian_pekerjaan.trim() : '';
    const tanggalLaporan =
        typeof req.body?.tanggal_laporan === 'string' && req.body.tanggal_laporan.trim() !== ''
            ? req.body.tanggal_laporan.trim()
            : new Date().toISOString().split('T')[0];

    const bobotRealisasi = Math.min(
        Math.max(Number(req.body?.bobot_realisasi) || 0, 0),
        100
    );

    const rawCatatan = req.body?.catatan ?? req.body?.kendala ?? null;
    const catatan =
        typeof rawCatatan === 'string' && rawCatatan.trim() !== '' ? rawCatatan.trim() : null;

    const cuaca =
        typeof req.body?.cuaca === 'string' && req.body.cuaca.trim() !== ''
            ? req.body.cuaca.trim()
            : null;

    const dokumentasi =
        typeof req.body?.dokumentasi === 'string' && req.body.dokumentasi.trim() !== ''
            ? req.body.dokumentasi
            : null;

    if (!proyekId || !uraianPekerjaan) {
        return res.status(400).json({
            message: 'Proyek dan uraian pekerjaan wajib diisi.',
        });
    }

    try {
        const [proyekRows] = await db.query('SELECT id FROM proyek WHERE id = ?', [proyekId]);
        if (proyekRows.length === 0) {
            return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
        }

        const namaBangunan = await resolveNamaBangunan(
            proyekId,
            bangunanId,
            req.body?.nama_bangunan
        );

        const [result] = await db.query(
            `INSERT INTO progress_harian (
                proyek_id,
                bangunan_id,
                nama_bangunan,
                pelaksana,
                uraian_pekerjaan,
                tanggal_laporan,
                bobot_realisasi,
                catatan,
                cuaca,
                dokumentasi,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                proyekId,
                bangunanId,
                namaBangunan,
                pelaksana,
                uraianPekerjaan,
                tanggalLaporan,
                bobotRealisasi,
                catatan,
                cuaca,
                dokumentasi,
                req.user?.id || null,
            ]
        );

        await syncBuildingAndProjectProgress(proyekId, bangunanId);

        res.status(201).json({
            id: result.insertId,
            proyek_id: proyekId,
            bangunan_id: bangunanId,
            nama_bangunan: namaBangunan,
            pelaksana,
            uraian_pekerjaan: uraianPekerjaan,
            tanggal_laporan: tanggalLaporan,
            bobot_realisasi: bobotRealisasi,
            catatan,
            kendala: catatan,
            cuaca,
            dokumentasi,
            message: 'Laporan progress harian berhasil disimpan.',
        });
    } catch (error) {
        res.status(500).json({
            message: 'Gagal menyimpan laporan progress harian',
            error: error.message,
        });
    }
};

// PUT /progress/:id
const updateProgress = async (req, res) => {
    const { id } = req.params;

    try {
        const [existingRows] = await db.query(
            'SELECT * FROM progress_harian WHERE id = ?',
            [id]
        );
        if (existingRows.length === 0) {
            return res.status(404).json({ message: 'Laporan progress tidak ditemukan.' });
        }

        const existing = existingRows[0];
        const proyekId = req.body?.proyek_id ? Number(req.body.proyek_id) : existing.proyek_id;
        const bangunanId =
            req.body?.bangunan_id !== undefined
                ? req.body.bangunan_id === null || String(req.body.bangunan_id).trim() === ''
                    ? null
                    : Number(req.body.bangunan_id)
                : existing.bangunan_id;

        const namaBangunan =
            req.body?.nama_bangunan !== undefined || req.body?.bangunan_id !== undefined
                ? await resolveNamaBangunan(proyekId, bangunanId, req.body?.nama_bangunan)
                : existing.nama_bangunan;

        const pelaksana =
            req.body?.pelaksana !== undefined
                ? typeof req.body.pelaksana === 'string' && req.body.pelaksana.trim() !== ''
                    ? req.body.pelaksana.trim()
                    : null
                : existing.pelaksana;

        const uraianPekerjaan =
            req.body?.uraian_pekerjaan !== undefined
                ? String(req.body.uraian_pekerjaan).trim()
                : existing.uraian_pekerjaan;

        const tanggalLaporan =
            req.body?.tanggal_laporan !== undefined && String(req.body.tanggal_laporan).trim() !== ''
                ? String(req.body.tanggal_laporan).trim()
                : existing.tanggal_laporan;

        const bobotRealisasi =
            req.body?.bobot_realisasi !== undefined
                ? Math.min(Math.max(Number(req.body.bobot_realisasi) || 0, 0), 100)
                : existing.bobot_realisasi;

        const rawCatatan =
            req.body?.catatan !== undefined ? req.body.catatan : req.body?.kendala;
        const catatan =
            rawCatatan !== undefined
                ? typeof rawCatatan === 'string' && rawCatatan.trim() !== ''
                    ? rawCatatan.trim()
                    : null
                : existing.catatan;

        const cuaca =
            req.body?.cuaca !== undefined
                ? typeof req.body.cuaca === 'string' && req.body.cuaca.trim() !== ''
                    ? req.body.cuaca.trim()
                    : null
                : existing.cuaca;

        const dokumentasi =
            req.body?.dokumentasi !== undefined
                ? typeof req.body.dokumentasi === 'string' && req.body.dokumentasi.trim() !== ''
                    ? req.body.dokumentasi
                    : null
                : existing.dokumentasi;

        if (!uraianPekerjaan) {
            return res.status(400).json({ message: 'Uraian pekerjaan wajib diisi.' });
        }

        await db.query(
            `UPDATE progress_harian
             SET proyek_id = ?,
                 bangunan_id = ?,
                 nama_bangunan = ?,
                 pelaksana = ?,
                 uraian_pekerjaan = ?,
                 tanggal_laporan = ?,
                 bobot_realisasi = ?,
                 catatan = ?,
                 cuaca = ?,
                 dokumentasi = ?
             WHERE id = ?`,
            [
                proyekId,
                bangunanId,
                namaBangunan,
                pelaksana,
                uraianPekerjaan,
                tanggalLaporan,
                bobotRealisasi,
                catatan,
                cuaca,
                dokumentasi,
                id,
            ]
        );

        await syncBuildingAndProjectProgress(existing.proyek_id, existing.bangunan_id);
        await syncBuildingAndProjectProgress(proyekId, bangunanId);

        res.json({ message: 'Laporan progress harian berhasil diperbarui.' });
    } catch (error) {
        res.status(500).json({
            message: 'Gagal memperbarui laporan progress harian',
            error: error.message,
        });
    }
};

// DELETE /progress/:id
const deleteProgress = async (req, res) => {
    const { id } = req.params;

    try {
        const [existingRows] = await db.query(
            'SELECT proyek_id, bangunan_id FROM progress_harian WHERE id = ?',
            [id]
        );
        if (existingRows.length === 0) {
            return res.status(404).json({ message: 'Laporan progress tidak ditemukan.' });
        }

        const { proyek_id: proyekId, bangunan_id: bangunanId } = existingRows[0];

        await db.query('DELETE FROM progress_harian WHERE id = ?', [id]);
        await syncBuildingAndProjectProgress(proyekId, bangunanId);

        res.json({ message: 'Laporan progress harian berhasil dihapus.' });
    } catch (error) {
        res.status(500).json({
            message: 'Gagal menghapus laporan progress harian',
            error: error.message,
        });
    }
};

module.exports = {
    getAllProgress,
    createProgress,
    updateProgress,
    deleteProgress,
};