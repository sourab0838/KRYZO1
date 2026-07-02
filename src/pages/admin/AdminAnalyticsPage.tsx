import { useEffect, useState } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { checkAdminRole } from '../../lib/admin';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../lib/data';
import {
  BarChart3, TrendingUp, ShoppingBag, Eye, Crown, Wallet, ArrowDownLeft, ArrowUpRight,
  ShieldCheck, FileClock, FileCheck2, FileX2, Loader2, Users, Package,
} from 'lucide-react';

interface ProfileName { id: string; username: string | null; full_name: string | null; }

export function AdminAnalyticsPage() {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [topSellers, setTopSellers] = useState<{ id: string; name: string; sales: number; revenue: number }[]>([]);
  const [topBuyers, setTopBuyers] = useState<{ id: string; name: string; orders: number; spent: number }[]>([]);
  const [topListings, setTopListings] = useState<{ id: string; title: string; views: number }[]>([]);
  const [mostSold, setMostSold] = useState<{ game: string; count: number }[]>([]);
  const [kycStats, setKycStats] = useState<Record<string, number>>({});
  const [walletStats, setWalletStats] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const r = await checkAdminRole();
      if (!r) { navigate('/dashboard'); return; }
      setChecking(false);
      try {
        await Promise.all([loadSellers(), loadBuyers(), loadListings(), loadMostSold(), loadKyc(), loadWallet()]);
      } catch (e: any) {
        toast('error', e?.message ?? 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nameMap = async (ids: string[]): Promise<Record<string, string>> => {
    if (ids.length === 0) return {};
    const { data } = await supabase.from('profiles').select('id, username, full_name').in('id', ids);
    const map: Record<string, string> = {};
    (data as ProfileName[] | null)?.forEach((p) => { map[p.id] = p.username || p.full_name || p.id.slice(0, 8); });
    return map;
  };

  const loadSellers = async () => {
    const { data } = await supabase.from('orders').select('seller_id, seller_payout').eq('status', 'completed');
    const agg: Record<string, { sales: number; revenue: number }> = {};
    (data ?? []).forEach((o: any) => {
      const id = o.seller_id as string;
      if (!id) return;
      agg[id] = agg[id] || { sales: 0, revenue: 0 };
      agg[id].sales += 1;
      agg[id].revenue += Number(o.seller_payout) || 0;
    });
    const sorted = Object.entries(agg).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);
    const names = await nameMap(sorted.map(([id]) => id));
    setTopSellers(sorted.map(([id, v]) => ({ id, name: names[id] ?? id.slice(0, 8), ...v })));
  };

  const loadBuyers = async () => {
    const { data } = await supabase.from('orders').select('buyer_id, amount').eq('status', 'completed');
    const agg: Record<string, { orders: number; spent: number }> = {};
    (data ?? []).forEach((o: any) => {
      const id = o.buyer_id as string;
      if (!id) return;
      agg[id] = agg[id] || { orders: 0, spent: 0 };
      agg[id].orders += 1;
      agg[id].spent += Number(o.amount) || 0;
    });
    const sorted = Object.entries(agg).sort((a, b) => b[1].spent - a[1].spent).slice(0, 10);
    const names = await nameMap(sorted.map(([id]) => id));
    setTopBuyers(sorted.map(([id, v]) => ({ id, name: names[id] ?? id.slice(0, 8), ...v })));
  };

  const loadListings = async () => {
    const { data } = await supabase.from('account_listings').select('id, title, views').order('views', { ascending: false }).limit(10);
    setTopListings((data ?? []).map((l: any) => ({ id: l.id, title: l.title, views: l.views ?? 0 })));
  };

  const loadMostSold = async () => {
    const { data } = await supabase.from('account_listings').select('game').eq('status', 'sold');
    const agg: Record<string, number> = {};
    (data ?? []).forEach((l: any) => { const g = l.game ?? 'unknown'; agg[g] = (agg[g] || 0) + 1; });
    setMostSold(Object.entries(agg).sort((a, b) => b[1] - a[1]).map(([game, count]) => ({ game, count })));
  };

  const loadKyc = async () => {
    const { data } = await supabase.from('kyc_requests').select('status');
    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: any) => { const s = r.status ?? 'unknown'; agg[s] = (agg[s] || 0) + 1; });
    setKycStats(agg);
  };

  const loadWallet = async () => {
    const { data } = await supabase.from('wallet_transactions').select('type, amount');
    const agg: Record<string, number> = {};
    (data ?? []).forEach((t: any) => { const ty = t.type ?? 'unknown'; agg[ty] = (agg[ty] || 0) + (Number(t.amount) || 0); });
    setWalletStats(agg);
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access…</div>;

  return (
    <AdminLayout currentPath="/admin/analytics">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-1">Analytics</h1>
        <p className="text-sm text-gray-400 mb-6">Platform performance insights and rankings.</p>

        {loading ? (
          <div className="py-20 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" /> Loading analytics…
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <Card title="Top Sellers" icon={<TrendingUp size={16} />} subtitle="By revenue (completed orders)">
              <RankList items={topSellers.map((s, i) => ({ rank: i + 1, name: s.name, sub: `${s.sales} sales`, value: formatPrice(s.revenue) }))} />
            </Card>

            <Card title="Top Buyers" icon={<ShoppingBag size={16} />} subtitle="By spend (completed orders)">
              <RankList items={topBuyers.map((b, i) => ({ rank: i + 1, name: b.name, sub: `${b.orders} orders`, value: formatPrice(b.spent) }))} />
            </Card>

            <Card title="Top Listings" icon={<Eye size={16} />} subtitle="Most viewed">
              <RankList items={topListings.map((l, i) => ({ rank: i + 1, name: l.title, sub: '', value: `${l.views} views` }))} />
            </Card>

            <Card title="Most Sold" icon={<Package size={16} />} subtitle="By game (sold listings)">
              {mostSold.length === 0 ? <Empty /> : (
                <ul className="space-y-2">
                  {mostSold.map((m, i) => (
                    <li key={m.game} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                      <span className="flex items-center gap-2 text-sm text-gray-200">
                        <span className="grid place-items-center w-6 h-6 rounded-md bg-gold-400/10 text-gold-300 text-xs font-bold">{i + 1}</span>
                        {m.game}
                      </span>
                      <span className="badge bg-white/[0.04] text-gray-300 border border-white/[0.06]">{m.count} sold</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="KYC Stats" icon={<ShieldCheck size={16} />} subtitle="By status">
              <div className="grid grid-cols-3 gap-3">
                <StatBox icon={FileClock} label="Pending" value={kycStats['pending'] ?? 0} />
                <StatBox icon={FileCheck2} label="Approved" value={kycStats['approved'] ?? 0} />
                <StatBox icon={FileX2} label="Rejected" value={kycStats['rejected'] ?? 0} />
              </div>
            </Card>

            <Card title="Wallet Stats" icon={<Wallet size={16} />} subtitle="Total by transaction type">
              {Object.keys(walletStats).length === 0 ? <Empty /> : (
                <ul className="space-y-2">
                  {Object.entries(walletStats).map(([type, amt]) => (
                    <li key={type} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                      <span className="flex items-center gap-2 text-sm text-gray-200 capitalize">
                        {type.includes('deposit') || type.includes('credit') ? <ArrowDownLeft size={14} className="text-success-400" /> : <ArrowUpRight size={14} className="text-error-400" />}
                        {type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-semibold text-white">{formatPrice(amt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Card({ title, icon, subtitle, children }: { title: string; icon: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass glass-hover rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gold-400">{icon}</span>
        <h2 className="font-display text-lg font-bold text-white">{title}</h2>
      </div>
      {subtitle && <p className="text-xs text-gray-400 mb-4">{subtitle}</p>}
      <div className="divider-gold mb-4" />
      {children}
    </div>
  );
}

function RankList({ items }: { items: { rank: number; name: string; sub?: string; value: string }[] }) {
  if (items.length === 0) return <Empty />;
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.rank} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
          <span className="flex items-center gap-3 min-w-0">
            <span className={`grid place-items-center w-7 h-7 rounded-md text-xs font-bold shrink-0 ${it.rank === 1 ? 'bg-gold-gradient text-ink-950' : 'bg-white/[0.04] text-gray-300'}`}>
              {it.rank === 1 ? <Crown size={13} /> : it.rank}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-white truncate">{it.name}</span>
              {it.sub && <span className="block text-xs text-gray-500">{it.sub}</span>}
            </span>
          </span>
          <span className="text-sm font-semibold text-gold-300 shrink-0 ml-2">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}

function StatBox({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 text-center">
      <Icon size={16} className="mx-auto text-gold-400 mb-1" />
      <p className="font-display text-lg font-bold text-white">{value}</p>
      <p className="text-[11px] text-gray-400">{label}</p>
    </div>
  );
}

function Empty() {
  return <div className="py-6 text-center text-sm text-gray-500 flex items-center justify-center gap-2"><BarChart3 size={16} /> No data available</div>;
}
