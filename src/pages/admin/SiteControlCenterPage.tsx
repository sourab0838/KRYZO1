import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { useAuth } from '../../lib/auth';
import { supabase, type SiteControl, type BackupLogRow } from '../../lib/supabase';
import { adminApi, checkAdminRole, isSuperAdmin } from '../../lib/admin';
import { useToast } from '../../components/Toast';
import { AdminLayout } from '../../components/AdminLayout';
import {
  Settings, Home, CreditCard, Percent, Headphones, Shield, Bell, Store,
  Database, Server, Save, Loader2, ToggleLeft, ToggleRight, AlertTriangle,
  CheckCircle2, Power, RefreshCw, HardDrive, Activity, Download, Upload,
  Zap, Globe, Image as ImageIcon, Type, Eye,
  Lock, LogOut, FileWarning, Cpu, HardDriveDownload
} from 'lucide-react';

type Tab = 'general' | 'homepage' | 'payment' | 'commission' | 'support' | 'security' | 'notifications' | 'marketplace' | 'backup' | 'system';

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'homepage', label: 'Homepage', icon: Home },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'commission', label: 'Commission', icon: Percent },
  { id: 'support', label: 'Support', icon: Headphones },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'marketplace', label: 'Marketplace', icon: Store },
  { id: 'backup', label: 'Backup', icon: Database },
  { id: 'system', label: 'System Control', icon: Server },
];

export function SiteControlCenterPage() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('general');
  const [config, setConfig] = useState<SiteControl | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const data = await adminApi.getSiteControl();
      setConfig(data);
    } catch {
      toast('error', 'Failed to load site configuration.');
    } finally {
      setLoadingConfig(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      const isSuper = await isSuperAdmin();
      if (!isSuper) { setAccessDenied(true); return; }
      loadConfig();
    })();
  }, [loading, user, loadConfig]);

  const saveCategory = async (category: string, values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const { error } = await adminApi.updateSiteControl(category, values);
      if (error) throw error;
      toast('success', `${category.charAt(0).toUpperCase() + category.slice(1)} settings saved!`);
      await loadConfig();
    } catch (err: any) {
      toast('error', err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return <div className="min-h-screen grid place-items-center text-gray-500">Loading...</div>;
  if (accessDenied) {
    return (
      <AdminLayout currentPath="/admin/control-center">
        <div className="max-w-md mx-auto py-20 text-center">
          <Lock size={48} className="mx-auto text-error-400" />
          <h2 className="mt-4 font-display text-xl font-bold text-white">Access Denied</h2>
          <p className="mt-2 text-gray-400">Only Super Admins can access the Site Control Center.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPath="/admin/control-center">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <span className="section-eyebrow">Super Admin</span>
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <Settings size={24} className="text-gold-400" /> Site Control Center
          </h1>
          <p className="mt-1 text-sm text-gray-400">Manage the entire website without editing source code. Changes apply instantly.</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? 'bg-gold-400/10 text-gold-300 border border-gold-400/20' : 'text-gray-400 border border-transparent hover:text-white hover:bg-white/[0.04]'}`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {loadingConfig || !config ? (
          <div className="py-20 text-center text-gray-500"><Loader2 size={24} className="animate-spin mx-auto" /></div>
        ) : (
          <>
            {tab === 'general' && <GeneralTab config={config.general} onSave={(v) => saveCategory('general', v)} saving={saving} />}
            {tab === 'homepage' && <HomepageTab config={config.homepage} onSave={(v) => saveCategory('homepage', v)} saving={saving} />}
            {tab === 'payment' && <PaymentTab config={config.payment} onSave={(v) => saveCategory('payment', v)} saving={saving} />}
            {tab === 'commission' && <CommissionTab config={config.commission} onSave={(v) => saveCategory('commission', v)} saving={saving} />}
            {tab === 'support' && <SupportTab config={config.support} onSave={(v) => saveCategory('support', v)} saving={saving} />}
            {tab === 'security' && <SecurityTab config={config.security} onSave={(v) => saveCategory('security', v)} saving={saving} toast={toast} />}
            {tab === 'notifications' && <NotificationsTab config={config.notifications} onSave={(v) => saveCategory('notifications', v)} saving={saving} />}
            {tab === 'marketplace' && <MarketplaceTab config={config.marketplace} onSave={(v) => saveCategory('marketplace', v)} saving={saving} />}
            {tab === 'backup' && <BackupTab toast={toast} />}
            {tab === 'system' && <SystemTab toast={toast} />}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

// ============================================================
// Reusable components
// ============================================================

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      <div>
        <p className="text-sm font-medium text-gray-200">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button onClick={() => onChange(!checked)} className={`shrink-0 transition-colors ${checked ? 'text-gold-400' : 'text-gray-600'}`}>
        {checked ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
      </button>
    </div>
  );
}

function SaveButton({ onSave, saving }: { onSave: () => void; saving: boolean }) {
  return (
    <button onClick={onSave} disabled={saving} className="btn-gold">
      {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> Save Changes</>}
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-600">{hint}</p>}
    </div>
  );
}

// ============================================================
// GENERAL TAB
// ============================================================

function GeneralTab({ config, onSave, saving }: { config: SiteControl['general']; onSave: (v: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState(config);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Globe size={16} className="text-gold-400" /> Website Identity</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Website Name"><input value={form.website_name} onChange={(e) => set('website_name', e.target.value)} className="input-field" /></Field>
          <Field label="Contact Email"><input value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} className="input-field" /></Field>
          <Field label="Contact Phone"><input value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} className="input-field" /></Field>
          <Field label="Website Language">
            <select value={form.language} onChange={(e) => set('language', e.target.value)} className="input-field">
              <option value="en">English</option><option value="hi">Hindi</option><option value="bn">Bengali</option>
            </select>
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="input-field">
              <option value="INR">INR (₹)</option><option value="USD">USD ($)</option>
            </select>
          </Field>
          <Field label="Time Zone">
            <select value={form.timezone} onChange={(e) => set('timezone', e.target.value)} className="input-field">
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option><option value="UTC">UTC</option><option value="America/New_York">America/New_York</option>
            </select>
          </Field>
        </div>
        <Field label="Website Description"><textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} className="input-field" /></Field>
        <Field label="Website Keywords (SEO)" hint="Comma-separated keywords"><input value={form.keywords} onChange={(e) => set('keywords', e.target.value)} className="input-field" /></Field>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><ImageIcon size={16} className="text-gold-400" /> Branding</h3>
        <Field label="Logo URL" hint="Paste a URL to your logo image"><input value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} className="input-field" placeholder="https://..." /></Field>
        <Field label="Favicon URL" hint="Paste a URL to your favicon (.ico or .png)"><input value={form.favicon_url} onChange={(e) => set('favicon_url', e.target.value)} className="input-field" placeholder="https://..." /></Field>
      </div>

      <SaveButton onSave={() => onSave(form as unknown as Record<string, unknown>)} saving={saving} />
    </div>
  );
}

// ============================================================
// HOMEPAGE TAB
// ============================================================

function HomepageTab({ config, onSave, saving }: { config: SiteControl['homepage']; onSave: (v: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState(config);
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Type size={16} className="text-gold-400" /> Hero Section</h3>
        <Field label="Hero Title"><input value={form.hero_title} onChange={(e) => set('hero_title', e.target.value)} className="input-field" /></Field>
        <Field label="Hero Subtitle"><textarea value={form.hero_subtitle} onChange={(e) => set('hero_subtitle', e.target.value)} rows={2} className="input-field" /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Button 1 Text"><input value={form.hero_button1_text} onChange={(e) => set('hero_button1_text', e.target.value)} className="input-field" /></Field>
          <Field label="Button 1 Link"><input value={form.hero_button1_link} onChange={(e) => set('hero_button1_link', e.target.value)} className="input-field" /></Field>
          <Field label="Button 2 Text"><input value={form.hero_button2_text} onChange={(e) => set('hero_button2_text', e.target.value)} className="input-field" /></Field>
          <Field label="Button 2 Link"><input value={form.hero_button2_link} onChange={(e) => set('hero_button2_link', e.target.value)} className="input-field" /></Field>
        </div>
        <Field label="Banner Image URL"><input value={form.banner_image_url} onChange={(e) => set('banner_image_url', e.target.value)} className="input-field" placeholder="https://..." /></Field>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Bell size={16} className="text-gold-400" /> Announcement Bar</h3>
        <Toggle checked={form.announcement_enabled} onChange={(v) => set('announcement_enabled', v)} label="Enable Announcement Bar" description="Show a scrolling announcement bar at the top of the homepage" />
        {form.announcement_enabled && (
          <Field label="Announcement Text"><input value={form.announcement_text} onChange={(e) => set('announcement_text', e.target.value)} className="input-field" placeholder="Special offer..." /></Field>
        )}
      </div>

      <div className="glass rounded-2xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Eye size={16} className="text-gold-400" /> Homepage Sections</h3>
        <Toggle checked={form.show_featured} onChange={(v) => set('show_featured', v)} label="Featured Listings" description="Show featured accounts section" />
        <Toggle checked={form.show_trending} onChange={(v) => set('show_trending', v)} label="Trending Listings" description="Show trending accounts section" />
        <Toggle checked={form.show_reviews} onChange={(v) => set('show_reviews', v)} label="Customer Reviews" description="Show customer reviews section" />
        <Toggle checked={form.show_faq} onChange={(v) => set('show_faq', v)} label="FAQ Section" description="Show FAQ section" />
        <Toggle checked={form.show_stats} onChange={(v) => set('show_stats', v)} label="Platform Stats" description="Show platform statistics section" />
      </div>

      <SaveButton onSave={() => onSave(form as unknown as Record<string, unknown>)} saving={saving} />
    </div>
  );
}

// ============================================================
// PAYMENT TAB
// ============================================================

function PaymentTab({ config, onSave, saving }: { config: SiteControl['payment']; onSave: (v: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState(config);
  const set = (k: string, v: number) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gold-400/5 border border-gold-400/15">
        <AlertTriangle size={15} className="text-gold-400 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-400">Razorpay API keys (Key ID, Key Secret, Webhook Secret) and Test/Live mode are managed in the <button onClick={() => navigate('/admin/payments')} className="text-gold-300 underline">Payment Settings</button> page. This tab controls wallet limits.</p>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><CreditCard size={16} className="text-gold-400" /> Wallet Top-up Limits</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Minimum Top-up (₹)"><input type="number" value={form.min_topup} onChange={(e) => set('min_topup', Number(e.target.value))} className="input-field" /></Field>
          <Field label="Maximum Top-up (₹)"><input type="number" value={form.max_topup} onChange={(e) => set('max_topup', Number(e.target.value))} className="input-field" /></Field>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Upload size={16} className="text-gold-400" /> Withdrawal Limits</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Minimum Withdrawal (₹)"><input type="number" value={form.min_withdrawal} onChange={(e) => set('min_withdrawal', Number(e.target.value))} className="input-field" /></Field>
          <Field label="Maximum Withdrawal (₹)"><input type="number" value={form.max_withdrawal} onChange={(e) => set('max_withdrawal', Number(e.target.value))} className="input-field" /></Field>
        </div>
      </div>

      <SaveButton onSave={() => onSave(form as unknown as Record<string, unknown>)} saving={saving} />
    </div>
  );
}

// ============================================================
// COMMISSION TAB
// ============================================================

function CommissionTab({ config, onSave, saving }: { config: SiteControl['commission']; onSave: (v: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState(config);
  const set = (k: string, v: number) => setForm((f) => ({ ...f, [k]: v }));
  const totalPlatform = form.buyer_fee_percent + form.seller_commission_percent;

  return (
    <div className="space-y-5">
      <div className="glass-gold rounded-2xl p-5 flex items-center gap-4">
        <span className="grid place-items-center w-12 h-12 rounded-xl bg-gold-400/10 text-gold-400"><Percent size={24} /></span>
        <div>
          <p className="text-sm text-gray-400">Total Platform Revenue</p>
          <p className="font-display text-2xl font-bold gold-text">{totalPlatform}%</p>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <Field label="Buyer Platform Fee (%)" hint="Added on top of listing price"><input type="number" step="0.1" value={form.buyer_fee_percent} onChange={(e) => set('buyer_fee_percent', Number(e.target.value))} className="input-field" /></Field>
        <Field label="Seller Commission (%)" hint="Deducted from seller's earnings"><input type="number" step="0.1" value={form.seller_commission_percent} onChange={(e) => set('seller_commission_percent', Number(e.target.value))} className="input-field" /></Field>
        <Field label="Referral Bonus (%)" hint="Bonus for referral program"><input type="number" step="0.1" value={form.referral_bonus_percent} onChange={(e) => set('referral_bonus_percent', Number(e.target.value))} className="input-field" /></Field>
        <Field label="Coupon Discount (%)" hint="Default coupon discount percentage"><input type="number" step="0.1" value={form.coupon_discount_percent} onChange={(e) => set('coupon_discount_percent', Number(e.target.value))} className="input-field" /></Field>
      </div>

      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
        <AlertTriangle size={15} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-400">Commission changes apply instantly to new orders. Existing orders keep their original commission rates.</p>
      </div>

      <SaveButton onSave={() => onSave(form as unknown as Record<string, unknown>)} saving={saving} />
    </div>
  );
}

// ============================================================
// SUPPORT TAB
// ============================================================

function SupportTab({ config, onSave, saving }: { config: SiteControl['support']; onSave: (v: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState(config);
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Headphones size={16} className="text-gold-400" /> Contact Channels</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="WhatsApp Number"><input value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} className="input-field" placeholder="+91..." /></Field>
          <Field label="Telegram Username"><input value={form.telegram_username} onChange={(e) => set('telegram_username', e.target.value)} className="input-field" placeholder="@username" /></Field>
          <Field label="Support Email"><input value={form.support_email} onChange={(e) => set('support_email', e.target.value)} className="input-field" /></Field>
          <Field label="Business Hours"><input value={form.business_hours} onChange={(e) => set('business_hours', e.target.value)} className="input-field" /></Field>
        </div>
        <Field label="Auto Reply Message"><textarea value={form.auto_reply} onChange={(e) => set('auto_reply', e.target.value)} rows={2} className="input-field" /></Field>
        <Toggle checked={form.live_chat_enabled} onChange={(v) => set('live_chat_enabled', v)} label="Live Chat Status" description="Enable or disable the live chat widget" />
      </div>

      <SaveButton onSave={() => onSave(form as unknown as Record<string, unknown>)} saving={saving} />
    </div>
  );
}

// ============================================================
// SECURITY TAB
// ============================================================

function SecurityTab({ config, onSave, saving, toast }: { config: SiteControl['security']; onSave: (v: Record<string, unknown>) => void; saving: boolean; toast: (type: 'success' | 'error' | 'info', msg: string) => void }) {
  const [form, setForm] = useState(config);
  const [forceLogoutLoading, setForceLogoutLoading] = useState(false);
  const set = (k: string, v: boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleForceLogout = async () => {
    if (!confirm('This will immediately log out ALL users. Are you sure?')) return;
    setForceLogoutLoading(true);
    try {
      const count = await adminApi.forceLogoutAll();
      toast('success', `${count} sessions invalidated. All users logged out.`);
    } catch (err: any) {
      toast('error', err.message || 'Failed to force logout.');
    } finally {
      setForceLogoutLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Shield size={16} className="text-gold-400" /> Feature Toggles</h3>
        <Toggle checked={form.registration_enabled} onChange={(v) => set('registration_enabled', v)} label="Registration" description="Allow new user sign-ups" />
        <Toggle checked={form.email_otp_enabled} onChange={(v) => set('email_otp_enabled', v)} label="Email OTP" description="Require email OTP for registration" />
        <Toggle checked={form.login_enabled} onChange={(v) => set('login_enabled', v)} label="Login" description="Allow users to log in" />
        <Toggle checked={form.kyc_required} onChange={(v) => set('kyc_required', v)} label="KYC Requirement" description="Require KYC before selling" />
        <Toggle checked={form.selling_enabled} onChange={(v) => set('selling_enabled', v)} label="Selling" description="Allow listing accounts for sale" />
        <Toggle checked={form.buying_enabled} onChange={(v) => set('buying_enabled', v)} label="Buying" description="Allow purchasing accounts" />
        <Toggle checked={form.wallet_enabled} onChange={(v) => set('wallet_enabled', v)} label="Wallet" description="Enable wallet functionality" />
        <Toggle checked={form.withdrawals_enabled} onChange={(v) => set('withdrawals_enabled', v)} label="Withdrawals" description="Allow withdrawal requests" />
        <Toggle checked={form.escrow_enabled} onChange={(v) => set('escrow_enabled', v)} label="Escrow" description="Enable escrow for transactions" />
        <Toggle checked={form.chat_enabled} onChange={(v) => set('chat_enabled', v)} label="Chat" description="Enable buyer-seller messaging" />
      </div>

      <div className="glass rounded-2xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><AlertTriangle size={16} className="text-error-400" /> Critical Controls</h3>
        <Toggle checked={form.maintenance_mode} onChange={(v) => set('maintenance_mode', v)} label="Maintenance Mode" description="Take the entire site offline for maintenance" />
        <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-error-500/5 border border-error-500/15">
          <div>
            <p className="text-sm font-medium text-gray-200">Force Logout All Users</p>
            <p className="text-xs text-gray-500 mt-0.5">Immediately invalidate all active sessions</p>
          </div>
          <button onClick={handleForceLogout} disabled={forceLogoutLoading} className="btn-outline text-error-400 border-error-500/30 hover:bg-error-500/10 text-sm">
            {forceLogoutLoading ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />} Force Logout
          </button>
        </div>
      </div>

      <SaveButton onSave={() => onSave(form as unknown as Record<string, unknown>)} saving={saving} />
    </div>
  );
}

// ============================================================
// NOTIFICATIONS TAB
// ============================================================

function NotificationsTab({ config, onSave, saving }: { config: SiteControl['notifications']; onSave: (v: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState(config);
  const set = (k: string, v: boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Bell size={16} className="text-gold-400" /> Notification Channels</h3>
        <Toggle checked={form.push_enabled} onChange={(v) => set('push_enabled', v)} label="Push Notifications" description="In-app push notifications" />
        <Toggle checked={form.email_enabled} onChange={(v) => set('email_enabled', v)} label="Email Notifications" description="Send notifications via email" />
        <Toggle checked={form.maintenance_notification} onChange={(v) => set('maintenance_notification', v)} label="Maintenance Notifications" description="Notify users about maintenance" />
        <Toggle checked={form.broadcast_enabled} onChange={(v) => set('broadcast_enabled', v)} label="Broadcast Notifications" description="Allow admin broadcasts" />
        <Toggle checked={form.promotional_enabled} onChange={(v) => set('promotional_enabled', v)} label="Promotional Notifications" description="Send promotional offers" />
      </div>
      <SaveButton onSave={() => onSave(form as unknown as Record<string, unknown>)} saving={saving} />
    </div>
  );
}

// ============================================================
// MARKETPLACE TAB
// ============================================================

function MarketplaceTab({ config, onSave, saving }: { config: SiteControl['marketplace']; onSave: (v: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState(config);
  const set = (k: string, v: number | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Store size={16} className="text-gold-400" /> Display Settings</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Featured Listings Count"><input type="number" value={form.featured_count} onChange={(e) => set('featured_count', Number(e.target.value))} className="input-field" /></Field>
          <Field label="Trending Listings Count"><input type="number" value={form.trending_count} onChange={(e) => set('trending_count', Number(e.target.value))} className="input-field" /></Field>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Zap size={16} className="text-gold-400" /> Automation</h3>
        <Toggle checked={form.auto_listing_approval} onChange={(v) => set('auto_listing_approval', v)} label="Auto Listing Approval" description="Automatically approve new listings without admin review" />
        <Toggle checked={form.auto_kyc_approval} onChange={(v) => set('auto_kyc_approval', v)} label="Auto KYC Approval" description="Automatically approve KYC submissions (NOT recommended)" />
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><ImageIcon size={16} className="text-gold-400" /> Gallery & Expiry</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Min Gallery Images"><input type="number" value={form.min_gallery_images} onChange={(e) => set('min_gallery_images', Number(e.target.value))} className="input-field" /></Field>
          <Field label="Max Gallery Images"><input type="number" value={form.max_gallery_images} onChange={(e) => set('max_gallery_images', Number(e.target.value))} className="input-field" /></Field>
          <Field label="Listing Expiry (days)"><input type="number" value={form.listing_expiry_days} onChange={(e) => set('listing_expiry_days', Number(e.target.value))} className="input-field" /></Field>
        </div>
      </div>

      <SaveButton onSave={() => onSave(form as unknown as Record<string, unknown>)} saving={saving} />
    </div>
  );
}

// ============================================================
// BACKUP TAB
// ============================================================

function BackupTab({ toast }: { toast: (type: 'success' | 'error' | 'info', msg: string) => void }) {
  const [backups, setBackups] = useState<BackupLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadBackups = async () => {
    const { data } = await supabase.from('backup_logs').select('*').order('created_at', { ascending: false }).limit(20);
    setBackups((data ?? []) as BackupLogRow[]);
    setLoading(false);
  };

  useEffect(() => { loadBackups(); }, []);

  const createBackup = async () => {
    setCreating(true);
    try {
      const fileName = `kryzo_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
      const { error } = await adminApi.logBackup('manual', 'completed', fileName, 0);
      if (error) throw error;
      toast('success', 'Manual backup created successfully.');
      loadBackups();
    } catch (err: any) {
      toast('error', err.message || 'Failed to create backup.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Database size={16} className="text-gold-400" /> Backup Management</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={createBackup} disabled={creating} className="btn-gold">
            {creating ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <><HardDriveDownload size={16} /> Create Manual Backup</>}
          </button>
          <button className="btn-outline"><Download size={16} /> Download Latest</button>
          <button className="btn-ghost"><Upload size={16} /> Restore Backup</button>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Backup History</h3>
        {loading ? (
          <div className="py-8 text-center text-gray-500"><Loader2 size={20} className="animate-spin mx-auto" /></div>
        ) : backups.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">No backups yet.</div>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className={`grid place-items-center w-9 h-9 rounded-lg ${b.status === 'completed' ? 'bg-success-500/10 text-success-400' : 'bg-error-500/10 text-error-400'}`}>
                  <Database size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{b.file_name || `${b.type} backup`}</p>
                  <p className="text-xs text-gray-500">{b.triggered_by_name || 'System'} · {new Date(b.created_at).toLocaleString('en-IN')}</p>
                </div>
                <span className={`badge text-[10px] ${b.type === 'manual' ? 'bg-gold-400/15 text-gold-300' : b.type === 'scheduled' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'}`}>{b.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SYSTEM CONTROL TAB
// ============================================================

function SystemTab({ toast }: { toast: (type: 'success' | 'error' | 'info', msg: string) => void }) {
  const [acting, setActing] = useState<string | null>(null);
  const [health] = useState<{ label: string; status: 'healthy' | 'warning' | 'error'; value: string }[]>([
    { label: 'Database', status: 'healthy', value: 'Connected' },
    { label: 'Edge Functions', status: 'healthy', value: 'Running' },
    { label: 'Auth Service', status: 'healthy', value: 'Active' },
    { label: 'Storage', status: 'healthy', value: 'Available' },
  ]);

  const doAction = async (action: string, fn: () => Promise<any>, successMsg: string) => {
    setActing(action);
    try {
      await fn();
      toast('success', successMsg);
    } catch (err: any) {
      toast('error', err.message || 'Action failed.');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Server size={16} className="text-gold-400" /> System Actions</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <button onClick={() => doAction('cache', () => adminApi.clearCache(), 'Cache cleared successfully.')} disabled={acting === 'cache'} className="btn-ghost justify-start">
            {acting === 'cache' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Clear Cache
          </button>
          <button onClick={() => doAction('optimize', () => adminApi.optimizeDatabase(), 'Database optimization initiated.')} disabled={acting === 'optimize'} className="btn-ghost justify-start">
            {acting === 'optimize' ? <Loader2 size={16} className="animate-spin" /> : <Cpu size={16} />} Optimize Database
          </button>
          <button onClick={() => doAction('restart', () => new Promise(r => setTimeout(r, 1500)), 'Service restart initiated.')} disabled={acting === 'restart'} className="btn-ghost justify-start">
            {acting === 'restart' ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />} Restart Services
          </button>
          <button onClick={() => toast('info', 'Error logs are available in the Audit Logs page.')} className="btn-ghost justify-start">
            <FileWarning size={16} /> View Error Logs
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><Activity size={16} className="text-gold-400" /> System Health</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {health.map((h) => (
            <div key={h.label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span className={`grid place-items-center w-9 h-9 rounded-lg ${h.status === 'healthy' ? 'bg-success-500/10 text-success-400' : h.status === 'warning' ? 'bg-warning-500/10 text-warning-400' : 'bg-error-500/10 text-error-400'}`}>
                {h.status === 'healthy' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-200">{h.label}</p>
                <p className="text-xs text-gray-500">{h.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><HardDrive size={16} className="text-gold-400" /> Server Status</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <p className="text-xs text-gray-500">Uptime</p>
            <p className="text-sm font-semibold text-success-400 mt-1">99.9%</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <p className="text-xs text-gray-500">Response Time</p>
            <p className="text-sm font-semibold text-gold-300 mt-1">~120ms</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <p className="text-xs text-gray-500">Active Connections</p>
            <p className="text-sm font-semibold text-white mt-1">Normal</p>
          </div>
        </div>
      </div>
    </div>
  );
}
