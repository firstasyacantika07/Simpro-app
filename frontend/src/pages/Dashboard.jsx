import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Building2,
    Package,
    TrendingUp,
    Bell,
    Calendar,
    ChevronRight,
    ChevronDown,
    Sun,
    Cloud,
    CloudSun,
    CloudRain,
    CloudLightning,
    Wind,
    Droplets,
    ClipboardCheck,
    Menu,
    RefreshCw,
    CheckCircle2,
    UserCheck,
    X,
} from 'lucide-react';
import SitesSection from '../components/SitesSection';
import MosSection from '../components/MosSection';
import ProgressSection from '../components/ProgressSection';
import Sidebar from '../components/Sidebar';

const API_BASE = 'http://localhost:5000';
const PROJECT_HERO_IMAGE = '/foto.jpg';
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#84cc16', '#8b5cf6', '#06b6d4'];
const READ_NOTIFICATIONS_KEY = 'simpro_read_notification_ids';

// Default koordinat Kab. Madiun / Desa Wonorejo, Jawa Timur
const DEFAULT_WEATHER_COORDS = {
    latitude: -7.5718,
    longitude: 111.6531,
    locationName: 'Kab. Madiun',
};

const extractArray = (payload, keys = ['data']) => {
    if (Array.isArray(payload)) return payload;
    for (const key of keys) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
};

const parseDecimal = (val) => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    if (typeof val !== 'string') return 0;
    const normalized = val.trim().replace(',', '.');
    if (normalized === '') return 0;
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const getMosMasuk = (item) => {
    const masuk = parseDecimal(item?.jumlah_masuk);
    const jumlah = parseDecimal(item?.jumlah);
    if (item?.jumlah_masuk !== undefined && item?.jumlah_masuk !== null && item?.jumlah_masuk !== '') {
        return masuk > 0 || jumlah === 0 ? masuk : jumlah;
    }
    return jumlah;
};

const getMosTerpakai = (item) => parseDecimal(item?.jumlah_terpakai ?? 0);

const getMosDateKey = (item) =>
    String(item?.tanggal_masuk || item?.tanggal_update || item?.created_at || '').split('T')[0];

const mapWeatherCode = (code) => {
    if (code === 0) return { label: 'Cerah', type: 'clear' };
    if (code === 1 || code === 2) return { label: 'Cerah Berawan', type: 'partly-cloudy' };
    if (code === 3) return { label: 'Berawan / Mendung', type: 'cloudy' };
    if (code === 45 || code === 48) return { label: 'Berkabut', type: 'cloudy' };
    if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Gerimis', type: 'rain' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Hujan', type: 'rain' };
    if ([95, 96, 99].includes(code)) return { label: 'Hujan Petir', type: 'storm' };
    return { label: 'Berawan', type: 'partly-cloudy' };
};

const renderWeatherIcon = (type) => {
    switch (type) {
        case 'clear':
            return <Sun className="w-6 h-6 text-amber-400" />;
        case 'partly-cloudy':
            return <CloudSun className="w-6 h-6 text-amber-300" />;
        case 'cloudy':
            return <Cloud className="w-6 h-6 text-slate-300" />;
        case 'rain':
            return <CloudRain className="w-6 h-6 text-sky-400" />;
        case 'storm':
            return <CloudLightning className="w-6 h-6 text-indigo-400" />;
        default:
            return <Sun className="w-6 h-6 text-amber-400" />;
    }
};

const formatShortDate = (dateInput) => {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};

const formatDateTime = (dateInput) => {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

function MosDonutChart({ items, total }) {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    if (!items.length || total <= 0) {
        return (
            <div className="py-10 text-center text-xs text-slate-500">
                Belum ada data stok Material On Site (MOS) dari API.
            </div>
        );
    }

    return (
        <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                    <circle
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="16"
                    />
                    {items.map((item) => {
                        const segmentLength = (item.value / total) * circumference;
                        const strokeDasharray = `${segmentLength} ${circumference}`;
                        const strokeDashoffset = -accumulatedOffset;
                        accumulatedOffset += segmentLength;

                        return (
                            <circle
                                key={item.label}
                                cx="70"
                                cy="70"
                                r={radius}
                                fill="none"
                                stroke={item.color}
                                strokeWidth="16"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                            />
                        );
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-2xl font-bold text-white leading-none tabular-nums">
                        {Number(total.toFixed(1))}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">Sisa Material</span>
                </div>
            </div>

            <div className="flex-1 w-full space-y-2.5 text-sm">
                {items.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: item.color }}
                            />
                            <span className="text-slate-300 truncate">{item.label}</span>
                        </div>
                        <span className="text-slate-400 tabular-nums whitespace-nowrap">
                            {Number(item.value.toFixed(1))}{' '}
                            {item.satuan ? `${item.satuan} · ` : ''}({item.share})
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ProgressLineChart({ series, labels }) {
    const width = 620;
    const height = 210;
    const padLeft = 42;
    const padRight = 18;
    const padTop = 16;
    const padBottom = 30;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    if (!series.length || !labels.length) {
        return (
            <div className="py-12 text-center text-xs text-slate-500">
                Belum ada data laporan progress harian dari API.
            </div>
        );
    }

    const getX = (idx) =>
        labels.length === 1
            ? padLeft + plotW / 2
            : padLeft + (idx / (labels.length - 1)) * plotW;
    const getY = (val) =>
        padTop + plotH - (Math.min(Math.max(Number(val) || 0, 0), 100) / 100) * plotH;

    const yTicks = [0, 25, 50, 75, 100];
    const lastIdx = labels.length - 1;

    return (
        <div className="relative w-full">
            <div className="flex flex-wrap items-center justify-center gap-5 mb-3 text-xs">
                {series.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-slate-300">
                        <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: s.color }}
                        />
                        <span>{s.label}</span>
                    </div>
                ))}
            </div>

            <div className="relative">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
                    {yTicks.map((tick) => {
                        const y = getY(tick);
                        return (
                            <g key={tick}>
                                <line
                                    x1={padLeft}
                                    y1={y}
                                    x2={width - padRight}
                                    y2={y}
                                    stroke="#1e293b"
                                    strokeWidth="1"
                                />
                                <text
                                    x={padLeft - 10}
                                    y={y + 4}
                                    textAnchor="end"
                                    className="fill-slate-500 text-[10px]"
                                >
                                    {tick}%
                                </text>
                            </g>
                        );
                    })}

                    {labels.map((label, idx) => (
                        <text
                            key={`${label}-${idx}`}
                            x={getX(idx)}
                            y={height - 6}
                            textAnchor="middle"
                            className="fill-slate-400 text-[10px]"
                        >
                            {label}
                        </text>
                    ))}

                    {series.map((s) => {
                        const pathData = s.points
                            .map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`)
                            .join(' ');

                        return (
                            <g key={s.label}>
                                <path
                                    d={pathData}
                                    fill="none"
                                    stroke={s.color}
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                {s.points.map((val, idx) => (
                                    <circle
                                        key={idx}
                                        cx={getX(idx)}
                                        cy={getY(val)}
                                        r="3.5"
                                        fill={s.color}
                                    />
                                ))}
                            </g>
                        );
                    })}
                </svg>

                <div className="hidden sm:block absolute right-3 top-2 bg-[#0b1220]/95 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-sm min-w-[140px]">
                    <div className="font-semibold text-white mb-1.5">
                        {labels[lastIdx]}
                    </div>
                    <div className="space-y-1">
                        {series.map((s) => {
                            const latestVal = s.points[s.points.length - 1] ?? 0;
                            return (
                                <div key={s.label} className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-1.5 text-slate-300 truncate max-w-[90px]">
                                        <span
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: s.color }}
                                        />
                                        <span className="truncate">{s.label}:</span>
                                    </span>
                                    <span className="font-semibold text-white tabular-nums">
                                        {Number(latestVal)}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function LaporanView({ proyekList, mosList, progressList, onNavigate }) {
    const proyekMap = useMemo(() => {
        const map = new Map();
        proyekList.forEach((p) => map.set(String(p.id), p.nama_proyek));
        return map;
    }, [proyekList]);

    return (
        <div className="space-y-6 text-left">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Rekapitulasi Laporan Proyek</h2>
                    <p className="text-sm text-slate-400">
                        Ringkasan capaian fisik harian dan posisi stok material on site.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => onNavigate('progress')}
                        className="px-3.5 py-2 rounded-xl bg-[#11192b] hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition cursor-pointer"
                    >
                        Kelola Progress
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate('mos')}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition cursor-pointer"
                    >
                        Kelola MOS
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <section className="bg-[#0e1626] border border-slate-800/80 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-white">
                            Rekap Progress ({progressList.length})
                        </h3>
                        <button
                            type="button"
                            onClick={() => onNavigate('progress')}
                            className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                        >
                            Buka halaman Progress
                        </button>
                    </div>

                    {progressList.length === 0 ? (
                        <p className="text-xs text-slate-500 py-6 text-center">
                            Belum ada laporan progress tersimpan.
                        </p>
                    ) : (
                        <div className="divide-y divide-slate-800/60">
                            {progressList.slice(0, 6).map((item) => (
                                <div
                                    key={item.id}
                                    className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm"
                                >
                                    <div className="min-w-0">
                                        <div className="font-medium text-white truncate">
                                            {item.uraian_pekerjaan}
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            {proyekMap.get(String(item.proyek_id)) || `Proyek #${item.proyek_id}`} ·{' '}
                                            {formatShortDate(item.tanggal_laporan)}
                                        </div>
                                    </div>
                                    <span className="font-semibold text-emerald-400 tabular-nums shrink-0">
                                        {Number(item.bobot_realisasi || 0)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="bg-[#0e1626] border border-slate-800/80 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-white">
                            Rekap Stok MOS ({mosList.length})
                        </h3>
                        <button
                            type="button"
                            onClick={() => onNavigate('mos')}
                            className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                        >
                            Buka halaman MOS
                        </button>
                    </div>

                    {mosList.length === 0 ? (
                        <p className="text-xs text-slate-500 py-6 text-center">
                            Belum ada data material MOS tersimpan.
                        </p>
                    ) : (
                        <div className="divide-y divide-slate-800/60">
                            {mosList.slice(0, 6).map((item) => {
                                const masuk = getMosMasuk(item);
                                const terpakai = getMosTerpakai(item);
                                const sisa = Number((masuk - terpakai).toFixed(2));
                                return (
                                    <div
                                        key={item.id}
                                        className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm"
                                    >
                                        <div className="min-w-0">
                                            <div className="font-medium text-white truncate">
                                                {item.nama_material}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {item.kode_material ? `Kode: ${item.kode_material} · ` : ''}
                                                Masuk: {masuk} {item.satuan}
                                            </div>
                                        </div>
                                        <span className="font-semibold text-blue-400 tabular-nums shrink-0">
                                            Sisa {sisa} {item.satuan}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

function NotifikasiView({ activities, readIds, onMarkRead, onNavigate }) {
    return (
        <div className="space-y-5 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-white">Pusat Notifikasi</h2>
                    <p className="text-sm text-slate-400">
                        Aktivitas terbaru dari pembaruan progress harian dan inventaris MOS.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onNavigate('overview')}
                    className="px-3.5 py-2 rounded-xl bg-[#11192b] hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition cursor-pointer"
                >
                    Kembali ke Dashboard
                </button>
            </div>

            <div className="bg-[#0e1626] border border-slate-800/80 rounded-2xl divide-y divide-slate-800/60">
                {activities.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                        Belum ada notifikasi aktivitas terbaru.
                    </div>
                ) : (
                    activities.map((act) => {
                        const isUnread = !readIds.includes(act.id);
                        return (
                            <div
                                key={act.id}
                                className="p-4 flex items-center justify-between gap-4 hover:bg-slate-800/30 transition"
                            >
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div
                                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${act.iconBg}`}
                                    >
                                        {act.type === 'mos' ? (
                                            <Package className="w-4 h-4" />
                                        ) : (
                                            <ClipboardCheck className="w-4 h-4" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-white truncate">
                                                {act.title}
                                            </span>
                                            {isUnread && (
                                                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-semibold shrink-0">
                                                    Baru
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400">{act.time}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <span className={`text-xs font-semibold tabular-nums ${act.badgeClass}`}>
                                        {act.badge}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onMarkRead(act.id);
                                            onNavigate(act.targetMenu || 'overview');
                                        }}
                                        className="px-3 py-1.5 rounded-lg bg-[#131c2e] hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-medium transition cursor-pointer"
                                    >
                                        Lihat
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function PengaturanView({ user, setUser }) {
    const [nama, setNama] = useState(user?.nama || '');
    const [email, setEmail] = useState(user?.email || '');
    const [password, setPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    useEffect(() => {
        setNama(user?.nama || '');
        setEmail(user?.email || '');
    }, [user]);

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFeedback(null);

        const token = localStorage.getItem('token');
        try {
            const payload = { nama: nama.trim(), email: email.trim() };
            if (password.trim()) {
                payload.password = password;
            }

            const res = await axios.put(`${API_BASE}/api/auth/profile`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.data?.token) {
                localStorage.setItem('token', res.data.token);
            }
            const nextUser = {
                ...user,
                ...(res.data?.user || {}),
                nama: res.data?.user?.nama || nama.trim(),
                email: res.data?.user?.email || email.trim(),
            };
            localStorage.setItem('user', JSON.stringify(nextUser));
            setUser(nextUser);
            setPassword('');
            setFeedback({
                type: 'success',
                text: res.data?.message || 'Profil berhasil diperbarui.',
            });
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err.response?.data?.message || 'Gagal memperbarui profil.',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl space-y-6 text-left">
            <div>
                <h2 className="text-xl font-bold text-white">Pengaturan Akun</h2>
                <p className="text-sm text-slate-400">
                    Perbarui informasi akun atau password Anda. Role saat ini:{' '}
                    <span className="text-blue-400 font-semibold">{user?.posisi}</span>.
                </p>
            </div>

            <form
                onSubmit={handleProfileSave}
                className="bg-[#0e1626] border border-slate-800/80 rounded-2xl p-6 space-y-4"
            >
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800/70">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                        <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-white">Informasi Profil</div>
                        <div className="text-xs text-slate-400">Peran: {user?.posisi}</div>
                    </div>
                </div>

                {feedback && (
                    <div
                        className={`px-4 py-3 rounded-xl text-xs sm:text-sm flex items-center gap-2 border ${feedback.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                            }`}
                    >
                        {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                        <span>{feedback.text}</span>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Nama Lengkap
                    </label>
                    <input
                        type="text"
                        required
                        value={nama}
                        onChange={(e) => setNama(e.target.value)}
                        className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Email
                    </label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Password Baru (Kosongkan jika tidak ingin mengganti)
                    </label>
                    <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#131c2e] border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                <div className="pt-2 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition cursor-pointer"
                    >
                        {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [activeMenu, setActiveMenu] = useState('overview');
    const [proyekList, setProyekList] = useState([]);
    const [mosList, setMosList] = useState([]);
    const [progressList, setProgressList] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedProyekId, setSelectedProyekId] = useState(null);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [readNotificationIds, setReadNotificationIds] = useState(() => {
        try {
            const raw = localStorage.getItem(READ_NOTIFICATIONS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    });
    const [weather, setWeather] = useState({
        loading: true,
        temp: '--',
        condition: 'Memuat cuaca...',
        type: 'partly-cloudy',
        humidity: '--',
        windSpeed: '--',
        rainChance: '--',
        locationName: DEFAULT_WEATHER_COORDS.locationName,
    });

    const fetchRealWeather = useCallback(async (lat, lon, locName) => {
        try {
            const url =
                `https://api.open-meteo.com/v1/forecast` +
                `?latitude=${lat}&longitude=${lon}` +
                `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
                `&hourly=precipitation_probability` +
                `&forecast_days=1&timezone=auto`;

            const res = await fetch(url);
            if (!res.ok) throw new Error('Gagal mengambil data cuaca');
            const data = await res.json();

            const current = data?.current || {};
            const mapped = mapWeatherCode(current.weather_code);
            const currentHourPrefix = String(current.time || '').slice(0, 13);
            const hourlyTimes = data?.hourly?.time || [];
            const hourlyProbs = data?.hourly?.precipitation_probability || [];
            const hourIdx = hourlyTimes.findIndex((t) => String(t).startsWith(currentHourPrefix));
            const rainProb =
                hourIdx !== -1 && hourlyProbs[hourIdx] != null
                    ? hourlyProbs[hourIdx]
                    : hourlyProbs[0] ?? 0;

            setWeather({
                loading: false,
                temp: current.temperature_2m != null ? Math.round(current.temperature_2m) : '--',
                condition: mapped.label,
                type: mapped.type,
                humidity: current.relative_humidity_2m != null ? Math.round(current.relative_humidity_2m) : '--',
                windSpeed: current.wind_speed_10m != null ? Math.round(current.wind_speed_10m) : '--',
                rainChance: Math.round(rainProb),
                locationName: locName,
            });
        } catch {
            setWeather((prev) => ({
                ...prev,
                loading: false,
                condition: prev.temp === '--' ? 'Cuaca tidak tersedia' : prev.condition,
            }));
        }
    }, []);

    useEffect(() => {
        fetchRealWeather(
            DEFAULT_WEATHER_COORDS.latitude,
            DEFAULT_WEATHER_COORDS.longitude,
            DEFAULT_WEATHER_COORDS.locationName
        );

        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    fetchRealWeather(
                        pos.coords.latitude,
                        pos.coords.longitude,
                        'Lokasi Saat Ini'
                    );
                },
                () => {},
                { timeout: 6000 }
            );
        }

        const timer = setInterval(() => {
            fetchRealWeather(
                DEFAULT_WEATHER_COORDS.latitude,
                DEFAULT_WEATHER_COORDS.longitude,
                DEFAULT_WEATHER_COORDS.locationName
            );
        }, 15 * 60 * 1000);

        return () => clearInterval(timer);
    }, [fetchRealWeather]);

    const loadDashboardData = useCallback(async (token) => {
        setLoadingData(true);
        const headers = { Authorization: `Bearer ${token}` };

        const [resProyek, resMos, resProgress] = await Promise.allSettled([
            axios.get(`${API_BASE}/api/proyek`, { headers }),
            axios.get(`${API_BASE}/api/fitur/mos`, { headers }),
            axios.get(`${API_BASE}/api/fitur/progress`, { headers }),
        ]);

        if (resProyek.status === 'fulfilled') {
            setProyekList(extractArray(resProyek.value.data, ['data', 'proyek']));
        } else {
            console.error('Gagal memuat /api/proyek:', resProyek.reason);
        }

        if (resMos.status === 'fulfilled') {
            setMosList(extractArray(resMos.value.data, ['data', 'mos']));
        } else {
            console.error('Gagal memuat /api/fitur/mos:', resMos.reason);
        }

        if (resProgress.status === 'fulfilled') {
            setProgressList(extractArray(resProgress.value.data, ['data', 'progress']));
        } else {
            console.error('Gagal memuat /api/fitur/progress:', resProgress.reason);
        }

        setLoadingData(false);
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (!storedUser || !token) {
            navigate('/login');
            return;
        }
        setUser(JSON.parse(storedUser));
        loadDashboardData(token);
    }, [navigate, loadDashboardData]);

    const handleRefresh = useCallback(() => {
        const token = localStorage.getItem('token');
        if (token) loadDashboardData(token);
        fetchRealWeather(
            DEFAULT_WEATHER_COORDS.latitude,
            DEFAULT_WEATHER_COORDS.longitude,
            DEFAULT_WEATHER_COORDS.locationName
        );
    }, [loadDashboardData, fetchRealWeather]);

    const markNotificationsAsRead = useCallback((idsToMark) => {
        if (!Array.isArray(idsToMark) || idsToMark.length === 0) return;
        setReadNotificationIds((prev) => {
            const merged = Array.from(new Set([...prev, ...idsToMark]));
            try {
                localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(merged));
            } catch {
                // abaikan jika storage penuh
            }
            return merged;
        });
    }, []);

    const handleNavigate = useCallback((menuId) => {
        if (menuId === 'progress' || menuId === 'mos') {
            setSelectedProyekId(null);
        }
        setActiveMenu(menuId);
        setMobileNavOpen(false);
    }, []);

    const handleOpenProgressFromSite = useCallback((site) => {
        if (site?.id !== undefined && site?.id !== null) {
            setSelectedProyekId(site.id);
        }
        setActiveMenu('progress');
        setMobileNavOpen(false);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const progressByProyek = useMemo(() => {
        const map = new Map();
        progressList.forEach((item) => {
            const key = String(item.proyek_id ?? '');
            const val = parseDecimal(item.bobot_realisasi ?? 0);
            const tgl = item.tanggal_laporan ? new Date(item.tanggal_laporan).getTime() : 0;
            const prev = map.get(key);
            if (!prev || tgl >= prev.tgl) {
                map.set(key, { val, tgl });
            }
        });
        return map;
    }, [progressList]);

    const sitesDisplay = useMemo(() => {
        return proyekList.map((p, idx) => {
            const latestProg = progressByProyek.get(String(p.id ?? ''));
            const rawProg =
                typeof p.progress === 'number'
                    ? p.progress
                    : latestProg
                        ? latestProg.val
                        : 0;
            return {
                id: p.id ?? idx,
                nama: p.nama_proyek || `Proyek ${idx + 1}`,
                lokasi: p.lokasi || 'Lokasi belum diatur',
                status: p.status || 'Aktif',
                progress: Math.min(Math.max(Math.round(rawProg), 0), 100),
                gambar: p.gambar || PROJECT_HERO_IMAGE,
            };
        });
    }, [proyekList, progressByProyek]);

    const featuredSite = sitesDisplay[0] || null;

    const availableDates = useMemo(() => {
        const set = new Set();
        progressList.forEach((item) => {
            if (item.tanggal_laporan) {
                set.add(String(item.tanggal_laporan).split('T')[0]);
            }
        });
        mosList.forEach((item) => {
            const d = getMosDateKey(item);
            if (d) set.add(d);
        });
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [progressList, mosList]);

    const filteredMosList = useMemo(() => {
        if (!selectedDate) return mosList;
        const matchByDate = mosList.filter(
            (item) => getMosDateKey(item) === selectedDate
        );
        return matchByDate.length > 0 ? matchByDate : mosList;
    }, [mosList, selectedDate]);

    const mosBreakdown = useMemo(() => {
        const grouped = new Map();
        filteredMosList.forEach((item) => {
            const name = item.nama_material || 'Material';
            const sisa = Math.max(
                getMosMasuk(item) - getMosTerpakai(item),
                0
            );
            const current = grouped.get(name) || {
                label: name,
                value: 0,
                satuan: item.satuan || '',
            };
            current.value += sisa;
            grouped.set(name, current);
        });

        const arr = Array.from(grouped.values()).filter((x) => x.value > 0);
        const sum = arr.reduce((acc, cur) => acc + cur.value, 0);

        return arr.slice(0, 6).map((item, idx) => ({
            ...item,
            color: CHART_COLORS[idx % CHART_COLORS.length],
            share: sum > 0 ? `${Math.round((item.value / sum) * 100)}%` : '0%',
        }));
    }, [filteredMosList]);

    const totalMos = useMemo(() => {
        return mosList.reduce(
            (acc, item) =>
                acc +
                Math.max(
                    getMosMasuk(item) - getMosTerpakai(item),
                    0
                ),
            0
        );
    }, [mosList]);

    const avgProgress = useMemo(() => {
        if (sitesDisplay.length > 0) {
            const total = sitesDisplay.reduce((acc, s) => acc + s.progress, 0);
            return Math.round(total / sitesDisplay.length);
        }
        if (progressList.length > 0) {
            const total = progressList.reduce(
                (acc, p) => acc + parseDecimal(p.bobot_realisasi ?? 0),
                0
            );
            return Math.round(total / progressList.length);
        }
        return 0;
    }, [sitesDisplay, progressList]);

    const aktivitasHariIniCount = useMemo(() => {
        const targetDate = selectedDate || new Date().toISOString().split('T')[0];
        const progCount = progressList.filter(
            (p) => String(p.tanggal_laporan || '').split('T')[0] === targetDate
        ).length;
        const mosCount = mosList.filter(
            (m) => getMosDateKey(m) === targetDate
        ).length;
        return progCount + mosCount;
    }, [progressList, mosList, selectedDate]);

    const chartData = useMemo(() => {
        const dateSet = new Set();
        progressList.forEach((p) => {
            if (p.tanggal_laporan) {
                dateSet.add(String(p.tanggal_laporan).split('T')[0]);
            }
        });
        const sortedDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b)).slice(-7);
        const labels = sortedDates.map((d) => formatShortDate(d));

        const proyekNameMap = new Map();
        proyekList.forEach((p) => proyekNameMap.set(String(p.id), p.nama_proyek));

        const seriesMap = new Map();
        progressList.forEach((p) => {
            const key = String(p.proyek_id ?? p.uraian_pekerjaan ?? 'Proyek');
            const label = proyekNameMap.get(key) || p.nama_proyek || `Proyek ${key}`;
            const dateKey = String(p.tanggal_laporan || '').split('T')[0];
            if (!seriesMap.has(key)) {
                seriesMap.set(key, { label, byDate: new Map() });
            }
            seriesMap.get(key).byDate.set(dateKey, parseDecimal(p.bobot_realisasi ?? 0));
        });

        const series = Array.from(seriesMap.values())
            .slice(0, 4)
            .map((s, idx) => {
                let lastKnown = 0;
                const points = sortedDates.map((d) => {
                    if (s.byDate.has(d)) {
                        lastKnown = s.byDate.get(d);
                    }
                    return lastKnown;
                });
                return {
                    label: s.label,
                    color: CHART_COLORS[idx % CHART_COLORS.length],
                    points,
                };
            });

        return { series, labels };
    }, [progressList, proyekList]);

    const recentActivities = useMemo(() => {
        const progActs = progressList.map((p) => ({
            id: `prog-${p.id}-${p.tanggal_laporan || ''}-${p.bobot_realisasi ?? 0}`,
            title: p.uraian_pekerjaan || `Update progress Proyek #${p.proyek_id}`,
            time: formatDateTime(p.tanggal_laporan),
            sortTime: p.tanggal_laporan ? new Date(p.tanggal_laporan).getTime() : 0,
            badge: `${parseDecimal(p.bobot_realisasi ?? 0)}%`,
            badgeClass: 'text-emerald-400 font-semibold',
            iconBg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
            type: 'progress',
            targetMenu: 'progress',
        }));

        const mosActs = mosList.map((m) => {
            const masuk = getMosMasuk(m);
            const dateVal = getMosDateKey(m);
            return {
                id: `mos-${m.id}-${dateVal}-${masuk}-${m.jumlah_terpakai ?? 0}`,
                title: `Update material ${m.nama_material || m.kode_material || 'MOS'}`,
                time: formatDateTime(dateVal),
                sortTime: dateVal ? new Date(dateVal).getTime() : 0,
                badge: `+${masuk} ${m.satuan || ''}`.trim(),
                badgeClass: 'text-sky-400 font-semibold',
                iconBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                type: 'mos',
                targetMenu: 'mos',
            };
        });

        return [...progActs, ...mosActs]
            .sort((a, b) => b.sortTime - a.sortTime)
            .slice(0, 5);
    }, [progressList, mosList]);

    const unreadNotificationCount = useMemo(() => {
        return recentActivities.filter((act) => !readNotificationIds.includes(act.id)).length;
    }, [recentActivities, readNotificationIds]);

    useEffect(() => {
        if (activeMenu === 'notifikasi' && recentActivities.length > 0) {
            markNotificationsAsRead(recentActivities.map((a) => a.id));
        }
    }, [activeMenu, recentActivities, markNotificationsAsRead]);

    const handleBellClick = useCallback(() => {
        if (recentActivities.length > 0) {
            markNotificationsAsRead(recentActivities.map((a) => a.id));
        }
        handleNavigate('notifikasi');
    }, [recentActivities, markNotificationsAsRead, handleNavigate]);

    const getHeaderInfo = () => {
        switch (activeMenu) {
            case 'sites':
                return {
                    title: 'Sites & Lokasi Proyek',
                    subtitle: 'Daftar lokasi proyek konstruksi dan status kemajuan lapangan.',
                };
            case 'mos':
                return {
                    title: 'MOS (Material on Site)',
                    subtitle: 'Inventaris stok masuk, terpakai, dan ketersediaan material proyek.',
                };
            case 'progress':
                return {
                    title: 'Progress Harian',
                    subtitle: 'Monitoring capaian progres pekerjaan harian tiap site.',
                };
            case 'laporan':
                return {
                    title: 'Laporan Proyek',
                    subtitle: 'Rekapitulasi progres, material, dan aktivitas tim SIMPRO.',
                };
            case 'notifikasi':
                return {
                    title: 'Notifikasi',
                    subtitle: 'Pembaruan status stok material dan laporan harian terbaru.',
                };
            case 'pengaturan':
                return {
                    title: 'Pengaturan Akun',
                    subtitle: `Kelola profil dan hak akses peran ${user?.posisi || 'Tim SIMPRO'}.`,
                };
            default:
                return {
                    title: 'Dashboard',
                    subtitle: `Selamat datang, ${user?.nama || 'Pengguna'} · ${user?.posisi || ''}`,
                };
        }
    };

    if (!user) return null;

    const headerInfo = getHeaderInfo();

    return (
        <div className="min-h-screen bg-[#070c16] text-slate-100 flex">
            {mobileNavOpen && (
                <div
                    onClick={() => setMobileNavOpen(false)}
                    className="fixed inset-0 bg-black/60 z-30 lg:hidden"
                />
            )}

            {/* LEFT SIDEBAR */}
            <Sidebar
                user={user}
                activeMenu={activeMenu}
                mobileNavOpen={mobileNavOpen}
                onCloseMobileNav={() => setMobileNavOpen(false)}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
            />

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="px-5 sm:px-8 pt-6 pb-4 flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <button
                            type="button"
                            onClick={() => setMobileNavOpen(true)}
                            className="lg:hidden mt-1 p-2 rounded-lg bg-[#11192b] border border-slate-800 text-slate-300 hover:text-white"
                            aria-label="Buka menu"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="text-left">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                                {headerInfo.title}
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400 mt-1">
                                {headerInfo.subtitle}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 ml-auto">
                        {activeMenu === 'overview' && (
                            <>
                                {/* Filter Kalender */}
                                <label
                                    className="relative flex items-center gap-2 bg-[#11192b] border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 cursor-pointer"
                                    title="Pilih tanggal lewat kalender"
                                >
                                    <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="bg-transparent text-slate-100 font-medium outline-none cursor-pointer [color-scheme:dark]"
                                        aria-label="Filter kalender tanggal"
                                    />
                                </label>

                                {/* Dropdown Tanggal Tersedia */}
                                <label className="relative flex items-center gap-2 bg-[#11192b] border border-slate-800 hover:border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-200 cursor-pointer">
                                    <select
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="bg-transparent text-slate-100 font-medium outline-none pr-4 appearance-none cursor-pointer"
                                    >
                                        <option value="" className="bg-[#11192b]">
                                            Semua Tanggal
                                        </option>
                                        {availableDates.map((tgl) => (
                                            <option key={tgl} value={tgl} className="bg-[#11192b]">
                                                {tgl}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none" />
                                </label>

                                {selectedDate && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDate('')}
                                        className="h-10 px-2.5 rounded-xl bg-[#11192b] border border-slate-800 hover:border-rose-500/50 hover:text-rose-300 flex items-center gap-1 text-xs text-slate-400 transition cursor-pointer"
                                        title="Reset filter tanggal"
                                        aria-label="Reset filter tanggal"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    disabled={loadingData}
                                    className="w-10 h-10 rounded-xl bg-[#11192b] border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
                                    title="Muat ulang data dari API"
                                    aria-label="Muat ulang data"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
                                </button>
                            </>
                        )}

                        <button
                            type="button"
                            onClick={handleBellClick}
                            className="relative w-10 h-10 rounded-xl bg-[#11192b] border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                            aria-label="Notifikasi"
                        >
                            <Bell className="w-4 h-4" />
                            {unreadNotificationCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                                    {unreadNotificationCount}
                                </span>
                            )}
                        </button>
                    </div>
                </header>

                <main className="px-5 sm:px-8 pb-8 flex-1 space-y-6">
                    {activeMenu === 'overview' && (
                        <>
                            {/* 4 KPI Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                <button
                                    type="button"
                                    onClick={() => handleNavigate('sites')}
                                    className="bg-[#0e1626] hover:bg-[#121c30] border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between text-left transition cursor-pointer"
                                >
                                    <div>
                                        <p className="text-xs font-medium text-slate-400">Total Projek</p>
                                        <p className="text-3xl font-bold text-white mt-1.5 tabular-nums">
                                            {proyekList.length}
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-1.5">
                                            Semua lokasi proyek
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 shrink-0">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleNavigate('mos')}
                                    className="bg-[#0e1626] hover:bg-[#121c30] border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between text-left transition cursor-pointer"
                                >
                                    <div>
                                        <p className="text-xs font-medium text-slate-400">Total Sisa MOS</p>
                                        <p className="text-3xl font-bold text-white mt-1.5 tabular-nums">
                                            {Number(totalMos.toFixed(1))}
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-1.5">
                                            {mosList.length} item material tercatat
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
                                        <Package className="w-5 h-5" />
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleNavigate('progress')}
                                    className="bg-[#0e1626] hover:bg-[#121c30] border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between text-left transition cursor-pointer"
                                >
                                    <div>
                                        <p className="text-xs font-medium text-slate-400">
                                            Progress Rata-rata
                                        </p>
                                        <p className="text-3xl font-bold text-white mt-1.5 tabular-nums">
                                            {avgProgress}%
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-1.5">
                                            Berdasarkan realisasi lapangan
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleBellClick}
                                    className="bg-[#0e1626] hover:bg-[#121c30] border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between text-left transition cursor-pointer"
                                >
                                    <div>
                                        <p className="text-xs font-medium text-slate-400">
                                            Aktivitas Tanggal Terpilih
                                        </p>
                                        <p className="text-3xl font-bold text-white mt-1.5 tabular-nums">
                                            {aktivitasHariIniCount}
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-1.5">
                                            Update progress & MOS
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-400 shrink-0">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                </button>
                            </div>

                            {/* Main Grid */}
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                                {/* Baris Atas: MOS Full-Width (sejajar hingga ujung kanan) */}
                                <section className="xl:col-span-12 bg-[#0e1626] border border-slate-800/80 rounded-2xl p-5">
                                    <div className="flex items-center justify-between gap-2 mb-4">
                                        <h2 className="text-sm sm:text-base font-semibold text-white leading-snug">
                                            MOS (Material on Site)
                                        </h2>
                                        <button
                                            type="button"
                                            onClick={() => handleNavigate('mos')}
                                            className="text-xs font-medium text-blue-400 hover:text-blue-300 transition cursor-pointer shrink-0 whitespace-nowrap"
                                        >
                                            Lihat semua
                                        </button>
                                    </div>

                                    <MosDonutChart items={mosBreakdown} total={totalMos} />
                                </section>

                                {/* Baris Bawah Kiri: Sites & Progress Harian */}
                                <div className="xl:col-span-7 space-y-5">
                                    {/* Sites Card */}
                                    <section className="bg-[#0e1626] border border-slate-800/80 rounded-2xl p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-base font-semibold text-white">Sites</h2>
                                            <button
                                                type="button"
                                                onClick={() => handleNavigate('sites')}
                                                className="text-xs font-medium text-blue-400 hover:text-blue-300 transition cursor-pointer"
                                            >
                                                Lihat semua
                                            </button>
                                        </div>

                                        {sitesDisplay.length === 0 ? (
                                            <div className="py-10 text-center text-xs text-slate-500">
                                                Belum ada data proyek di database.
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {sitesDisplay.slice(0, 4).map((site) => (
                                                    <button
                                                        key={site.id}
                                                        type="button"
                                                        onClick={() => handleOpenProgressFromSite(site)}
                                                        className="w-full flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-800/50 transition text-left cursor-pointer"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <img
                                                                src={site.gambar}
                                                                alt={site.nama}
                                                                className="w-12 h-10 rounded-lg object-cover bg-slate-800 shrink-0"
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-semibold text-white truncate">
                                                                    {site.nama}
                                                                </div>
                                                                <div className="text-xs text-slate-400 truncate">
                                                                    {site.lokasi}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2.5 shrink-0">
                                                            <div className="w-16 sm:w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full bg-blue-500"
                                                                    style={{ width: `${site.progress}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-slate-400 tabular-nums w-9 text-right">
                                                                {site.progress}%
                                                            </span>
                                                            <ChevronRight className="w-4 h-4 text-slate-500" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    {/* Progress Harian Line Chart */}
                                    <section className="bg-[#0e1626] border border-slate-800/80 rounded-2xl p-5">
                                        <div className="flex items-center justify-between mb-2">
                                            <h2 className="text-base font-semibold text-white">
                                                Progress Harian
                                            </h2>
                                            <button
                                                type="button"
                                                onClick={() => handleNavigate('progress')}
                                                className="text-xs font-medium text-blue-400 hover:text-blue-300 transition cursor-pointer"
                                            >
                                                Lihat semua
                                            </button>
                                        </div>

                                        <ProgressLineChart
                                            series={chartData.series}
                                            labels={chartData.labels}
                                        />
                                    </section>
                                </div>

                                {/* Baris Bawah Kanan: Weather & Aktivitas Terbaru */}
                                <div className="xl:col-span-5 space-y-5">
                                    {/* Real Weather Widget */}
                                    <section className="bg-[#0e1626] border border-slate-800/80 rounded-2xl p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-semibold text-white truncate">
                                                {weather.locationName || featuredSite?.lokasi || 'Kab. Madiun'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleNavigate('progress')}
                                                className="text-xs font-medium text-blue-400 hover:text-blue-300 transition cursor-pointer shrink-0"
                                            >
                                                Lihat detail
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-400">
                                                    {renderWeatherIcon(weather.type)}
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-2xl font-bold text-white leading-none tabular-nums">
                                                        {weather.loading ? '...' : `${weather.temp}°C`}
                                                    </div>
                                                    <div className="text-xs text-slate-400 mt-1">
                                                        {weather.condition}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-xs space-y-1.5 text-slate-400">
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="flex items-center gap-1.5">
                                                        <Droplets className="w-3.5 h-3.5 text-sky-400" />
                                                        Kelembapan
                                                    </span>
                                                    <span className="text-slate-200 font-medium tabular-nums">
                                                        {weather.humidity}%
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="flex items-center gap-1.5">
                                                        <Wind className="w-3.5 h-3.5 text-slate-400" />
                                                        Angin
                                                    </span>
                                                    <span className="text-slate-200 font-medium tabular-nums">
                                                        {weather.windSpeed} km/h
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="flex items-center gap-1.5">
                                                        <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
                                                        Hujan
                                                    </span>
                                                    <span className="text-slate-200 font-medium tabular-nums">
                                                        {weather.rainChance}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Aktivitas Terbaru */}
                                    <section className="bg-[#0e1626] border border-slate-800/80 rounded-2xl p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-base font-semibold text-white">
                                                Aktivitas Terbaru
                                            </h2>
                                            <button
                                                type="button"
                                                onClick={handleBellClick}
                                                className="text-xs font-medium text-blue-400 hover:text-blue-300 transition cursor-pointer"
                                            >
                                                Lihat semua
                                            </button>
                                        </div>

                                        {recentActivities.length === 0 ? (
                                            <div className="py-6 text-center text-xs text-slate-500">
                                                Belum ada aktivitas terbaru di database.
                                            </div>
                                        ) : (
                                            <div className="space-y-3.5">
                                                {recentActivities.map((act) => (
                                                    <button
                                                        key={act.id}
                                                        type="button"
                                                        onClick={() => {
                                                            markNotificationsAsRead([act.id]);
                                                            handleNavigate(act.targetMenu || 'notifikasi');
                                                        }}
                                                        className="w-full flex items-center justify-between gap-3 p-1.5 -mx-1.5 rounded-xl hover:bg-slate-800/40 transition text-left cursor-pointer"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div
                                                                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${act.iconBg}`}
                                                            >
                                                                {act.type === 'mos' ? (
                                                                    <Package className="w-4 h-4" />
                                                                ) : (
                                                                    <ClipboardCheck className="w-4 h-4" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 text-left">
                                                                <div className="text-xs sm:text-sm font-medium text-slate-100 truncate">
                                                                    {act.title}
                                                                </div>
                                                                <div className="text-[11px] text-slate-500 truncate">
                                                                    {act.time}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <span
                                                            className={`text-xs tabular-nums shrink-0 ${act.badgeClass}`}
                                                        >
                                                            {act.badge}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                </div>
                            </div>
                        </>
                    )}

                    {activeMenu === 'sites' && (
                        <SitesSection
                            user={user}
                            onDataChanged={handleRefresh}
                            onOpenProgress={handleOpenProgressFromSite}
                        />
                    )}

                    {activeMenu === 'mos' && (
                        <MosSection
                            user={user}
                            selectedProyekId={selectedProyekId}
                            onSelectProyekId={setSelectedProyekId}
                        />
                    )}

                    {activeMenu === 'progress' && (
                        <ProgressSection
                            user={user}
                            selectedProyekId={selectedProyekId}
                            onSelectProyekId={setSelectedProyekId}
                        />
                    )}

                    {activeMenu === 'laporan' && (
                        <LaporanView
                            proyekList={proyekList}
                            mosList={mosList}
                            progressList={progressList}
                            onNavigate={handleNavigate}
                        />
                    )}

                    {activeMenu === 'notifikasi' && (
                        <NotifikasiView
                            activities={recentActivities}
                            readIds={readNotificationIds}
                            onMarkRead={(id) => markNotificationsAsRead([id])}
                            onNavigate={handleNavigate}
                        />
                    )}

                    {activeMenu === 'pengaturan' && (
                        <PengaturanView user={user} setUser={setUser} />
                    )}
                </main>

                <footer className="px-5 sm:px-8 py-4 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <span>© {new Date().getFullYear()} SIMPRO ERP Systems Ltd.</span>
                    <div className="flex items-center gap-5">
                        <button
                            type="button"
                            onClick={() => handleNavigate('laporan')}
                            className="hover:text-slate-300 cursor-pointer transition"
                        >
                            Laporan
                        </button>
                        <button
                            type="button"
                            onClick={() => handleNavigate('pengaturan')}
                            className="hover:text-slate-300 cursor-pointer transition"
                        >
                            Pengaturan
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}