import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Info, ShieldCheck } from 'lucide-react';
import apiClient from '../api/axiosClient';
import backgroundImage from '../assets/Background.jpg';

const PROJECT_BG_IMAGE = backgroundImage;

export default function Register() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectTimerRef = useRef(null);

    const inviteToken = String(
        searchParams.get('token') || searchParams.get('invite_token') || ''
    ).trim();
    const invitedEmailFromQuery = String(searchParams.get('email') || '').trim().toLowerCase();

    const [formData, setFormData] = useState({
        nama: '',
        email: invitedEmailFromQuery,
        password: '',
        confirmPassword: '',
    });

    const [inviteInfo, setInviteInfo] = useState(null);
    const [verifyingInvite, setVerifyingInvite] = useState(Boolean(inviteToken));
    const [inviteNotice, setInviteNotice] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        return () => {
            if (redirectTimerRef.current) {
                clearTimeout(redirectTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        let active = true;

        async function verifyInvitation() {
            if (!inviteToken) {
                setVerifyingInvite(false);
                setInviteInfo(null);
                setInviteNotice(
                    'Registrasi akun memerlukan undangan proyek yang telah disetujui oleh SuperAdmin. Jika Anda belum menerima email undangan, silakan hubungi Project Manager proyek terkait.'
                );
                return;
            }

            setVerifyingInvite(true);
            setInviteNotice('');
            setError('');

            try {
                const res = await apiClient.get('/api/auth/verify-invite', {
                    params: {
                        token: inviteToken,
                        ...(invitedEmailFromQuery ? { email: invitedEmailFromQuery } : {}),
                    },
                });

                if (!active) return;

                const data = res.data || {};
                setInviteInfo(data);
                if (data.invited_email) {
                    setFormData((prev) => ({
                        ...prev,
                        email: String(data.invited_email).trim().toLowerCase(),
                    }));
                }
            } catch (err) {
                if (!active) return;
                setInviteInfo(null);
                setInviteNotice(
                    err?.response?.data?.message ||
                        'Undangan tidak valid, belum disetujui SuperAdmin, atau sudah kedaluwarsa. Pastikan Anda membuka tautan undangan terbaru dari email.'
                );
            } finally {
                if (active) {
                    setVerifyingInvite(false);
                }
            }
        }

        verifyInvitation();

        return () => {
            active = false;
        };
    }, [inviteToken, invitedEmailFromQuery]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!inviteToken || !inviteInfo?.valid) {
            setError(
                'Registrasi tidak dapat dilanjutkan tanpa undangan proyek yang telah disetujui SuperAdmin.'
            );
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Konfirmasi password tidak cocok dengan password.');
            return;
        }

        setLoading(true);

        try {
            const payload = {
                nama: formData.nama.trim(),
                email: formData.email.trim().toLowerCase(),
                password: formData.password,
                confirmPassword: formData.confirmPassword,
                invite_token: inviteToken,
            };

            const res = await apiClient.post('/api/auth/register', payload);
            const message =
                res.data?.message ||
                'Akun berhasil terdaftar dan keanggotaan proyek aktif! Anda akan diarahkan ke halaman login.';

            setSuccessMsg(message);
            setFormData((prev) => ({
                ...prev,
                password: '',
                confirmPassword: '',
            }));

            redirectTimerRef.current = setTimeout(() => {
                navigate('/login', { replace: true });
            }, 1500);
        } catch (err) {
            if (err.response?.status === 404) {
                setError(
                    'Endpoint registrasi (/api/auth/register) belum tersedia di server backend. Pastikan route register sudah ditambahkan dan container di-restart.'
                );
            } else {
                setError(err.response?.data?.message || 'Registrasi gagal.');
            }
        } finally {
            setLoading(false);
        }
    };

    const isEmailLocked = Boolean(inviteInfo?.valid && inviteInfo?.invited_email);
    const canSubmit = !loading && !successMsg && !verifyingInvite && Boolean(inviteInfo?.valid);
    const loginLinkTo = '/login';

    return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 grid lg:grid-cols-2">

            {/* LEFT - Construction Site Editorial Panel with Project Background Photo */}
            <div className="hidden lg:flex relative flex-col justify-between p-12 xl:p-14 overflow-hidden border-r border-slate-800/80 bg-[#12151c]">
                {/* Background */}
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
                        Daftarkan akun tim Anda melalui undangan proyek yang telah disetujui
                        untuk mulai mengelola Material On Site (MOS) dan laporan progres harian.
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
                            <h2 className="text-sm font-semibold text-white">Akses Proyek Terverifikasi</h2>
                            <p className="text-xs text-slate-300/80 mt-1 leading-relaxed">
                                Role keanggotaan proyek ditetapkan melalui persetujuan SuperAdmin.
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

            {/* RIGHT - Dark Register Form Panel */}
            <div className="flex flex-col justify-center items-center px-6 py-10 sm:px-12 bg-[#070b14]">
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
                    <div className="mb-7 text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
                            Create an account
                        </h2>
                        <p className="text-sm text-slate-400">
                            Lengkapi data diri Anda sesuai undangan proyek yang telah disetujui.
                        </p>
                    </div>

                    {/* Invitation Verification Status */}
                    {verifyingInvite && (
                        <div className="bg-slate-800/60 border border-slate-700 text-slate-300 text-xs px-4 py-3 rounded-lg mb-5 text-left">
                            Memverifikasi status undangan proyek...
                        </div>
                    )}

                    {!verifyingInvite && inviteInfo?.valid && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs px-4 py-3 rounded-lg mb-5 text-left space-y-1">
                            <div className="flex items-center gap-2 font-semibold text-emerald-300">
                                <ShieldCheck className="w-4 h-4 shrink-0" />
                                <span>Undangan Proyek Terverifikasi</span>
                            </div>
                            <p>Proyek: <strong className="text-white">{inviteInfo.nama_proyek}</strong></p>
                            <p>Role Ditetapkan: <strong className="text-white">{inviteInfo.role_code}</strong></p>
                            <p>Email Terdaftar Undangan: <strong className="text-white">{inviteInfo.invited_email}</strong></p>
                        </div>
                    )}

                    {!verifyingInvite && !inviteInfo?.valid && inviteNotice && (
                        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs px-4 py-3 rounded-lg mb-5 text-left space-y-1.5">
                            <div className="flex items-center gap-2 font-semibold text-amber-300">
                                <Info className="w-4 h-4 shrink-0" />
                                <span>Informasi Mekanisme Registrasi</span>
                            </div>
                            <p className="leading-relaxed">{inviteNotice}</p>
                            <p className="text-amber-300/90">
                                Sudah memiliki akun SIMPRO? Silakan masuk melalui tautan login di bawah untuk menautkan undangan.
                            </p>
                        </div>
                    )}

                    {/* Success Notification */}
                    {successMsg && (
                        <div
                            role="status"
                            className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm px-4 py-3 rounded-lg mb-5 flex items-center gap-2.5 text-left"
                        >
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    {/* Error Alert */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded-lg mb-5 text-left">
                            {error}
                        </div>
                    )}

                    {/* Register Form (Tanpa Pilihan Role) */}
                    <form onSubmit={handleSubmit} className="space-y-4 text-left">
                        <div>
                            <label className="block text-left text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-2">
                                Nama Lengkap
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Contoh: Budi Santoso"
                                className="w-full bg-[#131926] border border-slate-800 text-slate-100 placeholder-slate-500 rounded-lg px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                value={formData.nama}
                                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-left text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                readOnly={isEmailLocked}
                                placeholder="nama@perusahaan.com"
                                className="w-full bg-[#131926] border border-slate-800 text-slate-100 placeholder-slate-500 read-only:opacity-80 rounded-lg px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-left text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    minLength={6}
                                    placeholder="Minimal 6 karakter"
                                    className="w-full bg-[#131926] border border-slate-800 text-slate-100 placeholder-slate-500 rounded-lg pl-4 pr-11 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-left text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-2">
                                Konfirmasi Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    required
                                    minLength={6}
                                    placeholder="Ulangi password Anda"
                                    className="w-full bg-[#131926] border border-slate-800 text-slate-100 placeholder-slate-500 rounded-lg pl-4 pr-11 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    value={formData.confirmPassword}
                                    onChange={(e) =>
                                        setFormData({ ...formData, confirmPassword: e.target.value })
                                    }
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    aria-label={
                                        showConfirmPassword
                                            ? 'Sembunyikan konfirmasi password'
                                            : 'Tampilkan konfirmasi password'
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="w-full mt-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                    </svg>
                                    Mendaftarkan...
                                </>
                            ) : (
                                <>
                                    <span>Daftar Akun</span>
                                    <span aria-hidden="true">→</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Login Prompt */}
                    <div className="mt-7 pt-6 border-t border-slate-800/80 text-center text-sm text-slate-400">
                        Sudah memiliki akun?{' '}
                        <Link
                            to={loginLinkTo}
                            className="font-semibold text-blue-400 hover:text-blue-300 transition"
                        >
                            Masuk di sini
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}