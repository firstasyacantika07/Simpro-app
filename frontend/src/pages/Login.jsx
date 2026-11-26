import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import backgroundImage from '../assets/Background.jpg';
import apiClient, {
    getAccessToken,
    getStoredUser,
    refreshAccessToken,
    setAuthSession,
} from '../api/axiosClient';

const PROJECT_BG_IMAGE = backgroundImage;

export default function Login() {
    const navigate = useNavigate();

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [imgError, setImgError] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [showForgot, setShowForgot] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [resetMsg, setResetMsg] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    useEffect(() => {
        let active = true;

        async function checkExistingSession() {
            if (getAccessToken() && getStoredUser()) {
                navigate('/dashboard', { replace: true });
                return;
            }

            if (!getStoredUser()) return;

            try {
                const refreshed = await refreshAccessToken();
                if (active && refreshed?.accessToken) {
                    navigate('/dashboard', { replace: true });
                }
            } catch {
                // Biarkan di halaman login jika tidak ada refresh token valid
            }
        }

        checkExistingSession();

        return () => {
            active = false;
        };
    }, [navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await apiClient.post('/api/auth/login', {
                identifier: identifier.trim(),
                password,
            });

            const accessToken = res.data?.accessToken || res.data?.token;
            const user = res.data?.user;

            if (!accessToken || !user) {
                setError('Respons login tidak lengkap dari server.');
                return;
            }

            setAuthSession({ accessToken, user });
            navigate('/dashboard', { replace: true });
        } catch (err) {
            if (!err?.response) {
                setError(
                    'Server backend tidak memberikan respons (ERR_EMPTY_RESPONSE atau koneksi terputus). Pastikan server di port 5000 aktif dan periksa log backend.'
                );
            } else {
                setError(
                    err.response?.data?.message ||
                    'Login gagal. Periksa kembali data Anda.'
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setResetMsg('');
        setResetLoading(true);

        try {
            const res = await apiClient.post('/api/auth/forgot-password', {
                email: resetEmail.trim(),
                newPassword,
            });

            setResetMsg(res.data?.message || 'Password berhasil diperbarui.');

            setTimeout(() => {
                setShowForgot(false);
                setResetMsg('');
                setResetEmail('');
                setNewPassword('');
            }, 2000);
        } catch (err) {
            setResetMsg(
                err.response?.data?.message || 'Gagal mereset password.'
            );
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 grid lg:grid-cols-2">

            {/* LEFT - Construction Site Editorial Panel with Project Background Photo */}
            <div className="hidden lg:flex relative flex-col justify-between p-12 xl:p-14 overflow-hidden border-r border-slate-800/80 bg-[#12151c]">
                {/* Background Foto Proyek */}
                {!imgError && (
                    <img
                        src={PROJECT_BG_IMAGE}
                        alt="Background"
                        onError={() => {
                            console.error('Gagal memuat gambar:', PROJECT_BG_IMAGE);
                            setImgError(true);
                        }}
                        className="absolute inset-0 w-full h-full object-cover scale-105 grayscale contrast-110 pointer-events-none"
                    />
                )}

                {/* Overlay Gelap & Grid agar Teks Tetap Tajam */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/80 via-[#0b101b]/70 to-[#060911]/90 pointer-events-none" />
                <div
                    className="absolute inset-0 opacity-15 pointer-events-none"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(148, 163, 184, 0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.25) 1px, transparent 1px)',
                        backgroundSize: '48px 48px',
                    }}
                />

                {/* Top Brand */}
                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 backdrop-blur-sm">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
                        </svg>
                    </div>
                    <span className="text-lg font-extrabold tracking-wider uppercase text-white">
                        SIMPRO <span className="text-blue-400 font-semibold">ERP</span>
                    </span>
                </div>

                {/* Main Editorial Copy */}
                <div className="relative z-10 my-auto max-w-lg">
                    <h1 className="text-5xl xl:text-6xl font-bold tracking-tight leading-[1.08] text-white mb-6">
                        The future of site
                        <br />
                        management.
                    </h1>

                    <p className="text-slate-200/90 text-base leading-relaxed max-w-md">
                        Kelola alur kerja konstruksi, stok Material On Site (MOS),
                        dan laporan progres harian dengan koordinasi tim yang terstruktur.
                    </p>

                    {/* Feature Highlights */}
                    <div className="mt-14 pt-8 border-t border-slate-700/80 grid grid-cols-2 gap-8">
                        <div>
                            <div className="w-9 h-9 rounded-lg bg-slate-900/80 border border-slate-700 flex items-center justify-center text-blue-400 mb-3 backdrop-blur-sm">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h2 className="text-sm font-semibold text-white">MOS & Stok Real-Time</h2>
                            <p className="text-xs text-slate-300/80 mt-1 leading-relaxed">
                                Pantau material masuk, terpakai, dan sisa stok di lokasi proyek.
                            </p>
                        </div>

                        <div>
                            <div className="w-9 h-9 rounded-lg bg-slate-900/80 border border-slate-700 flex items-center justify-center text-blue-400 mb-3 backdrop-blur-sm">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                                </svg>
                            </div>
                            <h2 className="text-sm font-semibold text-white">Multi-Role & Progres</h2>
                            <p className="text-xs text-slate-300/80 mt-1 leading-relaxed">
                                Koordinasi akses Staff Proyek, Admin, Logistik, dan QS secara terpusat.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom Footer */}
                <div className="relative z-10 flex items-center justify-between text-xs text-slate-300/80">
                    <span>© {new Date().getFullYear()} SIMPRO Project Monitoring System.</span>
                    <div className="flex items-center gap-5">
                        <span className="hover:text-white cursor-pointer transition">Privacy</span>
                        <span className="hover:text-white cursor-pointer transition">Terms</span>
                    </div>
                </div>
            </div>

            {/* RIGHT - Dark Login Form Panel */}
            <div className="flex flex-col justify-center items-center px-6 py-12 sm:px-12 bg-[#070b14]">
                <div className="w-full max-w-md">

                    {/* Mobile Brand Header */}
                    <div className="lg:hidden flex items-center gap-2.5 mb-8">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
                            </svg>
                        </div>
                        <span className="text-base font-extrabold tracking-wider uppercase text-white">
                            SIMPRO <span className="text-blue-400">ERP</span>
                        </span>
                    </div>

                    {/* Heading */}
                    <div className="mb-8 text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
                            Welcome back
                        </h2>
                        <p className="text-sm text-slate-400">
                            Masukkan nama atau email dan password untuk mengakses SIMPRO.
                        </p>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded-lg mb-5 text-left">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-5 text-left">
                        <div>
                            <label className="block text-left text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-2">
                                Nama atau Email
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="nama@perusahaan.com atau nama lengkap"
                                className="w-full bg-[#131926] border border-slate-800 text-slate-100 placeholder-slate-500 rounded-lg px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-left text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                                    Password
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowForgot(true)}
                                    className="text-xs font-medium text-blue-400 hover:text-blue-300 transition cursor-pointer"
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <input
                                type="password"
                                required
                                placeholder="••••••••"
                                className="w-full bg-[#131926] border border-slate-800 text-slate-100 placeholder-slate-500 rounded-lg px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                    </svg>
                                    Memproses...
                                </>
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <span aria-hidden="true">→</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Register Prompt */}
                    <div className="mt-8 pt-6 border-t border-slate-800/80 text-center text-sm text-slate-400">
                        Don&apos;t have an account?{' '}
                        <Link
                            to="/register"
                            className="font-semibold text-blue-400 hover:text-blue-300 transition"
                        >
                            Create one now
                        </Link>
                    </div>
                </div>
            </div>

            {/* Modal Forgot Password */}
            {showForgot && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-[#111724] border border-slate-800 w-full max-w-md p-7 rounded-2xl shadow-2xl text-left">
                        <h3 className="text-xl font-bold text-white mb-1.5">
                            Reset Password
                        </h3>
                        <p className="text-sm text-slate-400 mb-5">
                            Masukkan email yang terdaftar dan password baru Anda.
                        </p>

                        {resetMsg && (
                            <p className="text-sm bg-blue-500/15 border border-blue-500/30 text-blue-300 px-4 py-3 rounded-lg mb-4">
                                {resetMsg}
                            </p>
                        )}

                        <form onSubmit={handleForgotPassword} className="space-y-4">
                            <input
                                type="email"
                                required
                                placeholder="Email terdaftar"
                                className="w-full bg-[#182030] border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                            />

                            <input
                                type="password"
                                required
                                minLength={6}
                                placeholder="Password baru"
                                className="w-full bg-[#182030] border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForgot(false);
                                        setResetMsg('');
                                    }}
                                    className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                >
                                    Batal
                                </button>

                                <button
                                    type="submit"
                                    disabled={resetLoading}
                                    className="px-5 py-2.5 text-sm font-semibold bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white rounded-lg transition cursor-pointer"
                                >
                                    {resetLoading ? 'Menyimpan...' : 'Simpan Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}