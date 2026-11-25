import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import {
    Plus,
    Pencil,
    Trash2,
    Lock,
    Upload,
    CloudSun,
    FileText,
    X,
    Building2,
    Calendar,
    BarChart3,
    RotateCcw,
} from 'lucide-react';
import { canEditProgress } from '../utils/rbac';

const API_BASE = 'http://localhost:5000/api';

const CUACA_OPTIONS = [
    'Cerah',
    'Berawan',
    'Mendung',
    'Hujan Ringan',
    'Hujan Lebat',
];

const INITIAL_FORM = {
    proyek_id: '',
    bangunan_id: '',
    nama_bangunan: '',
    pelaksana: '',
    tanggal_laporan: new Date().toISOString().split('T')[0],
    uraian_pekerjaan: '',
    bobot_realisasi: '',
    catatan: '',
    cuaca: 'Cerah',
    dokumentasi: '',
};

const parseDecimalPercent = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value !== 'string') return 0;
    const normalized = value.trim().replace(',', '.');
    if (normalized === '') return 0;
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatDecimalPercent = (value) => {
    const num = parseDecimalPercent(value);
    const clamped = Math.min(Math.max(num, 0), 100);
    return Number(clamped.toFixed(2)).toString();
};

const isImageDataUrl = (val = '') =>
    typeof val === 'string' && val.startsWith('data:image/');

const extractArray = (payload, keys = ['data']) => {
    if (Array.isArray(payload)) return payload;
    for (const key of keys) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
};

const getSiteLabel = (site) =>
    site?.nama_proyek ||
    site?.nama_site ||
    site?.nama ||
    site?.judul ||
    `Site #${site?.id ?? ''}`;

const normalizeDateKey = (rawDate) => {
    if (!rawDate) return '';
    return String(rawDate).split('T')[0].slice(0, 10);
};

const formatTanggalIndo = (dateKey) => {
    if (!dateKey) return '-';
    const parts = dateKey.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return dateKey;
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    return dt.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

// Mengembalikan kunci minggu berdasarkan awal minggu (Senin, YYYY-MM-DD)
const getWeekStartKey = (dateKey) => {
    if (!dateKey) return '';
    const parts = dateKey.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return '';
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = dt.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + diffToMonday);
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, '0');
    const d = String(monday.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getWeekRangeLabel = (mondayKey) => {
    if (!mondayKey) return '-';
    const [y, m, d] = mondayKey.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d + 6);
    const optsShort = { day: '2-digit', month: 'short' };
    const optsFull = { day: '2-digit', month: 'short', year: 'numeric' };
    return `${start.toLocaleDateString('id-ID', optsShort)} – ${end.toLocaleDateString('id-ID', optsFull)}`;
};

export default function ProgressSection({
    user,
    selectedProyekId = null,
    onSelectProyekId = () => {},
}) {
    const [progressList, setProgressList] = useState([]);
    const [proyekList, setProyekList] = useState([]);
    const [loadingProyek, setLoadingProyek] = useState(false);
    const [proyekError, setProyekError] = useState('');
    const [bangunanList, setBangunanList] = useState([]);
    const [loadingBangunan, setLoadingBangunan] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [filterTanggal, setFilterTanggal] = useState('');
    const [selectedWeekKey, setSelectedWeekKey] = useState('');
    const [form, setForm] = useState({
        ...INITIAL_FORM,
        proyek_id: selectedProyekId ? String(selectedProyekId) : '',
        pelaksana: user?.nama || '',
    });
    const [docFileName, setDocFileName] = useState('');

    const fileInputRef = useRef(null);

    const hasWriteAccess = canEditProgress(user?.posisi);
    const token = localStorage.getItem('token');
    const authHeader = useMemo(
        () => ({ headers: { Authorization: `Bearer ${token}` } }),
        [token]
    );

    const activeProyekId = selectedProyekId
        ? String(selectedProyekId)
        : form.proyek_id
            ? String(form.proyek_id)
            : '';

    const fetchBangunan = useCallback(
        async (proyekId, preferredBangunanId = null, preferredNamaBangunan = '') => {
            if (!token || !proyekId) {
                setBangunanList([]);
                return;
            }

            setLoadingBangunan(true);
            try {
                const res = await axios.get(
                    `${API_BASE}/proyek/${proyekId}/bangunan`,
                    authHeader
                );
                const rows = extractArray(res.data, ['data', 'bangunan']);
                setBangunanList(rows);

                setForm((prev) => {
                    if (String(prev.proyek_id) !== String(proyekId)) return prev;

                    if (preferredBangunanId) {
                        const matchedById = rows.find(
                            (b) => String(b.id) === String(preferredBangunanId)
                        );
                        if (matchedById) {
                            return {
                                ...prev,
                                bangunan_id: String(matchedById.id),
                                nama_bangunan: matchedById.nama_bangunan,
                            };
                        }
                    }

                    if (preferredNamaBangunan) {
                        const matchedByName = rows.find(
                            (b) =>
                                String(b.nama_bangunan || '').toLowerCase() ===
                                String(preferredNamaBangunan).toLowerCase()
                        );
                        if (matchedByName) {
                            return {
                                ...prev,
                                bangunan_id: String(matchedByName.id),
                                nama_bangunan: matchedByName.nama_bangunan,
                            };
                        }
                        return {
                            ...prev,
                            bangunan_id: '',
                            nama_bangunan: preferredNamaBangunan,
                        };
                    }

                    const stillValid = rows.find(
                        (b) => String(b.id) === String(prev.bangunan_id)
                    );
                    if (stillValid) {
                        return {
                            ...prev,
                            nama_bangunan: stillValid.nama_bangunan,
                        };
                    }

                    const firstBuilding = rows[0];
                    return {
                        ...prev,
                        bangunan_id: firstBuilding ? String(firstBuilding.id) : '',
                        nama_bangunan: firstBuilding ? firstBuilding.nama_bangunan : '',
                    };
                });
            } catch (err) {
                console.error('Gagal memuat daftar bangunan:', err);
                setBangunanList([]);
            } finally {
                setLoadingBangunan(false);
            }
        },
        [token, authHeader]
    );

    const fetchData = useCallback(async () => {
        if (!token) {
            setProyekError('Token autentikasi tidak ditemukan. Silakan login ulang.');
            return;
        }

        setLoadingProyek(true);
        setProyekError('');

        const progUrl = activeProyekId
            ? `${API_BASE}/fitur/progress?proyek_id=${encodeURIComponent(activeProyekId)}`
            : `${API_BASE}/fitur/progress`;

        const [progResult, proyekResult] = await Promise.allSettled([
            axios.get(progUrl, authHeader),
            axios.get(`${API_BASE}/proyek`, authHeader),
        ]);

        if (progResult.status === 'fulfilled') {
            setProgressList(extractArray(progResult.value.data, ['data', 'progress']));
        } else {
            console.error('Gagal memuat laporan progress:', progResult.reason);
        }

        if (proyekResult.status === 'fulfilled') {
            const fetchedProyek = extractArray(proyekResult.value.data, ['data', 'proyek']);
            setProyekList(fetchedProyek);
        } else {
            console.error('Gagal memuat daftar site/proyek:', proyekResult.reason);
            setProyekList([]);
            setProyekError(
                proyekResult.reason?.response?.data?.message ||
                'Gagal memuat daftar site dari server.'
            );
        }

        setForm((prev) => ({
            ...prev,
            proyek_id: activeProyekId || prev.proyek_id || '',
            pelaksana: prev.pelaksana || user?.nama || '',
        }));

        setLoadingProyek(false);
    }, [token, authHeader, activeProyekId, user?.nama]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (selectedProyekId) {
            setForm((prev) => ({
                ...prev,
                proyek_id: String(selectedProyekId),
                bangunan_id: '',
                nama_bangunan: '',
            }));
        }
    }, [selectedProyekId]);

    useEffect(() => {
        if (activeProyekId) {
            fetchBangunan(activeProyekId);
        } else {
            setBangunanList([]);
        }
    }, [activeProyekId, fetchBangunan]);

    const selectedProyek = useMemo(() => {
        if (!activeProyekId) return null;
        return (
            proyekList.find((p) => String(p.id) === String(activeProyekId)) || null
        );
    }, [proyekList, activeProyekId]);

    // Seluruh laporan milik site yang dipilih
    const siteProgressList = useMemo(() => {
        if (!activeProyekId) return [];
        return progressList.filter(
            (item) => String(item.proyek_id) === String(activeProyekId)
        );
    }, [progressList, activeProyekId]);

    // Daftar tanggal unik yang tersedia pada site terpilih
    const availableDates = useMemo(() => {
        const setDates = new Set();
        siteProgressList.forEach((item) => {
            const key = normalizeDateKey(item.tanggal_laporan);
            if (key) setDates.add(key);
        });
        return Array.from(setDates).sort((a, b) => b.localeCompare(a));
    }, [siteProgressList]);

    // Rangkuman progress mingguan (berdasarkan Senin - Minggu)
    const weeklySummaryList = useMemo(() => {
        if (siteProgressList.length === 0) return [];

        const grouped = new Map();
        siteProgressList.forEach((item) => {
            const dateKey = normalizeDateKey(item.tanggal_laporan || item.created_at);
            const weekKey = getWeekStartKey(dateKey) || 'tanpa-tanggal';
            const bobot = parseDecimalPercent(item.bobot_realisasi);

            if (!grouped.has(weekKey)) {
                grouped.set(weekKey, {
                    weekKey,
                    rangeLabel: weekKey === 'tanpa-tanggal' ? 'Tanpa Tanggal' : getWeekRangeLabel(weekKey),
                    count: 0,
                    sumBobot: 0,
                    latestBobot: bobot,
                    dates: new Set(),
                });
            }

            const entry = grouped.get(weekKey);
            entry.count += 1;
            entry.sumBobot += bobot;
            if (dateKey) entry.dates.add(dateKey);
        });

        return Array.from(grouped.values())
            .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
            .map((entry, idx) => {
                const sortedDates = Array.from(entry.dates).sort((a, b) => b.localeCompare(a));
                // Hitung rata-rata bobot pada minggu tersebut
                const avgBobot = entry.count > 0 ? entry.sumBobot / entry.count : 0;
                const prevWeek = idx < grouped.size - 1 ? null : null;
                void prevWeek;
                return {
                    weekKey: entry.weekKey,
                    rangeLabel: entry.rangeLabel,
                    count: entry.count,
                    avgBobot: Number(avgBobot.toFixed(2)),
                    dates: sortedDates,
                };
            });
    }, [siteProgressList]);

    // Laporan yang tampil di tabel sesuai filter tanggal laporan atau minggu terpilih
    const visibleProgressList = useMemo(() => {
        if (!activeProyekId) return [];
        return siteProgressList.filter((item) => {
            const dateKey = normalizeDateKey(item.tanggal_laporan || item.created_at);
            if (filterTanggal && dateKey !== filterTanggal) {
                return false;
            }
            if (selectedWeekKey && getWeekStartKey(dateKey) !== selectedWeekKey) {
                return false;
            }
            return true;
        });
    }, [siteProgressList, activeProyekId, filterTanggal, selectedWeekKey]);

    const handleDokumentasiChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setForm((prev) => ({
                ...prev,
                dokumentasi: typeof reader.result === 'string' ? reader.result : '',
            }));
            setDocFileName(file.name);
        };
        reader.readAsDataURL(file);
    };

    const clearDokumentasi = () => {
        setDocFileName('');
        setForm((prev) => ({ ...prev, dokumentasi: '' }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const resetForm = () => {
        const firstBuilding = activeProyekId ? bangunanList[0] : null;
        setEditId(null);
        setDocFileName('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setForm({
            ...INITIAL_FORM,
            proyek_id: activeProyekId,
            bangunan_id: firstBuilding ? String(firstBuilding.id) : '',
            nama_bangunan: firstBuilding ? firstBuilding.nama_bangunan : '',
            pelaksana: user?.nama || '',
            tanggal_laporan: filterTanggal || new Date().toISOString().split('T')[0],
        });
    };

    const handleSiteChange = (e) => {
        const val = e.target.value;
        setShowForm(false);
        setEditId(null);
        setFilterTanggal('');
        setSelectedWeekKey('');
        setForm((prev) => ({
            ...INITIAL_FORM,
            proyek_id: val,
            pelaksana: prev.pelaksana || user?.nama || '',
        }));
        onSelectProyekId(val ? Number(val) : null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeProyekId) {
            alert('Silakan pilih site / proyek terlebih dahulu sebelum mengisi laporan.');
            return;
        }

        const realisasiDesimal = Math.min(
            Math.max(parseDecimalPercent(form.bobot_realisasi), 0),
            100
        );

        const payload = {
            proyek_id: Number(activeProyekId),
            bangunan_id: form.bangunan_id ? Number(form.bangunan_id) : null,
            nama_bangunan: form.nama_bangunan.trim() || null,
            pelaksana: form.pelaksana.trim() || user?.nama || null,
            tanggal_laporan: form.tanggal_laporan || new Date().toISOString().split('T')[0],
            uraian_pekerjaan: form.uraian_pekerjaan.trim(),
            bobot_realisasi: realisasiDesimal,
            catatan: form.catatan.trim() || null,
            cuaca: form.cuaca || null,
            dokumentasi: form.dokumentasi || null,
        };

        try {
            if (editId) {
                await axios.put(
                    `${API_BASE}/fitur/progress/${editId}`,
                    payload,
                    authHeader
                );
            } else {
                await axios.post(`${API_BASE}/fitur/progress`, payload, authHeader);
            }
            setShowForm(false);
            resetForm();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal menyimpan laporan progress');
        }
    };

    const handleEdit = (item) => {
        const proyekId = item.proyek_id ? String(item.proyek_id) : activeProyekId;
        setEditId(item.id);
        setDocFileName('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setForm({
            proyek_id: proyekId,
            bangunan_id: item.bangunan_id ? String(item.bangunan_id) : '',
            nama_bangunan: item.nama_bangunan || '',
            pelaksana: item.pelaksana || item.dibuat_oleh || user?.nama || '',
            tanggal_laporan:
                normalizeDateKey(item.tanggal_laporan) ||
                new Date().toISOString().split('T')[0],
            uraian_pekerjaan: item.uraian_pekerjaan || '',
            bobot_realisasi: item.bobot_realisasi ?? '',
            catatan: item.catatan ?? item.kendala ?? '',
            cuaca: item.cuaca || 'Cerah',
            dokumentasi: item.dokumentasi || '',
        });
        if (proyekId) {
            onSelectProyekId(Number(proyekId));
        }
        setShowForm(true);
        if (proyekId) {
            fetchBangunan(proyekId, item.bangunan_id, item.nama_bangunan || '');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus laporan progress harian ini?')) return;
        try {
            await axios.delete(`${API_BASE}/fitur/progress/${id}`, authHeader);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal menghapus laporan');
        }
    };

    const isSiteSelected = Boolean(activeProyekId);

    return (
        <div className="space-y-6 text-left">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-xl font-bold text-white">Laporan Progress Harian</h2>
                        {isSiteSelected && (
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                Site: {getSiteLabel(selectedProyek) || `#${activeProyekId}`}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-400">
                        Halaman laporan progress harian tampil khusus untuk site yang dipilih, per tanggal laporan, dengan rangkuman mingguan
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[220px]">
                        <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                            disabled={loadingProyek}
                            value={activeProyekId}
                            onChange={handleSiteChange}
                            className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        >
                            <option value="" className="bg-[#131c2e] text-slate-400">
                                {loadingProyek ? 'Memuat site...' : '-- Pilih Site --'}
                            </option>
                            {proyekList.map((p) => (
                                <option
                                    key={p.id}
                                    value={p.id}
                                    className="bg-[#131c2e] text-slate-100"
                                >
                                    {getSiteLabel(p)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {isSiteSelected && (
                        hasWriteAccess ? (
                            <button
                                type="button"
                                onClick={() => {
                                    if (showForm) {
                                        setShowForm(false);
                                        resetForm();
                                    } else {
                                        setEditId(null);
                                        setDocFileName('');
                                        setForm((prev) => ({
                                            ...INITIAL_FORM,
                                            proyek_id: activeProyekId,
                                            tanggal_laporan:
                                                filterTanggal || new Date().toISOString().split('T')[0],
                                            pelaksana: user?.nama || '',
                                        }));
                                        setShowForm(true);
                                        fetchBangunan(activeProyekId);
                                    }
                                }}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition cursor-pointer"
                            >
                                <Plus size={18} />
                                <span>{showForm ? 'Tutup Form' : 'Input Progress Harian'}</span>
                            </button>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#131c2e] border border-slate-700/80 text-slate-300 px-3.5 py-2 rounded-xl">
                                <Lock size={14} className="text-slate-400" />
                                Mode Baca (Hanya QS yang dapat mengelola laporan progress)
                            </span>
                        )
                    )}
                </div>
            </div>

            {proyekError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-4 py-3 rounded-xl">
                    {proyekError}
                </div>
            )}

            {!isSiteSelected ? (
                <div className="bg-[#0e1626] p-8 rounded-2xl border border-slate-800/80 text-center space-y-2">
                    <p className="text-sm font-medium text-slate-200">
                        Silakan pilih site terlebih dahulu
                    </p>
                    <p className="text-xs text-slate-400">
                        Data, rangkuman mingguan, dan form laporan progress harian hanya ditampilkan setelah Anda memilih site yang aktif.
                    </p>
                </div>
            ) : (
                <>
                    {/* Rangkuman Progress Mingguan */}
                    <div className="bg-[#0e1626] p-5 rounded-2xl border border-slate-800/80 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-emerald-400" />
                                <h3 className="text-sm font-semibold text-white">
                                    Rangkuman Progress Mingguan
                                </h3>
                            </div>
                            {selectedWeekKey && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedWeekKey('')}
                                    className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-white underline cursor-pointer"
                                >
                                    <RotateCcw size={12} />
                                    Reset filter minggu
                                </button>
                            )}
                        </div>

                        {weeklySummaryList.length === 0 ? (
                            <p className="text-xs text-slate-500">
                                Belum ada data mingguan untuk site ini.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {weeklySummaryList.map((week) => {
                                    const isSelectedWeek = selectedWeekKey === week.weekKey;
                                    return (
                                        <div
                                            key={week.weekKey}
                                            onClick={() =>
                                                setSelectedWeekKey((prev) =>
                                                    prev === week.weekKey ? '' : week.weekKey
                                                )
                                            }
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedWeekKey((prev) =>
                                                        prev === week.weekKey ? '' : week.weekKey
                                                    );
                                                }
                                            }}
                                            className={`p-3.5 rounded-xl border transition cursor-pointer ${
                                                isSelectedWeek
                                                    ? 'bg-emerald-500/15 border-emerald-500/50'
                                                    : 'bg-[#131c2e] border-slate-800 hover:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-semibold text-white">
                                                    {week.rangeLabel}
                                                </span>
                                                <span className="text-sm font-bold text-emerald-400 tabular-nums">
                                                    {week.avgBobot.toFixed(2)}%
                                                </span>
                                            </div>
                                            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                                                <span>{week.count} laporan tercatat</span>
                                                <span>Rata-rata progres</span>
                                            </div>
                                            {week.dates.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {week.dates.map((dKey) => (
                                                        <button
                                                            key={dKey}
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFilterTanggal((prev) =>
                                                                    prev === dKey ? '' : dKey
                                                                );
                                                            }}
                                                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                                                                filterTanggal === dKey
                                                                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                                                                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                                                            }`}
                                                        >
                                                            {formatTanggalIndo(dKey)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Filter Tanggal Laporan */}
                    <div className="bg-[#0e1626] px-4 py-3.5 rounded-2xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                                <Calendar className="w-4 h-4 text-emerald-400" />
                                <span>Filter Tanggal Laporan:</span>
                            </div>
                            <input
                                type="date"
                                value={filterTanggal}
                                onChange={(e) => setFilterTanggal(e.target.value)}
                                className="bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-emerald-500"
                            />
                            {availableDates.length > 0 && (
                                <select
                                    value={filterTanggal}
                                    onChange={(e) => setFilterTanggal(e.target.value)}
                                    className="bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-emerald-500"
                                >
                                    <option value="">Semua Tanggal Tersedia</option>
                                    {availableDates.map((dKey) => (
                                        <option key={dKey} value={dKey}>
                                            {formatTanggalIndo(dKey)} ({dKey})
                                        </option>
                                    ))}
                                </select>
                            )}
                            {(filterTanggal || selectedWeekKey) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilterTanggal('');
                                        setSelectedWeekKey('');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 transition cursor-pointer"
                                >
                                    <X size={13} />
                                    <span>Tampilkan Semua Tanggal</span>
                                </button>
                            )}
                        </div>
                        <span className="text-xs text-slate-400">
                            Menampilkan <strong className="text-white">{visibleProgressList.length}</strong> laporan
                        </span>
                    </div>

                    {/* Form Input / Edit Progress */}
                    {showForm && hasWriteAccess && (
                        <form
                            onSubmit={handleSubmit}
                            className="bg-[#0e1626] p-6 rounded-2xl border border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                            {/* 1. Site / Proyek */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Site / Proyek *
                                </label>
                                <div className="relative">
                                    <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <select
                                        required
                                        disabled={loadingProyek}
                                        className="w-full bg-[#131c2e] border border-slate-700/80 disabled:opacity-50 text-slate-100 rounded-xl pl-10 pr-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                        value={activeProyekId}
                                        onChange={handleSiteChange}
                                    >
                                        <option value="" className="bg-[#131c2e] text-slate-400">
                                            {loadingProyek ? 'Memuat daftar site...' : '-- Pilih Site --'}
                                        </option>
                                        {proyekList.map((p) => (
                                            <option
                                                key={p.id}
                                                value={p.id}
                                                className="bg-[#131c2e] text-slate-100"
                                            >
                                                {getSiteLabel(p)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Tanggal Laporan */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Tanggal Laporan *
                                </label>
                                <input
                                    type="date"
                                    required
                                    className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                    value={form.tanggal_laporan}
                                    onChange={(e) =>
                                        setForm({ ...form, tanggal_laporan: e.target.value })
                                    }
                                />
                            </div>

                            {/* 2. Pelaksana */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Pelaksana *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Nama pelaksana lapangan"
                                    className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                    value={form.pelaksana}
                                    onChange={(e) => setForm({ ...form, pelaksana: e.target.value })}
                                />
                            </div>

                            {/* 3. Bangunan */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Bangunan *
                                </label>
                                <select
                                    required
                                    className="w-full bg-[#131c2e] border border-slate-700/80 disabled:opacity-50 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                    value={form.bangunan_id}
                                    disabled={loadingBangunan || bangunanList.length === 0}
                                    onChange={(e) => {
                                        const chosenId = e.target.value;
                                        const chosenBuilding = bangunanList.find(
                                            (b) => String(b.id) === String(chosenId)
                                        );
                                        setForm((prev) => ({
                                            ...prev,
                                            bangunan_id: chosenId,
                                            nama_bangunan: chosenBuilding ? chosenBuilding.nama_bangunan : '',
                                        }));
                                    }}
                                >
                                    {loadingBangunan ? (
                                        <option value="" className="bg-[#131c2e] text-slate-400">
                                            Memuat bangunan...
                                        </option>
                                    ) : bangunanList.length === 0 ? (
                                        <option value="" className="bg-[#131c2e] text-slate-400">
                                            Belum ada bangunan di site ini
                                        </option>
                                    ) : (
                                        bangunanList.map((b) => (
                                            <option
                                                key={b.id}
                                                value={b.id}
                                                className="bg-[#131c2e] text-slate-100"
                                            >
                                                {b.nama_bangunan}
                                            </option>
                                        ))
                                    )}
                                </select>
                                {!loadingBangunan && bangunanList.length === 0 && (
                                    <p className="mt-1 text-[11px] text-amber-400">
                                        Tambahkan bangunan pada site ini terlebih dahulu di menu Sites.
                                    </p>
                                )}
                            </div>

                            {/* 4. Persentase Progres (%) */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Persentase Progres (%) *
                                </label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    required
                                    placeholder="Contoh: 12.50 atau 12,50"
                                    className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                    value={form.bobot_realisasi}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        if (/^[0-9.,]*$/.test(raw)) {
                                            setForm({ ...form, bobot_realisasi: raw });
                                        }
                                    }}
                                    onBlur={() => {
                                        if (form.bobot_realisasi !== '') {
                                            setForm((prev) => ({
                                                ...prev,
                                                bobot_realisasi: formatDecimalPercent(prev.bobot_realisasi),
                                            }));
                                        }
                                    }}
                                />
                            </div>

                            {/* 5. Pekerjaan yang Dilaksanakan */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Pekerjaan yang Dilaksanakan *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Contoh: Instalasi rangka atap / Clearing"
                                    className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                    value={form.uraian_pekerjaan}
                                    onChange={(e) => setForm({ ...form, uraian_pekerjaan: e.target.value })}
                                />
                            </div>

                            {/* 6. Cuaca */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Cuaca *
                                </label>
                                <div className="relative">
                                    <CloudSun className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <select
                                        className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl pl-10 pr-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                        value={form.cuaca}
                                        onChange={(e) => setForm({ ...form, cuaca: e.target.value })}
                                    >
                                        {CUACA_OPTIONS.map((opt) => (
                                            <option
                                                key={opt}
                                                value={opt}
                                                className="bg-[#131c2e] text-slate-100"
                                            >
                                                {opt}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* 7. Catatan */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Catatan (Opsional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Catatan atau kendala pekerjaan di lapangan"
                                    className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                    value={form.catatan}
                                    onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                                />
                            </div>

                            {/* 8. Dokumen Terlampir */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Dokumen Terlampir (Opsional)
                                </label>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                    onChange={handleDokumentasiChange}
                                    className="hidden"
                                />

                                <div className="w-full bg-[#131c2e] border border-dashed border-slate-700 hover:border-emerald-500/70 text-slate-200 rounded-xl p-3.5 transition flex items-center justify-between gap-3">
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
                                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                                    >
                                        {form.dokumentasi && isImageDataUrl(form.dokumentasi) ? (
                                            <img
                                                src={form.dokumentasi}
                                                alt="Preview Dokumen Terlampir"
                                                className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                                            />
                                        ) : (
                                            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                                <Upload className="w-4 h-4" />
                                            </div>
                                        )}

                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-white truncate">
                                                {docFileName ||
                                                    (form.dokumentasi
                                                        ? 'Dokumen terlampir tersedia'
                                                        : 'Klik untuk pilih file foto atau dokumen')}
                                            </div>
                                            <div className="text-xs text-slate-400 truncate">
                                                Mendukung JPG, PNG, WEBP, PDF, DOC/X, XLS/X, TXT
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {form.dokumentasi && (
                                            <button
                                                type="button"
                                                onClick={clearDokumentasi}
                                                className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/15 transition cursor-pointer"
                                                title="Hapus Dokumen Terlampir"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-pointer"
                                        >
                                            Pilih File
                                        </button>
                                    </div>
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
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-5 py-2 rounded-xl transition cursor-pointer"
                                >
                                    {editId ? 'Update Laporan' : 'Simpan Laporan'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Tabel Laporan Progress */}
                    <div className="bg-[#0e1626] rounded-2xl border border-slate-800/80 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#111b2e] border-b border-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Tanggal Laporan</th>
                                    <th className="py-3.5 px-4">Pelaksana</th>
                                    <th className="py-3.5 px-4">Bangunan</th>
                                    <th className="py-3.5 px-4">Pekerjaan yang Dilaksanakan</th>
                                    <th className="py-3.5 px-4">Persentase Progres</th>
                                    <th className="py-3.5 px-4">Cuaca</th>
                                    <th className="py-3.5 px-4">Catatan</th>
                                    <th className="py-3.5 px-4">Dokumen Terlampir</th>
                                    {hasWriteAccess && <th className="py-3.5 px-4 text-right">Aksi</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-sm">
                                {visibleProgressList.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={hasWriteAccess ? 9 : 8}
                                            className="py-8 text-center text-slate-500"
                                        >
                                            Belum ada laporan progress harian untuk filter site / tanggal ini.
                                        </td>
                                    </tr>
                                ) : (
                                    visibleProgressList.map((item) => {
                                        const dateKey = normalizeDateKey(
                                            item.tanggal_laporan || item.created_at
                                        );
                                        const namaBangunanDisplay =
                                            item.nama_bangunan ||
                                            bangunanList.find(
                                                (b) => String(b.id) === String(item.bangunan_id)
                                            )?.nama_bangunan ||
                                            '-';
                                        const pelaksanaDisplay =
                                            item.pelaksana || item.dibuat_oleh || '-';
                                        const catatanDisplay =
                                            item.catatan ?? item.kendala ?? '-';

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-800/40 transition">
                                                <td className="py-3.5 px-4 whitespace-nowrap text-xs font-medium text-slate-200">
                                                    {formatTanggalIndo(dateKey)}
                                                </td>
                                                <td className="py-3.5 px-4 whitespace-nowrap text-slate-200 font-medium">
                                                    {pelaksanaDisplay}
                                                </td>
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                                        {namaBangunanDisplay}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 font-medium text-white">
                                                    {item.uraian_pekerjaan || '-'}
                                                </td>
                                                <td className="py-3.5 px-4 font-semibold text-emerald-400 tabular-nums">
                                                    {Number(item.bobot_realisasi || 0).toFixed(2)}%
                                                </td>
                                                <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 text-xs">
                                                    {item.cuaca || '-'}
                                                </td>
                                                <td className="py-3.5 px-4 text-slate-400">
                                                    {catatanDisplay || '-'}
                                                </td>
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    {item.dokumentasi ? (
                                                        <a
                                                            href={item.dokumentasi}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                                                        >
                                                            <FileText size={14} />
                                                            <span>Lihat Dokumen</span>
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-slate-500">-</span>
                                                    )}
                                                </td>
                                                {hasWriteAccess && (
                                                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEdit(item)}
                                                            className="p-1.5 text-amber-400 hover:bg-amber-500/15 rounded-lg transition cursor-pointer"
                                                            title="Edit"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(item.id)}
                                                            className="p-1.5 text-rose-400 hover:bg-rose-500/15 rounded-lg transition cursor-pointer"
                                                            title="Hapus"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}