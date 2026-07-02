import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { FileText, Save, Loader2, ScrollText, ShieldCheck, RefreshCw, ShoppingBag, User } from 'lucide-react';

interface LegalDoc {
  id: string;
  doc_type: string;
  title: string;
  content: string;
  updated_at: string;
}

const DOC_TABS = [
  { key: 'terms', label: 'Terms & Conditions', icon: ScrollText },
  { key: 'privacy', label: 'Privacy Policy', icon: ShieldCheck },
  { key: 'refund', label: 'Refund Policy', icon: RefreshCw },
  { key: 'seller_policy', label: 'Seller Policy', icon: ShoppingBag },
  { key: 'buyer_policy', label: 'Buyer Policy', icon: User },
] as const;

export function AdminLegalPage() {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Record<string, LegalDoc>>({});
  const [activeTab, setActiveTab] = useState<(typeof DOC_TABS)[number]['key']>('terms');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('legal_documents').select('*');
      if (error) throw error;
      const map: Record<string, LegalDoc> = {};
      (data ?? []).forEach((d: any) => { map[d.doc_type] = d; });
      setDocs(map);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load legal documents');
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

  useEffect(() => {
    const d = docs[activeTab];
    setTitle(d?.title ?? '');
    setContent(d?.content ?? '');
  }, [activeTab, docs]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { toast('error', 'Title and content are required.'); return; }
    setSaving(true);
    try {
      const { error } = await adminApi.updateLegalDoc(activeTab, title, content);
      if (error) throw error;
      toast('success', 'Legal document updated.');
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access…</div>;

  const activeDoc = docs[activeTab];

  return (
    <AdminLayout currentPath="/admin/legal">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-2">
          <FileText className="text-gold-400" /> Legal Documents
        </h1>

        <div className="flex flex-wrap gap-2 mb-6">
          {DOC_TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === t.key ? 'bg-gold-400/10 text-gold-300 border border-gold-400/20' : 'text-gray-400 border border-white/10 hover:text-white'}`}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading document…</div>
        ) : (
          <form onSubmit={save} className="glass rounded-2xl p-6 space-y-5 max-w-4xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">{DOC_TABS.find((t) => t.key === activeTab)?.label}</h2>
              {activeDoc && (
                <p className="text-xs text-gray-500">Last updated: {new Date(activeDoc.updated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              )}
            </div>

            <div className="divider-gold" />

            <div>
              <label className="label-field">Document Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Terms & Conditions" className="input-field" />
            </div>

            <div>
              <label className="label-field">Content</label>
              <textarea rows={18} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write the full legal document content here…" className="input-field font-mono text-sm leading-relaxed resize-y" />
              <p className="mt-1 text-xs text-gray-600">Supports plain text. Use line breaks for paragraphs.</p>
            </div>

            <button type="submit" disabled={saving} className="btn-gold">
              {saving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><Save size={18} /> Save Document</>}
            </button>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
