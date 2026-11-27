const db = require('../config/db');
const {
  ALLOWED_PROJECT_ROLES,
  listAllInvitationsForSuperAdmin,
  reviewInvitation,
  logActivity,
} = require('../services/invitationService');

async function getAllUsers(req, res) {
  try {
    const [users] = await db.query(
      `SELECT id, nama, email, posisi, role, is_active, created_at, updated_at
       FROM users
       ORDER BY id DESC`
    );

    const [members] = await db.query(
      `SELECT pm.user_id, pm.project_id, pm.role_code, pm.status, p.nama_proyek
       FROM project_members pm
       INNER JOIN proyek p ON p.id = pm.project_id
       WHERE pm.status = 'active'`
    );

    const byUser = new Map();
    for (const m of members) {
      if (!byUser.has(m.user_id)) byUser.set(m.user_id, []);
      byUser.get(m.user_id).push(m);
    }

    const enriched = users.map((u) => ({
      ...u,
      is_active: Number(u.is_active) !== 0,
      memberships: byUser.get(u.id) || [],
    }));

    return res.json({ data: enriched });
  } catch (err) {
    console.error('SuperAdmin getAllUsers error:', err);
    return res.status(500).json({ message: 'Gagal memuat daftar pengguna.' });
  }
}

async function updateUserRole(req, res) {
  const targetUserId = Number(req.params.id);
  const nextSystemRole = req.body?.role !== undefined ? String(req.body.role).trim() : null;
  const nextPosisi = req.body?.posisi !== undefined ? String(req.body.posisi).trim() : null;
  const nextActive = req.body?.is_active !== undefined ? Boolean(req.body.is_active) : null;

  if (!targetUserId) {
    return res.status(400).json({ message: 'ID pengguna tidak valid.' });
  }

  // Cegah eskalasi diri sendiri atau pengaturan role ilegal
  if (nextSystemRole && !['user', 'SuperAdmin'].includes(nextSystemRole)) {
    return res.status(400).json({ message: 'Role sistem tidak valid.' });
  }

  if (nextPosisi && !ALLOWED_PROJECT_ROLES.includes(nextPosisi)) {
    return res.status(400).json({ message: 'Posisi/role operasional tidak valid.' });
  }

  try {
    const [existingRows] = await db.query(
      'SELECT id, role, posisi, is_active FROM users WHERE id = ? LIMIT 1',
      [targetUserId]
    );
    if (!existingRows.length) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    }

    const updates = [];
    const values = [];

    if (nextSystemRole !== null) {
      updates.push('role = ?');
      values.push(nextSystemRole);
    }
    if (nextPosisi !== null) {
      updates.push('posisi = ?');
      values.push(nextPosisi);
    }
    if (nextActive !== null) {
      updates.push('is_active = ?');
      values.push(nextActive ? 1 : 0);
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'Tidak ada perubahan yang dikirim.' });
    }

    values.push(targetUserId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    await logActivity(db, {
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'USER_ROLE_UPDATED',
      entityType: 'users',
      entityId: targetUserId,
      details: { role: nextSystemRole, posisi: nextPosisi, is_active: nextActive },
      ipAddress: req.ip,
    });

    return res.json({ message: 'Role/status pengguna berhasil diperbarui.' });
  } catch (err) {
    console.error('SuperAdmin updateUserRole error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui role pengguna.' });
  }
}

async function getAllProjects(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id AND pm.status = 'active') AS total_anggota
       FROM proyek p
       ORDER BY p.created_at DESC, p.id DESC`
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error('SuperAdmin getAllProjects error:', err);
    return res.status(500).json({ message: 'Gagal memuat seluruh proyek.' });
  }
}

async function getInvitations(req, res) {
  try {
    const status = String(req.query?.status || '').trim();
    const rows = await listAllInvitationsForSuperAdmin(status);
    return res.json({ data: rows });
  } catch (err) {
    console.error('SuperAdmin getInvitations error:', err);
    return res.status(500).json({ message: 'Gagal memuat permintaan undangan.' });
  }
}

async function reviewInvitationRequest(req, res) {
  try {
    const invitationId = Number(req.params.id);
    const decision = req.body?.decision || req.body?.action;
    const approvedRoleCode = req.body?.approved_role_code || req.body?.role_code;
    const rejectionReason = req.body?.rejection_reason || req.body?.reason;

    const result = await reviewInvitation({
      superAdminUser: req.user,
      invitationId,
      decision,
      approvedRoleCode,
      rejectionReason,
      ipAddress: req.ip,
    });

    return res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('SuperAdmin reviewInvitation error:', err);
    return res.status(500).json({ message: 'Gagal memproses tinjauan undangan.' });
  }
}

async function getActivityLogs(req, res) {
  try {
    const limit = Math.min(Math.max(Number(req.query?.limit) || 100, 1), 500);
    const [rows] = await db.query(
      `SELECT al.*, u.nama AS actor_nama, u.email AS actor_email, p.nama_proyek
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       LEFT JOIN proyek p ON p.id = al.project_id
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT ?`,
      [limit]
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error('SuperAdmin getActivityLogs error:', err);
    return res.status(500).json({ message: 'Gagal memuat log aktivitas sistem.' });
  }
}

module.exports = {
  getAllUsers,
  updateUserRole,
  getAllProjects,
  getInvitations,
  reviewInvitationRequest,
  getActivityLogs,
};