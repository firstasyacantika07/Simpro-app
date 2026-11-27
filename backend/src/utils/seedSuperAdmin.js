require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seedSuperAdmin() {
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.SUPERADMIN_PASSWORD || '');
  const nama = String(process.env.SUPERADMIN_NAME || 'Super Admin SIMPRO').trim();

  if (!email || !password) {
    console.error(
      '[SEED SUPERADMIN] Set SUPERADMIN_EMAIL dan SUPERADMIN_PASSWORD di environment/.env terlebih dahulu.'
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('[SEED SUPERADMIN] Password SuperAdmin minimal 8 karakter.');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const [existing] = await db.query(
    'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
    [email]
  );

  if (existing.length > 0) {
    await db.query(
      `UPDATE users
       SET nama = ?, password = ?, role = 'SuperAdmin', is_active = 1
       WHERE id = ?`,
      [nama, hashedPassword, existing[0].id]
    );
    console.log(`[SEED SUPERADMIN] Akun SuperAdmin diperbarui untuk ${email}.`);
  } else {
    await db.query(
      `INSERT INTO users (nama, email, password, posisi, role, is_active)
       VALUES (?, ?, ?, 'Project Manager', 'SuperAdmin', 1)`,
      [nama, email, hashedPassword]
    );
    console.log(`[SEED SUPERADMIN] Akun SuperAdmin baru dibuat untuk ${email}.`);
  }

  process.exit(0);
}

seedSuperAdmin().catch((err) => {
  console.error('[SEED SUPERADMIN ERROR]:', err);
  process.exit(1);
});