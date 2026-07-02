import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { checkAdminRole } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import {
  Flag, AlertTriangle, MessageSquare, Package, User, Search,
  CheckCircle2, XCircle, Eye, Loader2, X, Send, Clock, Ban
} from 'lucide-react';

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_listing_id: string | null;
  type: 'scam' | 'fake_listing' | 'harassment' | 'spam' | 'other';
  reason: string;
  evidence_urls: string[] | null;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  resolution_notes: string | null;
  created_at: string;
  reporter?: { full_name: string; username: string; email: string } | null;
  reported_user?: { full_name: string; username: string; email: string } | null;
  reported_listing?: { title: string; game: string } | null;
}

const FILTERS = ['all', 'pending', 'investigating', 'resolved', 'dismissed'] as const;
const TYPES = ['all', 'scam', 'fake_listing', 'harassment', 'spam', 'other'] as const;

export function AdminReportsPage() {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('pending');
  const [typeFilter, setTypeFilter] = useState<(typeof TYPES)[number]>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          reporter:profiles!reports_reporter_id_fkey(full_name, username, email),
          reported_user:profiles!reports_reported_user_id_fkey(full_name, username, email),
          reported_listing:account_listings!reports_reported_listing_id_fkey(title, game)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReports((data ?? []) as ReportRow[]);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load reports');
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

  const filtered = reports.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.reason?.toLowerCase().includes(q) ||
        r.reporter?.full_name?.toLowerCase().includes(q) ||
        r.reporter?.username?.toLowerCase().includes(q) ||
        r.reported_user?.full_name?.toLowerCase().includes(q) ||
        r.reported_listing?.title?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const updateStatus = async (id: string, status: string, notes?: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status,
          resolution_notes: notes || null,
          resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) throw error;
      toast('success', `Report ${status}`);
      await load();
      setSelected(null);
      setResolutionNotes('');
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to update report');
    } finally {
      setActionLoading(false);
    }
  };

  const banUser = async (userId: string) => {
    if (!confirm('Are you sure you want to ban this user?')) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: true })
        .eq('id', userId);
      if (error) throw error;
      toast('success', 'User has been banned');
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to ban user');
    } finally {
      setActionLoading(false);
    }
  };

  const takeDownListing = async (listingId: string) => {
    if (!confirm('Are you sure you want to take down this listing?')) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('account_listings')
        .update({ status: 'removed' })
        .eq('id', listingId);
      if (error) throw error;
      toast('success', 'Listing has been taken down');
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to remove listing');
    } finally {
      setActionLoading(false);
    }
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access...</div>;

  return (
    <AdminLayout currentPath="/admin/reports">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-2">
          <Flag className="text-gold-400" /> Reports Management
        </h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total" value={reports.length} />
          <StatCard label="Pending" value={reports.filter((r) => r.status === 'pending').length} color="text-warning-400" />
          <StatCard label="Investigating" value={reports.filter((r) => r.status === 'investigating').length} color="text-blue-400" />
          <StatCard label="Resolved" value={reports.filter((r) => r.status === 'resolved').length} color="text-success-400" />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports..."
              className="input-field pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  filter === f ? 'bg-gold-400 text-ink-950' : 'glass text-gray-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="input-field w-auto text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t === 'all' ? 'All Types' : t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading reports...</div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-gray-500">No reports found.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <div key={r.id} className="glass glass-hover rounded-2xl p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <TypeBadge type={r.type} />
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>

                    <p className="text-sm text-gray-300 line-clamp-2 mb-2">{r.reason || 'No reason provided'}</p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <User size={12} />
                        <span>Reported by: {r.reporter?.full_name || r.reporter?.username || 'Unknown'}</span>
                      </div>
                      {r.reported_user && (
                        <div className="flex items-center gap-1">
                          <User size={12} className="text-error-400" />
                          <span>Target: {r.reported_user.full_name || r.reported_user.username}</span>
                        </div>
                      )}
                      {r.reported_listing && (
                        <div className="flex items-center gap-1">
                          <Package size={12} className="text-error-400" />
                          <span>Listing: {r.reported_listing.title}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:shrink-0">
                    <button onClick={() => setSelected(r)} className="btn-ghost px-3 py-1.5 text-xs">
                      <Eye size={14} /> View
                    </button>
                    {r.status === 'pending' && (
                      <button
                        onClick={() => updateStatus(r.id, 'investigating')}
                        disabled={actionLoading}
                        className="btn-outline px-3 py-1.5 text-xs"
                      >
                        <Clock size={14} /> Investigate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div className="glass-gold rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TypeBadge type={selected.type} />
                <StatusBadge status={selected.status} />
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-1">Reason</h3>
                <p className="text-white">{selected.reason || 'No reason provided'}</p>
              </div>

              {selected.evidence_urls && selected.evidence_urls.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Evidence</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.evidence_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-24 object-cover rounded-lg border border-white/[0.06]" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs text-gray-500 mb-2 flex items-center gap-1"><User size={12} /> Reporter</h3>
                  <p className="font-semibold text-white">{selected.reporter?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">@{selected.reporter?.username || 'N/A'}</p>
                  <p className="text-xs text-gray-500">{selected.reporter?.email || 'N/A'}</p>
                </div>

                {selected.reported_user && (
                  <div className="glass rounded-xl p-4 border border-error-500/20">
                    <h3 className="text-xs text-error-400 mb-2 flex items-center gap-1"><User size={12} /> Reported User</h3>
                    <p className="font-semibold text-white">{selected.reported_user.full_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400">@{selected.reported_user.username || 'N/A'}</p>
                    <button
                      onClick={() => banUser(selected.reported_user_id!)}
                      disabled={actionLoading}
                      className="mt-2 btn-outline text-xs text-error-400 border-error-500/30 hover:bg-error-500/10"
                    >
                      <Ban size={12} /> Ban User
                    </button>
                  </div>
                )}

                {selected.reported_listing && (
                  <div className="glass rounded-xl p-4 border border-error-500/20 sm:col-span-2">
                    <h3 className="text-xs text-error-400 mb-2 flex items-center gap-1"><Package size={12} /> Reported Listing</h3>
                    <p className="font-semibold text-white">{selected.reported_listing.title}</p>
                    <p className="text-xs text-gray-400 capitalize">{selected.reported_listing.game}</p>
                    <button
                      onClick={() => takeDownListing(selected.reported_listing_id!)}
                      disabled={actionLoading}
                      className="mt-2 btn-outline text-xs text-error-400 border-error-500/30 hover:bg-error-500/10"
                    >
                      <XCircle size={12} /> Take Down Listing
                    </button>
                  </div>
                )}
              </div>

              {selected.resolution_notes && (
                <div className="rounded-xl bg-success-500/10 border border-success-500/20 p-3">
                  <h3 className="text-xs text-success-400 mb-1">Resolution Notes</h3>
                  <p className="text-sm text-gray-300">{selected.resolution_notes}</p>
                </div>
              )}

              {(selected.status === 'pending' || selected.status === 'investigating') && (
                <div className="pt-4 border-t border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-white mb-2">Resolution</h3>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Add resolution notes..."
                    className="input-field min-h-[80px] resize-none mb-3"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(selected.id, 'resolved', resolutionNotes)}
                      disabled={actionLoading}
                      className="btn-gold flex-1"
                    >
                      {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Resolve
                    </button>
                    <button
                      onClick={() => updateStatus(selected.id, 'dismissed', resolutionNotes)}
                      disabled={actionLoading}
                      className="btn-outline flex-1"
                    >
                      <XCircle size={16} /> Dismiss
                    </button>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500">
                Reported: {new Date(selected.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || 'text-white'}`}>{value}</p>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    scam: { cls: 'bg-error-500/15 text-error-400', label: 'Scam' },
    fake_listing: { cls: 'bg-warning-500/15 text-warning-400', label: 'Fake Listing' },
    harassment: { cls: 'bg-purple-500/15 text-purple-400', label: 'Harassment' },
    spam: { cls: 'bg-blue-500/15 text-blue-400', label: 'Spam' },
    other: { cls: 'bg-gray-500/15 text-gray-400', label: 'Other' },
  };
  const c = config[type] || config.other;
  return (
    <span className={`badge ${c.cls}`}>
      {type === 'scam' ? <AlertTriangle size={11} /> : type === 'fake_listing' ? <Package size={11} /> : <Flag size={11} />}
      {c.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'bg-warning-500/15 text-warning-400', label: 'Pending' },
    investigating: { cls: 'bg-blue-500/15 text-blue-400', label: 'Investigating' },
    resolved: { cls: 'bg-success-500/15 text-success-400', label: 'Resolved' },
    dismissed: { cls: 'bg-gray-500/15 text-gray-400', label: 'Dismissed' },
  };
  const c = config[status] || config.pending;
  return <span className={`badge ${c.cls}`}>{c.label}</span>;
}
