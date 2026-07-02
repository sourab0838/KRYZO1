import { useEffect, useState } from 'react';
import { ShieldX } from 'lucide-react';
import { useRouter } from './lib/router';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/Toast';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { MarketplacePage } from './pages/MarketplacePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage, OtpVerifyPage } from './pages/ForgotPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { KycPage } from './pages/KycPage';
import { WalletPage } from './pages/WalletPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SupportPage } from './pages/SupportPage';
import { FaqPage } from './pages/FaqPage';
import { LegalPage } from './pages/LegalPage';
import { AccountDetailPage } from './pages/AccountDetailPage';
import { SellAccountPage } from './pages/SellAccountPage';
import { SellerDashboardPage } from './pages/SellerDashboardPage';
import { BuyerDashboardPage } from './pages/BuyerDashboardPage';
import { ChatPage } from './pages/ChatPage';
import { AddMoneyPage } from './pages/AddMoneyPage';
import { WithdrawPage } from './pages/WithdrawPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminKycPage } from './pages/admin/AdminKycPage';
import { AdminListingsPage } from './pages/admin/AdminListingsPage';
import { AdminEscrowPage } from './pages/admin/AdminEscrowPage';
import { AdminWithdrawalsPage } from './pages/admin/AdminWithdrawalsPage';
import { AdminPaymentSettingsPage } from './pages/admin/AdminPaymentSettingsPage';
import { AdminSupportPage } from './pages/admin/AdminSupportPage';
import { AdminNotificationsPage } from './pages/admin/AdminNotificationsPage';
import { AdminLegalPage } from './pages/admin/AdminLegalPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminRolesPage } from './pages/admin/AdminRolesPage';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { SiteControlCenterPage } from './pages/admin/SiteControlCenterPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminWalletsPage } from './pages/admin/AdminWalletsPage';
import { AdminPaymentGatewaysPage } from './pages/admin/AdminPaymentGatewaysPage';
import { AdminEmailSettingsPage } from './pages/admin/AdminEmailSettingsPage';
import { AdminGstPage } from './pages/admin/AdminGstPage';
import { AdminPaymentLogsPage } from './pages/admin/AdminPaymentLogsPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminCouponsPage } from './pages/admin/AdminCouponsPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { navigate } from './lib/router';
import { supabase } from './lib/supabase';

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/admin/login');
      return;
    }
    (async () => {
      try {
        const { data } = await supabase.rpc('get_admin_role');
        if (data) {
          setAllowed(true);
        } else {
          setDenied(true);
        }
      } catch {
        setDenied(true);
      } finally {
        setChecked(true);
      }
    })();
  }, [user, loading]);

  if (loading || !checked) {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-950">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-950 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-error-500/20 grid place-items-center mx-auto mb-4">
            <ShieldX size={32} className="text-error-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Access Denied</h1>
          <p className="mt-2 text-gray-400">You do not have admin privileges to access this area.</p>
          <button onClick={() => navigate('/dashboard')} className="btn-gold mt-6">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
}

function Router() {
  const { route } = useRouter();
  const { user, loading } = useAuth();
  const path = route.path;

  // Auth pages (public, but redirect logged-in users to dashboard)
  const authPages = ['/login', '/register', '/forgot-password', '/verify-otp', '/admin/login'];

  // Protected pages (require login, redirect to /login if not authenticated)
  // NOTE: Admin routes are handled separately by AdminGuard
  const protectedPages = ['/dashboard', '/profile', '/kyc', '/wallet', '/notifications', '/sell', '/seller-dashboard', '/buyer-dashboard', '/chat', '/wallet/add-money', '/wallet/withdraw'];

  const isAuthPage = authPages.includes(path);
  const isAdminRoute = path.startsWith('/admin') && path !== '/admin/login';
  const isProtectedPage = protectedPages.some((p) => path === p || path.startsWith(p + '/'));

  useEffect(() => {
    if (loading) return;
    // Skip auth checks for admin routes - AdminGuard handles them
    if (isAdminRoute) return;
    if (user && isAuthPage) {
      navigate('/dashboard');
    }
    if (!user && isProtectedPage) {
      navigate('/login');
    }
  }, [user, loading, path, isAuthPage, isProtectedPage, isAdminRoute]);

  // Admin login page is public (outside AdminGuard)
  if (path === '/admin/login') {
    return <AdminLoginPage />;
  }

  // Admin routes - handled by AdminGuard (checks admin role)
  if (isAdminRoute || path === '/admin') {
    return (
      <AdminGuard>
        {(path === '/admin' || path === '/admin/dashboard') && <AdminDashboardPage />}
        {path === '/admin/users' && <AdminUsersPage />}
        {path === '/admin/kyc' && <AdminKycPage />}
        {path === '/admin/listings' && <AdminListingsPage />}
        {path === '/admin/orders' && <AdminOrdersPage />}
        {path === '/admin/escrow' && <AdminEscrowPage />}
        {path === '/admin/wallets' && <AdminWalletsPage />}
        {path === '/admin/withdrawals' && <AdminWithdrawalsPage />}
        {path === '/admin/payments' && <AdminPaymentSettingsPage />}
        {path === '/admin/payment-gateways' && <AdminPaymentGatewaysPage />}
        {path === '/admin/email-settings' && <AdminEmailSettingsPage />}
        {path === '/admin/gst-settings' && <AdminGstPage />}
        {path === '/admin/payment-logs' && <AdminPaymentLogsPage />}
        {path === '/admin/support' && <AdminSupportPage />}
        {path === '/admin/notifications' && <AdminNotificationsPage />}
        {path === '/admin/legal' && <AdminLegalPage />}
        {path === '/admin/settings' && <AdminSettingsPage />}
        {path === '/admin/roles' && <AdminRolesPage />}
        {path === '/admin/audit' && <AdminAuditLogsPage />}
        {path === '/admin/analytics' && <AdminAnalyticsPage />}
        {path === '/admin/control-center' && <SiteControlCenterPage />}
        {path === '/admin/coupons' && <AdminCouponsPage />}
        {path === '/admin/reports' && <AdminReportsPage />}
        {![
          '/admin', '/admin/dashboard', '/admin/users', '/admin/kyc', '/admin/listings', '/admin/orders',
          '/admin/escrow', '/admin/wallets', '/admin/withdrawals', '/admin/payments',
          '/admin/payment-gateways', '/admin/email-settings', '/admin/gst-settings',
          '/admin/payment-logs', '/admin/support', '/admin/notifications', '/admin/legal',
          '/admin/settings', '/admin/roles', '/admin/audit', '/admin/analytics', '/admin/control-center',
          '/admin/coupons', '/admin/reports',
        ].includes(path) && <NotFound />}
      </AdminGuard>
    );
  }

  const render = () => {
    if (path.startsWith('/account/')) {
      const id = path.split('/')[2];
      if (!id) return <NotFound />;
      return <AccountDetailPage id={id} />;
    }
    if (path.startsWith('/chat/')) return <ChatPage conversationId={path.split('/')[2]} />;
    switch (path) {
      case '/': return <HomePage />;
      case '/marketplace': return <MarketplacePage />;
      case '/login': return <LoginPage />;
      case '/register': return <RegisterPage />;
      case '/forgot-password': return <ForgotPasswordPage />;
      case '/verify-otp': return <OtpVerifyPage />;
      case '/dashboard': return <DashboardPage />;
      case '/profile': return <ProfilePage />;
      case '/kyc': return <KycPage />;
      case '/wallet': return <WalletPage />;
      case '/notifications': return <NotificationsPage />;
      case '/support': return <SupportPage />;
      case '/faq': return <FaqPage />;
      case '/terms': return <LegalPage type="terms" />;
      case '/privacy': return <LegalPage type="privacy" />;
      case '/sell': return <SellAccountPage />;
      case '/seller-dashboard': return <SellerDashboardPage />;
      case '/buyer-dashboard': return <BuyerDashboardPage />;
      case '/wallet/add-money': return <AddMoneyPage />;
      case '/wallet/withdraw': return <WithdrawPage />;
      default: return <NotFound />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {render()}
      </main>
      {!isAuthPage && <Footer />}
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center text-center px-4">
      <div>
        <p className="font-display text-6xl font-extrabold gold-text">404</p>
        <p className="mt-4 text-gray-400">This page doesn't exist.</p>
        <button onClick={() => navigate('/')} className="btn-gold mt-6">Back to Home</button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </AuthProvider>
  );
}
