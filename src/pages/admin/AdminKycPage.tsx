import { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck, CheckCircle2, XCircle, Loader2, AlertCircle, RefreshCw,
  Search, Eye, X, FileText, User, Calendar, MapPin, CreditCard, Image as ImageIcon
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase, type KycSubmissionWithUser } from '../../lib/supabase';
import { useToast } from '../../components/Toast';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export function AdminKycPage() {
  const toast = useToast();
  const [submissions, setSubmissions] = useState<KycSubmissionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<KycSubmissionWithUser | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_get_kyc_submissions');
      if (rpcError) throw rpcError;
      setSubmissions((data || []) as KycSubmissionWithUser[]);
    } catch (err: any) {
      setError(err?.message || 'Failed to load KYC submissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = submissions.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.full_name?.toLowerCase().includes(q) ||
        s.user_email?.toLowerCase().includes(q) ||
        s.user_username?.toLowerCase().includes(q) ||
        s.id_number?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const approve = async (id: string) => {
    setActionLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc('admin_update_kyc_status', {
        p_kyc_id: id,
        p_status: 'approved',
      });
      if (rpcError) throw rpcError;
      toast('success', 'KYC approved successfully.');
      await loadData();
      setSelected(null);
    } catch (err: any) {
      toast('error', err?.message || 'Failed to approve KYC.');
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async () => {
    if (!selected || !rejectReason.trim()) {
      toast('error', 'Please provide a rejection reason.');
      return;
    }
    setActionLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc('admin_update_kyc_status', {
        p_kyc_id: selected.id,
        p_status: 'rejected',
        p_rejection_reason: rejectReason.trim(),
      });
      if (rpcError) throw rpcError;
      toast('success', 'KYC rejected.');
      setRejecting(false);
      setRejectReason('');
      await loadData();
      setSelected(null);
    } catch (err: any) {
      toast('error', err?.message || 'Failed to reject KYC.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout currentPath="/admin/kyc">
        <div className="min-h-[60vh] grid place-items-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-gold-400 mx-auto" />
            <p className="mt-4 text-gray-400">Loading KYC submissions...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout currentPath="/admin/kyc">
        <div className="min-h-[60vh] grid place-items-center px-4">
          <div className="text-center max-w-md">
            <AlertCircle size={40} className="text-error-400 mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold text-white mb-2">Failed to Load</h2>
            <p className="text-sm text-gray-400 mb-6">{error}</p>
            <button onClick={loadData} className="btn-gold inline-flex items-center gap-2">
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPath="/admin/kyc">
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-white">KYC Review</h1>
          <p className="text-sm text-gray-400 mt-1">Review and approve identity verification submissions.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total" value={submissions.length} icon={<ShieldCheck size={18} />} color="text-gold-400" />
          <StatCard label="Pending" value={submissions.filter(s => s.status === 'pending').length} icon={<Loader2 size={18} />} color="text-warning-400" />
          <StatCard label="Approved" value={submissions.filter(s => s.status === 'approved').length} icon={<CheckCircle2 size={18} />} color="text-success-400" />
          <StatCard label="Rejected" value={submissions.filter(s => s.status === 'rejected').length} icon={<XCircle size={18} />} color="text-error-400" />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                  filter === f ? 'bg-gold-400 text-ink-950' : 'glass text-gray-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, ID..."
              className="input-field pl-10"
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="glass rounded-2xl py-16 text-center">
            <ShieldCheck size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No KYC submissions found.</p>
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left p-4 font-medium">User</th>
                    <th className="text-left p-4 font-medium">ID Type</th>
                    <th className="text-left p-4 font-medium">Submitted</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-right p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gold-400/10 grid place-items-center text-gold-400 text-xs font-bold shrink-0">
                            {s.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-medium truncate">{s.full_name}</p>
                            <p className="text-gray-500 text-xs truncate">{s.user_email || s.user_username || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-300 capitalize">{s.id_type?.replace('_', ' ') || '—'}</span>
                      </td>
                      <td className="p-4 text-gray-400">
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setSelected(s)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium glass text-gray-300 hover:text-white transition-colors inline-flex items-center gap-1"
                          >
                            <Eye size={14} /> View
                          </button>
                          {s.status === 'pending' && (
                            <>
                              <button
                                onClick={() => approve(s.id)}
                                disabled={actionLoading}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-success-500/20 text-success-400 hover:bg-success-500/30 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                              >
                                <CheckCircle2 size={14} /> Approve
                              </button>
                              <button
                                onClick={() => { setSelected(s); setRejecting(true); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-error-500/20 text-error-400 hover:bg-error-500/30 transition-colors inline-flex items-center gap-1"
                              >
                                <XCircle size={14} /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setSelected(null); setRejecting(false); setRejectReason(''); }}>
          <div className="glass rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-white">KYC Details</h2>
              <button onClick={() => { setSelected(null); setRejecting(false); setRejectReason(''); }} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* User info */}
              <div className="grid grid-cols-2 gap-3">
                <DetailItem icon={<User size={14} />} label="Full Name" value={selected.full_name} />
                <DetailItem icon={<Calendar size={14} />} label="Date of Birth" value={selected.date_of_birth ? new Date(selected.date_of_birth).toLocaleDateString() : '—'} />
                <DetailItem icon={<MapPin size={14} />} label="Country" value={selected.country} />
                <DetailItem icon={<CreditCard size={14} />} label="ID Type" value={selected.id_type?.replace('_', ' ')} />
                <DetailItem icon={<FileText size={14} />} label="ID Number" value={selected.id_number} />
                <DetailItem icon={<Calendar size={14} />} label="Submitted" value={selected.submitted_at ? new Date(selected.submitted_at).toLocaleString() : '—'} />
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Status:</span>
                <StatusBadge status={selected.status} />
              </div>

              {/* Rejection reason */}
              {selected.rejection_reason && (
                <div className="rounded-xl bg-error-500/10 border border-error-500/20 p-3">
                  <p className="text-xs text-error-400 font-medium mb-1">Rejection Reason</p>
                  <p className="text-sm text-gray-300">{selected.rejection_reason}</p>
                </div>
              )}

              {/* Images */}
              <div className="grid grid-cols-3 gap-3">
                <DocImage label="Front ID" url={selected.front_image} />
                <DocImage label="Back ID" url={selected.back_image} />
                <DocImage label="Selfie" url={selected.selfie_image} />
              </div>

              {/* Actions */}
              {selected.status === 'pending' && (
                <div className="pt-4 border-t border-white/[0.06]">
                  {rejecting ? (
                    <div className="space-y-3">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Enter rejection reason..."
                        className="input-field min-h-[80px] resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={reject}
                          disabled={actionLoading}
                          className="btn-gold inline-flex items-center gap-2 flex-1 justify-center"
                        >
                          {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => { setRejecting(false); setRejectReason(''); }}
                          className="btn-ghost"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => approve(selected.id)}
                        disabled={actionLoading}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-success-500/20 text-success-400 hover:bg-success-500/30 font-medium inline-flex items-center gap-2 justify-center transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Approve
                      </button>
                      <button
                        onClick={() => setRejecting(true)}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-error-500/20 text-error-400 hover:bg-error-500/30 font-medium inline-flex items-center gap-2 justify-center transition-colors"
                      >
                        <XCircle size={16} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-warning-500/15', text: 'text-warning-400', label: 'Pending' },
    approved: { bg: 'bg-success-500/15', text: 'text-success-400', label: 'Approved' },
    rejected: { bg: 'bg-error-500/15', text: 'text-error-400', label: 'Rejected' },
  };
  const c = config[status] || { bg: 'bg-white/[0.06]', text: 'text-gray-400', label: status };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.04]">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wide mb-1">
        {icon} {label}
      </div>
      <p className="text-sm text-white capitalize">{value || '—'}</p>
    </div>
  );
}

function DocImage({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div>
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <div className="w-full h-28 rounded-lg border border-dashed border-white/[0.1] grid place-items-center">
          <ImageIcon size={20} className="text-gray-600" />
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img src={url} alt={label} className="w-full h-28 object-cover rounded-lg border border-white/[0.06] hover:border-gold-400/30 transition-colors cursor-pointer" />
      </a>
    </div>
  );
}
