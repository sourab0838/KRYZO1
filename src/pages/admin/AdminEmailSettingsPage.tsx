import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { useToast } from '../../components/Toast';
import type { EmailSettingsRow } from '../../lib/supabase';
import {
  Mail, Settings, Shield, Eye, EyeOff, Loader2, Save, RefreshCw,
  Code, Send, Clock, User, AlertCircle
} from 'lucide-react';

export function AdminEmailSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<EmailSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [isSuper, setIsSuper] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [form, setForm] = useState({
    resend_api_key: '',
    sender_email: '',
    sender_name: 'Kryzo',
    otp_subject: 'Your OTP for Kryzo',
    otp_template: '',
    otp_expiry_minutes: 5,
    welcome_email_enabled: true,
    welcome_subject: 'Welcome to Kryzo!',
    welcome_template: '',
    password_reset_template: '',
  });
  const [otpPreview, setOtpPreview] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getEmailSettings();
      setSettings(data as EmailSettingsRow);
      if ('is_super_admin' in data) {
        setIsSuper((data as any).is_super_admin);
      }
      setForm({
        resend_api_key: data.resend_api_key || '',
        sender_email: data.sender_email || '',
        sender_name: data.sender_name || 'Kryzo',
        otp_subject: data.otp_subject || 'Your OTP for Kryzo',
        otp_template: data.otp_template || '',
        otp_expiry_minutes: data.otp_expiry_minutes || 5,
        welcome_email_enabled: data.welcome_email_enabled ?? true,
        welcome_subject: data.welcome_subject || 'Welcome to Kryzo!',
        welcome_template: data.welcome_template || '',
        password_reset_template: data.password_reset_template || '',
      });
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load email settings');
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

  // Update OTP preview when template changes
  useEffect(() => {
    let preview = form.otp_template || settings?.otp_template || '';
    preview = preview.replace(/\{\{otp\}\}/g, '123456');
    preview = preview.replace(/\{\{app_name\}\}/g, 'Kryzo');
    preview = preview.replace(/\{\{expiry_minutes\}\}/g, String(form.otp_expiry_minutes || 5));
    setOtpPreview(preview);
  }, [form.otp_template, form.otp_expiry_minutes, settings?.otp_template]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await adminApi.updateEmailSettings({
        resend_api_key: form.resend_api_key || undefined,
        sender_email: form.sender_email || undefined,
        sender_name: form.sender_name || undefined,
        otp_subject: form.otp_subject || undefined,
        otp_template: form.otp_template || undefined,
        otp_expiry_minutes: form.otp_expiry_minutes || undefined,
        welcome_email_enabled: form.welcome_email_enabled,
        welcome_subject: form.welcome_subject || undefined,
        welcome_template: form.welcome_template || undefined,
        password_reset_template: form.password_reset_template || undefined,
      });
      if (error) throw error;
      toast('success', 'Email settings saved successfully');
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access...</div>;

  return (
    <AdminLayout currentPath="/admin/email-settings">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-2">
          <Mail className="text-gold-400" /> Email Settings
        </h1>
        <p className="text-sm text-gray-400 mb-6">Configure Resend API and email templates for OTPs and notifications.</p>

        {!isSuper && (
          <div className="glass rounded-xl p-4 mb-6 border border-warning-500/30 flex items-start gap-3">
            <Shield className="text-warning-400 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm text-warning-400 font-medium">Limited Access</p>
              <p className="text-xs text-gray-400">API keys are masked. Only Super Admin can view and edit sensitive credentials.</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading settings...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* API Configuration */}
            <div className="lg:col-span-2 space-y-6">
              <div className="glass rounded-2xl p-5">
                <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                  <Settings size={18} className="text-gold-400" /> Resend API Configuration
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="label-field">Resend API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={form.resend_api_key}
                        onChange={(e) => setForm((f) => ({ ...f, resend_api_key: e.target.value }))}
                        className="input-field font-mono text-xs pr-10"
                        placeholder="re_..."
                        disabled={!isSuper}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-field">Sender Email</label>
                      <input
                        type="email"
                        value={form.sender_email}
                        onChange={(e) => setForm((f) => ({ ...f, sender_email: e.target.value }))}
                        className="input-field"
                        placeholder="noreply@kryzo.com"
                        disabled={!isSuper}
                      />
                      <p className="text-xs text-gray-500 mt-1">Must be verified in Resend</p>
                    </div>
                    <div>
                      <label className="label-field">Sender Name</label>
                      <input
                        value={form.sender_name}
                        onChange={(e) => setForm((f) => ({ ...f, sender_name: e.target.value }))}
                        className="input-field"
                        placeholder="Kryzo"
                        disabled={!isSuper}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <div className={`w-2 h-2 rounded-full ${settings?.is_configured ? 'bg-success-400' : 'bg-gray-500'}`} />
                    <span className="text-xs text-gray-400">
                      {settings?.is_configured ? 'Resend is configured' : 'Resend not configured'}
                    </span>
                  </div>
                </div>
              </div>

              {/* OTP Email Template */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                  <Code size={18} className="text-gold-400" /> OTP Email Template
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="label-field">Email Subject</label>
                    <input
                      value={form.otp_subject}
                      onChange={(e) => setForm((f) => ({ ...f, otp_subject: e.target.value }))}
                      className="input-field"
                      disabled={!isSuper}
                    />
                  </div>

                  <div>
                    <label className="label-field">OTP Expiry (minutes)</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={form.otp_expiry_minutes}
                      onChange={(e) => setForm((f) => ({ ...f, otp_expiry_minutes: parseInt(e.target.value) || 5 }))}
                      className="input-field w-32"
                      disabled={!isSuper}
                    />
                  </div>

                  <div>
                    <label className="label-field">Email HTML Template</label>
                    <p className="text-xs text-gray-500 mb-2">
                      Use <code className="bg-ink-700 px-1 rounded">{'{{otp}}'}</code>, <code className="bg-ink-700 px-1 rounded">{'{{app_name}}'}</code>, <code className="bg-ink-700 px-1 rounded">{'{{expiry_minutes}}'}</code> as placeholders
                    </p>
                    <textarea
                      value={form.otp_template}
                      onChange={(e) => setForm((f) => ({ ...f, otp_template: e.target.value }))}
                      className="input-field font-mono text-xs min-h-[200px]"
                      placeholder="<html>..."
                      disabled={!isSuper}
                    />
                  </div>
                </div>
              </div>

              {/* Welcome Email */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                  <Send size={18} className="text-gold-400" /> Welcome Email
                </h3>

                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.welcome_email_enabled}
                      onChange={(e) => setForm((f) => ({ ...f, welcome_email_enabled: e.target.checked }))}
                      className="w-4 h-4 accent-gold-400"
                      disabled={!isSuper}
                    />
                    <span className="text-sm text-gray-300">Send welcome email on registration</span>
                  </label>

                  <div>
                    <label className="label-field">Welcome Email Subject</label>
                    <input
                      value={form.welcome_subject}
                      onChange={(e) => setForm((f) => ({ ...f, welcome_subject: e.target.value }))}
                      className="input-field"
                      disabled={!isSuper}
                    />
                  </div>

                  <div>
                    <label className="label-field">Welcome Email Template (optional)</label>
                    <textarea
                      value={form.welcome_template}
                      onChange={(e) => setForm((f) => ({ ...f, welcome_template: e.target.value }))}
                      className="input-field font-mono text-xs min-h-[120px]"
                      disabled={!isSuper}
                    />
                  </div>
                </div>
              </div>

              {/* Password Reset Template */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-display font-bold text-white mb-4">Password Reset Template</h3>
                <div>
                  <label className="label-field">Password Reset Email Template (optional)</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Use <code className="bg-ink-700 px-1 rounded">{'{{reset_link}}'}</code> as placeholder
                  </p>
                  <textarea
                    value={form.password_reset_template}
                    onChange={(e) => setForm((f) => ({ ...f, password_reset_template: e.target.value }))}
                    className="input-field font-mono text-xs min-h-[120px]"
                    disabled={!isSuper}
                  />
                </div>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="space-y-6">
              <div className="glass rounded-2xl p-5 sticky top-6">
                <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                  <Eye size={18} className="text-gold-400" /> OTP Email Preview
                </h3>

                <div className="bg-white rounded-lg p-4 min-h-[300px] overflow-auto">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: otpPreview }}
                  />
                </div>

                <div className="mt-4 p-3 bg-ink-800 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Subject Preview:</p>
                  <p className="text-sm text-white font-medium">{form.otp_subject}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    <User size={12} />
                    <span>From: {form.sender_name || 'Kryzo'} &lt;{form.sender_email || 'noreply@kryzo.com'}&gt;</span>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                  <Clock size={18} className="text-gold-400" /> Template Variables
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <code className="bg-ink-700 px-2 py-1 rounded text-gold-300">{'{{otp}}'}</code>
                    <span className="text-gray-400">6-digit OTP code</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="bg-ink-700 px-2 py-1 rounded text-gold-300">{'{{app_name}}'}</code>
                    <span className="text-gray-400">Kryzo</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="bg-ink-700 px-2 py-1 rounded text-gold-300">{'{{expiry_minutes}}'}</code>
                    <span className="text-gray-400">{form.otp_expiry_minutes} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="bg-ink-700 px-2 py-1 rounded text-gold-300">{'{{reset_link}}'}</code>
                    <span className="text-gray-400">Reset URL</span>
                  </div>
                </div>
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
