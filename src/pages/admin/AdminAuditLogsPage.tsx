import { useEffect, useState } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { checkAdminRole } from '../../lib/admin';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import type { AuditLogRow } from '../../lib/supabase';
import { ScrollText, Search, ShieldAlert, Globe, Calendar, Loader2 } from 'lucide-react';

export function AdminAuditLogsPage() {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      const r = await checkAdminRole();
      if (!r) { navigate('/dashboard'); return; }
      setChecking(false);
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        setLogs((data as AuditLogRow[]) ?? []);
      } catch (e: any) {
        toast('error', e?.message ?? 'Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access…</div>;

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? logs.filter((l) =>
        [l.action, l.admin_name, l.target_type, l.target_id, l.reason].some((v) => (v ?? '').toLowerCase().includes(q))
      )
    : logs;

  return (
    <AdminLayout currentPath="/admin/audit">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-1">Audit Logs</h1>
        <p className="text-sm text-gray-400 mb-6">Track all administrative actions performed on the platform.</p>

        <div className="glass rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-gray-400" />
            <input
              className="input-field flex-1"
              placeholder="Filter by action, admin, target, or reason…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {filter && (
              <button onClick={() => setFilter('')} className="btn-ghost text-sm">Clear</button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" /> Loading logs…
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center">
            <ScrollText size={32} className="mx-auto text-gray-500 mb-3" />
            <p className="text-gray-400">No audit logs found.</p>
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3 font-medium">Admin</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Target</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">IP</th>
                    <th className="px-4 py-3 font-medium">Date / Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map((l) => (
                    <tr key={l.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-gray-200 font-medium">{l.admin_name}</td>
                      <td className="px-4 py-3">
                        <span className="badge bg-gold-400/10 text-gold-300 border border-gold-400/20">{l.action}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {l.target_type && <span className="text-gray-300">{l.target_type}</span>}
                        {l.target_id && <span className="text-gray-500 ml-1 font-mono text-xs">#{l.target_id.slice(0, 8)}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate">{l.reason ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{l.ip_address ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-white/[0.04]">
              {filtered.map((l) => (
                <div key={l.id} className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-medium text-white text-sm">{l.admin_name}</span>
                    <span className="badge bg-gold-400/10 text-gold-300 border border-gold-400/20 text-xs">{l.action}</span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-400">
                    {l.target_type && <p><span className="text-gray-500">Target:</span> {l.target_type} {l.target_id && <span className="font-mono">#{l.target_id.slice(0, 8)}</span>}</p>}
                    {l.reason && <p><span className="text-gray-500">Reason:</span> {l.reason}</p>}
                    <p className="flex items-center gap-1"><Globe size={11} /> {l.ip_address ?? '—'}</p>
                    <p className="flex items-center gap-1"><Calendar size={11} /> {new Date(l.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-white/[0.06] text-xs text-gray-500 flex items-center gap-2">
              <ShieldAlert size={13} /> Showing {filtered.length} of {logs.length} logs
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
