import { type ReactNode } from 'react';
import { navigate, Link } from '../lib/router';
import { useAuth } from '../lib/auth';
import { LayoutDashboard, Users, ShieldCheck, Package, Lock, ArrowUpRight, CreditCard, Headphones, Bell, FileText, Settings, UserCog, ScrollText, BarChart3, ArrowLeft, Crown, ShoppingCart, Wallet, Mail, Receipt, Activity, Flag, Ticket } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'KYC', to: '/admin/kyc', icon: ShieldCheck },
  { label: 'Listings', to: '/admin/listings', icon: Package },
  { label: 'Orders', to: '/admin/orders', icon: ShoppingCart },
  { label: 'Escrow', to: '/admin/escrow', icon: Lock },
  { label: 'Wallet', to: '/admin/wallets', icon: Wallet },
  { label: 'Withdraw', to: '/admin/withdrawals', icon: ArrowUpRight },
  { label: 'Payments', to: '/admin/payment-gateways', icon: CreditCard },
  { label: 'Coupons', to: '/admin/coupons', icon: Ticket },
  { label: 'Reports', to: '/admin/reports', icon: Flag },
  { label: 'Analytics', to: '/admin/analytics', icon: BarChart3 },
  { label: 'Support', to: '/admin/support', icon: Headphones },
  { label: 'Control Center', to: '/admin/control-center', icon: Settings },
];

export function AdminLayout({ children, currentPath }: { children: ReactNode; currentPath: string }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen grid place-items-center text-gray-500">Loading...</div>;
  if (!user) { navigate('/admin/login'); return null; }

  return (
    <div className="min-h-screen flex bg-ink-950">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-white/[0.06] bg-ink-900/40 backdrop-blur-xl">
        <div className="p-5 border-b border-white/[0.06]">
          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-gold-gradient text-ink-950">
              <Crown size={18} />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-white">Kryzo Admin</p>
              <p className="text-[10px] text-gold-400 tracking-wider uppercase">Super Panel</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5 no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const active = currentPath === item.to || (item.to !== '/admin/dashboard' && currentPath.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? 'bg-gold-400/10 text-gold-300 border border-gold-400/20' : 'text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent'}`}
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/[0.06]">
          <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-all">
            <ArrowLeft size={16} /> Back to Site
          </Link>
        </div>
      </aside>

      {/* Mobile top bar + content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile nav */}
        <div className="lg:hidden border-b border-white/[0.06] bg-ink-900/60 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <Link to="/admin/dashboard" className="flex items-center gap-2">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-gold-gradient text-ink-950"><Crown size={16} /></span>
              <span className="font-display text-sm font-bold text-white">Kryzo Admin</span>
            </Link>
            <Link to="/dashboard" className="text-gray-400 hover:text-white"><ArrowLeft size={18} /></Link>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {NAV_ITEMS.map((item) => {
              const active = currentPath === item.to || (item.to !== '/admin/dashboard' && currentPath.startsWith(item.to));
              return (
                <Link key={item.to} to={item.to} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${active ? 'bg-gold-400/10 text-gold-300 border border-gold-400/20' : 'text-gray-400 border border-transparent'}`}>
                  <item.icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
