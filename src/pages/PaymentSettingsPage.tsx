import { useState, useEffect } from 'react';
import { navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { paymentApi } from '../lib/payments';
import { useToast } from '../components/Toast';
import { ShieldCheck, Save, Loader2, AlertTriangle, CheckCircle2, KeyRound, Globe, Building2, Lock } from 'lucide-react';

export function PaymentSettingsPage() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const [config, setConfig] = useState({
    razorpay_key_id: '',
    razorpay_key_secret: '',
    razorpay_webhook_secret: '',
    payment_mode: 'test' as 'test' | 'live',
    currency: 'INR',
    company_name: 'Kryzo',
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    paymentApi.getConfig().then((c) => {
      setConfig((prev) => ({
        ...prev,
        razorpay_key_id: c.key_id || '',
        payment_mode: c.payment_mode || 'test',
        currency: c.currency || 'INR',
        company_name: c.company_name || 'Kryzo',
      }));
      setIsConfigured(c.is_configured);
      setLoadingConfig(false);
    }).catch(() => setLoadingConfig(false));
  }, [loading, user]);

  if (loading || !user) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.razorpay_key_id || !config.razorpay_key_secret) {
      toast('error', 'Razorpay Key ID and Key Secret are required.');
      return;
    }
    setSaving(true);
    try {
      await paymentApi.saveSettings(config);
      setIsConfigured(true);
      toast('success', 'Payment settings saved! The site will now use these credentials.');
    } catch (err: any) {
      toast('error', err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="mb-8">
        <span className="section-eyebrow">Admin</span>
        <h1 className="font-display text-3xl font-bold text-white">Payment Settings</h1>
        <p className="mt-2 text-gray-400">Configure Razorpay credentials. When Live credentials are added, the site automatically uses Live mode.</p>
      </div>

      {/* Status banner */}
      {loadingConfig ? (
        <div className="glass rounded-2xl p-5 mb-6 text-center text-gray-500">Loading configuration...</div>
      ) : isConfigured ? (
        <div className="glass rounded-2xl p-5 mb-6 flex items-center gap-4 border border-success-500/20">
          <span className="grid place-items-center w-10 h-10 rounded-lg bg-success-500/10 text-success-400"><CheckCircle2 size={20} /></span>
          <div>
            <p className="text-sm font-semibold text-white">Payments Configured</p>
            <p className="text-xs text-gray-400">Razorpay is active in {config.payment_mode} mode.</p>
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
        {/* Key ID */}
        <div>
          <label className="label-field inline-flex items-center gap-1.5"><KeyRound size={14} className="text-gold-400" /> Razorpay Key ID *</label>
          <input
            value={config.razorpay_key_id}
            onChange={(e) => setConfig((c) => ({ ...c, razorpay_key_id: e.target.value }))}
            placeholder="rzp_test_XXXXXXXXXX"
            className="input-field font-mono text-sm"
          />
        </div>

        {/* Key Secret */}
        <div>
          <label className="label-field inline-flex items-center gap-1.5"><Lock size={14} className="text-gold-400" /> Razorpay Key Secret *</label>
          <input
            type="password"
            value={config.razorpay_key_secret}
            onChange={(e) => setConfig((c) => ({ ...c, razorpay_key_secret: e.target.value }))}
            placeholder="••••••••••••••••"
            className="input-field font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-600">Stored securely. Never exposed on the frontend.</p>
        </div>

        {/* Webhook Secret */}
        <div>
          <label className="label-field inline-flex items-center gap-1.5"><Lock size={14} className="text-gold-400" /> Razorpay Webhook Secret</label>
          <input
            type="password"
            value={config.razorpay_webhook_secret}
            onChange={(e) => setConfig((c) => ({ ...c, razorpay_webhook_secret: e.target.value }))}
            placeholder="••••••••••••••••"
            className="input-field font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-600">Used to verify incoming Razorpay webhooks.</p>
        </div>

        {/* Payment Mode */}
        <div>
          <label className="label-field">Payment Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfig((c) => ({ ...c, payment_mode: 'test' }))}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${config.payment_mode === 'test' ? 'bg-gold-gradient text-ink-950' : 'glass text-gray-300'}`}
            >
              <ShieldCheck size={15} /> Test Mode
            </button>
            <button
              type="button"
              onClick={() => setConfig((c) => ({ ...c, payment_mode: 'live' }))}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${config.payment_mode === 'live' ? 'bg-gold-gradient text-ink-950' : 'glass text-gray-300'}`}
            >
              <Globe size={15} /> Live Mode
            </button>
          </div>
        </div>

        {/* Currency */}
        <div>
          <label className="label-field">Currency</label>
          <select
            value={config.currency}
            onChange={(e) => setConfig((c) => ({ ...c, currency: e.target.value }))}
            className="input-field text-sm"
          >
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>

        {/* Company Name */}
        <div>
          <label className="label-field inline-flex items-center gap-1.5"><Building2 size={14} className="text-gold-400" /> Company Name</label>
          <input
            value={config.company_name}
            onChange={(e) => setConfig((c) => ({ ...c, company_name: e.target.value }))}
            placeholder="Kryzo"
            className="input-field"
          />
          <p className="mt-1 text-xs text-gray-600">Displayed on the Razorpay checkout page.</p>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gold-400/5 border border-gold-400/15">
          <AlertTriangle size={15} className="text-gold-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400">When Live credentials are added and Live Mode is selected, the website will automatically start using Live Razorpay without any source code changes. API keys are stored securely in the database and never exposed to the frontend.</p>
        </div>

        <button type="submit" disabled={saving} className="btn-gold w-full text-base">
          {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> Save Configuration</>}
        </button>
      </form>
    </div>
  );
}
