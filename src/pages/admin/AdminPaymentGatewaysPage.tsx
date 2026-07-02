import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { useToast } from '../../components/Toast';
import type { PaymentGatewayRow } from '../../lib/supabase';
import {
  CreditCard, Search, Settings, Shield, AlertCircle, CheckCircle2,
  Power, Edit2, X, Eye, EyeOff, Loader2, RefreshCw, TestTube
} from 'lucide-react';

export function AdminPaymentGatewaysPage() {
  const toast = useToast();
  const [gateways, setGateways] = useState<PaymentGatewayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [isSuper, setIsSuper] = useState(false);
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<PaymentGatewayRow | null>(null);
  const [editForm, setEditForm] = useState({
    display_name: '',
    api_key: '',
    api_secret: '',
    webhook_secret: '',
    is_enabled: false,
    sandbox_mode: true,
    currency: 'INR',
    supports_refund: true,
    supports_partial_refund: false,
    min_amount: 100,
    max_amount: 500000,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getPaymentGateways();
      setGateways((data ?? []) as PaymentGatewayRow[]);
      // Check if any gateway returned is_super_admin flag
      if (data && data.length > 0 && 'is_super_admin' in data[0]) {
        setIsSuper((data[0] as any).is_super_admin);
      }
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load gateways');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setIsSuper(role === 'super_admin');
      setChecking(false);
      load();
    })();
  }, [load]);

  const filtered = gateways.filter((g) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [g.gateway_name, g.display_name].some((f) => f.toLowerCase().includes(q));
  });

  const openEdit = (g: PaymentGatewayRow) => {
    setEditTarget(g);
    setEditForm({
      display_name: g.display_name,
      api_key: g.api_key ?? '',
      api_secret: g.api_secret ?? '',
      webhook_secret: g.webhook_secret ?? '',
      is_enabled: g.is_enabled,
      sandbox_mode: g.sandbox_mode,
      currency: g.currency,
      supports_refund: g.supports_refund,
      supports_partial_refund: g.supports_partial_refund,
      min_amount: g.min_amount,
      max_amount: g.max_amount,
    });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const { error } = await adminApi.updatePaymentGateway(editTarget.id, {
        display_name: editForm.display_name || undefined,
        api_key: editForm.api_key || undefined,
        api_secret: editForm.api_secret || undefined,
        webhook_secret: editForm.webhook_secret || undefined,
        is_enabled: editForm.is_enabled,
        sandbox_mode: editForm.sandbox_mode,
        currency: editForm.currency || undefined,
        supports_refund: editForm.supports_refund,
        supports_partial_refund: editForm.supports_partial_refund,
        min_amount: editForm.min_amount || undefined,
        max_amount: editForm.max_amount || undefined,
      });
      if (error) throw error;
      toast('success', 'Gateway updated successfully');
      setEditTarget(null);
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (g: PaymentGatewayRow) => {
    try {
      const { error } = await adminApi.updatePaymentGateway(g.id, { is_enabled: !g.is_enabled });
      if (error) throw error;
      toast('success', g.is_enabled ? 'Gateway disabled' : 'Gateway enabled');
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Action failed');
    }
  };

  const testGateway = async (g: PaymentGatewayRow) => {
    setTesting(g.id);
    try {
      const result = await adminApi.testPaymentGateway(g.id);
      if (result.success) {
        toast('success', `${g.display_name}: ${result.message}`);
      } else {
        toast('warning', `${g.display_name}: ${result.message}`);
      }
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Test failed');
    } finally {
      setTesting(null);
    }
  };

  const toggleShowSecret = (id: string) => {
    setShowSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access...</div>;

  return (
    <AdminLayout currentPath="/admin/payment-gateways">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-2">
          <CreditCard className="text-gold-400" /> Payment Gateways
        </h1>
        <p className="text-sm text-gray-400 mb-6">Configure and manage payment gateway integrations.</p>

        {!isSuper && (
          <div className="glass rounded-xl p-4 mb-6 border border-warning-500/30 flex items-start gap-3">
            <Shield className="text-warning-400 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm text-warning-400 font-medium">Limited Access</p>
              <p className="text-xs text-gray-400">API keys and secrets are masked. Only Super Admin can view and edit sensitive credentials.</p>
            </div>
          </div>
        )}

        <div className="relative mb-6 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input-field pl-10"
            placeholder="Search gateways..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading gateways...</div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-gray-500">No gateways found.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((g) => (
              <div key={g.id} className={`glass rounded-2xl p-5 ${g.is_enabled ? 'border border-gold-400/20' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`grid place-items-center w-12 h-12 rounded-xl ${g.is_enabled ? 'bg-gold-gradient text-ink-950' : 'bg-white/[0.06] text-gray-400'}`}>
                      <CreditCard size={22} />
                    </span>
                    <div>
                      <p className="font-display font-bold text-white">{g.display_name}</p>
                      <p className="text-xs text-gray-500 uppercase">{g.gateway_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${g.is_enabled ? 'bg-success-500/15 text-success-400' : 'bg-white/[0.06] text-gray-400'}`}>
                      {g.is_enabled ? 'Active' : 'Inactive'}
                    </span>
                    <span className={`badge ${g.sandbox_mode ? 'bg-warning-500/15 text-warning-400' : 'bg-info-500/15 text-info-400'}`}>
                      {g.sandbox_mode ? 'Sandbox' : 'Live'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-xs text-gray-500">API Key</p>
                    <p className="text-gray-300 font-mono text-xs truncate">
                      {isSuper && showSecrets[g.id] ? (g.api_key || 'Not set') : (g.api_key ? '••••••••••••' : 'Not set')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Webhook Secret</p>
                    <p className="text-gray-300 font-mono text-xs">
                      {g.webhook_secret ? 'Configured' : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Currency</p>
                    <p className="text-gray-200">{g.currency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Amount Range</p>
                    <p className="text-gray-200">₹{g.min_amount} - ₹{g.max_amount.toLocaleString()}</p>
                  </div>
                </div>

                {g.last_test_at && (
                  <div className="flex items-center gap-2 mb-4">
                    {g.last_test_status === 'success' ? (
                      <CheckCircle2 size={14} className="text-success-400" />
                    ) : (
                      <AlertCircle size={14} className="text-error-400" />
                    )}
                    <span className="text-xs text-gray-500">
                      Last test: {new Date(g.last_test_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {isSuper && (
                    <>
                      <button onClick={() => openEdit(g)} className="btn-ghost px-3 py-1.5 text-xs">
                        <Edit2 size={13} /> Edit Config
                      </button>
                      <button onClick={() => toggleShowSecret(g.id)} className="btn-ghost px-3 py-1.5 text-xs">
                        {showSecrets[g.id] ? <EyeOff size={13} /> : <Eye size={13} />} {showSecrets[g.id] ? 'Hide' : 'Show'} Keys
                      </button>
                    </>
                  )}
                  <button onClick={() => testGateway(g)} disabled={testing === g.id} className="btn-ghost px-3 py-1.5 text-xs">
                    {testing === g.id ? <Loader2 size={13} className="animate-spin" /> : <TestTube size={13} />} Test
                  </button>
                  <button onClick={() => toggleEnabled(g)} disabled={!isSuper && !g.is_enabled} className={`btn-ghost px-3 py-1.5 text-xs ${g.is_enabled ? 'text-error-400' : 'text-success-400'}`}>
                    <Power size={13} /> {g.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setEditTarget(null)}>
          <div className="glass-gold rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-white">Edit {editTarget.display_name}</h3>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-field">Display Name</label>
                <input value={editForm.display_name} onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))} className="input-field" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">API Key</label>
                  <input value={editForm.api_key} onChange={(e) => setEditForm((f) => ({ ...f, api_key: e.target.value }))} className="input-field font-mono text-xs" placeholder="rzp_live_..." />
                </div>
                <div>
                  <label className="label-field">API Secret</label>
                  <input type="password" value={editForm.api_secret} onChange={(e) => setEditForm((f) => ({ ...f, api_secret: e.target.value }))} className="input-field font-mono text-xs" placeholder="••••••••" />
                </div>
              </div>

              <div>
                <label className="label-field">Webhook Secret</label>
                <input type="password" value={editForm.webhook_secret} onChange={(e) => setEditForm((f) => ({ ...f, webhook_secret: e.target.value }))} className="input-field font-mono text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Mode</label>
                  <select value={editForm.sandbox_mode ? 'sandbox' : 'live'} onChange={(e) => setEditForm((f) => ({ ...f, sandbox_mode: e.target.value === 'sandbox' }))} className="input-field">
                    <option value="sandbox">Sandbox (Test)</option>
                    <option value="live">Live</option>
                  </select>
                </div>
                <div>
                  <label className="label-field">Currency</label>
                  <select value={editForm.currency} onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value }))} className="input-field">
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Min Amount</label>
                  <input type="number" value={editForm.min_amount} onChange={(e) => setEditForm((f) => ({ ...f, min_amount: parseInt(e.target.value) || 0 }))} className="input-field" />
                </div>
                <div>
                  <label className="label-field">Max Amount</label>
                  <input type="number" value={editForm.max_amount} onChange={(e) => setEditForm((f) => ({ ...f, max_amount: parseInt(e.target.value) || 0 }))} className="input-field" />
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.is_enabled} onChange={(e) => setEditForm((f) => ({ ...f, is_enabled: e.target.checked }))} className="w-4 h-4 accent-gold-400" />
                  <span className="text-sm text-gray-300">Enabled</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.supports_refund} onChange={(e) => setEditForm((f) => ({ ...f, supports_refund: e.target.checked }))} className="w-4 h-4 accent-gold-400" />
                  <span className="text-sm text-gray-300">Supports Refund</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.supports_partial_refund} onChange={(e) => setEditForm((f) => ({ ...f, supports_partial_refund: e.target.checked }))} className="w-4 h-4 accent-gold-400" />
                  <span className="text-sm text-gray-300">Partial Refund</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={saveEdit} disabled={saving} className="btn-gold flex-1">
                {saving ? <Loader2 size={16} className="animate-spin" /> : null} Save Changes
              </button>
              <button onClick={() => setEditTarget(null)} className="btn-outline">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
