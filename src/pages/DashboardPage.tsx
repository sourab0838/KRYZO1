import { useEffect, useState } from 'react';
import { Link, navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { supabase, type Wallet, type NotificationRow, type SupportTicket } from '../lib/supabase';
import { Wallet as WalletIcon, Bell, ShieldCheck, BadgeCheck, Ticket, TrendingUp, ArrowRight, Flame, Trophy, Activity } from 'lucide-react';

export function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    if (!user) return;
    (async () => {
      const [{ data: w }, { data: n }, { data: t }] = await Promise.all([
        supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);
      setWallet(w as Wallet | null);
      setNotifs((n ?? []) as NotificationRow[]);
      setTickets((t ?? []) as SupportTicket[]);
    })();
  }, [user, loading]);

  if (loading || !user) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;

  const kycBadge = {
    not_submitted: { label: 'Not Submitted', cls: 'bg-white/[0.06] text-gray-400' },
    pending: { label: 'Pending Review', cls: 'bg-warning-500/15 text-warning-400' },
    approved: { label: 'Verified', cls: 'bg-success-500/15 text-success-400' },
    rejected: { label: 'Rejected', cls: 'bg-error-500/15 text-error-400' },
  }[profile?.kyc_status ?? 'not_submitted'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="section-eyebrow">Dashboard</span>
          <h1 className="font-display text-3xl font-bold text-white">Welcome, {profile?.full_name?.split(' ')[0] ?? 'Gamer'}</h1>
          <p className="mt-1 text-sm text-gray-400">Manage your account, wallet, and activity.</p>
        </div>
        <Link to="/marketplace" className="btn-gold text-sm">Browse Marketplace <ArrowRight size={15} /></Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<WalletIcon size={20} />} label="Wallet Balance" value={`₹${(wallet?.balance ?? 0).toLocaleString('en-IN')}`} to="/wallet" />
        <StatCard icon={<Bell size={20} />} label="Notifications" value={String(notifs.length)} to="/notifications" />
        <StatCard icon={<Ticket size={20} />} label="Support Tickets" value={String(tickets.length)} to="/support" />
        <StatCard icon={<ShieldCheck size={20} />} label="KYC Status" value={kycBadge.label} to="/kyc" badgeCls={kycBadge.cls} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile summary */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-white mb-4">Profile Overview</h2>
          <div className="flex items-center gap-4">
            <span className="grid place-items-center w-16 h-16 rounded-full bg-gold-gradient text-ink-950 text-xl font-bold overflow-hidden">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : (profile?.username?.[0] ?? 'U').toUpperCase()}
            </span>
            <div>
              <p className="font-semibold text-white flex items-center gap-1.5">
                {profile?.username}
                {profile?.verified_seller && <BadgeCheck size={16} className="text-gold-400" />}
              </p>
              <p className="text-sm text-gray-400">{profile?.email}</p>
            </div>
          </div>
          <div className="mt-5 space-y-2.5 text-sm">
            <Row label="Full Name" value={profile?.full_name ?? '-'} />
            <Row label="Phone" value={`${profile?.phone_country_code} ${profile?.phone_number}`.trim()} />
            <Row label="Member Since" value={profile ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} />
          </div>
          <Link to="/profile" className="btn-ghost w-full mt-5 text-sm">Edit Profile <ArrowRight size={15} /></Link>
        </div>

        {/* Recent notifications */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-white">Recent Activity</h2>
            <Link to="/notifications" className="text-xs text-gold-400 hover:text-gold-300">View all</Link>
          </div>
          {notifs.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {notifs.map((n) => (
                <div key={n.id} className="flex gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="grid place-items-center w-8 h-8 rounded-lg bg-gold-400/10 text-gold-400 shrink-0">
                    <Activity size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-white mb-4">Quick Actions</h2>
          <div className="space-y-2.5">
            <QuickAction to="/kyc" icon={<ShieldCheck size={18} />} label="Complete KYC Verification" desc={profile?.kyc_status === 'approved' ? 'Verified' : 'Get verified'} />
            <QuickAction to="/sell" icon={<ShieldCheck size={18} />} label="Sell Account" desc="List your gaming account" />
            <QuickAction to="/seller-dashboard" icon={<ShieldCheck size={18} />} label="Seller Dashboard" desc="Manage your listings" />
            <QuickAction to="/buyer-dashboard" icon={<ShieldCheck size={18} />} label="Buyer Dashboard" desc="Track your purchases" />
            <QuickAction to="/wallet" icon={<WalletIcon size={18} />} label="View Wallet" desc="Check your balance" />
            <QuickAction to="/marketplace?game=free-fire" icon={<Flame size={18} />} label="Free Fire Accounts" desc="Browse listings" />
            <QuickAction to="/marketplace?game=bgmi" icon={<Trophy size={18} />} label="BGMI Accounts" desc="Browse listings" />
            <QuickAction to="/support" icon={<Ticket size={18} />} label="Get Support" desc="Open a ticket" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, to, badgeCls }: { icon: React.ReactNode; label: string; value: string; to: string; badgeCls?: string }) {
  return (
    <Link to={to} className="glass glass-hover rounded-2xl p-5 block">
      <div className="flex items-center justify-between">
        <span className="grid place-items-center w-10 h-10 rounded-lg bg-gold-400/10 text-gold-400">{icon}</span>
        <TrendingUp size={15} className="text-gray-600" />
      </div>
      <p className="mt-4 text-sm text-gray-400">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${badgeCls ?? 'text-white'}`}>{value}</p>
    </Link>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 font-medium">{value}</span>
    </div>
  );
}

function QuickAction({ to, icon, label, desc }: { to: string; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-gold-400/30 hover:bg-white/[0.04] transition-colors group">
      <span className="grid place-items-center w-9 h-9 rounded-lg bg-gold-400/10 text-gold-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <ArrowRight size={15} className="text-gray-600 group-hover:text-gold-400 transition-colors" />
    </Link>
  );
}
