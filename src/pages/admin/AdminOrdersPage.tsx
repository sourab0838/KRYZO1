import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { formatPrice } from '../../lib/data';
import type { OrderRow } from '../../lib/supabase';
import {
  ShoppingCart, Package, Clock, CheckCircle2, XCircle, AlertTriangle, Eye,
  User, DollarSign, ArrowDownLeft, Filter, X, ChevronDown, Unlock, RotateCcw
} from 'lucide-react';

type OrderStatus = 'pending' | 'payment_successful' | 'awaiting_delivery' | 'buyer_reviewing' | 'completed' | 'cancelled' | 'disputed';
type EscrowStatus = 'none' | 'held' | 'released' | 'refunded' | 'disputed';

interface OrderWithParties {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: OrderStatus;
  escrow_status?: EscrowStatus;
  delivery_status?: string;
  platform_fee?: number;
  seller_commission?: number;
  seller_payout?: number;
  created_at: string;
  updated_at: string;
  buyer?: { full_name: string; username: string; email: string };
  seller?: { full_name: string; username: string; email: string };
  listing?: { title: string; game: string };
}

const FILTERS: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All Orders', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Payment Done', value: 'payment_successful' },
  { label: 'Awaiting Delivery', value: 'awaiting_delivery' },
  { label: 'Buyer Reviewing', value: 'buyer_reviewing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Disputed', value: 'disputed' },
];

export function AdminOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<OrderWithParties[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithParties | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OrderWithParties | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getOrders(filter === 'all' ? undefined : filter);
      setOrders((data ?? []) as OrderWithParties[]);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-dep

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setChecking(false);
      load();
    })();
  }, [load]);

  const updateStatus = async (orderId: string, status: string, reason?: string) => {
    setActing(orderId);
    try {
      const { error } = await adminApi.updateOrderStatus(orderId, status, reason);
      if (error) throw error;
      toast('success', `Order status updated to ${status}`);
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to update order');
    } finally {
      setActing(null);
    }
  };

  const handleCancel = () => {
    if (cancelTarget) {
      updateStatus(cancelTarget.id, 'cancelled', cancelReason || undefined);
    }
    setShowCancelModal(false);
    setCancelTarget(null);
    setCancelReason('');
  };

  const openCancelModal = (order: OrderWithParties) => {
    setCancelTarget(order);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const openOrderDetails = async (order: OrderWithParties) => {
    setActing(order.id);
    try {
      const details = await adminApi.getOrderDetails(order.id);
      setSelectedOrder({ ...order, ...details });
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load order details');
    } finally {
      setActing(null);
    }
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access...</div>;

  const filteredCount = {
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    payment_successful: orders.filter(o => o.status === 'payment_successful').length,
    awaiting_delivery: orders.filter(o => o.status === 'awaiting_delivery').length,
    buyer_reviewing: orders.filter(o => o.status === 'buyer_reviewing').length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    disputed: orders.filter(o => o.status === 'disputed').length,
  };

  return (
    <AdminLayout currentPath="/admin/orders">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-2">
          <ShoppingCart className="text-gold-400" /> Order Management
        </h1>
        <p className="text-sm text-gray-400 mb-6">Manage all marketplace orders, track status, and handle disputes.</p>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)} className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${filter === f.value ? 'bg-gold-400/10 text-gold-300 border border-gold-400/20' : 'text-gray-400 border border-white/10 hover:text-white'}`}>
              {f.label} {f.value !== 'all' && `(${filteredCount[f.value as OrderStatus] ?? 0})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-gray-500">No orders found.</div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="glass glass-hover rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <p className="font-semibold text-white">Order #{o.id.slice(0, 8)}</p>
                    <StatusBadge status={o.status} />
                    {o.escrow_status && <EscrowBadge status={o.escrow_status} />}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Listing</p>
                      <p className="text-gray-200 truncate">{o.listing?.title || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Buyer</p>
                      <p className="text-gray-200 truncate">{o.buyer?.full_name || o.buyer?.username || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Seller</p>
                      <p className="text-gray-200 truncate">{o.seller?.full_name || o.seller?.username || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Amount</p>
                      <p className="text-gold-300 font-bold">{formatPrice(o.amount)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>

                <div className="flex flex-wrap gap-2 lg:shrink-0">
                  <button disabled={acting === o.id} onClick={() => openOrderDetails(o)} className="btn-ghost px-3 py-1.5 text-xs"><Eye size={14} /> Details</button>
                  {o.status !== 'completed' && o.status !== 'cancelled' && (
                    <button disabled={acting === o.id} onClick={() => openCancelModal(o)} className="btn-outline px-3 py-1.5 text-xs"><XCircle size={14} /> Cancel</button>
                  )}
                  {o.status === 'payment_successful' && (
                    <button disabled={acting === o.id} onClick={() => updateStatus(o.id, 'awaiting_delivery')} className="btn-gold px-3 py-1.5 text-xs"><Package size={14} /> Mark Awaiting</button>
                  )}
                  {o.status === 'buyer_reviewing' && (
                    <button disabled={acting === o.id} onClick={() => updateStatus(o.id, 'completed')} className="btn-gold px-3 py-1.5 text-xs"><CheckCircle2 size={14} /> Complete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedOrder(null)}>
          <div className="glass-gold rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-white">Order #{selectedOrder.id.slice(0, 8)}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={selectedOrder.status} />
                {selectedOrder.escrow_status && <EscrowBadge status={selectedOrder.escrow_status} />}
                {selectedOrder.delivery_status && <span className="badge bg-white/[0.06] text-gray-300">{selectedOrder.delivery_status}</span>}
              </div>

              <div className="divider-gold" />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Stat icon={<DollarSign size={14} />} label="Amount" value={formatPrice(selectedOrder.amount)} gold />
                <Stat icon={<ArrowDownLeft size={14} />} label="Platform Fee" value={formatPrice(selectedOrder.platform_fee ?? 0)} />
                <Stat icon={<ArrowDownLeft size={14} />} label="Commission" value={formatPrice(selectedOrder.seller_commission ?? 0)} />
                <Stat icon={<Unlock size={14} />} label="Seller Payout" value={formatPrice(selectedOrder.seller_payout ?? 0)} />
              </div>

              <div className="glass rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-2">Listing</p>
                <p className="font-semibold text-white">{selectedOrder.listing?.title || 'Unknown'}</p>
                <p className="text-xs text-gray-400 capitalize">{selectedOrder.listing?.game || 'Unknown game'}</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="glass rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><User size={12} /> Buyer</p>
                  <p className="font-semibold text-white">{selectedOrder.buyer?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">@{selectedOrder.buyer?.username || 'N/A'}</p>
                  <p className="text-xs text-gray-500">{selectedOrder.buyer?.email || 'N/A'}</p>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><User size={12} /> Seller</p>
                  <p className="font-semibold text-white">{selectedOrder.seller?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">@{selectedOrder.seller?.username || 'N/A'}</p>
                  <p className="text-xs text-gray-500">{selectedOrder.seller?.email || 'N/A'}</p>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Created: {new Date(selectedOrder.created_at).toLocaleString()} | Updated: {new Date(selectedOrder.updated_at).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {showCancelModal && cancelTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowCancelModal(false)}>
          <div className="glass-gold rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-white">Cancel Order</h3>
              <button onClick={() => setShowCancelModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-3">Order #{cancelTarget.id.slice(0, 8)} - {formatPrice(cancelTarget.amount)}</p>
            <label className="label-field">Cancellation Reason (optional)</label>
            <textarea className="input-field mb-4" rows={3} placeholder="Reason for cancellation..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={handleCancel} className="btn-gold flex-1">Confirm Cancel</button>
              <button onClick={() => setShowCancelModal(false)} className="btn-outline">Dismiss</button>
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
    payment_successful: { cls: 'bg-blue-500/15 text-blue-400', icon: <CheckCircle2 size={11} /> },
    awaiting_delivery: { cls: 'bg-purple-500/15 text-purple-400', icon: <Package size={11} /> },
    buyer_reviewing: { cls: 'bg-cyan-500/15 text-cyan-400', icon: <Eye size={11} /> },
    completed: { cls: 'bg-success-500/15 text-success-400', icon: <CheckCircle2 size={11} /> },
    cancelled: { cls: 'bg-error-500/15 text-error-400', icon: <XCircle size={11} /> },
    disputed: { cls: 'bg-error-500/20 text-error-400 border border-error-500/30', icon: <AlertTriangle size={11} /> },
  };
  const m = map[status] ?? { cls: 'bg-white/[0.06] text-gray-400', icon: <Clock size={11} /> };
  return <span className={`badge ${m.cls}`}>{m.icon} {status.replace('_', ' ')}</span>;
}

function EscrowBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    none: 'bg-gray-500/15 text-gray-400',
    held: 'bg-warning-500/15 text-warning-400',
    released: 'bg-success-500/15 text-success-400',
    refunded: 'bg-blue-500/15 text-blue-400',
    disputed: 'bg-error-500/15 text-error-400',
  };
  return <span className={`badge ${map[status] ?? map.none}`}>Escrow: {status}</span>;
}

function Stat({ icon, label, value, gold }: { icon: React.ReactNode; label: string; value: string; gold?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-gold-400 flex items-center justify-center gap-1 mb-1 ${gold ? 'text-base' : 'text-xs'}`}>{icon}</p>
      <p className={`font-bold ${gold ? 'gold-text text-lg' : 'text-white text-sm'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}