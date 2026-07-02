import { useEffect, useState } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { getDashboardStats, checkAdminRole } from '../../lib/admin';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import type { DashboardStats, FraudFlagRow, FraudSeverity, FraudType } from '../../lib/supabase';
import {
  Users, UserCheck, ShieldCheck, BadgeCheck, FileClock, FileCheck2, FileX2,
  Package, Clock, ShoppingBag, ShoppingCart, CheckCircle2, XCircle, AlertTriangle,
  Wallet, ArrowDownLeft, ArrowUpRight, Lock, Percent, IndianRupee,
  Calendar, CalendarDays, CalendarRange, CalendarClock, type LucideIcon,
} from 'lucide-react';

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function AdminDashboardPage() {
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [fraudFlags, setFraudFlags] = useState<FraudFlagRow[]>([]);
  const [fraudLoading, setFraudLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setChecking(false);
      try {
        const s = await getDashboardStats();
        setStats(s);
      } catch (e: any) {
        toast('error', e?.message ?? 'Failed to load stats');
      } finally {
        setLoading(false);
      }

      // Fetch unresolved fraud flags
      try {
        const { data, error } = await supabase
          .from('fraud_flags')
          .select('*')
          .eq('resolved', false)
          .order('created_at', { ascending: false })
          .limit(10);
        if (error) throw error;
        setFraudFlags((data as FraudFlagRow[]) ?? []);
      } catch (e: any) {
        toast('error', e?.message ?? 'Failed to load fraud alerts');
      } finally {
        setFraudLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveFlag = async (flagId: string) => {
    setResolvingId(flagId);
    try {
      const { error } = await supabase.rpc('resolve_fraud_flag', { p_flag_id: flagId });
      if (error) throw error;
      setFraudFlags((prev) => prev.filter((f) => f.id !== flagId));
      toast('success', 'Fraud flag resolved');
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to resolve flag');
    } finally {
      setResolvingId(null);
    }
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access…</div>;

  return (
    <AdminLayout currentPath="/admin/dashboard">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-6">Dashboard Overview</h1>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading statistics…</div>
        ) : stats ? (
          <div className="space-y-8">
            <Section title="User Overview" icon={<Users size={16} />}>
              <StatCard icon={Users} label="Total Users" value={stats.total_users} />
              <StatCard icon={UserCheck} label="Total Buyers" value={stats.total_buyers} />
              <StatCard icon={BadgeCheck} label="Total Sellers" value={stats.total_sellers} />
              <StatCard icon={ShieldCheck} label="Verified Sellers" value={stats.verified_sellers} />
            </Section>

            <Section title="KYC Statistics" icon={<FileCheck2 size={16} />}>
              <StatCard icon={FileClock} label="Pending KYC" value={stats.pending_kyc} />
              <StatCard icon={FileCheck2} label="Approved KYC" value={stats.approved_kyc} />
              <StatCard icon={FileX2} label="Rejected KYC" value={stats.rejected_kyc} />
            </Section>

            <Section title="Listings & Orders" icon={<Package size={16} />}>
              <StatCard icon={Package} label="Active Listings" value={stats.active_listings} />
              <StatCard icon={Clock} label="Pending Listings" value={stats.pending_listings} />
              <StatCard icon={ShoppingBag} label="Sold Listings" value={stats.sold_listings} />
              <StatCard icon={ShoppingCart} label="Total Orders" value={stats.total_orders} />
              <StatCard icon={Clock} label="Pending Orders" value={stats.pending_orders} />
              <StatCard icon={CheckCircle2} label="Completed Orders" value={stats.completed_orders} />
              <StatCard icon={XCircle} label="Cancelled Orders" value={stats.cancelled_orders} />
              <StatCard icon={AlertTriangle} label="Disputed Orders" value={stats.disputed_orders} />
            </Section>

            <Section title="Revenue & Wallet" icon={<IndianRupee size={16} />}>
              <StatCard icon={ArrowDownLeft} label="Wallet Deposits" value={fmt(stats.wallet_deposits)} />
              <StatCard icon={ArrowUpRight} label="Wallet Withdrawals" value={fmt(stats.wallet_withdrawals)} />
              <StatCard icon={Lock} label="Escrow Balance" value={fmt(stats.escrow_balance)} />
              <StatCard icon={Percent} label="Buyer Platform Fee Revenue" value={fmt(stats.buyer_fee_revenue)} />
              <StatCard icon={Wallet} label="Seller Commission Revenue" value={fmt(stats.seller_commission_revenue)} />
              <StatCard icon={IndianRupee} label="Total Platform Revenue (20%)" value={fmt(stats.total_platform_revenue)} highlight />
              <StatCard icon={Calendar} label="Daily Revenue" value={fmt(stats.daily_revenue)} />
              <StatCard icon={CalendarRange} label="Weekly Revenue" value={fmt(stats.weekly_revenue)} />
              <StatCard icon={CalendarDays} label="Monthly Revenue" value={fmt(stats.monthly_revenue)} />
              <StatCard icon={CalendarClock} label="Yearly Revenue" value={fmt(stats.yearly_revenue)} />
            </Section>
          </div>
        ) : null}

        {/* Fraud Alerts — always rendered, independent of stats loading */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gold-400"><AlertTriangle size={16} /></span>
            <h2 className="font-display text-lg font-bold text-white">Fraud Alerts</h2>
          </div>
          <div className="divider-gold mb-4" />

          {fraudLoading ? (
            <div className="py-10 text-center text-gray-500">Loading fraud alerts…</div>
          ) : fraudFlags.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center text-gray-400">
              No unresolved fraud flags. All clear!
            </div>
          ) : (
            <div className="space-y-3">
              {fraudFlags.map((flag) => (
                <div key={flag.id} className="glass glass-hover rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 font-mono">
                        {flag.user_id ? `${flag.user_id.slice(0, 8)}…` : 'No user'}
                      </span>
                      <TypeBadge type={flag.type} />
                      <SeverityBadge severity={flag.severity} />
                      {flag.auto_detected && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">Auto</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 truncate">
                      {flag.description ?? 'No description provided'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(flag.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => resolveFlag(flag.id)}
                    disabled={resolvingId === flag.id}
                    className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-gold-400 text-black hover:bg-gold-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {resolvingId === flag.id ? 'Resolving…' : 'Resolve'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gold-400">{icon}</span>
        <h2 className="font-display text-lg font-bold text-white">{title}</h2>
      </div>
      <div className="divider-gold mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{children}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: LucideIcon; label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`glass glass-hover rounded-2xl p-5 ${highlight ? 'border-gold-400/30' : ''}`}>
      <span className="grid place-items-center w-10 h-10 rounded-lg bg-gold-400/10 text-gold-400">
        <Icon size={18} />
      </span>
      <p className={`mt-3 font-display text-xl font-bold ${highlight ? 'gold-text' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

const typeLabels: Record<FraudType, string> = {
  spam_account: 'Spam Account',
  fake_listing: 'Fake Listing',
  repeated_failed_payments: 'Repeated Failed Payments',
  suspicious_login: 'Suspicious Login',
  fake_kyc: 'Fake KYC',
  multiple_accounts: 'Multiple Accounts',
};

function TypeBadge({ type }: { type: FraudType }) {
  return (
    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
      {typeLabels[type] ?? type}
    </span>
  );
}

const severityStyles: Record<FraudSeverity, string> = {
  low: 'bg-green-500/20 text-green-300',
  medium: 'bg-yellow-500/20 text-yellow-300',
  high: 'bg-orange-500/20 text-orange-300',
  critical: 'bg-red-500/20 text-red-300',
};

function SeverityBadge({ severity }: { severity: FraudSeverity }) {
  return (
    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${severityStyles[severity]}`}>
      {severity}
    </span>
  );
}
