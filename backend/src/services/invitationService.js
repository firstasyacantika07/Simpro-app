const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const { normalizeRole, isSuperAdminRole } = require('../middleware/authMiddleware');

const ALLOWED_PROJECT_ROLES = [
    'Project Manager',
    'Admin Proyek',
    'Staff Proyek',
    'Logistik',
    'QS (Quantity Surveyor)',
    'Pengawas',
    'Business Analyst',
    'Team Developer',
];

async function getActiveProjectRoles() {
    try {
        const [rows] = await db.query(
            'SELECT role_name FROM project_roles WHERE is_active = 1 ORDER BY id ASC'
        );
        if (Array.isArray(rows) && rows.length > 0) {
            const dbRoles = rows
                .map((r) => String(r.role_name || '').trim())
                .filter(Boolean);
            return Array.from(new Set(['Project Manager', ...dbRoles]));
        }
    } catch (_) {
        // Fallback ke daftar role statis jika tabel project_roles belum tersedia
    }
    return ALLOWED_PROJECT_ROLES;
}

function resolveCanonicalRole(roleVal = '', allowedList = ALLOWED_PROJECT_ROLES) {
    const clean = String(roleVal || '').trim();
    if (!clean) return '';
    const norm = normalizeRole(clean);
    const matched = allowedList.find((r) => normalizeRole(r) === norm);
    return matched || clean;
}

async function resolveCanonicalRoleFromDb(roleVal = '') {
    const allowedList = await getActiveProjectRoles();
    return {
        canonicalRole: resolveCanonicalRole(roleVal, allowedList),
        allowedList,
    };
}

function isPmRole(roleVal = '') {
    const n = normalizeRole(roleVal);
    return ['pm', 'project manager', 'proyek manager'].includes(n);
}

function createMailTransporter() {
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
        auth: { user, pass },
    });
}

async function logActivity(connOrDb, payload) {
    try {
        await connOrDb.query(
            `INSERT INTO activity_logs
        (actor_user_id, actor_role, action, entity_type, entity_id, project_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                payload.actorUserId || null,
                payload.actorRole || null,
                payload.action,
                payload.entityType || null,
                payload.entityId ? String(payload.entityId) : null,
                payload.projectId || null,
                payload.details ? JSON.stringify(payload.details) : null,
                payload.ipAddress || null,
            ]
        );
    } catch (err) {
        console.warn('[ACTIVITY LOG WARN]:', err.message);
    }
}

async function assertPmOwnsProject(user, projectId) {
    const [projRows] = await db.query(
        'SELECT id, nama_proyek, lokasi FROM proyek WHERE id = ? LIMIT 1',
        [Number(projectId)]
    );
    if (!projRows.length) {
        const err = new Error('Proyek tidak ditemukan.');
        err.status = 404;
        throw err;
    }

    if (isSuperAdminRole(user?.role)) {
        return projRows[0];
    }

    const effectiveRole = user?.role_di_proyek || user?.posisi || '';
    if (isPmRole(effectiveRole)) {
        const [pmRows] = await db.query(
            `SELECT id, role_code FROM project_members
       WHERE project_id = ? AND user_id = ? AND status = 'active' LIMIT 1`,
            [Number(projectId), user.id]
        );
        const [legacyRows] = await db.query(
            `SELECT id FROM proyek_anggota
       WHERE proyek_id = ? AND (user_id = ? OR LOWER(email) = LOWER(?))
         AND status IN ('active', 'accepted') LIMIT 1`,
            [Number(projectId), user.id, user.email || '']
        );
        const [anyMembers] = await db.query(
            'SELECT COUNT(*) AS cnt FROM project_members WHERE project_id = ?',
            [Number(projectId)]
        );

        const hasMembership = pmRows.length > 0 || legacyRows.length > 0;
        const hasPmRoleInProject =
            pmRows.length === 0 || isPmRole(pmRows[0]?.role_code || effectiveRole);

        if (!hasPmRoleInProject) {
            const err = new Error('Anda tidak memiliki kewenangan PM pada proyek ini.');
            err.status = 403;
            throw err;
        }

        if (!hasMembership && Number(anyMembers[0]?.cnt || 0) > 0) {
            const err = new Error('Anda tidak memiliki kewenangan pada proyek ini.');
            err.status = 403;
            throw err;
        }

        return projRows[0];
    }

    const err = new Error('Hanya Project Manager yang dapat mengajukan permintaan undangan proyek.');
    err.status = 403;
    throw err;
}

async function createInvitationRequest({ user, projectId, invitedEmail, requestedRole, ipAddress }) {
    const email = String(invitedEmail || '').trim().toLowerCase();
    const { canonicalRole: roleCode, allowedList } = await resolveCanonicalRoleFromDb(requestedRole);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!projectId || !email || !emailRegex.test(email)) {
        const err = new Error('Proyek dan email calon anggota yang valid wajib diisi.');
        err.status = 400;
        throw err;
    }

    const allowedSet = new Set(allowedList.map((r) => normalizeRole(r)));
    if (!roleCode || !allowedSet.has(normalizeRole(roleCode))) {
        const err = new Error('Role yang diminta tidak valid atau sudah dinonaktifkan.');
        err.status = 400;
        throw err;
    }

    const project = await assertPmOwnsProject(user, projectId);

    const [dupRows] = await db.query(
        `SELECT id, status FROM project_invitations
     WHERE project_id = ? AND LOWER(invited_email) = LOWER(?)
       AND status IN ('pending_approval', 'approved', 'active')
     LIMIT 1`,
        [Number(projectId), email]
    );

    if (dupRows.length > 0) {
        const err = new Error(
            `Sudah terdapat undangan berstatus "${dupRows[0].status}" untuk ${email} pada proyek ini.`
        );
        err.status = 409;
        throw err;
    }

    const [result] = await db.query(
        `INSERT INTO project_invitations
      (project_id, invited_email, requested_role_code, invited_by, status)
     VALUES (?, ?, ?, ?, 'pending_approval')`,
        [Number(projectId), email, roleCode, user.id]
    );

    await logActivity(db, {
        actorUserId: user.id,
        actorRole: user.role || user.posisi,
        action: 'INVITATION_REQUEST_CREATED',
        entityType: 'project_invitations',
        entityId: result.insertId,
        projectId: Number(projectId),
        details: { invited_email: email, requested_role_code: roleCode },
        ipAddress,
    });

    return {
        id: result.insertId,
        project_id: Number(projectId),
        nama_proyek: project.nama_proyek,
        invited_email: email,
        requested_role_code: roleCode,
        invited_by: user.id,
        status: 'pending_approval',
        message: 'Permintaan undangan dikirim ke SuperAdmin untuk persetujuan.',
    };
}

async function listInvitationsForPm(user, projectId = null) {
    const params = [user.id];
    let filterProject = '';
    if (projectId) {
        filterProject = ' AND pi.project_id = ?';
        params.push(Number(projectId));
    }

    const [rows] = await db.query(
        `SELECT pi.*, p.nama_proyek, p.lokasi,
            inv.nama AS invited_by_nama, inv.email AS invited_by_email,
            rev.nama AS reviewed_by_nama
     FROM project_invitations pi
     INNER JOIN proyek p ON p.id = pi.project_id
     LEFT JOIN users inv ON inv.id = pi.invited_by
     LEFT JOIN users rev ON rev.id = pi.reviewed_by
     WHERE pi.invited_by = ? ${filterProject}
     ORDER BY pi.created_at DESC, pi.id DESC`,
        params
    );
    return rows;
}

async function listAllInvitationsForSuperAdmin(statusFilter = '') {
    const params = [];
    let whereSql = '';
    if (statusFilter) {
        whereSql = 'WHERE pi.status = ?';
        params.push(String(statusFilter).trim());
    }

    const [rows] = await db.query(
        `SELECT pi.*, p.nama_proyek, p.lokasi,
            inv.nama AS invited_by_nama, inv.email AS invited_by_email,
            rev.nama AS reviewed_by_nama
     FROM project_invitations pi
     INNER JOIN proyek p ON p.id = pi.project_id
     LEFT JOIN users inv ON inv.id = pi.invited_by
     LEFT JOIN users rev ON rev.id = pi.reviewed_by
     ${whereSql}
     ORDER BY
       CASE WHEN pi.status = 'pending_approval' THEN 0 ELSE 1 END,
       pi.created_at DESC,
       pi.id DESC`,
        params
    );
    return rows;
}

async function sendApprovedInvitationEmail({ invitation, project, inviterName, finalRole, token }) {
    const transporter = createMailTransporter();
    if (!transporter) {
        return {
            emailSent: false,
            emailError: 'Konfigurasi SMTP belum lengkap di environment.',
        };
    }

    const appUrl = String(process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const registerUrl = `${appUrl}/register?token=${encodeURIComponent(token)}&email=${encodeURIComponent(
        invitation.invited_email
    )}`;
    const loginUrl = `${appUrl}/login?invite_token=${encodeURIComponent(token)}`;

    const info = await transporter.sendMail({
        from: `"SIMPRO" <${process.env.SMTP_USER.trim()}>`,
        to: invitation.invited_email,
        subject: `Undangan Proyek Disetujui: ${project.nama_proyek}`,
        html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f172a; margin-bottom: 16px;">Undangan Bergabung ke Proyek SIMPRO</h2>
        <p>Yth. Bapak/Ibu,</p>
        <p>
          Permintaan undangan dari <strong>${inviterName || 'Project Manager'}</strong> untuk Anda bergabung
          ke proyek pada <strong>SIMPRO (Sistem Informasi Monitoring Proyek)</strong> telah disetujui.
        </p>
        <div style="background-color: #f8fafc; padding: 16px 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="margin: 6px 0;"><strong>Nama Proyek:</strong> ${project.nama_proyek}</p>
          <p style="margin: 6px 0;"><strong>Project Manager Pengundang:</strong> ${inviterName || '-'}</p>
          <p style="margin: 6px 0;"><strong>Role Ditetapkan:</strong> ${finalRole}</p>
          <p style="margin: 6px 0;"><strong>Email Undangan:</strong> ${invitation.invited_email}</p>
        </div>
        <p>Silakan lanjutkan melalui tautan berikut menggunakan email <strong>${invitation.invited_email}</strong>:</p>
        <p style="margin: 22px 0;">
          <a href="${registerUrl}"
             style="display: inline-block; padding: 11px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px;">
            Registrasi Akun
          </a>
          <a href="${loginUrl}"
             style="display: inline-block; padding: 11px 20px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Login Akun Terdaftar
          </a>
        </p>
        <p style="font-size: 13px; color: #475569;">
          Tautan undangan berlaku selama 7 hari dan hanya dapat digunakan satu kali.
        </p>
        <p style="margin-top: 24px;">Hormat kami,<br><strong>Tim SIMPRO</strong></p>
      </div>
    `,
    });

    return { emailSent: true, messageId: info.messageId };
}

async function reviewInvitation({
    superAdminUser,
    invitationId,
    decision,
    approvedRoleCode,
    rejectionReason,
    ipAddress,
}) {
    const normalizedDecision = String(decision || '').trim().toLowerCase();
    if (!['approve', 'reject'].includes(normalizedDecision)) {
        const err = new Error('Keputusan harus berupa "approve" atau "reject".');
        err.status = 400;
        throw err;
    }

    const [rows] = await db.query(
        `SELECT pi.*, p.nama_proyek, p.lokasi, inv.nama AS inviter_nama
     FROM project_invitations pi
     INNER JOIN proyek p ON p.id = pi.project_id
     LEFT JOIN users inv ON inv.id = pi.invited_by
     WHERE pi.id = ? LIMIT 1`,
        [Number(invitationId)]
    );

    const invitation = rows?.[0];
    if (!invitation) {
        const err = new Error('Permintaan undangan tidak ditemukan.');
        err.status = 404;
        throw err;
    }

    if (invitation.status !== 'pending_approval') {
        const err = new Error(`Undangan sudah diproses dengan status "${invitation.status}".`);
        err.status = 409;
        throw err;
    }

    if (normalizedDecision === 'reject') {
        const reason = String(rejectionReason || '').trim() || null;
        await db.query(
            `UPDATE project_invitations
       SET status = 'rejected',
           reviewed_by = ?,
           reviewed_at = NOW(),
           rejection_reason = ?
       WHERE id = ?`,
            [superAdminUser.id, reason, invitation.id]
        );

        await logActivity(db, {
            actorUserId: superAdminUser.id,
            actorRole: superAdminUser.role,
            action: 'INVITATION_REJECTED',
            entityType: 'project_invitations',
            entityId: invitation.id,
            projectId: invitation.project_id,
            details: { invited_email: invitation.invited_email, rejection_reason: reason },
            ipAddress,
        });

        return {
            id: invitation.id,
            status: 'rejected',
            rejection_reason: reason,
            message: 'Permintaan undangan telah ditolak.',
        };
    }

    const { canonicalRole: finalRole, allowedList } = await resolveCanonicalRoleFromDb(
        approvedRoleCode || invitation.requested_role_code
    );
    const allowedSet = new Set(allowedList.map((r) => normalizeRole(r)));
    if (!finalRole || !allowedSet.has(normalizeRole(finalRole))) {
        const err = new Error('Role final yang ditetapkan tidak valid atau sudah dinonaktifkan.');
        err.status = 400;
        throw err;
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(
        `UPDATE project_invitations
     SET status = 'approved',
         approved_role_code = ?,
         reviewed_by = ?,
         reviewed_at = NOW(),
         invite_token = ?,
         expires_at = ?,
         rejection_reason = NULL
     WHERE id = ?`,
        [finalRole, superAdminUser.id, inviteToken, expiresAt, invitation.id]
    );

    let emailResult = { emailSent: false, emailError: null };
    try {
        emailResult = await sendApprovedInvitationEmail({
            invitation,
            project: { nama_proyek: invitation.nama_proyek, lokasi: invitation.lokasi },
            inviterName: invitation.inviter_nama,
            finalRole,
            token: inviteToken,
        });
    } catch (mailErr) {
        emailResult = { emailSent: false, emailError: mailErr.message };
        console.error('[INVITATION EMAIL ERROR]:', mailErr);
    }

    await logActivity(db, {
        actorUserId: superAdminUser.id,
        actorRole: superAdminUser.role,
        action: 'INVITATION_APPROVED',
        entityType: 'project_invitations',
        entityId: invitation.id,
        projectId: invitation.project_id,
        details: {
            invited_email: invitation.invited_email,
            requested_role_code: invitation.requested_role_code,
            approved_role_code: finalRole,
            emailSent: emailResult.emailSent,
        },
        ipAddress,
    });

    return {
        id: invitation.id,
        status: 'approved',
        approved_role_code: finalRole,
        expires_at: expiresAt,
        emailSent: emailResult.emailSent,
        ...(emailResult.emailError ? { emailError: emailResult.emailError } : {}),
        message: emailResult.emailSent
            ? 'Undangan disetujui dan email undangan telah dikirim.'
            : 'Undangan disetujui.',
    };
}

async function validateInvitationToken(token, email = '') {
    const cleanToken = String(token || '').trim();
    if (!cleanToken) {
        const err = new Error('Token undangan tidak ditemukan.');
        err.status = 400;
        throw err;
    }

    const [rows] = await db.query(
        `SELECT pi.*, p.nama_proyek, p.lokasi, inv.nama AS inviter_nama
     FROM project_invitations pi
     INNER JOIN proyek p ON p.id = pi.project_id
     LEFT JOIN users inv ON inv.id = pi.invited_by
     WHERE pi.invite_token = ? LIMIT 1`,
        [cleanToken]
    );

    const inv = rows?.[0];
    if (!inv) {
        const err = new Error('Token undangan tidak valid.');
        err.status = 404;
        throw err;
    }

    if (inv.status === 'active') {
        const err = new Error('Undangan ini sudah digunakan dan berstatus aktif.');
        err.status = 409;
        throw err;
    }

    if (inv.status !== 'approved') {
        const err = new Error(`Undangan belum disetujui atau tidak aktif (status: ${inv.status}).`);
        err.status = 400;
        throw err;
    }

    if (inv.expires_at && new Date(inv.expires_at).getTime() <= Date.now()) {
        const err = new Error('Token undangan sudah kedaluwarsa.');
        err.status = 410;
        throw err;
    }

    if (email && String(email).trim().toLowerCase() !== String(inv.invited_email).toLowerCase()) {
        const err = new Error('Email registrasi tidak sesuai dengan email undangan yang disetujui.');
        err.status = 400;
        throw err;
    }

    const { canonicalRole: finalRole } = await resolveCanonicalRoleFromDb(
        inv.approved_role_code || inv.requested_role_code
    );
    return {
        invitation: inv,
        finalRole,
        projectName: inv.nama_proyek,
        inviterName: inv.inviter_nama,
    };
}

async function activateInvitationForUser(conn, invitation, userId, finalRole) {
    const [freshRows] = await conn.query(
        'SELECT id, status FROM project_invitations WHERE id = ? FOR UPDATE',
        [invitation.id]
    );
    if (!freshRows.length || freshRows[0].status !== 'approved') {
        const err = new Error('Undangan tidak lagi tersedia untuk diaktifkan.');
        err.status = 409;
        throw err;
    }

    const { canonicalRole: normalizedFinalRole } = await resolveCanonicalRoleFromDb(finalRole);

    await conn.query(
        `INSERT INTO project_members (project_id, user_id, role_code, status)
     VALUES (?, ?, ?, 'active')
     ON DUPLICATE KEY UPDATE
       role_code = VALUES(role_code),
       status = 'active'`,
        [invitation.project_id, userId, normalizedFinalRole]
    );

    try {
        await conn.query(
            `INSERT INTO proyek_anggota (proyek_id, user_id, email, role_proyek, status, invited_by)
       VALUES (?, ?, ?, ?, 'active', ?)
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         role_proyek = VALUES(role_proyek),
         status = 'active'`,
            [
                invitation.project_id,
                userId,
                invitation.invited_email,
                normalizedFinalRole,
                invitation.invited_by,
            ]
        );
    } catch (_) {
        // Abaikan bila tabel proyek_anggota tidak dipakai
    }

    await conn.query(
        `UPDATE project_invitations
     SET status = 'active',
         accepted_at = NOW(),
         invite_token = NULL
     WHERE id = ?`,
        [invitation.id]
    );
}

module.exports = {
    ALLOWED_PROJECT_ROLES,
    getActiveProjectRoles,
    resolveCanonicalRole,
    resolveCanonicalRoleFromDb,
    createInvitationRequest,
    listInvitationsForPm,
    listAllInvitationsForSuperAdmin,
    reviewInvitation,
    validateInvitationToken,
    activateInvitationForUser,
    logActivity,
};