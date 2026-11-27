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

async function listMos(req, res) {
  const { proyek_id } = req.query;

  try {
    const params = [];
    const whereSql = proyek_id ? 'WHERE proyek_id = ?' : '';
    if (proyek_id) {
      params.push(proyek_id);
    }

    const [rows] = await db.query(
      `SELECT id,
              proyek_id,
              kode_material,
              nama_material,
              tanggal_masuk,
              tanggal_update,
              jumlah,
              jumlah_masuk,
              jumlah_terpakai,
              satuan,
              created_at,
              updated_at
       FROM mos
       ${whereSql}
       ORDER BY COALESCE(tanggal_update, tanggal_masuk, created_at) DESC, id DESC`,
      params
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({
      message: 'Gagal mengambil data MOS',
      error: error.message,
    });
  }
}

async function listProgress(req, res) {
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

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({
      message: 'Gagal mengambil data progress',
      error: error.message,
    });
  }
}

async function createMos(req, res) {
  try {
    const {
      proyek_id,
      kode_material,
      nama_material,
      satuan,
      jumlah_masuk,
      jumlah_terpakai,
      tanggal_masuk,
      tanggal_update,
    } = req.body;

    if (!proyek_id || !nama_material) {
      return res.status(400).json({
        message: 'Proyek dan nama material wajib diisi.',
      });
    }

    const masukVal = Number(jumlah_masuk) || 0;
    const terpakaiVal = Number(jumlah_terpakai) || 0;
    const sisaVal = Math.max(masukVal - terpakaiVal, 0);
    const tglUpdate =
      tanggal_update || tanggal_masuk || new Date().toISOString().split('T')[0];

    const [result] = await db.query(
      `INSERT INTO mos (
          proyek_id,
          kode_material,
          nama_material,
          tanggal_masuk,
          tanggal_update,
          jumlah,
          jumlah_masuk,
          jumlah_terpakai,
          satuan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(proyek_id),
        kode_material ? String(kode_material).trim() : null,
        String(nama_material).trim(),
        tanggal_masuk || tglUpdate,
        tglUpdate,
        sisaVal,
        masukVal,
        terpakaiVal,
        String(satuan || 'Unit').trim(),
      ]
    );

    return res.status(201).json({
      id: result.insertId,
      message: 'Data MOS berhasil ditambahkan',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Gagal menambahkan data MOS',
      error: error.message,
    });
  }
}

async function createProgress(req, res) {
  try {
    const proyekId = req.body?.proyek_id ? Number(req.body.proyek_id) : null;
    const bangunanId =
      req.body?.bangunan_id !== undefined &&
      req.body?.bangunan_id !== null &&
      String(req.body.bangunan_id).trim() !== ''
        ? Number(req.body.bangunan_id)
        : null;

    const uraianPekerjaan =
      typeof req.body?.uraian_pekerjaan === 'string'
        ? req.body.uraian_pekerjaan.trim()
        : '';

    if (!proyekId || !uraianPekerjaan) {
      return res.status(400).json({
        message: 'Proyek dan uraian pekerjaan wajib diisi.',
      });
    }

    const tanggalLaporan =
      typeof req.body?.tanggal_laporan === 'string' &&
      req.body.tanggal_laporan.trim() !== ''
        ? req.body.tanggal_laporan.trim()
        : new Date().toISOString().split('T')[0];

    const bobotRealisasi = Math.min(
      Math.max(Number(req.body?.bobot_realisasi) || 0, 0),
      100
    );

    const rawCatatan = req.body?.catatan ?? req.body?.kendala ?? null;
    const catatan =
      typeof rawCatatan === 'string' && rawCatatan.trim() !== ''
        ? rawCatatan.trim()
        : null;

    const pelaksana =
      typeof req.body?.pelaksana === 'string' && req.body.pelaksana.trim() !== ''
        ? req.body.pelaksana.trim()
        : req.user?.nama || null;

    let namaBangunan =
      typeof req.body?.nama_bangunan === 'string' &&
      req.body.nama_bangunan.trim() !== ''
        ? req.body.nama_bangunan.trim()
        : null;

    if (bangunanId) {
      const [bangunanRows] = await db.query(
        'SELECT nama_bangunan FROM proyek_bangunan WHERE id = ? AND proyek_id = ? LIMIT 1',
        [bangunanId, proyekId]
      );
      if (bangunanRows.length > 0) {
        namaBangunan = bangunanRows[0].nama_bangunan;
      }
    }

    const cuaca =
      typeof req.body?.cuaca === 'string' && req.body.cuaca.trim() !== ''
        ? req.body.cuaca.trim()
        : null;

    const dokumentasi =
      typeof req.body?.dokumentasi === 'string' &&
      req.body.dokumentasi.trim() !== ''
        ? req.body.dokumentasi
        : null;

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

    return res.status(201).json({
      id: result.insertId,
      message: 'Laporan progress harian berhasil disimpan',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Gagal menyimpan laporan progress harian',
      error: error.message,
    });
  }
}

module.exports = {
  listMos,
  listProgress,
  createMos,
  createProgress,
  syncBuildingAndProjectProgress,
};