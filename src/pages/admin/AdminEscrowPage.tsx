import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { formatPrice } from '../../lib/data';
import { Lock, Unlock, RotateCcw, AlertTriangle, X, User, ShoppingCart } from 'lucide-react';

interface EscrowRow {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  total_amount: number;
  platform_fee: number;
  seller_commission: number;
  seller_payout: number;
  status: string;
  released_at: string | null;
  created_at: string;
  buyer?: { full_name: string; username: string } | null;
  seller?: { full_name: string; username: string } | null;
}

interface DisputedOrder {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: string;
  escrow_status: string;
  created_at: string;
  buyer?: { full_name: string; username: string } | null;
  seller?: { full_name: string; username: string } | null;
}

export function AdminEscrowPage() {
  const toast = useToast();
  const [rows, setRows] = useState<EscrowRow[]>([]);
  const [disputed, setDisputed] = useState<DisputedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [isSuper, setIsSuper] = useState(false);
  const [refundTarget, setRefundTarget] = useState<EscrowRow | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('escrow_holds')
        .select('*, buyer:profiles!escrow_holds_buyer_id_fkey(full_name, username), seller:profiles!escrow_holds_seller_id_fkey(full_name, username)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as EscrowRow[]);

      const { data: dOrders } = await supabase
        .from('orders')
        .select('*, buyer:profiles!orders_buyer_id_fkey(full_name, username), seller:profiles!orders_seller_id_fkey(full_name, username)')
        .eq('escrow_status', 'disputed')
        .order('created_at', { ascending: false });
      setDisputed((dOrders ?? []) as DisputedOrder[]);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load escrow holds');
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

  const release = async (r: EscrowRow) => {
    setActing(r.order_id);
    try {
      const { error } = await adminApi.releaseEscrow(r.order_id);
      if (error) throw error;
      toast('success', 'Escrow funds released');
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Release failed');
    } finally {
      setActing(null);
    }
  };

  const confirmRefund = async () => {
    if (!refundTarget) return;
    setActing(refundTarget.order_id);
    try {
      const { error } = await adminApi.refundEscrow(refundTarget.order_id, refundReason || undefined);
      if (error) throw error;
      toast('success', 'Escrow refunded to buyer');
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Refund failed');
    } finally {
      setActing(null);
      setRefundTarget(null);
      setRefundReason('');
    }
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access…</div>;

  return (
    <AdminLayout currentPath="/admin/escrow">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-6">Escrow Management</h1>

        {disputed.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-error-400" />
              <h2 className="font-display text-lg font-bold text-white">Disputed Orders ({disputed.length})</h2>
            </div>
            <div className="divider-gold mb-4" />
            <div className="space-y-3">
              {disputed.map((o) => (
                <div key={o.id} className="glass rounded-2xl p-4 border border-error-500/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">Order #{o.id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Buyer: {o.buyer?.full_name || o.buyer?.username || '—'} · Seller: {o.seller?.full_name || o.seller?.username || '—'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatPrice(o.amount)} · {new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium' })}</p>
                    </div>
                    <span className="badge bg-error-500/15 text-error-400 shrink-0"><AlertTriangle size={11} /> Disputed</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <Lock size={16} className="text-gold-400" />
          <h2 className="font-display text-lg font-bold text-white">Escrow Holds ({rows.length})</h2>
        </div>
        <div className="divider-gold mb-4" />

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading escrow holds…</div>
        ) : rows.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-gray-500">No escrow holds found.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {rows.map((r) => (
              <div key={r.id} className="glass glass-hover rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">Order #{r.order_id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <EscrowBadge status={r.status} />
                </div>

                <div className="space-y-1.5 text-sm mb-4">
                  <Row icon={<User size={12} />} label="Buyer" value={r.buyer?.full_name || r.buyer?.username || '—'} />
                  <Row icon={<User size={12} />} label="Seller" value={r.seller?.full_name || r.seller?.username || '—'} />
                  <Row icon={<ShoppingCart size={12} />} label="Total Amount" value={formatPrice(r.total_amount)} />
                  <Row icon={<Lock size={12} />} label="Platform Fee" value={formatPrice(r.platform_fee)} />
                  <Row icon={<Lock size={12} />} label="Seller Commission" value={formatPrice(r.seller_commission)} />
                  <Row icon={<Unlock size={12} />} label="Seller Payout" value={formatPrice(r.seller_payout)} />
                </div>

                {isSuper && r.status === 'held' && (
                  <div className="flex gap-2">
                    <button disabled={acting === r.order_id} onClick={() => release(r)} className="btn-gold flex-1 text-sm"><Unlock size={14} /> Release Funds</button>
                    <button disabled={acting === r.order_id} onClick={() => { setRefundTarget(r); setRefundReason(''); }} className="btn-outline flex-1 text-sm"><RotateCcw size={14} /> Refund Buyer</button>
                  </div>
                )}
                {!isSuper && r.status === 'held' && (
                  <p className="text-xs text-gray-500">Super admin required to release or refund.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {refundTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setRefundTarget(null)}>
          <div className="glass-gold rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-white">Refund Buyer</h3>
              <button onClick={() => setRefundTarget(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-3">Order #{refundTarget.order_id.slice(0, 8)} · {formatPrice(refundTarget.total_amount)}</p>
            <label className="label-field">Refund Reason (optional)</label>
            <textarea className="input-field mb-4" rows={3} placeholder="Reason for refund…" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={confirmRefund} className="btn-gold flex-1">Confirm Refund</button>
              <button onClick={() => setRefundTarget(null)} className="btn-outline">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function EscrowBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    held: 'bg-warning-500/15 text-warning-400',
    released: 'bg-success-500/15 text-success-400',
    refunded: 'bg-error-500/15 text-error-400',
    disputed: 'bg-error-500/15 text-error-400',
  };
  return <span className={`badge ${map[status] ?? 'bg-white/[0.06] text-gray-400'}`}>{status}</span>;
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 flex items-center gap-1.5">{icon} {label}</span>
      <span className="text-gray-200 font-medium">{value}</span>
    </div>
  );
}
