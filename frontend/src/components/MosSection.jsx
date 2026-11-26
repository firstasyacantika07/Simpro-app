import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Plus,
    Pencil,
    Trash2,
    Lock,
    Building2,
    Calendar,
    Boxes,
    X,
    RotateCcw,
    FileSpreadsheet,
    FileText,
    Loader2,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';
import { canEditMOS } from '../utils/rbac';
import apiClient, { extractArray } from '../api/axiosClient';

const INITIAL_FORM = {
    proyek_id: '',
    kode_material: '',
    nama_material: '',
    tanggal_masuk: new Date().toISOString().split('T')[0],
    jumlah: '',
    jumlah_terpakai: '0',
    satuan: 'Sak',
};

const parseDecimal = (val) => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    if (typeof val !== 'string') return 0;
    const normalized = val.trim().replace(',', '.');
    if (normalized === '') return 0;
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
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

const getMonthKey = (dateKey) => {
    if (!dateKey || dateKey.length < 7) return '';
    return dateKey.slice(0, 7);
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

const formatBulanIndo = (monthKey) => {
    if (!monthKey || monthKey === 'tanpa-bulan') return 'Tanpa Tanggal';
    const [year, month] = monthKey.split('-').map(Number);
    if (!year || !month) return monthKey;
    const dt = new Date(year, month - 1, 1);
    return dt.toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
    });
};

const getItemDateKey = (item) =>
    normalizeDateKey(item?.tanggal_masuk || item?.tanggal_update || item?.created_at);

const getItemJumlah = (item) => {
    const masuk = parseDecimal(item?.jumlah_masuk);
    const jumlah = parseDecimal(item?.jumlah);
    if (item?.jumlah_masuk !== undefined && item?.jumlah_masuk !== null && item?.jumlah_masuk !== '') {
        return masuk > 0 || jumlah === 0 ? masuk : jumlah;
    }
    return jumlah;
};

const getItemTerpakai = (item) => parseDecimal(item?.jumlah_terpakai ?? 0);

const buildMaterialKey = (nama, satuan) =>
    `${String(nama || '').trim().toLowerCase()}__${String(satuan || 'Unit').trim().toLowerCase()}`;

export default function MosSection({
    user,
    selectedProyekId = null,
    onSelectProyekId = () => { },
}) {
    const [mosList, setMosList] = useState([]);
    const [proyekList, setProyekList] = useState([]);
    const [loadingProyek, setLoadingProyek] = useState(false);
    const [proyekError, setProyekError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [selectedMonthKey, setSelectedMonthKey] = useState('');
    const [selectedMaterialKey, setSelectedMaterialKey] = useState('');
    const [exportingFormat, setExportingFormat] = useState(null); // 'excel' | 'pdf' | null
    const [exportNotice, setExportNotice] = useState(null); // { type: 'success' | 'error', message: string }
    const [form, setForm] = useState({
        ...INITIAL_FORM,
        proyek_id: selectedProyekId ? String(selectedProyekId) : '',
    });

    const roleValue = user?.posisi || user?.role || '';
    const hasWriteAccess = canEditMOS(roleValue);

    const activeProyekId = selectedProyekId
        ? String(selectedProyekId)
        : form.proyek_id
            ? String(form.proyek_id)
            : '';

    const fetchData = useCallback(async () => {
        setLoadingProyek(true);
        setProyekError('');

        const mosUrl = activeProyekId
            ? `/api/fitur/mos?proyek_id=${encodeURIComponent(activeProyekId)}`
            : '/api/fitur/mos';

        const [mosResult, proyekResult] = await Promise.allSettled([
            apiClient.get(mosUrl),
            apiClient.get('/api/proyek'),
        ]);

        if (mosResult.status === 'fulfilled') {
            setMosList(extractArray(mosResult.value.data, ['data', 'mos']));
        } else {
            console.error('Gagal memuat data MOS:', mosResult.reason);
        }

        if (proyekResult.status === 'fulfilled') {
            setProyekList(extractArray(proyekResult.value.data, ['data', 'proyek']));
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
        }));

        setLoadingProyek(false);
    }, [activeProyekId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (selectedProyekId) {
            setForm((prev) => ({
                ...prev,
                proyek_id: String(selectedProyekId),
            }));
            setSelectedMonthKey('');
            setSelectedMaterialKey('');
        }
    }, [selectedProyekId]);

    const selectedProyek = useMemo(() => {
        if (!activeProyekId) return null;
        return (
            proyekList.find((p) => String(p.id) === String(activeProyekId)) || null
        );
    }, [proyekList, activeProyekId]);

    const siteMosList = useMemo(() => {
        if (!activeProyekId) return [];
        return mosList.filter(
            (item) => String(item.proyek_id) === String(activeProyekId)
        );
    }, [mosList, activeProyekId]);

    const materialTotalsList = useMemo(() => {
        if (siteMosList.length === 0) return [];

        const map = new Map();
        siteMosList.forEach((item) => {
            const nama = String(item.nama_material || '').trim() || 'Material Tanpa Nama';
            const satuan = String(item.satuan || 'Unit').trim();
            const key = buildMaterialKey(nama, satuan);
            const jumlah = getItemJumlah(item);
            const terpakai = getItemTerpakai(item);
            const monthKey = getMonthKey(getItemDateKey(item));

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    nama_material: nama,
                    satuan,
                    totalJumlah: 0,
                    totalTerpakai: 0,
                    entriesCount: 0,
                    months: new Set(),
                });
            }

            const entry = map.get(key);
            entry.totalJumlah += jumlah;
            entry.totalTerpakai += terpakai;
            entry.entriesCount += 1;
            if (monthKey) entry.months.add(monthKey);
        });

        return Array.from(map.values())
            .map((entry) => {
                const totalJumlah = Number(entry.totalJumlah.toFixed(2));
                const totalTerpakai = Number(entry.totalTerpakai.toFixed(2));
                const totalSisa = Number((totalJumlah - totalTerpakai).toFixed(2));
                return {
                    ...entry,
                    totalJumlah,
                    totalTerpakai,
                    totalSisa,
                    monthsCount: entry.months.size,
                };
            })
            .sort((a, b) => a.nama_material.localeCompare(b.nama_material, 'id'));
    }, [siteMosList]);

    const monthlySummaryList = useMemo(() => {
        if (siteMosList.length === 0) return [];

        const map = new Map();
        siteMosList.forEach((item) => {
            const monthKey = getMonthKey(getItemDateKey(item)) || 'tanpa-bulan';
            const nama = String(item.nama_material || '').trim() || 'Material';
            const satuan = String(item.satuan || 'Unit').trim();
            const jumlah = getItemJumlah(item);
            const terpakai = getItemTerpakai(item);

            if (!map.has(monthKey)) {
                map.set(monthKey, {
                    monthKey,
                    label: formatBulanIndo(monthKey),
                    entriesCount: 0,
                    materials: new Map(),
                });
            }

            const monthEntry = map.get(monthKey);
            monthEntry.entriesCount += 1;

            const matKey = buildMaterialKey(nama, satuan);
            if (!monthEntry.materials.has(matKey)) {
                monthEntry.materials.set(matKey, {
                    matKey,
                    nama_material: nama,
                    satuan,
                    totalJumlah: 0,
                    totalTerpakai: 0,
                });
            }
            const matEntry = monthEntry.materials.get(matKey);
            matEntry.totalJumlah += jumlah;
            matEntry.totalTerpakai += terpakai;
        });

        return Array.from(map.values())
            .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
            .map((m) => ({
                ...m,
                materialsList: Array.from(m.materials.values()).map((mat) => ({
                    ...mat,
                    totalJumlah: Number(mat.totalJumlah.toFixed(2)),
                    totalTerpakai: Number(mat.totalTerpakai.toFixed(2)),
                })),
            }));
    }, [siteMosList]);

    const visibleMosList = useMemo(() => {
        if (!activeProyekId) return [];
        return siteMosList.filter((item) => {
            if (selectedMonthKey) {
                const mKey = getMonthKey(getItemDateKey(item)) || 'tanpa-bulan';
                if (mKey !== selectedMonthKey) return false;
            }
            if (selectedMaterialKey) {
                const matKey = buildMaterialKey(item.nama_material, item.satuan);
                if (matKey !== selectedMaterialKey) return false;
            }
            return true;
        });
    }, [siteMosList, activeProyekId, selectedMonthKey, selectedMaterialKey]);

    const handleDownloadExport = async (format) => {
        if (!activeProyekId || exportingFormat) return;
        setExportingFormat(format);
        setExportNotice(null);

        try {
            const params = new URLSearchParams();
            params.set('proyek_id', activeProyekId);
            if (selectedMonthKey) params.set('month', selectedMonthKey);
            if (selectedMaterialKey) params.set('material_key', selectedMaterialKey);

            const endpoint =
                format === 'excel'
                    ? `/api/fitur/mos/export/excel?${params.toString()}`
                    : `/api/fitur/mos/export/pdf?${params.toString()}`;

            const response = await apiClient.get(endpoint, {
                responseType: 'blob',
            });

            const todayStr = new Date().toISOString().split('T')[0];
            const ext = format === 'excel' ? 'xlsx' : 'pdf';
            const fallbackName = `MOS_Simpro_${todayStr}.${ext}`;

            const disposition = response.headers?.['content-disposition'] || '';
            const match = disposition.match(/filename="?([^";]+)"?/i);
            const filename = match?.[1] || fallbackName;

            const mimeType =
                format === 'excel'
                    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    : 'application/pdf';

            const blob = new Blob([response.data], {
                type: response.data?.type || mimeType,
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            setExportNotice({
                type: 'success',
                message: `File ${filename} berhasil diunduh.`,
            });
        } catch (err) {
            let errMsg = `Gagal mengunduh laporan ${format.toUpperCase()}.`;
            if (err?.response?.data instanceof Blob) {
                try {
                    const text = await err.response.data.text();
                    const parsed = JSON.parse(text);
                    if (parsed?.message) errMsg = parsed.message;
                } catch {
                    // abaikan jika bukan JSON
                }
            } else if (err?.response?.data?.message) {
                errMsg = err.response.data.message;
            }
            setExportNotice({
                type: 'error',
                message: errMsg,
            });
        } finally {
            setExportingFormat(null);
        }
    };

    const resetForm = () => {
        setEditId(null);
        setForm({
            ...INITIAL_FORM,
            proyek_id: activeProyekId,
            tanggal_masuk: new Date().toISOString().split('T')[0],
        });
    };

    const handleSiteChange = (e) => {
        const val = e.target.value;
        setShowForm(false);
        setEditId(null);
        setSelectedMonthKey('');
        setSelectedMaterialKey('');
        setExportNotice(null);
        setForm({
            ...INITIAL_FORM,
            proyek_id: val,
        });
        onSelectProyekId(val ? Number(val) : null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeProyekId) {
            alert('Silakan pilih site / proyek terlebih dahulu.');
            return;
        }

        const jumlahVal = Math.max(parseDecimal(form.jumlah), 0);
        const terpakaiVal = Math.max(parseDecimal(form.jumlah_terpakai), 0);
        const tanggalVal = form.tanggal_masuk || new Date().toISOString().split('T')[0];
        const kodeMaterialVal =
            (form.kode_material || '').trim() ||
            `MAT-${Date.now().toString().slice(-6)}`;

        const payload = {
            proyek_id: Number(activeProyekId),
            kode_material: kodeMaterialVal,
            nama_material: form.nama_material.trim(),
            tanggal_masuk: tanggalVal,
            tanggal_update: tanggalVal,
            jumlah: jumlahVal,
            jumlah_masuk: jumlahVal,
            jumlah_terpakai: terpakaiVal,
            satuan: form.satuan.trim() || 'Unit',
        };

        try {
            if (editId) {
                await apiClient.put(`/api/fitur/mos/${editId}`, payload);
            } else {
                await apiClient.post('/api/fitur/mos', payload);
            }
            setShowForm(false);
            resetForm();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal menyimpan data MOS');
        }
    };

    const handleEdit = (item) => {
        const proyekId = item.proyek_id ? String(item.proyek_id) : activeProyekId;
        setEditId(item.id);
        setForm({
            proyek_id: proyekId,
            kode_material: item.kode_material || '',
            nama_material: item.nama_material || '',
            tanggal_masuk:
                getItemDateKey(item) || new Date().toISOString().split('T')[0],
            jumlah: item.jumlah ?? item.jumlah_masuk ?? '',
            jumlah_terpakai: item.jumlah_terpakai ?? '0',
            satuan: item.satuan || 'Sak',
        });
        if (proyekId) {
            onSelectProyekId(Number(proyekId));
        }
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus data material ini?')) return;
        try {
            await apiClient.delete(`/api/fitur/mos/${id}`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal menghapus data MOS');
        }
    };

    const isSiteSelected = Boolean(activeProyekId);
    const hasActiveSubFilter = Boolean(selectedMonthKey || selectedMaterialKey);

    return (
        <div className="space-y-6 text-left">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-xl font-bold text-white">Data Material On Site (MOS)</h2>
                        {isSiteSelected && (
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                Site: {getSiteLabel(selectedProyek) || `#${activeProyekId}`}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-400">
                        Pilih site untuk melihat total keseluruhan per material, rekap per bulan, dan input data MOS
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[220px]">
                        <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                            disabled={loadingProyek}
                            value={activeProyekId}
                            onChange={handleSiteChange}
                            className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="" className="bg-[#131c2e] text-slate-400">
                                {loadingProyek ? 'Memuat site...' : '-- Pilih Site --'}
                            </option>
                            {proyekList.map((p) => (
                                <option key={p.id} value={p.id} className="bg-[#131c2e] text-slate-100">
                                    {getSiteLabel(p)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {isSiteSelected && (
                        <>
                            <button
                                type="button"
                                disabled={Boolean(exportingFormat)}
                                onClick={() => handleDownloadExport('excel')}
                                className="inline-flex items-center gap-2 bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium px-3.5 py-2.5 rounded-xl transition cursor-pointer"
                                title="Download Excel (.xlsx)"
                            >
                                {exportingFormat === 'excel' ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <FileSpreadsheet size={16} />
                                )}
                                <span>{exportingFormat === 'excel' ? 'Exporting...' : 'Download Excel'}</span>
                            </button>

                            <button
                                type="button"
                                disabled={Boolean(exportingFormat)}
                                onClick={() => handleDownloadExport('pdf')}
                                className="inline-flex items-center gap-2 bg-[#131c2e] hover:bg-slate-800 border border-slate-700/80 disabled:opacity-60 text-slate-100 text-sm font-medium px-3.5 py-2.5 rounded-xl transition cursor-pointer"
                                title="Download PDF (.pdf)"
                            >
                                {exportingFormat === 'pdf' ? (
                                    <Loader2 size={16} className="animate-spin text-rose-400" />
                                ) : (
                                    <FileText size={16} className="text-rose-400" />
                                )}
                                <span>{exportingFormat === 'pdf' ? 'Exporting...' : 'Download PDF'}</span>
                            </button>

                            {hasWriteAccess ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (showForm) {
                                            setShowForm(false);
                                            resetForm();
                                        } else {
                                            setEditId(null);
                                            setForm({
                                                ...INITIAL_FORM,
                                                proyek_id: activeProyekId,
                                                tanggal_masuk: new Date().toISOString().split('T')[0],
                                            });
                                            setShowForm(true);
                                        }
                                    }}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition cursor-pointer"
                                >
                                    <Plus size={18} />
                                    <span>{showForm ? 'Tutup Form' : 'Tambah Data MOS'}</span>
                                </button>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#131c2e] border border-slate-700/80 text-slate-300 px-3.5 py-2 rounded-xl">
                                    <Lock size={14} className="text-slate-400" />
                                    Mode Baca (Hanya Logistik & Admin Proyek yang dapat mengubah)
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {exportNotice && (
                <div
                    className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm border ${exportNotice.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        {exportNotice.type === 'success' ? (
                            <CheckCircle2 size={16} className="shrink-0" />
                        ) : (
                            <AlertCircle size={16} className="shrink-0" />
                        )}
                        <span>{exportNotice.message}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setExportNotice(null)}
                        className="text-current/80 hover:text-white cursor-pointer"
                        aria-label="Tutup notifikasi"
                    >
                        <X size={15} />
                    </button>
                </div>
            )}

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
                        Total material, rekap per bulan, tombol export, dan form data MOS hanya ditampilkan setelah Anda memilih site yang aktif.
                    </p>
                </div>
            ) : (
                <>
                    {/* Form Input / Edit MOS */}
                    {showForm && hasWriteAccess && (
                        <form
                            onSubmit={handleSubmit}
                            className="bg-[#0e1626] p-6 rounded-2xl border border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Site / Proyek *
                                </label>
                                <select
                                    required
                                    className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    value={activeProyekId}
                                    onChange={handleSiteChange}
                                >
                                    <option value="" className="bg-[#131c2e] text-slate-400">
                                        -- Pilih Site --
                                    </option>
                                    {proyekList.map((p) => (
                                        <option key={p.id} value={p.id} className="bg-[#131c2e] text-slate-100">
                                            {getSiteLabel(p)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Nama Material *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Contoh: Semen Portland 50kg"
                                    className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    value={form.nama_material}
                                    onChange={(e) => setForm({ ...form, nama_material: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Tanggal Masuk *
                                </label>
                                <input
                                    type="date"
                                    required
                                    className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    value={form.tanggal_masuk}
                                    onChange={(e) => setForm({ ...form, tanggal_masuk: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                        Jumlah *
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        required
                                        placeholder="0.00"
                                        className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                        value={form.jumlah}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            if (/^[0-9.,]*$/.test(raw)) {
                                                setForm({ ...form, jumlah: raw });
                                            }
                                        }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                        Jumlah Terpakai
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                        value={form.jumlah_terpakai}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            if (/^[0-9.,]*$/.test(raw)) {
                                                setForm({ ...form, jumlah_terpakai: raw });
                                            }
                                        }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                        Satuan *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Sak / m3 / Batang"
                                        className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                        value={form.satuan}
                                        onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                                    />
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
                                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2 rounded-xl transition cursor-pointer"
                                >
                                    {editId ? 'Update Data MOS' : 'Simpan Data MOS'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Keseluruhan Total Tiap Material */}
                    <div className="bg-[#0e1626] p-5 rounded-2xl border border-slate-800/80 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Boxes className="w-4 h-4 text-blue-400" />
                                <h3 className="text-sm font-semibold text-white">
                                    Total Keseluruhan Tiap Material
                                </h3>
                            </div>
                            {selectedMaterialKey && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedMaterialKey('')}
                                    className="inline-flex items-center gap-1 text-xs text-blue-300 hover:text-white underline cursor-pointer"
                                >
                                    <X size={12} />
                                    Reset filter material
                                </button>
                            )}
                        </div>

                        {materialTotalsList.length === 0 ? (
                            <p className="text-xs text-slate-500">
                                Belum ada total material pada site ini.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {materialTotalsList.map((mat) => {
                                    const active = selectedMaterialKey === mat.key;
                                    return (
                                        <div
                                            key={mat.key}
                                            onClick={() =>
                                                setSelectedMaterialKey((prev) =>
                                                    prev === mat.key ? '' : mat.key
                                                )
                                            }
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedMaterialKey((prev) =>
                                                        prev === mat.key ? '' : mat.key
                                                    );
                                                }
                                            }}
                                            className={`p-3.5 rounded-xl border transition cursor-pointer ${active
                                                    ? 'bg-blue-500/15 border-blue-500/50'
                                                    : 'bg-[#131c2e] border-slate-800 hover:border-slate-700'
                                                }`}
                                        >
                                            <div className="text-xs font-semibold text-white truncate">
                                                {mat.nama_material}
                                            </div>
                                            <div className="mt-1.5 flex items-baseline justify-between gap-2">
                                                <span className="text-base font-bold text-blue-400 tabular-nums">
                                                    Masuk: {mat.totalJumlah} {mat.satuan}
                                                </span>
                                                <span className="text-[11px] text-slate-400">
                                                    {mat.entriesCount} input • {mat.monthsCount} bln
                                                </span>
                                            </div>
                                            <div className="mt-1 flex items-center justify-between text-xs text-slate-300 tabular-nums">
                                                <span>Terpakai: {mat.totalTerpakai} {mat.satuan}</span>
                                                <span className="text-emerald-400 font-medium">
                                                    Sisa: {mat.totalSisa} {mat.satuan}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Rekap MOS Per Bulan */}
                    <div className="bg-[#0e1626] p-5 rounded-2xl border border-slate-800/80 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-emerald-400" />
                                <h3 className="text-sm font-semibold text-white">
                                    Rekap Material On Site Per Bulan
                                </h3>
                            </div>
                            {selectedMonthKey && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedMonthKey('')}
                                    className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-white underline cursor-pointer"
                                >
                                    <X size={12} />
                                    Reset filter bulan
                                </button>
                            )}
                        </div>

                        {monthlySummaryList.length === 0 ? (
                            <p className="text-xs text-slate-500">
                                Belum ada rekap bulanan pada site ini.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {monthlySummaryList.map((m) => {
                                    const active = selectedMonthKey === m.monthKey;
                                    return (
                                        <div
                                            key={m.monthKey}
                                            onClick={() =>
                                                setSelectedMonthKey((prev) =>
                                                    prev === m.monthKey ? '' : m.monthKey
                                                )
                                            }
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedMonthKey((prev) =>
                                                        prev === m.monthKey ? '' : m.monthKey
                                                    );
                                                }
                                            }}
                                            className={`p-3.5 rounded-xl border transition cursor-pointer ${active
                                                    ? 'bg-emerald-500/15 border-emerald-500/50'
                                                    : 'bg-[#131c2e] border-slate-800 hover:border-slate-700'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-semibold text-white">
                                                    {m.label}
                                                </span>
                                                <span className="text-[11px] text-slate-400">
                                                    {m.entriesCount} data
                                                </span>
                                            </div>
                                            <div className="mt-2 space-y-1.5">
                                                {m.materialsList.map((mat) => (
                                                    <div
                                                        key={mat.matKey}
                                                        className="text-xs text-slate-300 flex items-center justify-between gap-2"
                                                    >
                                                        <span className="truncate">{mat.nama_material}</span>
                                                        <span className="font-semibold text-emerald-400 tabular-nums whitespace-nowrap">
                                                            {mat.totalJumlah} masuk • {mat.totalTerpakai} terpakai {mat.satuan}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Bar Info Filter Tabel */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <div>
                            Menampilkan <strong className="text-white">{visibleMosList.length}</strong> rincian data MOS
                        </div>
                        {hasActiveSubFilter && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedMonthKey('');
                                    setSelectedMaterialKey('');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 transition cursor-pointer"
                            >
                                <RotateCcw size={12} />
                                <span>Reset semua filter</span>
                            </button>
                        )}
                    </div>

                    {/* Tabel Rincian Data MOS */}
                    <div className="bg-[#0e1626] rounded-2xl border border-slate-800/80 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#111b2e] border-b border-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Tanggal Masuk</th>
                                    <th className="py-3.5 px-4">Nama Material</th>
                                    <th className="py-3.5 px-4">Jumlah</th>
                                    <th className="py-3.5 px-4">Jumlah Terpakai</th>
                                    <th className="py-3.5 px-4">Sisa</th>
                                    <th className="py-3.5 px-4">Satuan</th>
                                    {hasWriteAccess && <th className="py-3.5 px-4 text-right">Aksi</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-sm">
                                {visibleMosList.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={hasWriteAccess ? 7 : 6}
                                            className="py-8 text-center text-slate-500"
                                        >
                                            Belum ada data Material On Site untuk filter ini.
                                        </td>
                                    </tr>
                                ) : (
                                    visibleMosList.map((item) => {
                                        const dateKey = getItemDateKey(item);
                                        const jumlahVal = Number(getItemJumlah(item).toFixed(2));
                                        const terpakaiVal = Number(getItemTerpakai(item).toFixed(2));
                                        const sisaVal = Number((jumlahVal - terpakaiVal).toFixed(2));
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-800/40 transition">
                                                <td className="py-3.5 px-4 whitespace-nowrap text-xs font-medium text-slate-200">
                                                    {formatTanggalIndo(dateKey)}
                                                </td>
                                                <td className="py-3.5 px-4 font-medium text-white">
                                                    {item.nama_material || '-'}
                                                </td>
                                                <td className="py-3.5 px-4 font-semibold text-blue-400 tabular-nums">
                                                    {jumlahVal}
                                                </td>
                                                <td className="py-3.5 px-4 text-amber-300 tabular-nums">
                                                    {terpakaiVal}
                                                </td>
                                                <td className="py-3.5 px-4 font-semibold text-emerald-400 tabular-nums">
                                                    {sisaVal}
                                                </td>
                                                <td className="py-3.5 px-4 text-slate-300">
                                                    {item.satuan || '-'}
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