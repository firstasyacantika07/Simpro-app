import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Lock } from 'lucide-react';
import { canEditMOS } from '../utils/rbac';

const INITIAL_FORM = {
    proyek_id: '',
    kode_material: '',
    nama_material: '',
    satuan: 'Sak',
    jumlah_masuk: '',
    jumlah_terpakai: 0,
    tanggal_update: new Date().toISOString().split('T')[0],
};

export default function MosSection({ user }) {
    const [mosList, setMosList] = useState([]);
    const [proyekList, setProyekList] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(INITIAL_FORM);

    const hasWriteAccess = canEditMOS(user?.posisi);
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const fetchData = useCallback(async () => {
        try {
            const [resMos, resProyek] = await Promise.all([
                axios.get('http://localhost:5000/api/fitur/mos', authHeader),
                axios.get('http://localhost:5000/api/proyek', authHeader),
            ]);
            setMosList(resMos.data);
            setProyekList(resProyek.data);
            if (resProyek.data.length > 0) {
                setForm((prev) => ({
                    ...prev,
                    proyek_id: prev.proyek_id || resProyek.data[0].id,
                }));
            }
        } catch (err) {
            console.error('Gagal memuat data MOS:', err);
        }
    }, [token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const resetForm = () => {
        setEditId(null);
        setForm({
            ...INITIAL_FORM,
            proyek_id: proyekList[0]?.id || '',
            tanggal_update: new Date().toISOString().split('T')[0],
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editId) {
                await axios.put(`http://localhost:5000/api/fitur/mos/${editId}`, form, authHeader);
            } else {
                await axios.post('http://localhost:5000/api/fitur/mos', form, authHeader);
            }
            setShowForm(false);
            resetForm();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal menyimpan data MOS');
        }
    };

    const handleEdit = (item) => {
        setEditId(item.id);
        setForm({
            proyek_id: item.proyek_id,
            kode_material: item.kode_material,
            nama_material: item.nama_material,
            satuan: item.satuan,
            jumlah_masuk: item.jumlah_masuk,
            jumlah_terpakai: item.jumlah_terpakai,
            tanggal_update: item.tanggal_update?.split('T')[0] || '',
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus data material ini?')) return;
        try {
            await axios.delete(`http://localhost:5000/api/fitur/mos/${id}`, authHeader);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal menghapus data MOS');
        }
    };

    return (
        <div className="space-y-6 text-left">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Data Material On Site (MOS)</h2>
                    <p className="text-sm text-slate-400">
                        Monitoring stok material masuk, terpakai, dan sisa di lapangan
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
            </div>

            {/* Form Input / Edit MOS */}
            {showForm && hasWriteAccess && (
                <form
                    onSubmit={handleSubmit}
                    className="bg-[#0e1626] p-6 rounded-2xl border border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Proyek
                        </label>
                        <select
                            required
                            className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            value={form.proyek_id}
                            onChange={(e) => setForm({ ...form, proyek_id: e.target.value })}
                        >
                            {proyekList.map((p) => (
                                <option key={p.id} value={p.id} className="bg-[#131c2e] text-slate-100">
                                    {p.nama_proyek}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Kode Material
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="MAT-001"
                            className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            value={form.kode_material}
                            onChange={(e) => setForm({ ...form, kode_material: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Nama Material
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Semen Portland 50kg"
                            className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            value={form.nama_material}
                            onChange={(e) => setForm({ ...form, nama_material: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Satuan
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

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Jumlah Masuk
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            required
                            className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            value={form.jumlah_masuk}
                            onChange={(e) => setForm({ ...form, jumlah_masuk: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Jumlah Terpakai
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            value={form.jumlah_terpakai}
                            onChange={(e) => setForm({ ...form, jumlah_terpakai: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-3 flex justify-end gap-2 pt-2">
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

            {/* Tabel Data MOS */}
            <div className="bg-[#0e1626] rounded-2xl border border-slate-800/80 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#111b2e] border-b border-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            <th className="py-3.5 px-4">Kode</th>
                            <th className="py-3.5 px-4">Nama Material</th>
                            <th className="py-3.5 px-4">Masuk</th>
                            <th className="py-3.5 px-4">Terpakai</th>
                            <th className="py-3.5 px-4">Sisa di Lokasi</th>
                            <th className="py-3.5 px-4">Tgl Update</th>
                            {hasWriteAccess && <th className="py-3.5 px-4 text-right">Aksi</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                        {mosList.length === 0 ? (
                            <tr>
                                <td colSpan={hasWriteAccess ? 7 : 6} className="py-8 text-center text-slate-500">
                                    Belum ada data Material On Site.
                                </td>
                            </tr>
                        ) : (
                            mosList.map((item) => {
                                const sisa = Number(item.jumlah_masuk) - Number(item.jumlah_terpakai);
                                return (
                                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                                        <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                                            {item.kode_material}
                                        </td>
                                        <td className="py-3.5 px-4 font-medium text-white">
                                            {item.nama_material}
                                        </td>
                                        <td className="py-3.5 px-4 text-slate-300 tabular-nums">
                                            {item.jumlah_masuk} {item.satuan}
                                        </td>
                                        <td className="py-3.5 px-4 text-slate-300 tabular-nums">
                                            {item.jumlah_terpakai} {item.satuan}
                                        </td>
                                        <td className="py-3.5 px-4 font-semibold text-blue-400 tabular-nums">
                                            {sisa} {item.satuan}
                                        </td>
                                        <td className="py-3.5 px-4 text-slate-400">
                                            {item.tanggal_update
                                                ? new Date(item.tanggal_update).toLocaleDateString('id-ID')
                                                : '-'}
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