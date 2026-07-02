import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { useToast } from '../../components/Toast';
import type { GstSettingsRow } from '../../lib/supabase';
import {
  Receipt, Shield, Building, MapPin, FileText, Save, Loader2,
  Percent, Hash, Image, CheckCircle2, XCircle, Eye, EyeOff
} from 'lucide-react';

export function AdminGstPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<GstSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [isSuper, setIsSuper] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPan, setShowPan] = useState(false);
  const [form, setForm] = useState({
    gst_enabled: false,
    gst_percentage: 18,
    gst_number: '',
    company_name: '',
    company_address: '',
    company_city: '',
    company_state: '',
    company_pincode: '',
    company_pan: '',
    invoice_prefix: 'INV',
    invoice_starting_number: 1001,
    invoice_logo_url: '',
    invoice_footer_text: 'Thank you for your business!',
    hsn_sac_code: '998311',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getGstSettings();
      setSettings(data as GstSettingsRow);
      setForm({
        gst_enabled: data.gst_enabled ?? false,
        gst_percentage: data.gst_percentage ?? 18,
        gst_number: data.gst_number ?? '',
        company_name: data.company_name ?? '',
        company_address: data.company_address ?? '',
        company_city: data.company_city ?? '',
        company_state: data.company_state ?? '',
        company_pincode: data.company_pincode ?? '',
        company_pan: data.company_pan ?? '',
        invoice_prefix: data.invoice_prefix ?? 'INV',
        invoice_starting_number: data.invoice_starting_number ?? 1001,
        invoice_logo_url: data.invoice_logo_url ?? '',
        invoice_footer_text: data.invoice_footer_text ?? 'Thank you for your business!',
        hsn_sac_code: data.hsn_sac_code ?? '998311',
      });
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load GST settings');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-dep

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setIsSuper(role === 'super_admin');
      setChecking(false);
      load();
    })();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await adminApi.updateGstSettings({
        gst_enabled: form.gst_enabled,
        gst_percentage: form.gst_percentage || undefined,
        gst_number: form.gst_number || undefined,
        company_name: form.company_name || undefined,
        company_address: form.company_address || undefined,
        company_city: form.company_city || undefined,
        company_state: form.company_state || undefined,
        company_pincode: form.company_pincode || undefined,
        company_pan: form.company_pan || undefined,
        invoice_prefix: form.invoice_prefix || undefined,
        invoice_starting_number: form.invoice_starting_number || undefined,
        invoice_logo_url: form.invoice_logo_url || undefined,
        invoice_footer_text: form.invoice_footer_text || undefined,
        hsn_sac_code: form.hsn_sac_code || undefined,
      });
      if (error) throw error;
      toast('success', 'GST settings saved successfully');
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const isValidGstin = form.gst_number ? gstinRegex.test(form.gst_number.toUpperCase()) : true;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const isValidPan = form.company_pan ? panRegex.test(form.company_pan.toUpperCase()) : true;

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access...</div>;

  return (
    <AdminLayout currentPath="/admin/gst-settings">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-2">
          <Receipt className="text-gold-400" /> GST Settings
        </h1>
        <p className="text-sm text-gray-400 mb-6">Configure GST for invoice generation and tax compliance.</p>

        {!isSuper && (
          <div className="glass rounded-xl p-4 mb-6 border border-warning-500/30 flex items-start gap-3">
            <Shield className="text-warning-400 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm text-warning-400 font-medium">Read Only</p>
              <p className="text-xs text-gray-400">Only Super Admin can modify GST settings.</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading settings...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* GST Toggle */}
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-white flex items-center gap-2">
                    <Percent size={18} className="text-gold-400" /> GST Configuration
                  </h3>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <span className={`text-sm ${form.gst_enabled ? 'text-success-400' : 'text-gray-400'}`}>
                      {form.gst_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, gst_enabled: !f.gst_enabled }))}
                      disabled={!isSuper}
                      className={`relative w-12 h-6 rounded-full transition-colors ${form.gst_enabled ? 'bg-gold-400' : 'bg-ink-700'} ${!isSuper ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${form.gst_enabled ? 'translate-x-6' : ''}`} />
                    </button>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">GST Percentage (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={form.gst_percentage}
                      onChange={(e) => setForm((f) => ({ ...f, gst_percentage: parseFloat(e.target.value) || 0 }))}
                      className="input-field"
                      disabled={!isSuper || !form.gst_enabled}
                    />
                  </div>
                  <div>
                    <label className="label-field">GST Number (GSTIN)</label>
                    <input
                      value={form.gst_number}
                      onChange={(e) => setForm((f) => ({ ...f, gst_number: e.target.value.toUpperCase() }))}
                      className={`input-field font-mono ${!isValidGstin ? 'border-error-500' : ''}`}
                      placeholder="29ABCDE1234F1Z5"
                      maxLength={15}
                      disabled={!isSuper || !form.gst_enabled}
                    />
                    {form.gst_number && !isValidGstin && (
                      <p className="text-xs text-error-400 mt-1">Invalid GSTIN format</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Company Details */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                  <Building size={18} className="text-gold-400" /> Company Details
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="label-field">Company Name</label>
                    <input
                      value={form.company_name}
                      onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                      className="input-field"
                      placeholder="Kryzo Technologies Pvt Ltd"
                      disabled={!isSuper}
                    />
                  </div>

                  <div>
                    <label className="label-field">Company Address</label>
                    <textarea
                      value={form.company_address}
                      onChange={(e) => setForm((f) => ({ ...f, company_address: e.target.value }))}
                      className="input-field min-h-[80px]"
                      placeholder="123, Business Park, Sector 15"
                      disabled={!isSuper}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label-field">City</label>
                      <input
                        value={form.company_city}
                        onChange={(e) => setForm((f) => ({ ...f, company_city: e.target.value }))}
                        className="input-field"
                        placeholder="Bangalore"
                        disabled={!isSuper}
                      />
                    </div>
                    <div>
                      <label className="label-field">State</label>
                      <input
                        value={form.company_state}
                        onChange={(e) => setForm((f) => ({ ...f, company_state: e.target.value }))}
                        className="input-field"
                        placeholder="Karnataka"
                        disabled={!isSuper}
                      />
                    </div>
                    <div>
                      <label className="label-field">Pincode</label>
                      <input
                        value={form.company_pincode}
                        onChange={(e) => setForm((f) => ({ ...f, company_pincode: e.target.value }))}
                        className="input-field"
                        placeholder="560001"
                        maxLength={6}
                        disabled={!isSuper}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label-field">Company PAN</label>
                    <div className="relative">
                      <input
                        type={showPan ? 'text' : 'password'}
                        value={form.company_pan}
                        onChange={(e) => setForm((f) => ({ ...f, company_pan: e.target.value.toUpperCase() }))}
                        className={`input-field font-mono pr-10 ${!isValidPan ? 'border-error-500' : ''}`}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        disabled={!isSuper}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPan(!showPan)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                      >
                        {showPan ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {form.company_pan && !isValidPan && (
                      <p className="text-xs text-error-400 mt-1">Invalid PAN format</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Invoice Settings */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                  <FileText size={18} className="text-gold-400" /> Invoice Settings
                </h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-field">Invoice Prefix</label>
                      <input
                        value={form.invoice_prefix}
                        onChange={(e) => setForm((f) => ({ ...f, invoice_prefix: e.target.value.toUpperCase() }))}
                        className="input-field font-mono"
                        placeholder="INV"
                        maxLength={6}
                        disabled={!isSuper}
                      />
                    </div>
                    <div>
                      <label className="label-field">Starting Invoice Number</label>
                      <input
                        type="number"
                        value={form.invoice_starting_number}
                        onChange={(e) => setForm((f) => ({ ...f, invoice_starting_number: parseInt(e.target.value) || 1001 }))}
                        className="input-field"
                        disabled={!isSuper}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label-field">HSN/SAC Code</label>
                    <input
                      value={form.hsn_sac_code}
                      onChange={(e) => setForm((f) => ({ ...f, hsn_sac_code: e.target.value }))}
                      className="input-field font-mono"
                      placeholder="998311"
                      disabled={!isSuper}
                    />
                    <p className="text-xs text-gray-500 mt-1">HSN/SAC code for services (default: 998311 for IT services)</p>
                  </div>

                  <div>
                    <label className="label-field">Invoice Logo URL</label>
                    <input
                      value={form.invoice_logo_url}
                      onChange={(e) => setForm((f) => ({ ...f, invoice_logo_url: e.target.value }))}
                      className="input-field"
                      placeholder="https://..."
                      disabled={!isSuper}
                    />
                  </div>

                  <div>
                    <label className="label-field">Invoice Footer Text</label>
                    <textarea
                      value={form.invoice_footer_text}
                      onChange={(e) => setForm((f) => ({ ...f, invoice_footer_text: e.target.value }))}
                      className="input-field min-h-[60px]"
                      placeholder="Thank you for your business!"
                      disabled={!isSuper}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="space-y-6">
              <div className="glass rounded-2xl p-5 sticky top-6">
                <h3 className="font-display font-bold text-white mb-4">Invoice Preview</h3>

                <div className="bg-white text-ink-950 rounded-lg p-4 text-sm">
                  {form.invoice_logo_url && (
                    <img src={form.invoice_logo_url} alt="Logo" className="h-10 mb-3" />
                  )}
                  <p className="font-bold text-lg">{form.company_name || 'Company Name'}</p>
                  <p className="text-xs text-gray-600">
                    {form.company_address || 'Address'}<br />
                    {form.company_city && `${form.company_city}, `}{form.company_state} - {form.company_pincode}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    GSTIN: {form.gst_number || '—'} | PAN: {form.company_pan || '—'}
                  </p>

                  <div className="border-t border-gray-200 mt-3 pt-3">
                    <p className="font-semibold">Tax Invoice</p>
                    <p className="text-xs">No: {form.invoice_prefix}-{String(form.invoice_starting_number).padStart(6, '0')}</p>
                  </div>

                  <div className="border-t border-gray-200 mt-3 pt-3 text-xs text-gray-500">
                    <p>HSN/SAC: {form.hsn_sac_code || '998311'}</p>
                    {form.gst_enabled && (
                      <p className="text-ink-900 font-medium mt-1">GST @ {form.gst_percentage}% applicable</p>
                    )}
                  </div>

                  <div className="border-t border-gray-200 mt-3 pt-3 text-xs text-gray-500 italic">
                    {form.invoice_footer_text || 'Thank you for your business!'}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {form.gst_enabled ? (
                      <CheckCircle2 size={16} className="text-success-400" />
                    ) : (
                      <XCircle size={16} className="text-gray-500" />
                    )}
                    <span className={form.gst_enabled ? 'text-success-400' : 'text-gray-400'}>
                      GST {form.gst_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {form.company_name && form.gst_number ? (
                      <CheckCircle2 size={16} className="text-success-400" />
                    ) : (
                      <XCircle size={16} className="text-warning-400" />
                    )}
                    <span className={form.company_name && form.gst_number ? 'text-success-400' : 'text-warning-400'}>
                      {form.company_name && form.gst_number ? 'Configuration Complete' : 'Incomplete Configuration'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-display font-bold text-white mb-3">GST Information</h3>
                <ul className="text-xs text-gray-400 space-y-2">
                  <li>• GST is applied on platform fees and commissions</li>
                  <li>• Enable GST for generating tax-compliant invoices</li>
                  <li>• GSTIN must be 15 characters (e.g., 29ABCDE1234F1Z5)</li>
                  <li>• PAN must be 10 characters (e.g., ABCDE1234F)</li>
                  <li>• Invoice numbers auto-increment per transaction</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        {isSuper && !loading && (
          <div className="fixed bottom-6 right-6">
            <button onClick={save} disabled={saving} className="btn-gold flex items-center gap-2 shadow-lg">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Settings
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
