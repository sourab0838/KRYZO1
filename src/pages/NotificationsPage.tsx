import { useEffect, useState } from 'react';
import { navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { supabase, type NotificationRow, type NotificationType } from '../lib/supabase';
import { Bell, CheckCheck, Trash2, User, LogIn, KeyRound, ShieldCheck, Wallet, ShoppingBag, Headphones, Package, MessageCircle, Tag, ArrowLeftRight, TrendingUp, ArrowDownLeft, ArrowUpRight, XCircle, CheckCircle2, Search, Trash, ShoppingCart, DollarSign, ShieldAlert, Megaphone } from 'lucide-react';

const TYPE_META: Record<NotificationType, { icon: React.ReactNode; cls: string }> = {
  registration: { icon: <User size={16} />, cls: 'bg-gold-400/10 text-gold-400' },
  login: { icon: <LogIn size={16} />, cls: 'bg-blue-500/10 text-blue-400' },
  email_otp: { icon: <KeyRound size={16} />, cls: 'bg-purple-500/10 text-purple-400' },
  password_reset: { icon: <KeyRound size={16} />, cls: 'bg-orange-500/10 text-orange-400' },
  kyc: { icon: <ShieldCheck size={16} />, cls: 'bg-success-500/10 text-success-400' },
  wallet: { icon: <Wallet size={16} />, cls: 'bg-amber-500/10 text-amber-400' },
  orders: { icon: <ShoppingBag size={16} />, cls: 'bg-pink-500/10 text-pink-400' },
  support: { icon: <Headphones size={16} />, cls: 'bg-cyan-500/10 text-cyan-400' },
  listing_submitted: { icon: <Package size={16} />, cls: 'bg-gold-400/10 text-gold-400' },
  listing_approved: { icon: <CheckCheck size={16} />, cls: 'bg-success-500/10 text-success-400' },
  listing_rejected: { icon: <Package size={16} />, cls: 'bg-error-500/10 text-error-400' },
  new_chat: { icon: <MessageCircle size={16} />, cls: 'bg-cyan-500/10 text-cyan-400' },
  new_offer: { icon: <Tag size={16} />, cls: 'bg-amber-500/10 text-amber-400' },
  counter_offer: { icon: <ArrowLeftRight size={16} />, cls: 'bg-orange-500/10 text-orange-400' },
  payment_success: { icon: <CheckCircle2 size={16} />, cls: 'bg-success-500/10 text-success-400' },
  payment_failed: { icon: <XCircle size={16} />, cls: 'bg-error-500/10 text-error-400' },
  wallet_credited: { icon: <Wallet size={16} />, cls: 'bg-amber-500/10 text-amber-400' },
  withdrawal_requested: { icon: <ArrowUpRight size={16} />, cls: 'bg-warning-500/10 text-warning-400' },
  withdrawal_approved: { icon: <CheckCircle2 size={16} />, cls: 'bg-success-500/10 text-success-400' },
  withdrawal_rejected: { icon: <XCircle size={16} />, cls: 'bg-error-500/10 text-error-400' },
  order_created: { icon: <ShoppingBag size={16} />, cls: 'bg-pink-500/10 text-pink-400' },
  seller_delivered: { icon: <Package size={16} />, cls: 'bg-cyan-500/10 text-cyan-400' },
  buyer_confirmed: { icon: <CheckCircle2 size={16} />, cls: 'bg-success-500/10 text-success-400' },
  funds_released: { icon: <TrendingUp size={16} />, cls: 'bg-gold-400/10 text-gold-400' },
  refund_completed: { icon: <ArrowDownLeft size={16} />, cls: 'bg-blue-500/10 text-blue-400' },
  // New notification types
  new_order: { icon: <ShoppingCart size={16} />, cls: 'bg-pink-500/10 text-pink-400' },
  payment_received: { icon: <DollarSign size={16} />, cls: 'bg-success-500/10 text-success-400' },
  payment_released: { icon: <TrendingUp size={16} />, cls: 'bg-gold-400/10 text-gold-400' },
  refund: { icon: <ArrowDownLeft size={16} />, cls: 'bg-blue-500/10 text-blue-400' },
  kyc_approved: { icon: <ShieldCheck size={16} />, cls: 'bg-success-500/10 text-success-400' },
  kyc_rejected: { icon: <XCircle size={16} />, cls: 'bg-error-500/10 text-error-400' },
  new_message: { icon: <MessageCircle size={16} />, cls: 'bg-cyan-500/10 text-cyan-400' },
  seller_verification: { icon: <ShieldCheck size={16} />, cls: 'bg-gold-400/10 text-gold-400' },
  withdraw_approved: { icon: <CheckCircle2 size={16} />, cls: 'bg-success-500/10 text-success-400' },
  withdraw_rejected: { icon: <XCircle size={16} />, cls: 'bg-error-500/10 text-error-400' },
  account_sold: { icon: <Package size={16} />, cls: 'bg-gold-400/10 text-gold-400' },
  account_purchased: { icon: <ShoppingCart size={16} />, cls: 'bg-pink-500/10 text-pink-400' },
  admin_announcement: { icon: <Megaphone size={16} />, cls: 'bg-purple-500/10 text-purple-400' },
  security_alert: { icon: <ShieldAlert size={16} />, cls: 'bg-error-500/10 text-error-400' },
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

export function NotificationsPage() {
  const { user, loading } = useAuth();
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [search, setSearch] = useState('');

  const loadNotifications = async () => {
    if (!user) return;
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setNotifs((data ?? []) as NotificationRow[]);
  };

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    if (!user) return;
    loadNotifications();
    const channel = supabase
      .channel('notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, loadNotifications)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, loadNotifications)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, loadNotifications)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loading]);

  if (loading || !user) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;

  const unreadCount = notifs.filter((n) => !n.is_read).length;
  const readCount = notifs.filter((n) => n.is_read).length;

  // Filter logic
  let shown = notifs;
  if (filter === 'unread') shown = notifs.filter((n) => !n.is_read);
  else if (filter === 'read') shown = notifs.filter((n) => n.is_read);

  // Search logic
  if (search.trim()) {
    const q = search.toLowerCase();
    shown = shown.filter((n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q));
  }

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifs((arr) => arr.map((n) => ({ ...n, is_read: true })));
  };

  const toggleRead = async (id: string, isRead: boolean) => {
    await supabase.from('notifications').update({ is_read: !isRead }).eq('id', id);
    setNotifs((arr) => arr.map((n) => n.id === id ? { ...n, is_read: !isRead } : n));
  };

  const remove = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifs((arr) => arr.filter((n) => n.id !== id));
  };

  const clearAll = async () => {
    if (!confirm('Delete all notifications?')) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setNotifs([]);
  };

  const clearRead = async () => {
    await supabase.from('notifications').delete().eq('user_id', user.id).eq('is_read', true);
    setNotifs((arr) => arr.filter((n) => !n.is_read));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className="section-eyebrow">Inbox</span>
          <h1 className="font-display text-3xl font-bold text-white">Notifications</h1>
          <p className="mt-1 text-sm text-gray-400">{unreadCount} unread of {notifs.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-ghost text-sm">
              <CheckCheck size={15} /> Mark all read
            </button>
          )}
          {notifs.length > 0 && (
            <button onClick={clearAll} className="btn-ghost text-sm text-error-400 hover:text-error-300">
              <Trash size={15} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notifications..."
          className="input-field pl-10 w-full"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${filter === 'all' ? 'bg-gold-gradient text-ink-950' : 'glass text-gray-300'}`}>
          All ({notifs.length})
        </button>
        <button onClick={() => setFilter('unread')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${filter === 'unread' ? 'bg-gold-gradient text-ink-950' : 'glass text-gray-300'}`}>
          Unread ({unreadCount})
        </button>
        <button onClick={() => setFilter('read')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${filter === 'read' ? 'bg-gold-gradient text-ink-950' : 'glass text-gray-300'}`}>
          Read ({readCount})
        </button>
        {readCount > 0 && (
          <button onClick={clearRead} className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap glass text-gray-400 hover:text-error-400">
            Clear read
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="glass rounded-2xl py-20 text-center">
          <Bell size={40} className="mx-auto text-gray-600" />
          <p className="mt-4 text-gray-400">
            {search ? 'No matching notifications' : filter === 'unread' ? 'No unread notifications' : filter === 'read' ? 'No read notifications' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((n) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.support;
            return (
              <div key={n.id} className={`glass rounded-xl p-4 flex gap-3.5 transition-all ${!n.is_read ? 'border-gold-400/20 bg-gold-400/[0.03]' : ''}`}>
                <span className={`grid place-items-center w-10 h-10 rounded-lg shrink-0 ${meta.cls}`}>{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{n.title}</p>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-gold-400 shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-600 mt-1.5">{getRelativeTime(n.created_at)}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => toggleRead(n.id, n.is_read)} className="text-gray-500 hover:text-gold-300 p-1 transition-colors" title={n.is_read ? 'Mark unread' : 'Mark read'}>
                    <CheckCheck size={15} />
                  </button>
                  <button onClick={() => remove(n.id)} className="text-gray-500 hover:text-error-400 p-1 transition-colors" title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
