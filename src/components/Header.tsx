import { useEffect, useState, useRef } from 'react';
import { Link, navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { supabase, type NotificationRow, type NotificationType } from '../lib/supabase';
import { Bell, Search, Wallet, User as UserIcon, Menu, X, ShieldCheck, ChevronDown, Plus, Package, ShoppingBag, Crown, CheckCheck, Trash2, XCircle, CheckCircle2, TrendingUp, ArrowDownLeft, ArrowUpRight, KeyRound, LogIn, Headphones, MessageCircle, Tag, ArrowLeftRight, DollarSign, ShieldAlert, Megaphone, ShoppingCart } from 'lucide-react';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-lg' : 'text-xl';
  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      <span className="relative grid place-items-center w-9 h-9 rounded-xl bg-ink-850 border border-gold-400/30 shadow-gold group-hover:border-gold-400/60 transition-colors">
        <span className="font-display font-extrabold text-gold-400 text-lg leading-none">K</span>
        <span className="absolute inset-0 rounded-xl bg-gold-400/0 group-hover:bg-gold-400/10 transition-colors" />
      </span>
      <span className={`font-display font-extrabold tracking-tight ${dims}`}>
        <span className="text-white">KRYZ</span><span className="gold-text">O</span>
      </span>
    </Link>
  );
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  registration: <UserIcon size={16} />,
  login: <LogIn size={16} />,
  email_otp: <KeyRound size={16} />,
  password_reset: <KeyRound size={16} />,
  kyc: <ShieldCheck size={16} />,
  wallet: <Wallet size={16} />,
  orders: <ShoppingBag size={16} />,
  support: <Headphones size={16} />,
  listing_submitted: <Package size={16} />,
  listing_approved: <CheckCircle2 size={16} />,
  listing_rejected: <XCircle size={16} />,
  new_chat: <MessageCircle size={16} />,
  new_offer: <Tag size={16} />,
  counter_offer: <ArrowLeftRight size={16} />,
  payment_success: <CheckCircle2 size={16} />,
  payment_failed: <XCircle size={16} />,
  wallet_credited: <Wallet size={16} />,
  withdrawal_requested: <ArrowUpRight size={16} />,
  withdrawal_approved: <CheckCircle2 size={16} />,
  withdrawal_rejected: <XCircle size={16} />,
  order_created: <ShoppingCart size={16} />,
  seller_delivered: <Package size={16} />,
  buyer_confirmed: <CheckCircle2 size={16} />,
  funds_released: <TrendingUp size={16} />,
  refund_completed: <ArrowDownLeft size={16} />,
  new_order: <ShoppingCart size={16} />,
  payment_received: <DollarSign size={16} />,
  payment_released: <TrendingUp size={16} />,
  refund: <ArrowDownLeft size={16} />,
  kyc_approved: <ShieldCheck size={16} />,
  kyc_rejected: <XCircle size={16} />,
  new_message: <MessageCircle size={16} />,
  seller_verification: <ShieldCheck size={16} />,
  withdraw_approved: <CheckCircle2 size={16} />,
  withdraw_rejected: <XCircle size={16} />,
  account_sold: <Package size={16} />,
  account_purchased: <ShoppingCart size={16} />,
  admin_announcement: <Megaphone size={16} />,
  security_alert: <ShieldAlert size={16} />,
};

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN');
}

export function Header() {
  const { user, profile, logout: authLogout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [recentNotifs, setRecentNotifs] = useState<NotificationRow[]>([]);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      setRecentNotifs([]);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentNotifs((data ?? []) as NotificationRow[]);
      const unreadCount = (data ?? []).filter((n: NotificationRow) => !n.is_read).length;
      setUnread(unreadCount);
    };
    load();
    const channel = supabase
      .channel('header-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    (async () => {
      try {
        const { data } = await supabase.rpc('get_admin_role');
        setIsAdmin(!!data);
      } catch {
        setIsAdmin(false);
      }
    })();
  }, [user]);

  useEffect(() => {
    const close = () => { setProfileOpen(false); setNotifOpen(false); };
    if (profileOpen || notifOpen) {
      window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
    }
  }, [profileOpen, notifOpen]);

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Marketplace', to: '/marketplace' },
    { label: 'Support', to: '/support' },
    { label: 'FAQ', to: '/faq' },
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-ink-950/85 backdrop-blur-xl border-b border-white/[0.06] shadow-glass' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-gold-300 hover:bg-white/[0.04] transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => navigate('/marketplace')}
              className="grid place-items-center w-9 h-9 rounded-lg text-gray-400 hover:text-gold-300 hover:bg-white/[0.04] transition-colors"
              aria-label="Search"
            >
              <Search size={18} />
            </button>

            {user ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setNotifOpen((v) => !v); }}
                  className="relative grid place-items-center w-9 h-9 rounded-lg text-gray-400 hover:text-gold-300 hover:bg-white/[0.04] transition-colors"
                  aria-label="Notifications"
                >
                  <Bell size={18} />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-error-500 text-white text-[10px] font-bold">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>

                <Link
                  to="/wallet"
                  className="grid place-items-center w-9 h-9 rounded-lg text-gray-400 hover:text-gold-300 hover:bg-white/[0.04] transition-colors"
                  aria-label="Wallet"
                >
                  <Wallet size={18} />
                </Link>

                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setProfileOpen((v) => !v); }}
                    className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="grid place-items-center w-7 h-7 rounded-full bg-gold-gradient text-ink-950 text-xs font-bold overflow-hidden">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (profile?.username?.[0] ?? 'U').toUpperCase()
                      )}
                    </span>
                    <span className="text-sm font-medium text-gray-200 max-w-[100px] truncate">{profile?.username ?? 'User'}</span>
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>
                  {profileOpen && (
                    <div
                      className="absolute right-0 mt-2 w-56 glass rounded-xl py-2 animate-scale-in origin-top-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-3 py-2 border-b border-white/[0.06]">
                        <p className="text-sm font-semibold text-white truncate">{profile?.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{profile?.email}</p>
                      </div>
                      <MenuItem to="/dashboard" icon={<UserIcon size={15} />} label="Dashboard" />
                      <MenuItem to="/profile" icon={<UserIcon size={15} />} label="My Profile" />
                      <MenuItem to="/kyc" icon={<ShieldCheck size={15} />} label="KYC Verification" />
                      <MenuItem to="/wallet" icon={<Wallet size={15} />} label="Wallet" />
                      <MenuItem to="/notifications" icon={<Bell size={15} />} label="Notifications" />
                      <div className="my-1 divider-gold" />
                      <MenuItem to="/sell" icon={<Plus size={15} />} label="Sell Account" />
                      <MenuItem to="/seller-dashboard" icon={<Package size={15} />} label="Seller Dashboard" />
                      <MenuItem to="/buyer-dashboard" icon={<ShoppingBag size={15} />} label="Buyer Dashboard" />
                      {isAdmin && (
                        <>
                          <div className="my-1 divider-gold" />
                          <MenuItem to="/admin" icon={<Crown size={15} />} label="Admin Panel" />
                          <div className="my-1 divider-gold" />
                        </>
                      )}
                      <button
                        onClick={async () => { try { await authLogout(); } catch {} navigate('/login'); }}
                        className="w-full text-left px-3 py-2 text-sm text-error-400 hover:bg-error-500/10 transition-colors rounded-lg mx-1"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 ml-2">
                <Link to="/login" className="btn-ghost text-sm">Login</Link>
                <Link to="/register" className="btn-gold text-sm">Register</Link>
              </div>
            )}
          </div>

          {/* Mobile right - Bell + Menu */}
          <div className="flex md:hidden items-center gap-1">
            {user && (
              <button
                onClick={(e) => { e.stopPropagation(); setNotifOpen((v) => !v); }}
                className="relative grid place-items-center w-9 h-9 rounded-lg text-gray-400 hover:text-gold-300 hover:bg-white/[0.04] transition-colors"
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-error-500 text-white text-[10px] font-bold">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            )}
            <button
              className="grid place-items-center w-9 h-9 rounded-lg text-gray-300 hover:bg-white/[0.04]"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Desktop Notif dropdown */}
        {user && notifOpen && (
          <div
            ref={notifPanelRef}
            className="hidden md:block absolute right-4 top-14 w-96 glass rounded-xl py-0 animate-scale-in origin-top-right z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-sm font-semibold text-white">Notifications</span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={async () => {
                      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
                      setRecentNotifs((arr) => arr.map((n) => ({ ...n, is_read: true })));
                      setUnread(0);
                    }}
                    className="text-xs text-gold-400 hover:text-gold-300"
                  >
                    Mark all read
                  </button>
                )}
                <Link to="/notifications" className="text-xs text-gray-400 hover:text-gold-300">View all</Link>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto no-scrollbar">
              {recentNotifs.length === 0 ? (
                <p className="px-4 py-8 text-sm text-gray-500 text-center">No notifications yet</p>
              ) : (
                recentNotifs.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-0 cursor-pointer ${!n.is_read ? 'bg-gold-400/[0.03]' : ''}`}
                    onClick={async () => {
                      if (!n.is_read) {
                        await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
                        setRecentNotifs((arr) => arr.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
                        setUnread((u) => Math.max(0, u - 1));
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${!n.is_read ? 'bg-gold-400/15 text-gold-400' : 'bg-white/[0.04] text-gray-400'}`}>
                        {TYPE_ICONS[n.type] || <Bell size={16} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{n.title}</p>
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-gold-400 shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-gray-600 mt-1">{getRelativeTime(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Notification Full Screen Panel */}
      {user && notifOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-ink-950 animate-fade-in">
          <div className="flex items-center justify-between px-4 h-16 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNotifOpen(false)}
                className="grid place-items-center w-9 h-9 rounded-lg text-gray-300 hover:bg-white/[0.04]"
              >
                <X size={20} />
              </button>
              <div>
                <p className="text-sm font-semibold text-white">Notifications</p>
                <p className="text-xs text-gray-400">{unread} unread</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={async () => {
                    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
                    setRecentNotifs((arr) => arr.map((n) => ({ ...n, is_read: true })));
                    setUnread(0);
                  }}
                  className="text-xs text-gold-400 hover:text-gold-300 px-3 py-1.5 rounded-lg hover:bg-gold-400/10"
                >
                  Mark all read
                </button>
              )}
              <Link
                to="/notifications"
                onClick={() => setNotifOpen(false)}
                className="text-xs text-gray-400 hover:text-gold-300 px-3 py-1.5 rounded-lg hover:bg-white/[0.04]"
              >
                View all
              </Link>
            </div>
          </div>
          <div className="overflow-y-auto no-scrollbar" style={{ height: 'calc(100vh - 64px)' }}>
            {recentNotifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Bell size={40} className="text-gray-600" />
                <p className="mt-4 text-gray-400">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {recentNotifs.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-4 active:bg-white/[0.03] ${!n.is_read ? 'bg-gold-400/[0.03]' : ''}`}
                    onClick={async () => {
                      if (!n.is_read) {
                        await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
                        setRecentNotifs((arr) => arr.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
                        setUnread((u) => Math.max(0, u - 1));
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`grid place-items-center w-10 h-10 rounded-lg shrink-0 ${!n.is_read ? 'bg-gold-400/15 text-gold-400' : 'bg-white/[0.04] text-gray-400'}`}>
                        {TYPE_ICONS[n.type] || <Bell size={18} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{n.title}</p>
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-gold-400 shrink-0" />}
                        </div>
                        <p className="text-sm text-gray-400 mt-0.5">{n.message}</p>
                        <p className="text-xs text-gray-600 mt-1">{getRelativeTime(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden glass border-t border-white/[0.06] animate-fade-in">
          <nav className="px-4 py-3 space-y-1">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-gold-300 hover:bg-white/[0.04]"
              >
                {l.label}
              </Link>
            ))}
            <div className="my-2 divider-gold" />
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/[0.04]">Dashboard</Link>
                <Link to="/profile" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/[0.04]">My Profile</Link>
                <Link to="/wallet" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/[0.04]">Wallet</Link>
                <Link to="/notifications" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/[0.04]">Notifications</Link>
                <Link to="/kyc" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/[0.04]">KYC Verification</Link>
                <Link to="/sell" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-gold-300 hover:bg-white/[0.04]">Sell Account</Link>
                <Link to="/seller-dashboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/[0.04]">Seller Dashboard</Link>
                <Link to="/buyer-dashboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/[0.04]">Buyer Dashboard</Link>
                {isAdmin && (
                  <>
                    <div className="my-1 divider-gold" />
                    <Link to="/admin" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-gold-300 hover:bg-gold-400/10">Admin Panel</Link>
                  </>
                )}
                <button
                  onClick={async () => { try { await authLogout(); } catch {} setMobileOpen(false); navigate('/login'); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-error-400 hover:bg-error-500/10"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-ghost flex-1 text-sm">Login</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="btn-gold flex-1 text-sm">Register</Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:text-gold-300 hover:bg-white/[0.04] transition-colors rounded-lg mx-1">
      <span className="text-gray-400">{icon}</span>
      {label}
    </Link>
  );
}
