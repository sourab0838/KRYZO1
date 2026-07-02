import { useEffect, useState } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { checkAdminRole } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { getToken } from '../../lib/authApi';
import { CreditCard, Save, Loader2, AlertTriangle, CheckCircle2, KeyRound, Globe, Building2, Lock, ShieldCheck } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function AdminPaymentSettingsPage() {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [config, setConfig] = useState({
    razorpay_key_id: '',
    razorpay_key_secret: '',
    razorpay_webhook_secret: '',
    payment_mode: 'test' as 'test' | 'live',
    currency: 'INR',
    company_name: 'Kryzo',
  });

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setChecking(false);
      try {
        const { data: rpcData } = await supabase.rpc('get_payment_config');
        const c = (rpcData as any) ?? {};
        setConfig((prev) => ({
          ...prev,
          razorpay_key_id: c.key_id || '',
          payment_mode: c.payment_mode || 'test',
          currency: c.currency || 'INR',
          company_name: c.company_name || 'Kryzo',
        }));
        setIsConfigured(!!c.is_configured);

        const { data: row } = await supabase.from('payment_settings').select('key, value').in('key', ['razorpay_key_secret', 'razorpay_webhook_secret']);
        const map = new Map((row ?? []).map((r: any) => [r.key, r.value]));
        setSecretConfigured(!!map.get('razorpay_key_secret'));
        setWebhookConfigured(!!map.get('razorpay_webhook_secret'));
      } catch (e: any) {
        toast('error', e?.message ?? 'Failed to load payment config');
      } finally {
        setLoadingConfig(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.razorpay_key_id) { toast('error', 'Razorpay Key ID is required.'); return; }
    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch(`${supabaseUrl}/functions/v1/zonex-payments/save-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          ...(token ? { 'x-zonex-token': token } : {}),
        },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setIsConfigured(true);
      if (config.razorpay_key_secret) setSecretConfigured(true);
      if (config.razorpay_webhook_secret) setWebhookConfigured(true);
      toast('success', 'Payment settings saved.');
    } catch (err: any) {
      toast('error', err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access…</div>;

  return (
    <AdminLayout currentPath="/admin/payments">
      <div className="animate-fade-in max-w-2xl">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-2">
          <CreditCard className="text-gold-400" /> Payment Settings
        </h1>

        {loadingConfig ? (
          <div className="glass rounded-2xl p-5 mb-6 text-center text-gray-500">Loading configuration…</div>
        ) : isConfigured ? (
          <div className="glass rounded-2xl p-5 mb-6 flex items-center gap-4 border border-success-500/20">
            <span className="grid place-items-center w-10 h-10 rounded-lg bg-success-500/10 text-success-400"><CheckCircle2 size={20} /></span>
            <div>
              <p className="text-sm font-semibold text-white">Payments Configured</p>
              <p className="text-xs text-gray-400">Razorpay is active in <span className="text-gold-300 font-semibold capitalize">{config.payment_mode}</span> mode.</p>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-5 mb-6 flex items-center gap-4 border border-warning-500/20">
            <span className="grid place-items-center w-10 h-10 rounded-lg bg-warning-500/10 text-warning-400"><AlertTriangle size={20} /></span>
            <div>
              <p className="text-sm font-semibold text-white">Not Configured</p>
              <p className="text-xs text-gray-400">Add Razorpay credentials to enable payments.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="glass rounded-2xl p-6 space-y-5">
          <div>
            <label className="label-field inline-flex items-center gap-1.5"><KeyRound size={14} className="text-gold-400" /> Razorpay Key ID *</label>
            <input value={config.razorpay_key_id} onChange={(e) => setConfig((c) => ({ ...c, razorpay_key_id: e.target.value }))} placeholder="rzp_test_XXXXXXXXXX" className="input-field font-mono text-sm" />
          </div>

          <div>
            <label className="label-field inline-flex items-center gap-1.5"><Lock size={14} className="text-gold-400" /> Razorpay Key Secret</label>
            <input type="password" value={config.razorpay_key_secret} onChange={(e) => setConfig((c) => ({ ...c, razorpay_key_secret: e.target.value }))} placeholder={secretConfigured ? '•••••••• (configured — type to replace)' : '••••••••••••••••'} className="input-field font-mono text-sm" />
            <p className="mt-1 text-xs text-gray-600">{secretConfigured ? 'Secret is configured. Leave blank to keep current value.' : 'Stored securely. Never exposed on the frontend.'}</p>
          </div>

          <div>
            <label className="label-field inline-flex items-center gap-1.5"><Lock size={14} className="text-gold-400" /> Razorpay Webhook Secret</label>
            <input type="password" value={config.razorpay_webhook_secret} onChange={(e) => setConfig((c) => ({ ...c, razorpay_webhook_secret: e.target.value }))} placeholder={webhookConfigured ? '•••••••• (configured — type to replace)' : '••••••••••••••••'} className="input-field font-mono text-sm" />
            <p className="mt-1 text-xs text-gray-600">{webhookConfigured ? 'Webhook secret is configured.' : 'Used to verify incoming Razorpay webhooks.'}</p>
          </div>

          <div>
            <label className="label-field">Payment Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfig((c) => ({ ...c, payment_mode: 'test' }))} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${config.payment_mode === 'test' ? 'bg-gold-gradient text-ink-950' : 'glass text-gray-300'}`}>
                <ShieldCheck size={15} /> Test Mode
              </button>
              <button type="button" onClick={() => setConfig((c) => ({ ...c, payment_mode: 'live' }))} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${config.payment_mode === 'live' ? 'bg-gold-gradient text-ink-950' : 'glass text-gray-300'}`}>
                <Globe size={15} /> Live Mode
              </button>
            </div>
          </div>

          <div>
            <label className="label-field">Currency</label>
            <select value={config.currency} onChange={(e) => setConfig((c) => ({ ...c, currency: e.target.value }))} className="input-field text-sm">
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>

          <div>
            <label className="label-field inline-flex items-center gap-1.5"><Building2 size={14} className="text-gold-400" /> Company Name</label>
            <input value={config.company_name} onChange={(e) => setConfig((c) => ({ ...c, company_name: e.target.value }))} placeholder="Kryzo" className="input-field" />
            <p className="mt-1 text-xs text-gray-600">Displayed on the Razorpay checkout page.</p>
          </div>

          <button type="submit" disabled={saving} className="btn-gold w-full text-base">
            {saving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><Save size={18} /> Save Configuration</>}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
