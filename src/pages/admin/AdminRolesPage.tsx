import { useEffect, useState } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { checkAdminRole, isSuperAdmin, adminApi } from '../../lib/admin';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import type { AdminRole } from '../../lib/supabase';
import { UserCog, Search, ShieldCheck, Crown, Headphones, Trash2, UserPlus, Loader2 } from 'lucide-react';

interface AdminRow {
  id: string;
  user_id: string;
  role: AdminRole;
  created_at: string;
  user: { email: string; username: string; full_name: string } | null;
}

interface UserRow {
  id: string;
  email: string;
  username: string;
  full_name: string;
}

const ROLE_META: Record<AdminRole, { label: string; icon: typeof Crown; color: string }> = {
  super_admin: { label: 'Super Admin', icon: Crown, color: 'text-gold-300 bg-gold-400/10 border-gold-400/30' },
  moderator: { label: 'Moderator', icon: ShieldCheck, color: 'text-blue-300 bg-blue-400/10 border-blue-400/30' },
  support_staff: { label: 'Support Staff', icon: Headphones, color: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30' },
};

export function AdminRolesPage() {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [superOk, setSuperOk] = useState(false);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [role, setRole] = useState<AdminRole>('moderator');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await checkAdminRole();
      if (!r) { navigate('/dashboard'); return; }
      const ok = await isSuperAdmin();
      setSuperOk(ok);
      setChecking(false);
      if (ok) await loadAdmins();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAdmins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_roles')
      .select('*, user:app_users!admin_roles_user_id_fkey(email, username, full_name)')
      .order('created_at', { ascending: false });
    if (error) toast('error', error.message);
    setAdmins((data as unknown as AdminRow[]) ?? []);
    setLoading(false);
  };

  const runSearch = async () => {
    if (!search.trim()) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('app_users')
      .select('id, email, username, full_name')
      .or(`email.ilike.%${search.trim()}%,username.ilike.%${search.trim()}%`)
      .limit(10);
    setResults((data as UserRow[]) ?? []);
    setSearching(false);
  };

  const assign = async () => {
    if (!selectedUser) { toast('error', 'Select a user first'); return; }
    setSaving(true);
    const { error } = await adminApi.assignRole(selectedUser.id, role);
    setSaving(false);
    if (error) { toast('error', error.message); return; }
    toast('success', `Assigned ${ROLE_META[role].label} to ${selectedUser.username || selectedUser.email}`);
    setSelectedUser(null);
    setSearch('');
    setResults([]);
    await loadAdmins();
  };

  const revoke = async (userId: string) => {
    if (!confirm('Revoke admin role?')) return;
    const { error } = await adminApi.revokeRole(userId);
    if (error) { toast('error', error.message); return; }
    toast('success', 'Admin role revoked');
    await loadAdmins();
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access…</div>;

  if (!superOk) {
    return (
      <AdminLayout currentPath="/admin/roles">
        <div className="animate-fade-in">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-6">Role Management</h1>
          <div className="glass rounded-2xl p-10 text-center">
            <Crown size={40} className="mx-auto text-gold-400 mb-4" />
            <p className="text-lg font-semibold text-white">Access denied</p>
            <p className="text-sm text-gray-400 mt-2">Only Super Admins can manage admin roles.</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPath="/admin/roles">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-1">Role Management</h1>
        <p className="text-sm text-gray-400 mb-6">Assign and revoke admin roles for platform staff.</p>

        {/* Assign form */}
        <div className="glass rounded-2xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={18} className="text-gold-400" />
            <h2 className="font-display text-lg font-bold text-white">Add New Admin</h2>
          </div>
          <div className="divider-gold mb-4" />
          <div className="space-y-4">
            <div>
              <label className="label-field">Search user by email or username</label>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Enter email or username…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                />
                <button onClick={runSearch} className="btn-outline px-4 flex items-center gap-2">
                  {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search
                </button>
              </div>
              {results.length > 0 && (
                <div className="mt-2 glass-gold rounded-xl divide-y divide-white/[0.06] max-h-56 overflow-y-auto">
                  {results.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setSearch(`${u.username || u.email}`); setResults([]); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] transition-colors"
                    >
                      <p className="text-sm font-medium text-white">{u.full_name || u.username}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedUser && (
                <p className="mt-2 text-xs text-gold-300">Selected: {selectedUser.full_name || selectedUser.username} ({selectedUser.email})</p>
              )}
            </div>
            <div>
              <label className="label-field">Role</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ROLE_META) as AdminRole[]).map((r) => {
                  const M = ROLE_META[r];
                  const active = role === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${active ? M.color : 'border-white/[0.06] text-gray-400 hover:text-white'}`}
                    >
                      <M.icon size={15} /> {M.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={assign} disabled={saving || !selectedUser} className="btn-gold flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Assign Role
            </button>
          </div>
        </div>

        {/* Admins list */}
        <h2 className="font-display text-lg font-bold text-white mb-3 flex items-center gap-2">
          <UserCog size={18} className="text-gold-400" /> Current Admins
        </h2>
        <div className="divider-gold mb-4" />
        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading admins…</div>
        ) : admins.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-gray-500">No admins found.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {admins.map((a) => {
              const M = ROLE_META[a.role];
              return (
                <div key={a.id} className="glass glass-hover rounded-2xl p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{a.user?.full_name || a.user?.username || 'Unknown'}</p>
                      <p className="text-xs text-gray-400 truncate">{a.user?.email}</p>
                    </div>
                    <span className={`badge flex items-center gap-1.5 ${M.color}`}>
                      <M.icon size={12} /> {M.label}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-gray-500">Since {new Date(a.created_at).toLocaleDateString()}</p>
                    <button onClick={() => revoke(a.user_id)} className="text-error-400 hover:text-error-300 text-sm flex items-center gap-1">
                      <Trash2 size={14} /> Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
