import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Plus,
    Pencil,
    Trash2,
    Lock,
    MapPin,
    Building2,
    CheckCircle2,
    TrendingUp,
    X,
    Upload,
    UserPlus,
    Users,
    Mail,
    Layers,
} from 'lucide-react';
import apiClient, { extractArray } from '../api/axiosClient';

const DEFAULT_SITE_IMAGE = '/foto.jpg';

const INITIAL_FORM = {
    nama_proyek: '',
    lokasi: '',
    status: 'Berjalan',
    persentase_progres: 0,
    gambar: '',
};

const canManageSites = (user) => {
    const posisi = user?.posisi || user?.role || '';
    const normalized = String(posisi).trim().toLowerCase();
    return (
        normalized === 'pm' ||
        normalized === 'proyek manager' ||
        normalized === 'project manager' ||
        normalized.includes('project manager') ||
        normalized.includes('proyek manager')
    );
};

const isSiteOwnedByUser = (site, user) => {
    if (!user) return true;

    const ownerIds = [
        site.user_id,
        site.created_by,
        site.pm_id,
        site.project_manager_id,
        site.owner_id,
    ].filter((val) => val !== undefined && val !== null && String(val) !== '');

    const ownerNames = [
        site.pm_nama,
        site.project_manager,
        site.penanggung_jawab,
        site.created_by_nama,
    ]
        .filter((val) => typeof val === 'string' && val.trim() !== '')
        .map((val) => val.trim().toLowerCase());

    const assignedList = Array.isArray(site.anggota)
        ? site.anggota
        : Array.isArray(site.users)
            ? site.users
            : [];

    const hasOwnershipMetadata =
        ownerIds.length > 0 || ownerNames.length > 0 || assignedList.length > 0;
    if (!hasOwnershipMetadata) return true;

    const matchById =
        user.id !== undefined &&
        user.id !== null &&
        ownerIds.some((id) => String(id) === String(user.id));

    const matchByName =
        typeof user.nama === 'string' &&
        user.nama.trim() !== '' &&
        ownerNames.includes(user.nama.trim().toLowerCase());

    const matchByAssigned = assignedList.some((member) => {
        if (typeof member === 'string' || typeof member === 'number') {
            return (
                String(member) === String(user.id) ||
                String(member).trim().toLowerCase() === String(user.nama || '').trim().toLowerCase()
            );
        }
        if (member && typeof member === 'object') {
            return (
                String(member.id ?? member.user_id ?? '') === String(user.id ?? '') ||
                String(member.nama ?? member.email ?? '').trim().toLowerCase() ===
                String(user.nama || '').trim().toLowerCase()
            );
        }
        return false;
    });

    return matchById || matchByName || matchByAssigned;
};

export default function SitesSection({ user, onDataChanged, onOpenProgress }) {
    const [proyekList, setProyekList] = useState([]);
    const [progressList, setProgressList] = useState([]);
    const [anggotaBySite, setAnggotaBySite] = useState({});
    const [bangunanBySite, setBangunanBySite] = useState({});
    const [bangunanInputBySite, setBangunanInputBySite] = useState({});
    const [bangunanSavingBySite, setBangunanSavingBySite] = useState({});
    const [bangunanErrorBySite, setBangunanErrorBySite] = useState({});

    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [fileName, setFileName] = useState('');
    const [form, setForm] = useState(INITIAL_FORM);

    // State Modal Invite Tim
    const [inviteSite, setInviteSite] = useState(null);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('');
    const [inviteSubmitting, setInviteSubmitting] = useState(false);
    const [inviteFeedback, setInviteFeedback] = useState(null);

    const fileInputRef = useRef(null);

    const hasWriteAccess = canManageSites(user);
    const roleLabel = user?.posisi || user?.role || 'Pengguna';

    const fetchAnggotaForSites = useCallback(async (sites) => {
        if (!Array.isArray(sites) || sites.length === 0) {
            setAnggotaBySite({});
            return;
        }

        const results = await Promise.allSettled(
            sites.map((site) => apiClient.get(`/api/proyek/${site.id}/anggota`))
        );

        const nextMap = {};
        results.forEach((res, idx) => {
            const siteId = sites[idx]?.id;
            if (siteId !== undefined && res.status === 'fulfilled') {
                nextMap[String(siteId)] = extractArray(res.value.data, ['data', 'anggota']);
            }
        });
        setAnggotaBySite(nextMap);
    }, []);

    const fetchBangunanForSites = useCallback(async (sites) => {
        if (!Array.isArray(sites) || sites.length === 0) {
            setBangunanBySite({});
            return;
        }

        const results = await Promise.allSettled(
            sites.map((site) => apiClient.get(`/api/proyek/${site.id}/bangunan`))
        );

        const nextMap = {};
        results.forEach((res, idx) => {
            const siteId = sites[idx]?.id;
            if (siteId !== undefined && res.status === 'fulfilled') {
                nextMap[String(siteId)] = extractArray(res.value.data, ['data', 'bangunan']);
            }
        });
        setBangunanBySite(nextMap);
    }, []);

    const fetchSitesData = useCallback(async () => {
        setLoading(true);
        setErrorMsg('');

        const [resProyek, resProgress] = await Promise.allSettled([
            apiClient.get('/api/proyek'),
            apiClient.get('/api/fitur/progress'),
        ]);

        if (resProyek.status === 'fulfilled') {
            const sites = extractArray(resProyek.value.data, ['data', 'proyek']);
            setProyekList(sites);
            await Promise.allSettled([
                fetchAnggotaForSites(sites),
                fetchBangunanForSites(sites),
            ]);
        } else {
            setErrorMsg(
                resProyek.reason?.response?.data?.message ||
                'Gagal memuat daftar proyek/sites dari server.'
            );
        }

        if (resProgress.status === 'fulfilled') {
            setProgressList(extractArray(resProgress.value.data, ['data', 'progress']));
        }

        setLoading(false);
    }, [fetchAnggotaForSites, fetchBangunanForSites]);

    useEffect(() => {
        fetchSitesData();
    }, [fetchSitesData]);

    const handleAddBangunan = async (e, siteId) => {
        e.preventDefault();
        if (!hasWriteAccess) return;

        const siteKey = String(siteId);
        const namaBangunan = (bangunanInputBySite[siteKey] || '').trim();
        if (!namaBangunan) return;

        setBangunanSavingBySite((prev) => ({ ...prev, [siteKey]: true }));
        setBangunanErrorBySite((prev) => ({ ...prev, [siteKey]: '' }));

        try {
            const res = await apiClient.post(`/api/proyek/${siteId}/bangunan`, {
                nama_bangunan: namaBangunan,
            });

            const createdBangunan = {
                id: res.data?.id ?? Date.now(),
                proyek_id: siteId,
                nama_bangunan: res.data?.nama_bangunan ?? namaBangunan,
                persentase_progres: res.data?.persentase_progres ?? 0,
            };

            setBangunanBySite((prev) => ({
                ...prev,
                [siteKey]: [...(prev[siteKey] || []), createdBangunan],
            }));
            setBangunanInputBySite((prev) => ({ ...prev, [siteKey]: '' }));
        } catch (err) {
            setBangunanErrorBySite((prev) => ({
                ...prev,
                [siteKey]: err.response?.data?.message || 'Gagal menambahkan bangunan.',
            }));
        } finally {
            setBangunanSavingBySite((prev) => ({ ...prev, [siteKey]: false }));
        }
    };

    const resetForm = () => {
        setEditId(null);
        setFileName('');
        setForm(INITIAL_FORM);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleOpenCreate = () => {
        if (!hasWriteAccess) return;
        resetForm();
        setShowForm(true);
    };

    const handleEdit = (site) => {
        if (!hasWriteAccess) return;
        const currentProgress = site.persentase_progres ?? site.progress ?? 0;
        setEditId(site.id);
        setFileName('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setForm({
            nama_proyek: site.nama_proyek || '',
            lokasi: site.lokasi || '',
            status: site.status || 'Berjalan',
            persentase_progres: Number(currentProgress) || 0,
            gambar: site.gambar || '',
        });
        setShowForm(true);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Silakan pilih file gambar (JPG, PNG, WEBP, dll.).');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setForm((prev) => ({
                ...prev,
                gambar: typeof reader.result === 'string' ? reader.result : '',
            }));
            setFileName(file.name);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!hasWriteAccess) {
            alert('Hanya Proyek Manager / PM yang berwenang menambahkan atau mengubah proyek.');
            return;
        }

        setSubmitting(true);
        const clampedProgress = Math.min(
            Math.max(Number(form.persentase_progres) || 0, 0),
            100
        );

        const payload = {
            nama_proyek: form.nama_proyek.trim(),
            lokasi: form.lokasi.trim(),
            status: form.status,
            persentase_progres: clampedProgress,
            ...(form.gambar ? { gambar: form.gambar } : {}),
        };

        try {
            if (editId) {
                await apiClient.put(`/api/proyek/${editId}`, payload);
            } else {
                await apiClient.post('/api/proyek', payload);
            }
            setShowForm(false);
            resetForm();
            await fetchSitesData();
            if (typeof onDataChanged === 'function') {
                onDataChanged();
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal menyimpan data proyek.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id, namaProyek) => {
        if (!hasWriteAccess) {
            alert('Hanya Proyek Manager / PM yang berwenang menghapus proyek.');
            return;
        }
        if (!confirm(`Hapus proyek "${namaProyek}"?`)) return;

        try {
            await apiClient.delete(`/api/proyek/${id}`);
            await fetchSitesData();
            if (typeof onDataChanged === 'function') {
                onDataChanged();
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal menghapus proyek.');
        }
    };

    const handleOpenInvite = (site) => {
        if (!hasWriteAccess) return;
        setInviteSite(site);
        setInviteEmail('');
        setInviteRole('');
        setInviteFeedback(null);
    };

    const handleCloseInvite = () => {
        setInviteSite(null);
        setInviteEmail('');
        setInviteRole('');
        setInviteFeedback(null);
    };

    const handleInviteSubmit = async (e) => {
        e.preventDefault();
        if (!inviteSite || !inviteEmail.trim()) return;

        setInviteSubmitting(true);
        setInviteFeedback(null);

        try {
            const res = await apiClient.post(`/api/proyek/${inviteSite.id}/invite`, {
                email: inviteEmail.trim(),
                ...(inviteRole.trim() ? { role_proyek: inviteRole.trim() } : {}),
            });

            setInviteFeedback({
                type: 'success',
                message: res.data?.message || 'Undangan berhasil dikirim.',
            });
            setInviteEmail('');
            setInviteRole('');

            const resAnggota = await apiClient.get(`/api/proyek/${inviteSite.id}/anggota`);
            setAnggotaBySite((prev) => ({
                ...prev,
                [String(inviteSite.id)]: extractArray(resAnggota.data, ['data', 'anggota']),
            }));
        } catch (err) {
            setInviteFeedback({
                type: 'error',
                message: err.response?.data?.message || 'Gagal mengirim undangan anggota.',
            });
        } finally {
            setInviteSubmitting(false);
        }
    };

    const handleGoToProgress = (site) => {
        if (typeof onOpenProgress === 'function') {
            onOpenProgress(site);
        }
    };

    const enrichedSites = useMemo(() => {
        const latestProgressByProyek = new Map();
        progressList.forEach((p) => {
            const key = String(p.proyek_id ?? '');
            const val = Number(p.bobot_realisasi ?? 0);
            const time = p.tanggal_laporan ? new Date(p.tanggal_laporan).getTime() : 0;
            const prev = latestProgressByProyek.get(key);
            if (!prev || time >= prev.time) {
                latestProgressByProyek.set(key, { val, time });
            }
        });

        return proyekList
            .filter((site) => isSiteOwnedByUser(site, user))
            .map((site) => {
                const fallbackProg = latestProgressByProyek.get(String(site.id))?.val ?? 0;
                const rawSiteProgress = site.persentase_progres ?? site.progress;
                const computedProgress =
                    typeof rawSiteProgress === 'number' ||
                        (rawSiteProgress !== undefined &&
                            rawSiteProgress !== null &&
                            rawSiteProgress !== '')
                        ? Number(rawSiteProgress)
                        : fallbackProg;

                return {
                    ...site,
                    displayProgress: Math.min(Math.max(Math.round(computedProgress || 0), 0), 100),
                    displayImage: site.gambar || DEFAULT_SITE_IMAGE,
                    members: anggotaBySite[String(site.id)] || [],
                    buildings: bangunanBySite[String(site.id)] || [],
                };
            });
    }, [proyekList, progressList, anggotaBySite, bangunanBySite, user]);

    return (
        <div className="space-y-6 text-left">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">
                        Daftar Sites & Proyek ({enrichedSites.length})
                    </h2>
                    <p className="text-sm text-slate-400">
                        Menampilkan seluruh proyek untuk akun{' '}
                        <span className="text-slate-200 font-medium">{user?.nama}</span> ({roleLabel})
                    </p>
                </div>

                {hasWriteAccess ? (
                    <button
                        type="button"
                        onClick={() => {
                            if (showForm) {
                                setShowForm(false);
                                resetForm();
                            } else {
                                handleOpenCreate();
                            }
                        }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition cursor-pointer"
                    >
                        {showForm ? <X size={18} /> : <Plus size={18} />}
                        <span>{showForm ? 'Tutup Form' : 'Tambah Proyek'}</span>
                    </button>
                ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#131c2e] border border-slate-700/80 text-slate-300 px-3.5 py-2 rounded-xl">
                        <Lock size={14} className="text-slate-400" />
                        Mode Baca (Hanya Proyek Manager / PM yang dapat menambah atau mengubah proyek)
                    </span>
                )}
            </div>

            {showForm && hasWriteAccess && (
                <form
                    onSubmit={handleSubmit}
                    className="bg-[#0e1626] p-6 rounded-2xl border border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                    <div className="md:col-span-2 flex items-center justify-between pb-2 border-b border-slate-800/70">
                        <h3 className="text-base font-semibold text-white">
                            {editId ? 'Edit Data Proyek' : 'Tambah Proyek Baru'}
                        </h3>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            Akses PM
                        </span>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Nama Proyek *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Contoh: Proyek Batalyon E"
                            className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            value={form.nama_proyek}
                            onChange={(e) => setForm({ ...form, nama_proyek: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Lokasi Site *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Contoh: Madiun, Jawa Timur"
                            className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            value={form.lokasi}
                            onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Status Proyek
                        </label>
                        <select
                            className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            value={form.status}
                            onChange={(e) => setForm({ ...form, status: e.target.value })}
                        >
                            <option value="Perencanaan" className="bg-[#131c2e]">Perencanaan</option>
                            <option value="Berjalan" className="bg-[#131c2e]">Berjalan</option>
                            <option value="Tertunda" className="bg-[#131c2e]">Tertunda</option>
                            <option value="Selesai" className="bg-[#131c2e]">Selesai</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Progress Awal / Terkini (%)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            value={form.persentase_progres}
                            onChange={(e) =>
                                setForm({ ...form, persentase_progres: e.target.value })
                            }
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Foto Proyek (Pilih dari File Perangkat)
                        </label>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        <div
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    fileInputRef.current?.click();
                                }
                            }}
                            className="w-full bg-[#131c2e] hover:bg-[#172138] border border-dashed border-slate-700 hover:border-blue-500/70 text-slate-200 rounded-xl p-4 transition cursor-pointer flex items-center justify-between gap-4"
                        >
                            <div className="flex items-center gap-3.5 min-w-0">
                                {form.gambar ? (
                                    <img
                                        src={form.gambar}
                                        alt="Preview Foto Proyek"
                                        className="w-14 h-14 rounded-lg object-cover border border-slate-700 shrink-0"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                                        <Upload className="w-5 h-5" />
                                    </div>
                                )}

                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-white truncate">
                                        {fileName ||
                                            (form.gambar
                                                ? 'Foto proyek terpilih'
                                                : 'Klik untuk pilih foto dari perangkat')}
                                    </div>
                                    <div className="text-xs text-slate-400 truncate mt-0.5">
                                        Format didukung: JPG, PNG, WEBP, GIF
                                    </div>
                                </div>
                            </div>

                            <span className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 text-xs font-semibold shrink-0">
                                Pilih File
                            </span>
                        </div>
                    </div>

                    <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setShowForm(false);
                                resetForm();
                            }}
                            className="px-4 py-2 rounded-xl border border-slate-700/80 text-slate-300 hover:bg-slate-800/70 text-sm font-medium transition cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-xl transition cursor-pointer"
                        >
                            {submitting
                                ? 'Menyimpan...'
                                : editId
                                    ? 'Update Proyek'
                                    : 'Simpan Proyek'}
                        </button>
                    </div>
                </form>
            )}

            {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-4 py-3 rounded-xl">
                    {errorMsg}
                </div>
            )}

            {loading ? (
                <div className="bg-[#0e1626] border border-slate-800/80 rounded-2xl p-10 text-center text-sm text-slate-400">
                    Memuat data sites...
                </div>
            ) : enrichedSites.length === 0 ? (
                <div className="bg-[#0e1626] border border-slate-800/80 rounded-2xl p-10 text-center space-y-3">
                    <Building2 className="w-9 h-9 text-slate-500 mx-auto" />
                    <p className="text-sm text-slate-400">
                        Belum ada proyek yang terdaftar untuk akun ini.
                    </p>
                    {hasWriteAccess && (
                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
                        >
                            <Plus size={15} />
                            <span>Tambah Proyek Pertama</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {enrichedSites.map((site) => {
                        const siteKey = String(site.id);
                        const buildingInput = bangunanInputBySite[siteKey] || '';
                        const buildingSaving = Boolean(bangunanSavingBySite[siteKey]);
                        const buildingError = bangunanErrorBySite[siteKey] || '';

                        return (
                            <div
                                key={site.id}
                                className="bg-[#0e1626] border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col justify-between"
                            >
                                <div>
                                    <div className="relative h-40 w-full bg-[#11192b] overflow-hidden">
                                        <img
                                            src={site.displayImage}
                                            alt={site.nama_proyek}
                                            onError={(e) => {
                                                e.currentTarget.src = DEFAULT_SITE_IMAGE;
                                            }}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1626] via-transparent to-transparent" />
                                        <span className="absolute top-3 right-3 text-xs font-semibold px-3 py-1 rounded-full bg-[#070c16]/85 text-blue-400 border border-blue-500/30 backdrop-blur-sm">
                                            {site.status || 'Aktif'}
                                        </span>
                                    </div>

                                    <div className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-base font-bold text-white">
                                                    {site.nama_proyek}
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                    <span>{site.lokasi || 'Lokasi belum diatur'}</span>
                                                </p>
                                            </div>

                                            {hasWriteAccess && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenInvite(site)}
                                                        className="p-2 text-blue-400 hover:bg-blue-500/15 rounded-lg transition cursor-pointer"
                                                        title="Invite Anggota Tim via Email"
                                                    >
                                                        <UserPlus size={15} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(site)}
                                                        className="p-2 text-amber-400 hover:bg-amber-500/15 rounded-lg transition cursor-pointer"
                                                        title="Edit Proyek"
                                                    >
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(site.id, site.nama_proyek)}
                                                        className="p-2 text-rose-400 hover:bg-rose-500/15 rounded-lg transition cursor-pointer"
                                                        title="Hapus Proyek"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4">
                                            <div className="flex items-center justify-between text-xs mb-1.5">
                                                <span className="text-slate-400 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                                                    Progres Pekerjaan
                                                </span>
                                                <span className="font-semibold text-white tabular-nums">
                                                    {site.displayProgress}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                                    style={{ width: `${site.displayProgress}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Daftar Bangunan / Zona Pekerjaan di Site */}
                                        <div className="mt-4 pt-3.5 border-t border-slate-800/70">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                                                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                                                    Bangunan Site ({site.buildings.length})
                                                </span>
                                            </div>

                                            {site.buildings.length === 0 ? (
                                                <p className="text-[11px] text-slate-500">
                                                    Belum ada bangunan terdaftar (mis. Barak 1, Dapuryon, Garasi Alat Berat).
                                                </p>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5 mb-2.5">
                                                    {site.buildings.map((b) => (
                                                        <span
                                                            key={b.id}
                                                            className="inline-flex items-center gap-1.5 bg-[#131c2e] border border-slate-800/90 text-slate-200 text-[11px] font-medium px-2.5 py-1 rounded-lg"
                                                        >
                                                            <span>{b.nama_bangunan}</span>
                                                            <span className="text-blue-400 tabular-nums">
                                                                {Number(b.persentase_progres || 0).toFixed(0)}%
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {hasWriteAccess && (
                                                <form
                                                    onSubmit={(e) => handleAddBangunan(e, site.id)}
                                                    className="mt-2 flex items-center gap-2"
                                                >
                                                    <input
                                                        type="text"
                                                        placeholder="Tambah bangunan (mis. Barak 1)..."
                                                        className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                        value={buildingInput}
                                                        onChange={(e) => {
                                                            setBangunanInputBySite((prev) => ({
                                                                ...prev,
                                                                [siteKey]: e.target.value,
                                                            }));
                                                            if (buildingError) {
                                                                setBangunanErrorBySite((prev) => ({
                                                                    ...prev,
                                                                    [siteKey]: '',
                                                                }));
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={buildingSaving || !buildingInput.trim()}
                                                        className="shrink-0 inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer"
                                                    >
                                                        <Plus size={14} />
                                                        <span>{buildingSaving ? '...' : 'Tambah'}</span>
                                                    </button>
                                                </form>
                                            )}

                                            {buildingError && (
                                                <p className="mt-1.5 text-[11px] text-rose-400">
                                                    {buildingError}
                                                </p>
                                            )}
                                        </div>

                                        {/* Daftar Anggota / Undangan Site */}
                                        <div className="mt-4 pt-3.5 border-t border-slate-800/70">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                                                    <Users className="w-3.5 h-3.5 text-blue-400" />
                                                    Anggota Site ({site.members.length})
                                                </span>
                                                {hasWriteAccess && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenInvite(site)}
                                                        className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition cursor-pointer"
                                                    >
                                                        + Invite Email
                                                    </button>
                                                )}
                                            </div>

                                            {site.members.length === 0 ? (
                                                <p className="text-[11px] text-slate-500">
                                                    Belum ada anggota tim yang diundang ke site ini.
                                                </p>
                                            ) : (
                                                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                                                    {site.members.map((member) => (
                                                        <div
                                                            key={member.id || member.email}
                                                            className="flex items-center justify-between gap-2 bg-[#131c2e]/80 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-xs"
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="text-slate-200 font-medium truncate">
                                                                    {member.nama || member.email}
                                                                </div>
                                                                <div className="text-[11px] text-slate-400 truncate">
                                                                    {member.email}
                                                                    {member.posisi ? ` • ${member.posisi}` : ''}
                                                                </div>
                                                            </div>
                                                            <span
                                                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${member.status === 'active'
                                                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                                                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                                                    }`}
                                                            >
                                                                {member.status === 'active' ? 'Aktif' : 'Pending'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4 pt-3.5 border-t border-slate-800/70 flex items-center justify-between gap-3">
                                            <span className="text-[11px] text-slate-500">
                                                ID Site #{site.id}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleGoToProgress(site)}
                                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
                                            >
                                                <TrendingUp className="w-3.5 h-3.5" />
                                                <span>Progress</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Invite Anggota Tim via Email */}
            {inviteSite && hasWriteAccess && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-[#0e1626] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
                        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <UserPlus className="w-4 h-4 text-blue-400" />
                                    <span>Invite Anggota Tim</span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Site: <span className="text-slate-200 font-medium">{inviteSite.nama_proyek}</span>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseInvite}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {inviteFeedback && (
                            <div
                                className={`text-xs px-3.5 py-2.5 rounded-xl border ${inviteFeedback.type === 'success'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                    }`}
                            >
                                {inviteFeedback.message}
                            </div>
                        )}

                        <form onSubmit={handleInviteSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Email Anggota Tim *
                                </label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="email"
                                        required
                                        placeholder="contoh: anggota@perusahaan.com"
                                        className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Peran di Proyek (Opsional)
                                </label>
                                <select
                                    className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                >
                                    <option value="" className="bg-[#131c2e]">
                                        Sesuai posisi akun terdaftar
                                    </option>
                                    <option value="Staff Proyek" className="bg-[#131c2e]">
                                        Staff Proyek
                                    </option>
                                    <option value="Admin Proyek" className="bg-[#131c2e]">
                                        Admin Proyek
                                    </option>
                                    <option value="Logistik" className="bg-[#131c2e]">
                                        Logistik
                                    </option>
                                    <option value="QS (Quantity Surveyor)" className="bg-[#131c2e]">
                                        QS (Quantity Surveyor)
                                    </option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseInvite}
                                    className="px-4 py-2 rounded-xl border border-slate-700/80 text-slate-300 hover:bg-slate-800/70 text-xs font-medium transition cursor-pointer"
                                >
                                    Tutup
                                </button>
                                <button
                                    type="submit"
                                    disabled={inviteSubmitting}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
                                >
                                    {inviteSubmitting ? 'Mengirim...' : 'Kirim Undangan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}