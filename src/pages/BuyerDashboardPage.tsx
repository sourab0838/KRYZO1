import { useEffect, useState } from 'react';
import { navigate, Link } from '../lib/router';
import { useAuth } from '../lib/auth';
import { supabase, type AccountListingRow, type OrderRow, type WishlistRow, type Wallet, type WalletTransactionRow } from '../lib/supabase';
import { GAMES, formatPrice, maskUid } from '../lib/data';
import { useToast } from '../components/Toast';
import { createNotification } from '../lib/notify';
import { ShoppingBag, Heart, Clock, Bookmark, Eye, ArrowRight, BadgeCheck, Trophy, Wallet as WalletIcon, Receipt, CheckCircle2, AlertTriangle, X } from 'lucide-react';

type Tab = 'purchased' | 'wishlist' | 'orders' | 'saved';

export function BuyerDashboardPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('purchased');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [wishlist, setWishlist] = useState<WishlistRow[]>([]);
  const [wishlistListings, setWishlistListings] = useState<AccountListingRow[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    if (!user) return;
    (async () => {
      try {
        const [o, w, wt, wtx] = await Promise.all([
          supabase.from('orders').select('*').eq('buyer_id', user.id).order('created_at', { ascending: false }),
          supabase.from('listing_wishlists').select('*, listing:account_listings(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
        ]);
        setOrders((o.data ?? []) as OrderRow[]);
        const wData = (w.data ?? []) as any[];
        setWishlist(wData.map((d) => ({ id: d.id, user_id: d.user_id, listing_id: d.listing_id, created_at: d.created_at })));
        setWishlistListings(wData.map((d) => d.listing).filter(Boolean) as AccountListingRow[]);
        setWallet(wt.data as Wallet | null);
        setTransactions((wtx.data ?? []) as WalletTransactionRow[]);
      } catch {
        /* loading completes regardless of query success */
      } finally {
        setLoadingData(false);
      }
    })();
  }, [user, loading]);

  if (loading || !user) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;

  const purchasedListings = orders.filter((o) => o.status === 'completed' || o.status === 'pending');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="mb-8">
        <span className="section-eyebrow">Buyer Dashboard</span>
        <h1 className="font-display text-3xl font-bold text-white">My Activity</h1>
        <p className="mt-1 text-sm text-gray-400">Track your purchases, wishlist, and saved listings.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<ShoppingBag size={20} />} value={purchasedListings.length} label="Purchased Accounts" />
        <StatCard icon={<WalletIcon size={20} />} value={formatPrice(wallet?.balance ?? 0)} label="Wallet Balance" />
        <StatCard icon={<Clock size={20} />} value={orders.length} label="Order History" />
        <StatCard icon={<Receipt size={20} />} value={transactions.length} label="Transactions" />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <TabBtn active={tab === 'purchased'} onClick={() => setTab('purchased')} label="Purchased Accounts" count={purchasedListings.length} />
        <TabBtn active={tab === 'wishlist'} onClick={() => setTab('wishlist')} label="Wishlist" count={wishlist.length} />
        <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')} label="Order History" count={orders.length} />
        <TabBtn active={tab === 'saved'} onClick={() => setTab('saved')} label="Saved Listings" count={0} />
      </div>

      {loadingData ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : tab === 'purchased' ? (
        purchasedListings.length === 0 ? (
          <EmptyState icon={<ShoppingBag size={32} />} text="No purchases yet" cta="Browse Marketplace" to="/marketplace" />
        ) : (
          <div className="space-y-3">
            {purchasedListings.map((o) => (
              <OrderRow key={o.id} order={o} setOrders={setOrders} />
            ))}
          </div>
        )
      ) : tab === 'wishlist' ? (
        wishlistListings.length === 0 ? (
          <EmptyState icon={<Heart size={32} />} text="Your wishlist is empty" cta="Browse Marketplace" to="/marketplace" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {wishlistListings.map((l) => <MiniListingCard key={l.id} listing={l} />)}
          </div>
        )
      ) : tab === 'orders' ? (
        orders.length === 0 ? (
          <EmptyState icon={<Clock size={32} />} text="No order history" cta="Browse Marketplace" to="/marketplace" />
        ) : (
          <div className="space-y-3">
            {orders.map((o) => <OrderRow key={o.id} order={o} setOrders={setOrders} />)}
          </div>
        )
      ) : (
        <EmptyState icon={<Bookmark size={32} />} text="No saved listings" cta="Browse Marketplace" to="/marketplace" />
      )}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="glass glass-hover rounded-2xl p-5">
      <span className="grid place-items-center w-10 h-10 rounded-lg bg-gold-400/10 text-gold-400">{icon}</span>
      <p className="mt-3 font-display text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-gold-gradient text-ink-950' : 'glass text-gray-300 hover:text-gold-300'}`}>
      {label} <span className={`text-xs ${active ? 'text-ink-900/60' : 'text-gray-500'}`}>({count})</span>
    </button>
  );
}

function EmptyState({ icon, text, cta, to }: { icon: React.ReactNode; text: string; cta: string; to: string }) {
  return (
    <div className="glass rounded-2xl py-16 text-center">
      <span className="inline-grid place-items-center text-gray-600">{icon}</span>
      <p className="mt-3 text-gray-400">{text}</p>
      <Link to={to} className="btn-outline mt-4 text-sm">{cta} <ArrowRight size={15} /></Link>
    </div>
  );
}

function OrderRow({ order, setOrders }: { order: OrderRow; setOrders: React.Dispatch<React.SetStateAction<OrderRow[]>> }) {
  const toast = useToast();
  const [listing, setListing] = useState<AccountListingRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('account_listings').select('*').eq('id', order.listing_id).maybeSingle();
      setListing(data as AccountListingRow | null);
    })();
  }, [order.listing_id]);

  const canAct = order.delivery_status === 'delivered' && order.status !== 'completed' && order.status !== 'disputed';

  const confirmReceipt = async () => {
    setConfirming(true);
    try {
      const { error } = await supabase.rpc('confirm_receipt', { p_order_id: order.id });
      if (error) throw new Error(error.message);
      toast('success', 'Receipt confirmed! Escrow funds released to seller.');
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: 'completed', delivery_status: 'confirmed', escrow_status: 'released' } : o));
    } catch (err: any) {
      toast('error', err.message || 'Failed to confirm receipt.');
    } finally {
      setConfirming(false);
    }
  };

  const submitDispute = async () => {
    if (!disputeReason.trim()) { toast('info', 'Please describe the problem.'); return; }
    setSubmittingDispute(true);
    try {
      const { error } = await supabase.from('orders').update({
        status: 'disputed',
        escrow_status: 'disputed',
        delivery_status: 'disputed',
        dispute_reason: disputeReason.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      if (error) throw error;
      await supabase.from('escrow_holds').update({ status: 'disputed' }).eq('order_id', order.id);
      // Notify admins
      try {
        const { data: admins } = await supabase.from('admin_roles').select('user_id');
        const adminIds = (admins ?? []).map((a: any) => a.user_id).filter(Boolean);
        for (const adminId of adminIds) {
          await createNotification(adminId, 'support', 'Order Dispute Opened', `Order ${order.id} was disputed by the buyer. Reason: ${disputeReason.trim().slice(0, 180)}`);
        }
      } catch { /* non-fatal */ }
      toast('success', 'Dispute opened. Our team will review and contact you shortly.');
      order.status = 'disputed';
      order.escrow_status = 'disputed';
      order.delivery_status = 'disputed';
      setShowDispute(false);
      setDisputeReason('');
    } catch (err: any) {
      toast('error', err.message || 'Failed to open dispute.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-4">
        {listing && <img src={listing.profile_image} alt="" className="w-14 h-14 rounded-lg object-cover" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{listing?.title ?? 'Loading...'}</p>
          <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString('en-IN')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gold-300">{formatPrice(order.amount)}</p>
          <span className={`badge text-[10px] ${
            order.status === 'completed' ? 'bg-success-500/15 text-success-400' :
            order.status === 'disputed' ? 'bg-error-500/15 text-error-400' :
            order.status === 'pending' ? 'bg-warning-500/15 text-warning-400' :
            'bg-error-500/15 text-error-400'
          }`}>{order.status}</span>
        </div>
      </div>
      {canAct && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button onClick={confirmReceipt} disabled={confirming} className="btn-gold text-sm">
            {confirming ? 'Confirming...' : <><CheckCircle2 size={15} /> Confirm Receipt</>}
          </button>
          <button onClick={() => setShowDispute(true)} className="btn-outline text-sm !border-error-500/40 !text-error-400 hover:!bg-error-500/10">
            <AlertTriangle size={15} /> Report Problem
          </button>
        </div>
      )}
      {showDispute && (
        <div className="mt-3 rounded-lg border border-error-500/30 bg-error-500/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-white">Describe the problem</p>
            <button onClick={() => setShowDispute(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
          </div>
          <textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            rows={3}
            placeholder="Describe the issue with this order..."
            className="w-full rounded-lg bg-ink-950/60 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold-400/50"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setShowDispute(false)} className="btn-ghost text-sm">Cancel</button>
            <button onClick={submitDispute} disabled={submittingDispute} className="btn-gold text-sm">
              {submittingDispute ? 'Submitting...' : <><AlertTriangle size={15} /> Open Dispute</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniListingCard({ listing }: { listing: AccountListingRow }) {
  const game = GAMES[listing.game];
  return (
    <div className="glass glass-hover rounded-2xl overflow-hidden cursor-pointer" onClick={() => navigate(`/account/${listing.id}`)}>
      <div className="relative aspect-[16/10] overflow-hidden">
        <img src={listing.profile_image} alt={listing.title} className="w-full h-full object-cover" />
        <span className={`absolute top-2 left-2 badge bg-ink-950/70 backdrop-blur text-[10px] ${game.accent}`}>{game.name}</span>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-semibold text-white line-clamp-1">{listing.title}</h3>
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1"><Trophy size={11} className="text-gold-400" /> {listing.br_rank}</span>
          <span className="inline-flex items-center gap-1"><Eye size={11} /> {maskUid(listing.uid)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <span className="font-display font-bold text-gold-300">{formatPrice(listing.price)}</span>
          <span className="inline-flex items-center gap-1 text-xs text-gold-400"><BadgeCheck size={12} /> Verified</span>
        </div>
      </div>
    </div>
  );
}
