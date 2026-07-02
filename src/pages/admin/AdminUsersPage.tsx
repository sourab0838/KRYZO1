import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole, isSuperAdmin } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Search, Ban, PauseCircle, PlayCircle, Wallet, ShoppingCart, Package, ShieldCheck, X, Pencil, Trash2, BadgeCheck, UserCog, Eye, Loader2 } from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  username: string;
  full_name: string;
  phone_country_code: string;
  phone_number: string;
  is_suspended: boolean;
  is_banned: boolean;
  created_at: string;
  kyc_status?: string;
  verified_seller?: boolean;
  deleted_at?: string | null;
}

export function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [isSuper, setIsSuper] = useState(false);
  const [search, setSearch] = useState('');
  const [banTarget, setBanTarget] = useState<UserRow | null>(null);
  const [banReason, setBanReason] = useState('');
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', username: '', phone_country_code: '', phone_number: '' });
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, username, full_name, phone_country_code, phone_number, is_suspended, is_banned, created_at, kyc_status, verified_seller, deleted_at');
      if (error) throw error;
      setUsers((data ?? []) as UserRow[]);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setIsSuper(role === 'super_admin');
      setChecking(false);
      load();
    })();
  }, [load]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [u.email, u.username, u.full_name].some((f) => (f ?? '').toLowerCase().includes(q));
  }).filter((u) => !u.deleted_at);

  const act = async (u: UserRow, action: string, reason?: string) => {
    setActing(u.id);
    try {
      const { error } = await adminApi.updateUserStatus(u.id, action, reason);
      if (error) throw error;
      toast('success', `User ${action} successful`);
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const confirmBan = () => {
    if (banTarget) act(banTarget, banTarget.is_banned ? 'unban' : 'ban', banReason || undefined);
    setBanTarget(null);
    setBanReason('');
  };

  const openEdit = (u: UserRow) => {
    setEditTarget(u);
    setEditForm({
      full_name: u.full_name || '',
      username: u.username || '',
      phone_country_code: u.phone_country_code || '+91',
      phone_number: u.phone_number || '',
    });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setActing(editTarget.id);
    try {
      const { error } = await adminApi.updateUser(editTarget.id, {
        fullName: editForm.full_name || undefined,
        username: editForm.username || undefined,
        phoneCountryCode: editForm.phone_country_code || undefined,
        phoneNumber: editForm.phone_number || undefined,
      });
      if (error) throw error;
      toast('success', 'User updated successfully');
      setEditTarget(null);
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Update failed');
    } finally {
      setActing(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setActing(deleteTarget.id);
    try {
      const { error } = await adminApi.deleteUser(deleteTarget.id, deleteReason || undefined);
      if (error) throw error;
      toast('success', 'User deleted (soft)');
      setDeleteTarget(null);
      setDeleteReason('');
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Delete failed');
    } finally {
      setActing(null);
    }
  };

  const toggleVerified = async (u: UserRow) => {
    setActing(u.id);
    try {
      const { error } = u.verified_seller
        ? await adminApi.revokeVerifiedSeller(u.id)
        : await adminApi.grantVerifiedSeller(u.id);
      if (error) throw error;
      toast('success', u.verified_seller ? 'Verification badge revoked' : 'Verification badge granted');
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Action failed');
    } finally {
      setActing(null);
    }
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access...</div>;

  return (
    <AdminLayout currentPath="/admin/users">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-6">User Management</h1>

        <div className="relative mb-6 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input-field pl-10"
            placeholder="Search by email, username, or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading users...</div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-gray-500">No users found.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((u) => (
              <div key={u.id} className="glass glass-hover rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="grid place-items-center w-11 h-11 rounded-full bg-gold-400/10 text-gold-300 font-bold shrink-0">
                    {(u.full_name || u.username || u.email || '?').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{u.full_name || '—'}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    <p className="text-xs text-gray-500 truncate">@{u.username || '—'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <KycBadge status={u.kyc_status} />
                  {u.verified_seller && <span className="badge bg-gold-400/15 text-gold-300"><ShieldCheck size={11} /> Verified Seller</span>}
                  {u.is_suspended && <span className="badge bg-warning-500/15 text-warning-400">Suspended</span>}
                  {u.is_banned && <span className="badge bg-error-500/15 text-error-400">Banned</span>}
                </div>

                <p className="text-xs text-gray-500 hidden lg:block">{new Date(u.created_at).toLocaleDateString('en-IN')}</p>

                <div className="flex flex-wrap gap-1.5">
                  <button disabled={acting === u.id} onClick={() => act(u, u.is_suspended ? 'unsuspend' : 'suspend')} className="btn-ghost px-3 py-1.5 text-xs">
                    {u.is_suspended ? <><PlayCircle size={13} /> Unsuspend</> : <><PauseCircle size={13} /> Suspend</>}
                  </button>
                  <button disabled={acting === u.id} onClick={() => { setBanTarget(u); setBanReason(''); }} className="btn-ghost px-3 py-1.5 text-xs">
                    {u.is_banned ? <><PlayCircle size={13} /> Unban</> : <><Ban size={13} /> Ban</>}
                  </button>
                  <button disabled={acting === u.id} onClick={() => toggleVerified(u)} className="btn-ghost px-3 py-1.5 text-xs">
                    {u.verified_seller ? <><X size={13} /> Revoke Badge</> : <><BadgeCheck size={13} /> Verify</>}
                  </button>
                  <button disabled={acting === u.id} onClick={() => openEdit(u)} className="btn-ghost px-3 py-1.5 text-xs">
                    <Pencil size={13} /> Edit
                  </button>
                  {isSuper && (
                    <button disabled={acting === u.id} onClick={() => { setDeleteTarget(u); setDeleteReason(''); }} className="btn-outline px-3 py-1.5 text-xs text-error-400 border-error-500/30 hover:bg-error-500/10">
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                  <button onClick={() => navigate(`/admin/wallets`)} className="btn-ghost px-3 py-1.5 text-xs"><Wallet size={13} /> Wallet</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ban modal */}
      {banTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setBanTarget(null)}>
          <div className="glass-gold rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-white">{banTarget.is_banned ? 'Unban' : 'Ban'} User</h3>
              <button onClick={() => setBanTarget(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-3">{banTarget.full_name} · {banTarget.email}</p>
            {!banTarget.is_banned && (
              <>
                <label className="label-field">Reason (optional)</label>
                <textarea className="input-field mb-4" rows={3} placeholder="Reason for ban..." value={banReason} onChange={(e) => setBanReason(e.target.value)} />
              </>
            )}
            <div className="flex gap-3">
              <button onClick={confirmBan} className="btn-gold flex-1">Confirm</button>
              <button onClick={() => setBanTarget(null)} className="btn-outline">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setEditTarget(null)}>
          <div className="glass-gold rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-white">Edit User</h3>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">{editTarget.email}</p>
            <div className="space-y-3">
              <div>
                <label className="label-field">Full Name</label>
                <input value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="label-field">Username</label>
                <input value={editForm.username} onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))} className="input-field" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="label-field">Country Code</label>
                  <input value={editForm.phone_country_code} onChange={(e) => setEditForm((f) => ({ ...f, phone_country_code: e.target.value }))} className="input-field" placeholder="+91" />
                </div>
                <div className="col-span-2">
                  <label className="label-field">Phone Number</label>
                  <input value={editForm.phone_number} onChange={(e) => setEditForm((f) => ({ ...f, phone_number: e.target.value }))} className="input-field" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveEdit} disabled={acting === editTarget.id} className="btn-gold flex-1">
                {acting === editTarget.id ? <Loader2 size={16} className="animate-spin" /> : null} Save Changes
              </button>
              <button onClick={() => setEditTarget(null)} className="btn-outline">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setDeleteTarget(null)}>
          <div className="glass-gold rounded-2xl p-6 w-full max-w-md border border-error-500/30" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-error-400">Delete User</h3>
              <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-3">This will soft-delete the user. They will no longer be able to access their account.</p>
            <p className="text-sm text-white mb-3 font-medium">{deleteTarget.full_name || deleteTarget.email}</p>
            <label className="label-field">Reason (optional)</label>
            <textarea className="input-field mb-4" rows={3} placeholder="Reason for deletion..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={confirmDelete} disabled={acting === deleteTarget.id} className="btn-gold flex-1 !bg-error-500 hover:!bg-error-600">
                {acting === deleteTarget.id ? <Loader2 size={16} className="animate-spin" /> : null} Delete User
              </button>
              <button onClick={() => setDeleteTarget(null)} className="btn-outline">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function KycBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    approved: 'bg-success-500/15 text-success-400',
    pending: 'bg-warning-500/15 text-warning-400',
    rejected: 'bg-error-500/15 text-error-400',
    not_submitted: 'bg-white/[0.06] text-gray-400',
  };
  return <span className={`badge ${map[status ?? 'not_submitted'] ?? map.not_submitted}`}>KYC: {status ?? '—'}</span>;
}
