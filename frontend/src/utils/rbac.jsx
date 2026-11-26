const normalizeRole = (posisi = '') =>
    String(posisi).trim().toLowerCase().replace(/\s+/g, ' ');

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

export const canEditMOS = (posisi) => {
    const normalized = normalizeRole(posisi);
    return ['logistik', 'admin proyek'].includes(normalized);
};

export const canEditProgress = (posisi) => {
    const normalized = normalizeRole(posisi);
    return normalized === 'qs (quantity surveyor)' || normalized === 'qs';
};

export const isProjectManagerRole = (posisi) => {
    const normalized = normalizeRole(posisi);
    return ['pm', 'project manager', 'proyek manager'].includes(normalized);
};