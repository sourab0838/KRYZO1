import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { formatPrice } from '../../lib/data';
import { ArrowUpRight, CheckCircle2, XCircle, Clock, Loader2, User, X } from 'lucide-react';

interface WithdrawalRow {
  id: string;
  user_id: string;
  upi_id: string;
  amount: number;
  status: string;
  reason: string | null;
  created_at: string;
  profile?: { full_name: string; username: string } | null;
}

const FILTERS = ['all', 'pending', 'processing', 'completed', 'rejected'] as const;

export function AdminWithdrawalsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*, profile:profiles!withdrawals_user_id_profiles_fkey(full_name, username)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as WithdrawalRow[]);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setChecking(false);
      load();
    })();
  }, [load]);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  const act = async (r: WithdrawalRow, status: string, reason?: string) => {
    setActing(r.id);
    try {
      const { error } = await adminApi.updateWithdrawalStatus(r.id, status, reason);
      if (error) throw error;
      toast('success', `Withdrawal ${status}`);
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const confirmReject = () => {
    if (rejectTarget) act(rejectTarget, 'rejected', rejectReason || undefined);
    setRejectTarget(null);
    setRejectReason('');
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access…</div>;

  return (
    <AdminLayout currentPath="/admin/withdrawals">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-2">
          <ArrowUpRight className="text-gold-400" /> Withdrawal Management
        </h1>

        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${filter === f ? 'bg-gold-400/10 text-gold-300 border border-gold-400/20' : 'text-gray-400 border border-white/10 hover:text-white'}`}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading withdrawals…</div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-gray-500">No withdrawals found.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((r) => (
              <div key={r.id} className="glass glass-hover rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid place-items-center w-10 h-10 rounded-full bg-gold-400/10 text-gold-300 shrink-0">
                      <User size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{r.profile?.full_name || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">@{r.profile?.username || '—'}</p>
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-xs text-gray-500">UPI ID</p>
                    <p className="text-sm text-gray-200 mt-0.5 truncate font-mono">{r.upi_id || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Amount</p>
                    <p className="text-sm text-gold-300 font-bold mt-0.5">{formatPrice(r.amount)}</p>
                  </div>
                </div>

                {r.reason && <p className="text-xs text-error-400 mb-2">Reason: {r.reason}</p>}
                <p className="text-xs text-gray-500 mb-4">Requested: {new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>

                <div className="flex flex-wrap gap-2">
                  {r.status === 'pending' && (
                    <>
                      <button disabled={acting === r.id} onClick={() => act(r, 'processing')} className="btn-gold flex-1 text-sm">
                        {acting === r.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Approve
                      </button>
                      <button disabled={acting === r.id} onClick={() => { setRejectTarget(r); setRejectReason(''); }} className="btn-outline flex-1 text-sm">
                        <XCircle size={15} /> Reject
                      </button>
                    </>
                  )}
                  {r.status === 'processing' && (
                    <>
                      <button disabled={acting === r.id} onClick={() => act(r, 'completed')} className="btn-gold flex-1 text-sm">
                        {acting === r.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Mark Completed
                      </button>
                      <button disabled={acting === r.id} onClick={() => { setRejectTarget(r); setRejectReason(''); }} className="btn-outline flex-1 text-sm">
                        <XCircle size={15} /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setRejectTarget(null)}>
          <div className="glass-gold rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-white">Reject Withdrawal</h3>
              <button onClick={() => setRejectTarget(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-3">{rejectTarget.profile?.full_name || '—'} · {formatPrice(rejectTarget.amount)}</p>
            <label className="label-field">Rejection Reason (refunds amount to wallet)</label>
            <textarea className="input-field mb-4" rows={3} placeholder="Reason for rejection…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={confirmReject} className="btn-gold flex-1">Confirm Reject</button>
              <button onClick={() => setRejectTarget(null)} className="btn-outline">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    pending: { cls: 'bg-warning-500/15 text-warning-400', icon: <Clock size={11} /> },
    processing: { cls: 'bg-info-500/15 text-info-400', icon: <Loader2 size={11} /> },
    completed: { cls: 'bg-success-500/15 text-success-400', icon: <CheckCircle2 size={11} /> },
    rejected: { cls: 'bg-error-500/15 text-error-400', icon: <XCircle size={11} /> },
  };
  const m = map[status] ?? { cls: 'bg-white/[0.06] text-gray-400', icon: <Clock size={11} /> };
  return <span className={`badge ${m.cls}`}>{m.icon} {status}</span>;
}
