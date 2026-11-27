import {
    LayoutDashboard,
    Building2,
    Package,
    FileText,
    Bell,
    Settings,
    LogOut,
    ChevronDown,
    X,
} from 'lucide-react';

const NAV_ITEMS = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sites', label: 'Sites', icon: Building2 },
    { id: 'mos', label: 'MOS', sublabel: 'Material on Site', icon: Package },
    { id: 'laporan', label: 'Laporan', icon: FileText },
    { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
    { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
];

export default function Sidebar({
    user,
    activeMenu,
    mobileNavOpen,
    onCloseMobileNav,
    onNavigate,
    onLogout,
}) {
    if (!user) return null;

    const roleSubtitle =
        user.role_di_proyek || user.posisi || user.role || 'Anggota Proyek';

    return (
        <>
            {mobileNavOpen && (
                <div
                    onClick={onCloseMobileNav}
                    className="fixed inset-0 bg-black/60 z-30 lg:hidden"
                />
            )}

            <aside
                className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#0a101d] border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-200 ${
                    mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`}
            >
                <div>
                    <div className="h-20 px-5 flex items-center justify-between border-b border-slate-800/60">
                        <button
                            type="button"
                            onClick={() => onNavigate('overview')}
                            className="flex items-center gap-3 cursor-pointer text-left"
                        >
                            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div className="leading-tight">
                                <span className="text-base font-extrabold tracking-wide text-white">
                                    SIMPRO
                                </span>
                                <span className="text-base font-bold text-blue-400 ml-1">
                                    ERP
                                </span>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={onCloseMobileNav}
                            className="lg:hidden text-slate-400 hover:text-white p-1"
                            aria-label="Tutup menu"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <nav className="p-3.5 space-y-1">
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeMenu === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onNavigate(item.id)}
                                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition cursor-pointer ${
                                        isActive
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                                    }`}
                                >
                                    <Icon
                                        className={`w-4 h-4 shrink-0 ${
                                            isActive ? 'text-white' : 'text-slate-400'
                                        }`}
                                    />
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium leading-snug truncate">
                                            {item.label}
                                        </div>
                                        {item.sublabel && (
                                            <div
                                                className={`text-[11px] leading-tight ${
                                                    isActive ? 'text-blue-100/80' : 'text-slate-500'
                                                }`}
                                            >
                                                {item.sublabel}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-3.5 space-y-2.5 border-t border-slate-800/70">
                    <button
                        type="button"
                        onClick={() => onNavigate('pengaturan')}
                        className="w-full bg-[#11192b] hover:bg-[#162036] border border-slate-800/90 rounded-xl p-3 flex items-center justify-between gap-2 transition cursor-pointer text-left"
                        title="Buka Pengaturan Akun"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-slate-700/80 border border-slate-600/50 flex items-center justify-center text-sm font-bold text-white shrink-0">
                                {(user.nama || 'A').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-white truncate">
                                    {user.nama}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">
                                    {roleSubtitle}
                                </div>
                            </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    </button>

                    <button
                        type="button"
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#11192b]/70 hover:bg-red-500/10 border border-slate-800/80 hover:border-red-500/30 text-slate-300 hover:text-red-300 text-sm font-medium transition cursor-pointer"
                    >
                        <LogOut className="w-4 h-4 text-slate-400" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
}