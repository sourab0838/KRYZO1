import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Settings, Save, Loader2, Image, Search, BarChart3, Twitter, Instagram, Youtube, Building2, AlertTriangle, Check } from 'lucide-react';

interface SettingRow { key: string; value: string; description: string | null; }

const FIELDS = [
  { key: 'website_name', label: 'Website Name', icon: Building2, type: 'text' },
  { key: 'logo_url', label: 'Logo URL', icon: Image, type: 'text' },
  { key: 'favicon_url', label: 'Favicon URL', icon: Image, type: 'text' },
  { key: 'homepage_banner_text', label: 'Homepage Banner Text', icon: BarChart3, type: 'text' },
  { key: 'seo_title', label: 'SEO Title', icon: Search, type: 'text' },
  { key: 'seo_description', label: 'SEO Description', icon: Search, type: 'textarea' },
  { key: 'google_analytics_id', label: 'Google Analytics ID', icon: BarChart3, type: 'text' },
  { key: 'twitter_url', label: 'Twitter / X URL', icon: Twitter, type: 'text' },
  { key: 'instagram_url', label: 'Instagram URL', icon: Instagram, type: 'text' },
  { key: 'youtube_url', label: 'YouTube URL', icon: Youtube, type: 'text' },
  { key: 'maintenance_mode', label: 'Maintenance Mode', icon: AlertTriangle, type: 'toggle' },
] as const;

export function AdminSettingsPage() {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('website_settings').select('key, value, description');
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: SettingRow) => { map[r.key] = r.value ?? ''; });
      // Ensure all fields have a default
      FIELDS.forEach((f) => { if (!(f.key in map)) map[f.key] = f.type === 'toggle' ? 'false' : ''; });
      setValues(map);
      setOriginal(map);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setChecking(false);
      await load();
    })();
  }, [load]);

  const changedKeys = FIELDS.filter((f) => values[f.key] !== original[f.key]).map((f) => f.key);
  const hasChanges = changedKeys.length > 0;

  const saveAll = async () => {
    if (!hasChanges) { toast('info', 'No changes to save.'); return; }
    setSaving(true);
    let ok = 0, fail = 0;
    for (const key of changedKeys) {
      try {
        const { error } = await adminApi.updateSiteSetting(key, values[key]);
        if (error) throw error;
        ok++;
      } catch {
        fail++;
      }
    }
    setSaving(false);
    if (fail === 0) {
      toast('success', `Saved ${ok} setting${ok !== 1 ? 's' : ''}.`);
      setOriginal({ ...values });
    } else {
      toast('error', `${ok} saved, ${fail} failed.`);
      await load();
    }
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access…</div>;

  return (
    <AdminLayout currentPath="/admin/settings">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <Settings className="text-gold-400" /> Website Settings
          </h1>
          {hasChanges && (
            <button onClick={saveAll} disabled={saving} className="btn-gold">
              {saving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><Save size={18} /> Save All ({changedKeys.length})</>}
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading settings…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {FIELDS.map((f) => {
              const val = values[f.key] ?? '';
              const changed = val !== original[f.key];
              return (
                <div key={f.key} className={`glass rounded-2xl p-5 ${f.type === 'textarea' ? 'lg:col-span-2' : ''}`}>
                  <label className="label-field inline-flex items-center gap-1.5">
                    <f.icon size={14} className="text-gold-400" /> {f.label}
                    {changed && <span className="badge bg-gold-400/15 text-gold-300 ml-1">modified</span>}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea rows={3} value={val} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="input-field" />
                  ) : f.type === 'toggle' ? (
                    <button type="button" onClick={() => setValues((v) => ({ ...v, [f.key]: val === 'true' ? 'false' : 'true' }))} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${val === 'true' ? 'bg-warning-500/15 text-warning-400 border border-warning-500/30' : 'glass text-gray-300 border border-white/10'}`}>
                      <span className={`relative w-10 h-5 rounded-full transition-all ${val === 'true' ? 'bg-warning-500' : 'bg-white/10'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all ${val === 'true' ? 'translate-x-5' : ''}`} />
                      </span>
                      {val === 'true' ? 'Maintenance ON' : 'Maintenance OFF'}
                    </button>
                  ) : (
                    <input value={val} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={`Enter ${f.label.toLowerCase()}…`} className="input-field" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && hasChanges && (
          <div className="mt-6 flex justify-end">
            <button onClick={saveAll} disabled={saving} className="btn-gold">
              {saving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><Check size={18} /> Save All Changes</>}
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
