import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Bell, Send, Loader2, Radio, Megaphone, ShieldAlert, Smartphone } from 'lucide-react';

interface AdminNotifRow {
  id: string;
  type: string;
  title: string;
  message: string;
  target_audience: string;
  is_active: boolean;
  created_at: string;
  admin?: { full_name: string; username: string } | null;
}

const TYPES = [
  { value: 'broadcast', label: 'Broadcast', icon: Megaphone },
  { value: 'maintenance', label: 'Maintenance', icon: ShieldAlert },
  { value: 'security', label: 'Security', icon: Radio },
  { value: 'push', label: 'Push', icon: Smartphone },
] as const;

const AUDIENCES = ['all', 'buyers', 'sellers'] as const;

export function AdminNotificationsPage() {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<AdminNotifRow[]>([]);
  const [form, setForm] = useState({ type: 'broadcast' as string, title: '', message: '', audience: 'all' as string });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*, admin:app_users!admin_notifications_admin_id_fkey(full_name, username)')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setRows((data ?? []) as AdminNotifRow[]);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setChecking(false);
      load();
    })();
  }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) { toast('error', 'Title and message are required.'); return; }
    setSending(true);
    try {
      const { error } = await adminApi.broadcastNotification(form.type, form.title, form.message, form.audience);
      if (error) throw error;
      toast('success', 'Notification broadcast sent.');
      setForm({ type: 'broadcast', title: '', message: '', audience: 'all' });
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access…</div>;

  return (
    <AdminLayout currentPath="/admin/notifications">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-2">
          <Bell className="text-gold-400" /> Notification Management
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send form */}
          <form onSubmit={send} className="glass rounded-2xl p-6 space-y-5">
            <h2 className="font-display text-lg font-bold text-white">Send Broadcast</h2>

            <div>
              <label className="label-field">Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => setForm((f) => ({ ...f, type: t.value }))} className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${form.type === t.value ? 'bg-gold-gradient text-ink-950' : 'glass text-gray-300'}`}>
                    <t.icon size={16} /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label-field">Title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Notification title…" className="input-field" />
            </div>

            <div>
              <label className="label-field">Message</label>
              <textarea rows={4} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Write your message…" className="input-field" />
            </div>

            <div>
              <label className="label-field">Target Audience</label>
              <div className="grid grid-cols-3 gap-2">
                {AUDIENCES.map((a) => (
                  <button key={a} type="button" onClick={() => setForm((f) => ({ ...f, audience: a }))} className={`px-3 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all ${form.audience === a ? 'bg-gold-400/10 text-gold-300 border border-gold-400/20' : 'glass text-gray-300 border border-white/10'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={sending} className="btn-gold w-full">
              {sending ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : <><Send size={18} /> Send Notification</>}
            </button>
          </form>

          {/* Recent notifications */}
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-white">Recent Sent</h2>
            {loading ? (
              <div className="py-20 text-center text-gray-500">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center text-gray-500">No notifications sent yet.</div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto no-scrollbar">
                {rows.map((r) => (
                  <div key={r.id} className="glass glass-hover rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`badge ${r.type === 'security' ? 'bg-error-500/15 text-error-400' : r.type === 'maintenance' ? 'bg-warning-500/15 text-warning-400' : 'bg-gold-400/15 text-gold-300'}`}>{r.type}</span>
                      <span className="badge bg-white/[0.06] text-gray-400 capitalize">{r.target_audience}</span>
                    </div>
                    <p className="font-semibold text-white text-sm">{r.title}</p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{r.message}</p>
                    <p className="text-xs text-gray-600 mt-2">{r.admin?.full_name || r.admin?.username || 'System'} · {new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
