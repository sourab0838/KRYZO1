import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Headphones, Save, Loader2, Plus, Pencil, Trash2, X, MessageSquare, LifeBuoy, HelpCircle, Send } from 'lucide-react';

interface FaqRow { id: string; question: string; answer: string; category: string; sort_order: number; is_published: boolean; }
interface TicketRow { id: string; subject: string; category: string; status: string; created_at: string; profile?: { full_name: string; username: string } | null; }
interface TicketMessage { id: string; ticket_id: string; sender: string; message: string; created_at: string; }

const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

export function AdminSupportPage() {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<'settings' | 'faq' | 'tickets'>('settings');

  const [settings, setSettings] = useState({ whatsapp_number: '', telegram_username: '', support_email: '', business_hours: '', auto_reply: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [editingFaq, setEditingFaq] = useState<FaqRow | null>(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: 'general', sort_order: 0, is_published: true });
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [faqSaving, setFaqSaving] = useState(false);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [ticketLoading, setTicketLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('support_settings').select('*').maybeSingle();
    if (data) setSettings({ whatsapp_number: data.whatsapp_number || '', telegram_username: data.telegram_username || '', support_email: data.support_email || '', business_hours: data.business_hours || '', auto_reply: data.auto_reply || '' });
  }, []);

  const loadFaqs = useCallback(async () => {
    const { data, error } = await supabase.from('faq_entries').select('*').order('sort_order', { ascending: true });
    if (!error) setFaqs((data ?? []) as FaqRow[]);
  }, []);

  const loadTickets = useCallback(async () => {
    setTicketLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, profile:profiles!support_tickets_user_id_profiles_fkey(full_name, username)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTickets((data ?? []) as TicketRow[]);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load tickets');
    } finally {
      setTicketLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setChecking(false);
      loadSettings(); loadFaqs(); loadTickets();
    })();
  }, [loadSettings, loadFaqs, loadTickets]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const { error } = await adminApi.updateSupportSettings(settings);
      if (error) throw error;
      toast('success', 'Support settings saved.');
    } catch (e: any) {
      toast('error', e?.message ?? 'Save failed');
    } finally {
      setSavingSettings(false);
    }
  };

  const openNewFaq = () => { setEditingFaq(null); setFaqForm({ question: '', answer: '', category: 'general', sort_order: 0, is_published: true }); setShowFaqForm(true); };
  const openEditFaq = (f: FaqRow) => { setEditingFaq(f); setFaqForm({ question: f.question, answer: f.answer, category: f.category, sort_order: f.sort_order, is_published: f.is_published }); setShowFaqForm(true); };

  const saveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    setFaqSaving(true);
    try {
      const { error } = await adminApi.upsertFaq({ p_question: faqForm.question, p_answer: faqForm.answer, p_category: faqForm.category, p_sort_order: faqForm.sort_order, p_is_published: faqForm.is_published, p_id: editingFaq?.id ?? null });
      if (error) throw error;
      toast('success', editingFaq ? 'FAQ updated.' : 'FAQ added.');
      setShowFaqForm(false); await loadFaqs();
    } catch (e: any) {
      toast('error', e?.message ?? 'Save failed');
    } finally {
      setFaqSaving(false);
    }
  };

  const deleteFaq = async (id: string) => {
    try {
      const { error } = await adminApi.deleteFaq(id);
      if (error) throw error;
      toast('success', 'FAQ deleted.');
      await loadFaqs();
    } catch (e: any) {
      toast('error', e?.message ?? 'Delete failed');
    }
  };

  const updateTicketStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id);
      if (error) throw error;
      toast('success', 'Ticket status updated.');
      await loadTickets();
      if (selectedTicket?.id === id) setSelectedTicket((t) => t ? { ...t, status } : t);
    } catch (e: any) {
      toast('error', e?.message ?? 'Update failed');
    }
  };

  const loadMessages = async (ticketId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase.from('support_ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
      if (error) throw error;
      setMessages((data ?? []) as TicketMessage[]);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  };

  const openTicket = (t: TicketRow) => {
    setSelectedTicket(t);
    setReplyText('');
    loadMessages(t.id);
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    setReplySending(true);
    try {
      const { error: msgError } = await supabase.from('support_ticket_messages').insert({ ticket_id: selectedTicket.id, sender: 'admin', message: replyText.trim() });
      if (msgError) throw msgError;
      if (selectedTicket.status === 'open') {
        const { error: statusError } = await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', selectedTicket.id);
        if (statusError) throw statusError;
        setSelectedTicket((t) => t ? { ...t, status: 'in_progress' } : t);
      }
      setReplyText('');
      await loadMessages(selectedTicket.id);
      await loadTickets();
      toast('success', 'Reply sent.');
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to send reply');
    } finally {
      setReplySending(false);
    }
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access…</div>;

  return (
    <AdminLayout currentPath="/admin/support">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-2">
          <Headphones className="text-gold-400" /> Support Management
        </h1>

        <div className="flex flex-wrap gap-2 mb-6">
          {([['settings', 'Settings', LifeBuoy], ['faq', 'FAQ Manager', HelpCircle], ['tickets', 'Support Tickets', MessageSquare]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === key ? 'bg-gold-400/10 text-gold-300 border border-gold-400/20' : 'text-gray-400 border border-white/10 hover:text-white'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === 'settings' && (
          <form onSubmit={saveSettings} className="glass rounded-2xl p-6 space-y-5 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label-field">WhatsApp Number</label><input value={settings.whatsapp_number} onChange={(e) => setSettings((s) => ({ ...s, whatsapp_number: e.target.value }))} placeholder="+91 98765 43210" className="input-field" /></div>
              <div><label className="label-field">Telegram Username</label><input value={settings.telegram_username} onChange={(e) => setSettings((s) => ({ ...s, telegram_username: e.target.value }))} placeholder="@kryzo_support" className="input-field" /></div>
              <div><label className="label-field">Support Email</label><input value={settings.support_email} onChange={(e) => setSettings((s) => ({ ...s, support_email: e.target.value }))} placeholder="support@kryzo.com" className="input-field" /></div>
              <div><label className="label-field">Business Hours</label><input value={settings.business_hours} onChange={(e) => setSettings((s) => ({ ...s, business_hours: e.target.value }))} placeholder="Mon–Sun, 9 AM – 9 PM IST" className="input-field" /></div>
            </div>
            <div><label className="label-field">Auto Reply Message</label><textarea rows={3} value={settings.auto_reply} onChange={(e) => setSettings((s) => ({ ...s, auto_reply: e.target.value }))} placeholder="Thanks for reaching out! Our team will respond shortly." className="input-field" /></div>
            <button type="submit" disabled={savingSettings} className="btn-gold">{savingSettings ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><Save size={18} /> Save Settings</>}</button>
          </form>
        )}

        {tab === 'faq' && (
          <div className="space-y-4">
            <button onClick={openNewFaq} className="btn-gold"><Plus size={16} /> Add New FAQ</button>
            {faqs.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center text-gray-500">No FAQs yet.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {faqs.map((f) => (
                  <div key={f.id} className="glass glass-hover rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="badge bg-gold-400/15 text-gold-300">{f.category}</span>
                      <span className={`badge ${f.is_published ? 'bg-success-500/15 text-success-400' : 'bg-white/[0.06] text-gray-400'}`}>{f.is_published ? 'Published' : 'Draft'}</span>
                    </div>
                    <p className="font-semibold text-white mb-1">{f.question}</p>
                    <p className="text-sm text-gray-400 line-clamp-3">{f.answer}</p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openEditFaq(f)} className="btn-ghost px-3 py-1.5 text-xs"><Pencil size={13} /> Edit</button>
                      <button onClick={() => deleteFaq(f.id)} className="btn-outline px-3 py-1.5 text-xs"><Trash2 size={13} /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'tickets' && (
          <div>
            {ticketLoading ? (
              <div className="py-20 text-center text-gray-500">Loading tickets…</div>
            ) : tickets.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center text-gray-500">No support tickets found.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {tickets.map((t) => (
                  <div key={t.id} className="glass glass-hover rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{t.subject || '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{t.profile?.full_name || t.profile?.username || '—'} · {new Date(t.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                      </div>
                      <span className="badge bg-white/[0.06] text-gray-300 capitalize">{t.category || 'general'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <label className="text-xs text-gray-500">Status:</label>
                      <select value={t.status} onChange={(e) => updateTicketStatus(t.id, e.target.value)} className="input-field text-xs py-1.5 px-2 w-auto">
                        {TICKET_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                      <button onClick={() => openTicket(t)} className="ml-auto btn-gold text-xs px-3 py-1.5">View & Reply</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedTicket && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedTicket(null)}>
            <div className="glass-gold rounded-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold text-white truncate">{selectedTicket.subject || '—'}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedTicket.profile?.full_name || selectedTicket.profile?.username || '—'} · <span className="capitalize">{selectedTicket.status.replace('_', ' ')}</span></p>
                </div>
                <button type="button" onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
                {messagesLoading ? (
                  <div className="text-center text-gray-500 py-8">Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No messages yet.</div>
                ) : messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.sender === 'admin' ? 'bg-gold-400/20 text-white' : 'bg-white/[0.06] text-gray-200'}`}>
                      <p className="text-[10px] uppercase tracking-wide mb-1 opacity-60">{m.sender}</p>
                      <p className="whitespace-pre-wrap break-words">{m.message}</p>
                      <p className="text-[10px] opacity-50 mt-1">{new Date(m.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={sendReply} className="flex items-center gap-2">
                <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type a reply…" className="input-field flex-1" disabled={replySending} />
                <button type="submit" disabled={replySending || !replyText.trim()} className="btn-gold px-3 py-2.5 disabled:opacity-50"><Send size={16} /></button>
              </form>
            </div>
          </div>
        )}
      </div>

      {showFaqForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowFaqForm(false)}>
          <form onSubmit={saveFaq} className="glass-gold rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-white">{editingFaq ? 'Edit FAQ' : 'New FAQ'}</h3>
              <button type="button" onClick={() => setShowFaqForm(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="label-field">Question</label><input value={faqForm.question} onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))} required className="input-field" /></div>
              <div><label className="label-field">Answer</label><textarea rows={4} value={faqForm.answer} onChange={(e) => setFaqForm((f) => ({ ...f, answer: e.target.value }))} required className="input-field" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-field">Category</label><input value={faqForm.category} onChange={(e) => setFaqForm((f) => ({ ...f, category: e.target.value }))} className="input-field" /></div>
                <div><label className="label-field">Sort Order</label><input type="number" value={faqForm.sort_order} onChange={(e) => setFaqForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} className="input-field" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={faqForm.is_published} onChange={(e) => setFaqForm((f) => ({ ...f, is_published: e.target.checked }))} className="accent-gold-400" /> Published
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="submit" disabled={faqSaving} className="btn-gold flex-1">{faqSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save FAQ</button>
              <button type="button" onClick={() => setShowFaqForm(false)} className="btn-outline">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
