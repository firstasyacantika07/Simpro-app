import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import {
    Plus,
    Pencil,
    Trash2,
    Lock,
    RotateCcw,
    Upload,
    CloudSun,
    FileText,
    X,
    Building2,
} from 'lucide-react';
import { canEditProgress } from '../utils/rbac';

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

const isImageDataUrl = (val = '') =>
    typeof val === 'string' && val.startsWith('data:image/');

export default function ProgressSection({
    user,
    selectedProyekId = null,
    onSelectProyekId = () => { },
}) {
    const [progressList, setProgressList] = useState([]);
    const [proyekList, setProyekList] = useState([]);
    const [bangunanList, setBangunanList] = useState([]);
    const [loadingBangunan, setLoadingBangunan] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({
        ...INITIAL_FORM,
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

    const fetchBangunan = useCallback(
        async (proyekId, preferredBangunanId = null, preferredNamaBangunan = '') => {
            if (!token || !proyekId) {
                setBangunanList([]);
                return;
            }

            setLoadingBangunan(true);
            try {
                const res = await axios.get(
                    `http://localhost:5000/api/proyek/${proyekId}/bangunan`,
                    authHeader
                );
                const rows = Array.isArray(res.data) ? res.data : [];
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
        if (!token) return;
        try {
            const [resProg, resProyek] = await Promise.all([
                axios.get('http://localhost:5000/api/fitur/progress', authHeader),
                axios.get('http://localhost:5000/api/proyek', authHeader),
            ]);
            const fetchedProyek = Array.isArray(resProyek.data) ? resProyek.data : [];
            setProgressList(Array.isArray(resProg.data) ? resProg.data : []);
            setProyekList(fetchedProyek);

            setForm((prev) => ({
                ...prev,
                proyek_id: selectedProyekId ? String(selectedProyekId) : prev.proyek_id || '',
                pelaksana: prev.pelaksana || user?.nama || '',
            }));
        } catch (err) {
            console.error('Gagal memuat laporan progress:', err);
        }
    }, [token, authHeader, selectedProyekId, user?.nama]);

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
        if (form.proyek_id) {
            fetchBangunan(form.proyek_id);
        } else {
            setBangunanList([]);
        }
    }, [form.proyek_id, fetchBangunan]);

    const selectedProyek = useMemo(() => {
        if (!selectedProyekId) return null;
        return (
            proyekList.find((p) => String(p.id) === String(selectedProyekId)) || null
        );
    }, [proyekList, selectedProyekId]);

    const visibleProgressList = useMemo(() => {
        if (!selectedProyekId) return progressList;
        return progressList.filter(
            (item) => String(item.proyek_id) === String(selectedProyekId)
        );
    }, [progressList, selectedProyekId]);

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
        const activeSiteId = selectedProyekId ? String(selectedProyekId) : '';
        const firstBuilding = activeSiteId ? bangunanList[0] : null;
        setEditId(null);
        setDocFileName('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setForm({
            ...INITIAL_FORM,
            proyek_id: activeSiteId,
            bangunan_id: firstBuilding ? String(firstBuilding.id) : '',
            nama_bangunan: firstBuilding ? firstBuilding.nama_bangunan : '',
            pelaksana: user?.nama || '',
            tanggal_laporan: new Date().toISOString().split('T')[0],
        });
    };

    const handleSiteChange = (e) => {
        const val = e.target.value;
        setForm((prev) => ({
            ...prev,
            proyek_id: val,
            bangunan_id: '',
            nama_bangunan: '',
        }));
        onSelectProyekId(val ? Number(val) : null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.proyek_id) {
            alert('Silakan pilih site / proyek terlebih dahulu sebelum mengisi laporan.');
            return;
        }

        const catatanGabungan = [
            form.pelaksana.trim() ? `Pelaksana: ${form.pelaksana.trim()}` : '',
            form.catatan.trim(),
        ]
            .filter(Boolean)
            .join(' | ');

        const payload = {
            proyek_id: Number(form.proyek_id),
            bangunan_id: form.bangunan_id ? Number(form.bangunan_id) : null,
            nama_bangunan: form.nama_bangunan.trim() || null,
            pelaksana: form.pelaksana.trim() || user?.nama || null,
            tanggal_laporan: form.tanggal_laporan,
            uraian_pekerjaan: form.uraian_pekerjaan.trim(),
            bobot_realisasi: Number(form.bobot_realisasi) || 0,
            catatan: catatanGabungan || null,
            cuaca: form.cuaca || null,
            dokumentasi: form.dokumentasi || null,
        };

        try {
            if (editId) {
                await axios.put(
                    `http://localhost:5000/api/fitur/progress/${editId}`,
                    payload,
                    authHeader
                );
            } else {
                await axios.post('http://localhost:5000/api/fitur/progress', payload, authHeader);
            }
            setShowForm(false);
            resetForm();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal menyimpan laporan progress');
        }
    };

    const handleEdit = (item) => {
        const proyekId = item.proyek_id ? String(item.proyek_id) : '';
        const rawCatatan = item.catatan ?? item.kendala ?? '';
        const pelaksanaMatch = rawCatatan.match(/^Pelaksana:\s*([^|]+)(?:\s*\|\s*(.*))?$/i);
        const parsedPelaksana = pelaksanaMatch
            ? pelaksanaMatch[1].trim()
            : item.dibuat_oleh || user?.nama || '';
        const parsedCatatan = pelaksanaMatch
            ? (pelaksanaMatch[2] || '').trim()
            : rawCatatan;

        setEditId(item.id);
        setDocFileName('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setForm({
            proyek_id: proyekId,
            bangunan_id: item.bangunan_id ? String(item.bangunan_id) : '',
            nama_bangunan: item.nama_bangunan || '',
            pelaksana: parsedPelaksana,
            tanggal_laporan: item.tanggal_laporan?.split('T')[0] || '',
            uraian_pekerjaan: item.uraian_pekerjaan || '',
            bobot_realisasi: item.bobot_realisasi ?? '',
            catatan: parsedCatatan,
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
            await axios.delete(`http://localhost:5000/api/fitur/progress/${id}`, authHeader);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal menghapus laporan');
        }
    };

    const isSiteSelected = Boolean(form.proyek_id);

    return (
        <div className="space-y-6 text-left">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-xl font-bold text-white">Laporan Progress Harian</h2>
                        {selectedProyekId && (
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                Site: {selectedProyek?.nama_proyek || `#${selectedProyekId}`}
                                <button
                                    type="button"
                                    onClick={() => onSelectProyekId(null)}
                                    className="inline-flex items-center gap-1 text-emerald-200 hover:text-white underline ml-1 cursor-pointer"
                                    title="Tampilkan semua site"
                                >
                                    <RotateCcw size={12} />
                                    Semua
                                </button>
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-400">
                        Pilih site terlebih dahulu untuk mengisi laporan pelaksana, bangunan, progres, cuaca, catatan, dan dokumen terlampir
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
                                setEditId(null);
                                setDocFileName('');
                                setForm((prev) => ({
                                    ...INITIAL_FORM,
                                    proyek_id: selectedProyekId ? String(selectedProyekId) : '',
                                    pelaksana: user?.nama || '',
                                }));
                                setShowForm(true);
                                if (selectedProyekId) {
                                    fetchBangunan(selectedProyekId);
                                }
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
                )}
            </div>

            {/* Form Input / Edit Progress */}
            {showForm && hasWriteAccess && (
                <form
                    onSubmit={handleSubmit}
                    className="bg-[#0e1626] p-6 rounded-2xl border border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                    {/* 1. Site / Proyek (dari API Site) */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Site / Proyek *
                        </label>
                        <div className="relative">
                            <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                                required
                                className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl pl-10 pr-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                value={form.proyek_id}
                                onChange={handleSiteChange}
                            >
                                <option value="" className="bg-[#131c2e] text-slate-400">
                                    -- Pilih Site terlebih dahulu --
                                </option>
                                {proyekList.map((p) => (
                                    <option
                                        key={p.id}
                                        value={p.id}
                                        className="bg-[#131c2e] text-slate-100"
                                    >
                                        {p.nama_proyek}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 2. Pelaksana */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Pelaksana *
                        </label>
                        <input
                            type="text"
                            required
                            disabled={!isSiteSelected}
                            placeholder="Nama pelaksana lapangan"
                            className="w-full bg-[#131c2e] border border-slate-700/80 disabled:opacity-50 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
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
                            disabled={!isSiteSelected || loadingBangunan || bangunanList.length === 0}
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
                            {!isSiteSelected ? (
                                <option value="" className="bg-[#131c2e] text-slate-400">
                                    Pilih site terlebih dahulu
                                </option>
                            ) : loadingBangunan ? (
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
                        {isSiteSelected && !loadingBangunan && bangunanList.length === 0 && (
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
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            required
                            disabled={!isSiteSelected}
                            placeholder="0.00"
                            className="w-full bg-[#131c2e] border border-slate-700/80 disabled:opacity-50 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            value={form.bobot_realisasi}
                            onChange={(e) => setForm({ ...form, bobot_realisasi: e.target.value })}
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
                            disabled={!isSiteSelected}
                            placeholder="Contoh: Instalasi rangka atap / Clearing"
                            className="w-full bg-[#131c2e] border border-slate-700/80 disabled:opacity-50 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
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
                                disabled={!isSiteSelected}
                                className="w-full bg-[#131c2e] border border-slate-700/80 disabled:opacity-50 text-slate-100 rounded-xl pl-10 pr-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
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
                            disabled={!isSiteSelected}
                            placeholder="Catatan atau kendala pekerjaan di lapangan"
                            className="w-full bg-[#131c2e] border border-slate-700/80 disabled:opacity-50 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
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
                            disabled={!isSiteSelected}
                            onChange={handleDokumentasiChange}
                            className="hidden"
                        />

                        <div
                            className={`w-full bg-[#131c2e] border border-dashed border-slate-700 text-slate-200 rounded-xl p-3.5 transition flex items-center justify-between gap-3 ${isSiteSelected
                                    ? 'hover:border-emerald-500/70'
                                    : 'opacity-50 cursor-not-allowed'
                                }`}
                        >
                            <div
                                onClick={() => isSiteSelected && fileInputRef.current?.click()}
                                role="button"
                                tabIndex={isSiteSelected ? 0 : -1}
                                onKeyDown={(e) => {
                                    if (
                                        isSiteSelected &&
                                        (e.key === 'Enter' || e.key === ' ')
                                    ) {
                                        e.preventDefault();
                                        fileInputRef.current?.click();
                                    }
                                }}
                                className={`flex items-center gap-3 min-w-0 flex-1 ${isSiteSelected ? 'cursor-pointer' : 'cursor-not-allowed'
                                    }`}
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
                                {form.dokumentasi && isSiteSelected && (
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
                                    disabled={!isSiteSelected}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 disabled:opacity-50 text-xs font-semibold cursor-pointer"
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
                            disabled={!isSiteSelected}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-xl transition cursor-pointer"
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
                                    colSpan={hasWriteAccess ? 8 : 7}
                                    className="py-8 text-center text-slate-500"
                                >
                                    {selectedProyekId
                                        ? 'Belum ada laporan progress harian untuk site ini.'
                                        : 'Belum ada laporan progress harian.'}
                                </td>
                            </tr>
                        ) : (
                            visibleProgressList.map((item) => {
                                const namaBangunanDisplay =
                                    item.nama_bangunan ||
                                    bangunanList.find(
                                        (b) => String(b.id) === String(item.bangunan_id)
                                    )?.nama_bangunan ||
                                    '-';
                                const rawCatatan = item.catatan ?? item.kendala ?? '';
                                const pelaksanaDisplay =
                                    item.pelaksana ||
                                    rawCatatan.match(/^Pelaksana:\s*([^|]+)/i)?.[1]?.trim() ||
                                    item.dibuat_oleh ||
                                    '-';
                                const catatanDisplay =
                                    rawCatatan.replace(/^Pelaksana:\s*[^|]+\s*\|\s*/i, '').trim() ||
                                    (rawCatatan.toLowerCase().startsWith('pelaksana:') ? '-' : rawCatatan) ||
                                    '-';

                                return (
                                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
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
                                            {catatanDisplay}
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
        </div>
    );
}