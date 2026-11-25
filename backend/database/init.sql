USE simpro_db;

-- 1. Tabel Users dengan Role Spesifik
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    posisi ENUM('Staff Proyek', 'Admin Proyek', 'Logistik', 'QS (Quantity Surveyor)') NOT NULL,
    password VARCHAR(255) NOT NULL,
    reset_token VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Proyek
CREATE TABLE IF NOT EXISTS proyek (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_proyek VARCHAR(150) NOT NULL,
    lokasi VARCHAR(255),
    tanggal_mulai DATE,
    target_selesai DATE,
    persentase_progres DECIMAL(5,2) DEFAULT 0.00,
    status ENUM('Perencanaan', 'Berjalan', 'Selesai', 'Tertunda') DEFAULT 'Perencanaan',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Material On Site (MOS)
CREATE TABLE IF NOT EXISTS material_on_site (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proyek_id INT NOT NULL,
    kode_material VARCHAR(50) NOT NULL,
    nama_material VARCHAR(100) NOT NULL,
    satuan VARCHAR(20) NOT NULL,
    jumlah_masuk DECIMAL(10,2) DEFAULT 0.00,
    jumlah_terpakai DECIMAL(10,2) DEFAULT 0.00,
    tanggal_update DATE NOT NULL,
    FOREIGN KEY (proyek_id) REFERENCES proyek(id) ON DELETE CASCADE
);

-- 4. Tabel Laporan Progress Harian
CREATE TABLE IF NOT EXISTS laporan_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proyek_id INT NOT NULL,
    tanggal_laporan DATE NOT NULL,
    uraian_pekerjaan TEXT NOT NULL,
    bobot_rencana DECIMAL(5,2) NOT NULL,
    bobot_realisasi DECIMAL(5,2) NOT NULL,
    kendala TEXT,
    dibuat_oleh INT,
    FOREIGN KEY (proyek_id) REFERENCES proyek(id) ON DELETE CASCADE,
    FOREIGN KEY (dibuat_oleh) REFERENCES users(id) ON DELETE SET NULL
);