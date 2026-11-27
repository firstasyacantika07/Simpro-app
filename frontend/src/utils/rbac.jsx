const normalizeRole = (value = '') =>
    String(value).trim().toLowerCase().replace(/\s+/g, ' ');

export const getUser = () => {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
};

export const isSuperAdmin = (userOrRole) => {
    if (!userOrRole) return false;
    if (typeof userOrRole === 'string') {
        return normalizeRole(userOrRole) === 'superadmin';
    }
    return (
        normalizeRole(userOrRole?.role) === 'superadmin' ||
        normalizeRole(userOrRole?.posisi) === 'superadmin'
    );
};

const extractRoleCandidates = (userOrRole, projectId = null) => {
    if (!userOrRole) return [];
    if (typeof userOrRole === 'string') {
        return [userOrRole].filter(Boolean);
    }

    const candidates = [];
    const memberships = Array.isArray(userOrRole.memberships)
        ? userOrRole.memberships
        : [];

    if (projectId != null && memberships.length > 0) {
        const matched = memberships.find(
            (m) => String(m.project_id) === String(projectId)
        );
        if (matched?.role_code) {
            candidates.push(matched.role_code);
        }
    }

    if (userOrRole.role_di_proyek) candidates.push(userOrRole.role_di_proyek);
    if (userOrRole.posisi) candidates.push(userOrRole.posisi);

    if (projectId == null && memberships.length > 0) {
        memberships.forEach((m) => {
            if (m?.role_code) candidates.push(m.role_code);
        });
    }

    if (userOrRole.role && normalizeRole(userOrRole.role) !== 'user') {
        candidates.push(userOrRole.role);
    }

    return candidates;
};

const matchesAnyRole = (userOrRole, allowedRoles, projectId = null) => {
    if (isSuperAdmin(userOrRole)) return true;
    const normalizedAllowed = new Set(allowedRoles.map(normalizeRole));
    const candidates = extractRoleCandidates(userOrRole, projectId);
    return candidates.some((c) => normalizedAllowed.has(normalizeRole(c)));
};

export const canEditMOS = (userOrRole, projectId = null) => {
    return matchesAnyRole(
        userOrRole,
        ['logistik', 'admin proyek'],
        projectId
    );
};

export const canEditProgress = (userOrRole, projectId = null) => {
    return matchesAnyRole(
        userOrRole,
        ['qs (quantity surveyor)', 'qs'],
        projectId
    );
};

export const isProjectManagerRole = (userOrRole, projectId = null) => {
    return matchesAnyRole(
        userOrRole,
        ['pm', 'project manager', 'proyek manager'],
        projectId
    );
};

export const canManageProject = (userOrRole, projectId = null) => {
    return isProjectManagerRole(userOrRole, projectId);
};