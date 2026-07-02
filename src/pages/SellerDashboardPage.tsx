import { useEffect, useState } from 'react';
import { navigate, Link } from '../lib/router';
import { useAuth } from '../lib/auth';
import { supabase, type AccountListingRow, type OrderRow, type ListingReviewRow, type Wallet, type WithdrawalRow } from '../lib/supabase';
import { paymentApi } from '../lib/payments';
import { useToast } from '../components/Toast';
import { GAMES, formatPrice, maskUid } from '../lib/data';
import { Plus, TrendingUp, Package, Clock, CheckCircle2, Star, Wallet as WalletIcon, ShoppingBag, Eye, BadgeCheck, ArrowUpRight, Percent, Truck, XCircle, Loader2 } from 'lucide-react';

type Tab = 'active' | 'pending' | 'sold' | 'orders' | 'withdrawals';

export function SellerDashboardPage() {
  const { user, profile, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('active');
  const [listings, setListings] = useState<AccountListingRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [reviews, setReviews] = useState<ListingReviewRow[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    if (!user) return;
    loadData();
  }, [user, loading]);

  const toast = useToast();

  async function loadData() {
    if (!user) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const [l, o, r, w, wd] = await Promise.all([
        supabase.from('account_listings').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
        supabase.from('listing_reviews').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
        supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      const errors = [l, o, r, w, wd].filter((q) => q.error);
      if (errors.length > 0) {
        setDataError(errors[0].error!.message);
      }

      setListings((l.data ?? []) as AccountListingRow[]);
      setOrders((o.data ?? []) as OrderRow[]);
      setReviews((r.data ?? []) as ListingReviewRow[]);
      setWallet(w.data as Wallet | null);
      setWithdrawals((wd.data ?? []) as WithdrawalRow[]);
    } catch (err: any) {
      setDataError(err?.message || 'Failed to load seller data.');
    } finally {
      setLoadingData(false);
    }
  }

  const markDelivered = async (orderId: string) => {
    try {
      await paymentApi.markDelivered(orderId);
      toast('success', 'Order marked as delivered. Buyer can now confirm receipt.');
      loadData();
    } catch (err: any) {
      toast('error', err.message || 'Failed to mark order as delivered.');
    }
  };

  if (loading) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;
  if (!user) return null;
  if (!profile) return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <div className="text-center max-w-md">
        <p className="text-error-400 font-semibold mb-2">Profile not found</p>
        <p className="text-sm text-gray-400 mb-4">Your profile could not be loaded. This may be a permissions issue. Try logging out and back in.</p>
        <button onClick={() => navigate('/login')} className="btn-gold">Go to Login</button>
      </div>
    </div>
  );
  if (loadingData) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading seller data...</div>;
  if (dataError) return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <div className="text-center max-w-md">
        <p className="text-error-400 font-semibold mb-2">Failed to load data</p>
        <p className="text-sm text-gray-400 mb-4">{dataError}</p>
        <button onClick={loadData} className="btn-gold">Retry</button>
      </div>
    </div>
  );

  const activeListings = listings.filter((l) => l.status === 'approved');
  const pendingListings = listings.filter((l) => l.status === 'pending');
  const soldListings = listings.filter((l) => orders.some((o) => o.listing_id === l.id && o.status === 'completed'));
  const pendingOrders = orders.filter((o) => o.escrow_status === 'held');
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const avgRating = reviews.length > 0 ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const availableBalance = wallet?.balance ?? 0;
  const pendingBalance = wallet?.pending_balance ?? 0;
  const totalEarnings = wallet?.total_earnings ?? 0;
  const totalCommission = completedOrders.reduce((a, o) => a + (o.seller_commission ?? 0), 0);
  const totalWithdrawn = wallet?.total_withdrawals ?? 0;

  const shownListings = tab === 'active' ? activeListings : tab === 'pending' ? pendingListings : tab === 'sold' ? soldListings : [];
  const shownOrders = tab === 'orders' ? orders : [];
  const shownWithdrawals = tab === 'withdrawals' ? withdrawals : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="section-eyebrow">Seller Dashboard</span>
          <h1 className="font-display text-3xl font-bold text-white">Seller Overview</h1>
          <p className="mt-1 text-sm text-gray-400">Manage your listings, orders, and earnings.</p>
        </div>
        <Link to="/sell" className="btn-gold text-sm">
          <Plus size={16} /> Sell New Account
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Package size={20} />} value={activeListings.length} label="Active Listings" />
        <StatCard icon={<Clock size={20} />} value={pendingListings.length} label="Pending Listings" />
        <StatCard icon={<ShoppingBag size={20} />} value={soldListings.length} label="Sold Listings" />
        <StatCard icon={<Star size={20} />} value={avgRating.toFixed(1)} label="Seller Rating" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<WalletIcon size={20} />} value={formatPrice(availableBalance)} label="Available Wallet" />
        <StatCard icon={<Clock size={20} />} value={formatPrice(pendingBalance)} label="Pending Wallet" />
        <StatCard icon={<TrendingUp size={20} />} value={formatPrice(totalEarnings)} label="Revenue" />
        <StatCard icon={<Percent size={20} />} value={formatPrice(totalCommission)} label="Commission Paid" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Clock size={20} />} value={pendingOrders.length} label="Pending Orders" />
        <StatCard icon={<CheckCircle2 size={20} />} value={completedOrders.length} label="Completed Orders" />
        <StatCard icon={<ArrowUpRight size={20} />} value={formatPrice(totalWithdrawn)} label="Withdrawals" />
        <StatCard icon={<ShoppingBag size={20} />} value={orders.length} label="Total Orders" />
      </div>

      {/* KYC Status Banner */}
      <KycStatusBanner kycStatus={profile.kyc_status} />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <TabBtn active={tab === 'active'} onClick={() => setTab('active')} label="Active Listings" count={activeListings.length} />
        <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')} label="Pending Listings" count={pendingListings.length} />
        <TabBtn active={tab === 'sold'} onClick={() => setTab('sold')} label="Sold Listings" count={soldListings.length} />
        <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')} label="Orders" count={orders.length} />
        <TabBtn active={tab === 'withdrawals'} onClick={() => setTab('withdrawals')} label="Withdrawals" count={withdrawals.length} />
      </div>

      {loadingData ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : tab === 'orders' ? (
        shownOrders.length === 0 ? (
          <EmptyState icon={<ShoppingBag size={32} />} text="No orders yet" />
        ) : (
          <div className="space-y-3">
            {shownOrders.map((o) => {
              const listing = listings.find((l) => l.id === o.listing_id);
              return (
                <div key={o.id} className="glass rounded-xl p-4 flex items-center gap-4">
                  {listing && <img src={listing.profile_image} alt="" className="w-14 h-14 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{listing?.title ?? 'Unknown listing'}</p>
                    <p className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gold-300">{formatPrice(o.amount)}</p>
                    <span className={`badge text-[10px] ${
                      o.status === 'completed' ? 'bg-success-500/15 text-success-400' :
                      o.status === 'pending' ? 'bg-warning-500/15 text-warning-400' :
                      'bg-error-500/15 text-error-400'
                    }`}>{o.status}</span>
                    {o.delivery_status === 'pending' && o.status === 'payment_successful' && (
                      <button
                        onClick={() => markDelivered(o.id)}
                        className="btn-gold text-xs mt-2 px-3 py-1.5"
                      >
                        <Truck size={13} /> Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === 'withdrawals' ? (
        shownWithdrawals.length === 0 ? (
          <EmptyState icon={<ArrowUpRight size={32} />} text="No withdrawals yet" />
        ) : (
          <div className="space-y-3">
            {shownWithdrawals.map((w) => (
              <div key={w.id} className="glass rounded-xl p-4 flex items-center gap-4">
                <span className={`grid place-items-center w-10 h-10 rounded-lg ${w.status === 'completed' ? 'bg-success-500/10 text-success-400' : w.status === 'rejected' ? 'bg-error-500/10 text-error-400' : 'bg-warning-500/10 text-warning-400'}`}>
                  <ArrowUpRight size={18} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{w.upi_id}</p>
                  <p className="text-xs text-gray-500">{new Date(w.created_at).toLocaleString('en-IN')}</p>
                  {w.reason && <p className="text-xs text-error-400 mt-0.5">{w.reason}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gold-300">{formatPrice(w.amount)}</p>
                  <span className={`badge text-[10px] ${w.status === 'completed' ? 'bg-success-500/15 text-success-400' : w.status === 'rejected' ? 'bg-error-500/15 text-error-400' : 'bg-warning-500/15 text-warning-400'}`}>{w.status}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : shownListings.length === 0 ? (
        <EmptyState icon={<Package size={32} />} text={`No ${tab} listings yet`} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {shownListings.map((l) => {
            const game = GAMES[l.game];
            return (
              <div key={l.id} className="glass glass-hover rounded-2xl overflow-hidden cursor-pointer" onClick={() => navigate(`/account/${l.id}`)}>
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img src={l.profile_image} alt={l.title} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    <span className={`badge bg-ink-950/70 backdrop-blur text-[10px] ${game.accent}`}>{game.name}</span>
                    {l.status === 'pending' && <span className="badge bg-warning-500/90 text-ink-950 text-[10px]">Pending</span>}
                    {l.status === 'rejected' && <span className="badge bg-error-500/90 text-white text-[10px]">Rejected</span>}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-white line-clamp-1">{l.title}</h3>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1"><Eye size={11} /> {maskUid(l.uid)}</span>
                    <span className="inline-flex items-center gap-1"><Star size={11} className="text-gold-400" /> Lv {l.account_level}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-white/[0.06]">
                    <span className="font-display font-bold text-gold-300">{formatPrice(l.price)}</span>
                    <span className="text-xs text-gray-500">{l.views} views</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="glass rounded-2xl py-16 text-center">
      <span className="inline-grid place-items-center text-gray-600">{icon}</span>
      <p className="mt-3 text-gray-400">{text}</p>
      <Link to="/sell" className="btn-outline mt-4 text-sm"><Plus size={15} /> Create Listing</Link>
    </div>
  );
}

function KycStatusBanner({ kycStatus }: { kycStatus: string }) {
  const config = {
    approved: { bg: 'bg-success-500/10', border: 'border-success-500/20', icon: <BadgeCheck size={20} className="text-success-400" />, title: 'KYC Verified', desc: 'Your identity is verified. You can sell on the marketplace.' },
    pending: { bg: 'bg-warning-500/10', border: 'border-warning-500/20', icon: <Loader2 size={20} className="text-warning-400 animate-spin" />, title: 'KYC Under Review', desc: 'Your KYC is being reviewed. You can list accounts but cannot sell until approved.' },
    rejected: { bg: 'bg-error-500/10', border: 'border-error-500/20', icon: <XCircle size={20} className="text-error-400" />, title: 'KYC Rejected', desc: 'Your KYC was rejected. Please resubmit with correct information.' },
    not_submitted: { bg: 'glass', border: 'border-warning-500/20', icon: <BadgeCheck size={20} className="text-warning-400" />, title: 'Complete KYC Verification', desc: 'You need to complete KYC to list accounts on the marketplace.' },
  };
  const c = (config as any)[kycStatus] || config.not_submitted;

  return (
    <div className={`rounded-2xl p-5 mb-6 flex items-center gap-4 border ${c.bg} ${c.border}`}>
      <span className="grid place-items-center w-10 h-10 rounded-lg bg-white/[0.04] shrink-0">
        {c.icon}
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{c.title}</p>
        <p className="text-xs text-gray-400">{c.desc}</p>
      </div>
      {kycStatus !== 'approved' && (
        <Link to="/kyc" className="btn-outline text-sm whitespace-nowrap">
          {kycStatus === 'not_submitted' ? 'Complete KYC' : 'View KYC'}
        </Link>
      )}
    </div>
  );
}
