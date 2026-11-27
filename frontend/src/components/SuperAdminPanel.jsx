
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Check,
    Edit3,
    Menu,
    Plus,
    RefreshCw,
    Save,
    Shield,
    Trash2,
    X,
} from 'lucide-react';
import SuperAdminSidebar from './SuperAdminSidebar';
import apiClient, { logoutRequest } from '../api/axiosClient';

const FALLBACK_ROLES = [
    'Admin Proyek',
    'Logistik',
    'QS (Quantity Surveyor)',
    'Pengawas',
];

const TAB_LABELS = {
    invitations: 'Permintaan Undangan',
    users: 'Pengguna & Role',
    roles: 'Kelola Role',
    projects: 'Seluruh Proyek',
    logs: 'Aktivitas Sistem',
};

export default function SuperAdminPanel({ currentUser }) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('invitations');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [invitations, setInvitations] = useState([]);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [projects, setProjects] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', text: '' });

    const [roleOverrides, setRoleOverrides] = useState({});
    const [rejectReasons, setRejectReasons] = useState({});

    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDesc, setNewRoleDesc] = useState('');
    const [editingRoleId, setEditingRoleId] = useState(null);
    const [editRoleForm, setEditRoleForm] = useState({
        role_name: '',
        description: '',
        is_active: true,
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        setFeedback({ type: '', text: '' });
        try {
            const [invRes, usrRes, prjRes, logRes, rolesRes] = await Promise.all([
                apiClient.get('/api/superadmin/invitations'),
                apiClient.get('/api/superadmin/users'),
                apiClient.get('/api/superadmin/projects'),
                apiClient.get('/api/superadmin/activity-logs?limit=100'),
                apiClient.get('/api/superadmin/roles').catch(() => ({ data: { data: [] } })),
            ]);
            setInvitations(invRes.data?.data || []);
            setUsers(usrRes.data?.data || []);
            setProjects(prjRes.data?.data || []);
            setLogs(logRes.data?.data || []);
            setRoles(rolesRes.data?.data || []);
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err?.response?.data?.message || 'Gagal memuat data SuperAdmin.',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleLogout = async () => {
        await logoutRequest();
        navigate('/login', { replace: true });
    };

    const roleOptions = (() => {
        const activeDbRoles = roles
            .filter((r) => r.is_active !== 0 && r.is_active !== false)
            .map((r) => r.role_name)
            .filter(Boolean);
        return activeDbRoles.length > 0 ? activeDbRoles : FALLBACK_ROLES;
    })();

    const handleReview = async (invitationId, decision, defaultRole) => {
        setFeedback({ type: '', text: '' });
        const chosenRole = roleOverrides[invitationId] || defaultRole;
        const reason = rejectReasons[invitationId] || '';

        try {
            const res = await apiClient.post(`/api/superadmin/invitations/${invitationId}/review`, {
                decision,
                ...(decision === 'approve' ? { approved_role_code: chosenRole } : {}),
                ...(decision === 'reject' ? { rejection_reason: reason } : {}),
            });
            setFeedback({
                type: 'success',
                text: res.data?.message || 'Tinjauan undangan berhasil disimpan.',
            });
            await loadData();
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err?.response?.data?.message || 'Gagal memproses tinjauan undangan.',
            });
        }
    };

    const handleUserRoleChange = async (userId, nextRole, nextPosisi, nextActive) => {
        setFeedback({ type: '', text: '' });
        try {
            const res = await apiClient.patch(`/api/superadmin/users/${userId}/role`, {
                ...(nextRole !== undefined ? { role: nextRole } : {}),
                ...(nextPosisi !== undefined ? { posisi: nextPosisi } : {}),
                ...(nextActive !== undefined ? { is_active: nextActive } : {}),
            });
            setFeedback({
                type: 'success',
                text: res.data?.message || 'Role pengguna berhasil diperbarui.',
            });
            await loadData();
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err?.response?.data?.message || 'Gagal memperbarui role pengguna.',
            });
        }
    };

    const handleCreateRole = async (e) => {
        e.preventDefault();
        if (!newRoleName.trim()) return;
        setFeedback({ type: '', text: '' });
        try {
            const res = await apiClient.post('/api/superadmin/roles', {
                role_name: newRoleName.trim(),
                description: newRoleDesc.trim() || null,
            });
            setNewRoleName('');
            setNewRoleDesc('');
            setFeedback({
                type: 'success',
                text: res.data?.message || 'Role baru berhasil ditambahkan.',
            });
            await loadData();
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err?.response?.data?.message || 'Gagal menambah role.',
            });
        }
    };

    const startEditRole = (roleItem) => {
        setEditingRoleId(roleItem.id);
        setEditRoleForm({
            role_name: roleItem.role_name || '',
            description: roleItem.description || '',
            is_active: roleItem.is_active !== 0 && roleItem.is_active !== false,
        });
    };

    const cancelEditRole = () => {
        setEditingRoleId(null);
        setEditRoleForm({ role_name: '', description: '', is_active: true });
    };

    const handleSaveRole = async (roleId) => {
        if (!editRoleForm.role_name.trim()) return;
        setFeedback({ type: '', text: '' });
        try {
            const res = await apiClient.put(`/api/superadmin/roles/${roleId}`, {
                role_name: editRoleForm.role_name.trim(),
                description: editRoleForm.description.trim() || null,
                is_active: editRoleForm.is_active,
            });
            cancelEditRole();
            setFeedback({
                type: 'success',
                text: res.data?.message || 'Role berhasil diperbarui.',
            });
            await loadData();
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err?.response?.data?.message || 'Gagal memperbarui role.',
            });
        }
    };

    const handleDeleteRole = async (roleId, roleName) => {
        setFeedback({ type: '', text: '' });
        try {
            const res = await apiClient.delete(`/api/superadmin/roles/${roleId}`);
            if (editingRoleId === roleId) cancelEditRole();
            setFeedback({
                type: 'success',
                text: res.data?.message || `Role "${roleName}" berhasil dihapus.`,
            });
            await loadData();
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err?.response?.data?.message || 'Gagal menghapus role.',
            });
        }
    };

    const pendingInvitationsCount = invitations.filter(
        (i) => i.status === 'pending_approval'
    ).length;

    return (
        <div className="min-h-screen bg-[#070c16] text-slate-100 flex items-stretch text-left">
            <SuperAdminSidebar
                currentUser={currentUser}
                activeTab={activeTab}
                onSelectTab={setActiveTab}
                onLogout={handleLogout}
                pendingCount={pendingInvitationsCount}
                mobileOpen={mobileMenuOpen}
                onCloseMobile={() => setMobileMenuOpen(false)}
            />

            <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0e1626] border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(true)}
                            className="lg:hidden p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                            aria-label="Buka menu navigasi"
                        >
                            <Menu className="w-4 h-4" />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                                {TAB_LABELS[activeTab] || 'Dashboard'}
                            </div>
                            <h1 className="text-xl font-bold text-white truncate">Dashboard SuperAdmin</h1>
                            <p className="text-xs text-slate-400">
                                Masuk sebagai {currentUser?.nama || 'SuperAdmin'} — kelola permintaan undangan, pengguna, role sistem, proyek, dan audit aktivitas.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={loadData}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer shrink-0"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Muat Ulang</span>
                    </button>
                </div>

                {feedback.text && (
                    <div
                        className={`px-4 py-3 rounded-xl text-xs border ${
                            feedback.type === 'error'
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        }`}
                    >
                        {feedback.text}
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-4">
                        <div className="text-xs text-slate-400">Total Pengguna</div>
                        <div className="text-2xl font-bold text-white mt-1">{users.length}</div>
                    </div>
                    <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-4">
                        <div className="text-xs text-slate-400">Total Proyek</div>
                        <div className="text-2xl font-bold text-white mt-1">{projects.length}</div>
                    </div>
                    <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-4">
                        <div className="text-xs text-slate-400">Undangan Menunggu</div>
                        <div className="text-2xl font-bold text-amber-300 mt-1">
                            {pendingInvitationsCount}
                        </div>
                    </div>
                    <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-4">
                        <div className="text-xs text-slate-400">Daftar Role Aktif</div>
                        <div className="text-2xl font-bold text-blue-300 mt-1">{roleOptions.length}</div>
                    </div>
                </div>

                {activeTab === 'invitations' && (
                    <div className="bg-[#0e1626] border border-slate-800 rounded-2xl overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-[#131c2e] text-slate-400 uppercase text-[11px]">
                                <tr>
                                    <th className="px-3 py-3">Proyek</th>
                                    <th className="px-3 py-3">PM Pengundang</th>
                                    <th className="px-3 py-3">Email Calon Anggota</th>
                                    <th className="px-3 py-3">Role Diminta / Final</th>
                                    <th className="px-3 py-3">Tanggal</th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3">Aksi SuperAdmin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                                {invitations.map((inv) => {
                                    const selectedRole =
                                        roleOverrides[inv.id] ?? inv.approved_role_code ?? inv.requested_role_code;
                                    const isPending = inv.status === 'pending_approval';
                                    return (
                                        <tr key={inv.id} className="hover:bg-slate-900/40">
                                            <td className="px-3 py-3 font-medium text-white">{inv.nama_proyek}</td>
                                            <td className="px-3 py-3">{inv.invited_by_nama || '-'}</td>
                                            <td className="px-3 py-3 break-all">{inv.invited_email}</td>
                                            <td className="px-3 py-3 space-y-1">
                                                <div>Diminta: <span className="text-slate-200">{inv.requested_role_code}</span></div>
                                                {isPending ? (
                                                    <div className="flex items-center gap-1">
                                                        <Edit3 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                                        <select
                                                            value={selectedRole}
                                                            onChange={(e) =>
                                                                setRoleOverrides((prev) => ({ ...prev, [inv.id]: e.target.value }))
                                                            }
                                                            className="bg-[#131c2e] border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                                                        >
                                                            {roleOptions.map((r) => (
                                                                <option key={r} value={r}>
                                                                    {r}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        Final: <strong className="text-emerald-300">{inv.approved_role_code || '-'}</strong>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                {inv.created_at ? new Date(inv.created_at).toLocaleDateString('id-ID') : '-'}
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-200 whitespace-nowrap">
                                                    {inv.status}
                                                </span>
                                                {inv.rejection_reason && (
                                                    <div className="text-[11px] text-rose-300 mt-1">Alasan: {inv.rejection_reason}</div>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                {isPending ? (
                                                    <div className="space-y-1.5 min-w-[175px]">
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReview(inv.id, 'approve', inv.requested_role_code)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                <span>Setujui</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReview(inv.id, 'reject', inv.requested_role_code)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium cursor-pointer"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                                <span>Tolak</span>
                                                            </button>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            placeholder="Alasan tolak (opsional)"
                                                            value={rejectReasons[inv.id] || ''}
                                                            onChange={(e) =>
                                                                setRejectReasons((prev) => ({ ...prev, [inv.id]: e.target.value }))
                                                            }
                                                            className="w-full bg-[#131c2e] border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500">Selesai ditinjau</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {invitations.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                                            Belum ada permintaan undangan.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="bg-[#0e1626] border border-slate-800 rounded-2xl overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-[#131c2e] text-slate-400 uppercase text-[11px]">
                                <tr>
                                    <th className="px-3 py-3">Nama</th>
                                    <th className="px-3 py-3">Email</th>
                                    <th className="px-3 py-3">Role Sistem</th>
                                    <th className="px-3 py-3">Posisi Default</th>
                                    <th className="px-3 py-3">Proyek Aktif</th>
                                    <th className="px-3 py-3">Status Akun</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td className="px-3 py-3 font-medium text-white">{u.nama}</td>
                                        <td className="px-3 py-3 break-all">{u.email}</td>
                                        <td className="px-3 py-3">
                                            <select
                                                value={u.role || 'user'}
                                                onChange={(e) =>
                                                    handleUserRoleChange(u.id, e.target.value, undefined, undefined)
                                                }
                                                className="bg-[#131c2e] border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                                            >
                                                <option value="user">user</option>
                                                <option value="SuperAdmin">SuperAdmin</option>
                                            </select>
                                        </td>
                                        <td className="px-3 py-3">
                                            <select
                                                value={u.posisi || roleOptions[0] || 'Admin Proyek'}
                                                onChange={(e) =>
                                                    handleUserRoleChange(u.id, undefined, e.target.value, undefined)
                                                }
                                                className="bg-[#131c2e] border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                                            >
                                                {roleOptions.map((r) => (
                                                    <option key={r} value={r}>
                                                        {r}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-3 py-3">
                                            {(u.memberships || []).length > 0
                                                ? u.memberships.map((m) => `${m.nama_proyek} (${m.role_code})`).join(', ')
                                                : '-'}
                                        </td>
                                        <td className="px-3 py-3">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleUserRoleChange(u.id, undefined, undefined, !u.is_active)
                                                }
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                                                    u.is_active
                                                        ? 'bg-emerald-500/15 text-emerald-300'
                                                        : 'bg-rose-500/15 text-rose-300'
                                                }`}
                                            >
                                                {u.is_active ? 'Aktif' : 'Nonaktif'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'roles' && (
                    <div className="space-y-4">
                        <form
                            onSubmit={handleCreateRole}
                            className="bg-[#0e1626] border border-slate-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
                        >
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">
                                    Nama Role Baru
                                </label>
                                <input
                                    type="text"
                                    value={newRoleName}
                                    onChange={(e) => setNewRoleName(e.target.value)}
                                    placeholder="Contoh: Site Engineer"
                                    className="w-full bg-[#131c2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">
                                    Deskripsi Tugas (Opsional)
                                </label>
                                <input
                                    type="text"
                                    value={newRoleDesc}
                                    onChange={(e) => setNewRoleDesc(e.target.value)}
                                    placeholder="Ringkasan tanggung jawab role"
                                    className="w-full bg-[#131c2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                                />
                            </div>
                            <button
                                type="submit"
                                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Tambah Role</span>
                            </button>
                        </form>

                        <div className="bg-[#0e1626] border border-slate-800 rounded-2xl overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-[#131c2e] text-slate-400 uppercase text-[11px]">
                                    <tr>
                                        <th className="px-3 py-3">Nama Role</th>
                                        <th className="px-3 py-3">Deskripsi</th>
                                        <th className="px-3 py-3">Status</th>
                                        <th className="px-3 py-3">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/80">
                                    {roles.map((r) => {
                                        const isEditing = editingRoleId === r.id;
                                        const isActive = r.is_active !== 0 && r.is_active !== false;
                                        return (
                                            <tr key={r.id}>
                                                <td className="px-3 py-3 font-medium text-white">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editRoleForm.role_name}
                                                            onChange={(e) =>
                                                                setEditRoleForm((prev) => ({
                                                                    ...prev,
                                                                    role_name: e.target.value,
                                                                }))
                                                            }
                                                            className="w-full bg-[#131c2e] border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                                                        />
                                                    ) : (
                                                        r.role_name
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editRoleForm.description}
                                                            onChange={(e) =>
                                                                setEditRoleForm((prev) => ({
                                                                    ...prev,
                                                                    description: e.target.value,
                                                                }))
                                                            }
                                                            className="w-full bg-[#131c2e] border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                                                        />
                                                    ) : (
                                                        r.description || '-'
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {isEditing ? (
                                                        <label className="inline-flex items-center gap-1.5 text-xs">
                                                            <input
                                                                type="checkbox"
                                                                checked={editRoleForm.is_active}
                                                                onChange={(e) =>
                                                                    setEditRoleForm((prev) => ({
                                                                        ...prev,
                                                                        is_active: e.target.checked,
                                                                    }))
                                                                }
                                                            />
                                                            <span>Aktif</span>
                                                        </label>
                                                    ) : (
                                                        <span
                                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                                                                isActive
                                                                    ? 'bg-emerald-500/15 text-emerald-300'
                                                                    : 'bg-rose-500/15 text-rose-300'
                                                            }`}
                                                        >
                                                            {isActive ? 'Aktif' : 'Nonaktif'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveRole(r.id)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer"
                                                            >
                                                                <Save className="w-3.5 h-3.5" />
                                                                <span>Simpan</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelEditRole}
                                                                className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer"
                                                            >
                                                                Batal
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => startEditRole(r)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-medium cursor-pointer"
                                                            >
                                                                <Edit3 className="w-3.5 h-3.5" />
                                                                <span>Edit</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteRole(r.id, r.role_name)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-medium cursor-pointer"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                <span>Hapus</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {roles.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                                                Belum ada data role di database. Tambahkan role baru pada form di atas.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'projects' && (
                    <div className="bg-[#0e1626] border border-slate-800 rounded-2xl overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-[#131c2e] text-slate-400 uppercase text-[11px]">
                                <tr>
                                    <th className="px-3 py-3">Nama Proyek</th>
                                    <th className="px-3 py-3">Lokasi</th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3">Progres</th>
                                    <th className="px-3 py-3">Anggota Aktif</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                                {projects.map((p) => (
                                    <tr key={p.id}>
                                        <td className="px-3 py-3 font-medium text-white">{p.nama_proyek}</td>
                                        <td className="px-3 py-3">{p.lokasi || '-'}</td>
                                        <td className="px-3 py-3">{p.status || '-'}</td>
                                        <td className="px-3 py-3">{Number(p.persentase_progres || 0)}%</td>
                                        <td className="px-3 py-3">{p.total_anggota ?? 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="bg-[#0e1626] border border-slate-800 rounded-2xl overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-[#131c2e] text-slate-400 uppercase text-[11px]">
                                <tr>
                                    <th className="px-3 py-3">Waktu</th>
                                    <th className="px-3 py-3">Aktor</th>
                                    <th className="px-3 py-3">Aksi</th>
                                    <th className="px-3 py-3">Proyek</th>
                                    <th className="px-3 py-3">Detail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                                {logs.map((l) => (
                                    <tr key={l.id}>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            {l.created_at ? new Date(l.created_at).toLocaleString('id-ID') : '-'}
                                        </td>
                                        <td className="px-3 py-3">{l.actor_nama || l.actor_email || 'Sistem'}</td>
                                        <td className="px-3 py-3 font-mono text-[11px] text-blue-300">{l.action}</td>
                                        <td className="px-3 py-3">{l.nama_proyek || '-'}</td>
                                        <td className="px-3 py-3 font-mono text-[11px] text-slate-400">
                                            {typeof l.details === 'string' ? l.details : JSON.stringify(l.details || {})}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}