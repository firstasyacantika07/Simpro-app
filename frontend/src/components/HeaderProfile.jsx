import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, UserPen, LogOut, X } from 'lucide-react';
import axios from 'axios';

export default function HeaderProfile({ user, setUser, pageTitle }) {
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const dropdownRef = useRef(null);

    // State Form Edit Profile
    const [formData, setFormData] = useState({
        nama: user?.nama || '',
        email: user?.email || '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    // Tutup dropdown jika klik di luar area
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOpenEditModal = () => {
        setFormData({
            nama: user?.nama || '',
            email: user?.email || '',
            password: '',
        });
        setMsg({ type: '', text: '' });
        setDropdownOpen(false);
        setEditModalOpen(true);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMsg({ type: '', text: '' });

        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(
                'http://localhost:5000/api/auth/profile',
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            setUser(res.data.user);
            setMsg({ type: 'success', text: res.data.message });

            setTimeout(() => {
                setEditModalOpen(false);
            }, 1200);
        } catch (err) {
            setMsg({
                type: 'error',
                text: err.response?.data?.message || 'Gagal memperbarui profil.',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    // Inisial nama untuk avatar
    const initials = user?.nama
        ? user.nama
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()
        : 'U';

    return (
        <>
            <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20">
                <h1 className="text-lg font-bold text-slate-800">{pageTitle}</h1>

                {/* Menu Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center gap-3 py-1.5 px-3 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                    >
                        <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-semibold text-sm flex items-center justify-center">
                            {initials}
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className="text-sm font-semibold text-slate-800 leading-tight">
                                {user?.nama}
                            </p>
                            <p className="text-xs text-slate-500">{user?.posisi}</p>
                        </div>
                        <ChevronDown size={16} className="text-slate-500" />
                    </button>

                    {dropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30">
                            <div className="px-4 py-2.5 border-b border-slate-100">
                                <p className="text-xs font-medium text-slate-400">Masuk sebagai</p>
                                <p className="text-sm font-semibold text-slate-800 truncate">{user?.email}</p>
                            </div>

                            <button
                                onClick={handleOpenEditModal}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                                <UserPen size={16} className="text-blue-600" />
                                <span>Edit Profile</span>
                            </button>

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition cursor-pointer"
                            >
                                <LogOut size={16} />
                                <span>Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Modal Edit Profile */}
            {editModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900">Edit Profile</h2>
                            <button
                                onClick={() => setEditModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {msg.text && (
                            <div
                                className={`text-sm p-3 rounded-lg mb-4 ${msg.type === 'success'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-red-50 text-red-600 border border-red-200'
                                    }`}
                            >
                                {msg.text}
                            </div>
                        )}

                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nama Lengkap
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.nama}
                                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    required
                                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Posisi / Role (Tidak dapat diubah mandiri)
                                </label>
                                <input
                                    type="text"
                                    disabled
                                    className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-3.5 py-2 text-sm"
                                    value={user?.posisi || ''}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Password Baru <span className="text-slate-400 font-normal">(Opsional)</span>
                                </label>
                                <input
                                    type="password"
                                    placeholder="Kosongkan jika tidak ingin mengganti password"
                                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setEditModalOpen(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition cursor-pointer disabled:opacity-50"
                                >
                                    {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}