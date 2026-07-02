import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { formatPrice } from '../../lib/data';
import { CheckCircle2, XCircle, Star, EyeOff, Eye as EyeIcon, X, Package, TrendingUp } from 'lucide-react';

interface ListingRow {
  id: string;
  seller_id: string;
  title: string;
  game: string;
  price: number;
  profile_image: string | null;
  status: string;
  featured: boolean;
  trending: boolean;
  rejection_reason: string | null;
  views: number;
  created_at: string;
  seller?: { full_name: string; username: string; email: string } | null;
}

const FILTERS = ['all', 'pending', 'approved', 'rejected', 'sold', 'draft'] as const;

export function AdminListingsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [rejectTarget, setRejectTarget] = useState<ListingRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('account_listings')
        .select('*, seller:profiles!account_listings_seller_id_fkey(full_name, username, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as ListingRow[]);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load listings');
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

  const act = async (r: ListingRow, action: string, reason?: string) => {
    setActing(r.id);
    try {
      const { error } = await adminApi.updateListingStatus(r.id, action, reason);
      if (error) throw error;
      toast('success', `Listing ${action} successful`);
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const confirmReject = () => {
    if (rejectTarget) act(rejectTarget, 'reject', rejectReason || undefined);
    setRejectTarget(null);
    setRejectReason('');
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access…</div>;

  return (
    <AdminLayout currentPath="/admin/listings">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-6">Listing Management</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${filter === f ? 'bg-gold-400/10 text-gold-300 border border-gold-400/20' : 'text-gray-400 border border-white/10 hover:text-white'}`}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading listings…</div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-gray-500">No listings found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((r) => (
              <div key={r.id} className="glass glass-hover rounded-2xl overflow-hidden">
                <div className="relative aspect-video bg-ink-850">
                  {r.profile_image ? (
                    <img src={r.profile_image} alt={r.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-gray-600"><Package size={32} /></div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    <StatusBadge status={r.status} />
                    {r.featured && <span className="badge bg-gold-400/20 text-gold-300"><Star size={11} /> Featured</span>}
                  </div>
                </div>

                <div className="p-4">
                  <p className="font-semibold text-white truncate">{r.title || '—'}</p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">{r.game || '—'}</p>
                  <p className="text-sm text-gold-300 font-bold mt-1">{formatPrice(r.price)}</p>
                  <p className="text-xs text-gray-500 mt-1">Seller: {r.seller?.full_name || r.seller?.username || '—'}</p>

                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><EyeIcon size={12} /> {r.views ?? 0}</span>
                    {r.trending && <span className="flex items-center gap-1 text-gold-400"><TrendingUp size={12} /> Trending</span>}
                  </div>

                  {r.rejection_reason && <p className="text-xs text-error-400 mt-2">Reason: {r.rejection_reason}</p>}

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {r.status === 'pending' && (
                      <button disabled={acting === r.id} onClick={() => act(r, 'approve')} className="btn-gold px-3 py-1.5 text-xs"><CheckCircle2 size={13} /> Approve</button>
                    )}
                    {(r.status === 'pending' || r.status === 'approved') && (
                      <button disabled={acting === r.id} onClick={() => { setRejectTarget(r); setRejectReason(''); }} className="btn-outline px-3 py-1.5 text-xs"><XCircle size={13} /> Reject</button>
                    )}
                    <button disabled={acting === r.id} onClick={() => act(r, r.featured ? 'unfeature' : 'feature')} className="btn-ghost px-3 py-1.5 text-xs">
                      {r.featured ? <><EyeOff size={13} /> Unfeature</> : <><Star size={13} /> Feature</>}
                    </button>
                    {r.status !== 'draft' && (
                      <button disabled={acting === r.id} onClick={() => act(r, 'hide')} className="btn-ghost px-3 py-1.5 text-xs"><EyeOff size={13} /> Hide</button>
                    )}
                  </div>
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
              <h3 className="font-display text-lg font-bold text-white">Reject Listing</h3>
              <button onClick={() => setRejectTarget(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-3">{rejectTarget.title}</p>
            <label className="label-field">Rejection Reason (optional)</label>
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
  const map: Record<string, string> = {
    approved: 'bg-success-500/15 text-success-400',
    pending: 'bg-warning-500/15 text-warning-400',
    rejected: 'bg-error-500/15 text-error-400',
    sold: 'bg-gold-400/15 text-gold-300',
    draft: 'bg-white/[0.06] text-gray-400',
  };
  return <span className={`badge ${map[status] ?? 'bg-white/[0.06] text-gray-400'}`}>{status}</span>;
}
