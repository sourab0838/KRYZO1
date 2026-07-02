import { useEffect, useRef, useState } from 'react';
import { Link, navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { supabase, type SupportTicket, type SupportTicketMessage } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { FAQS } from '../lib/data';
import { MessageCircle, Send, Mail, Headphones, Plus, Ticket, ChevronRight, X, ChevronDown, Zap } from 'lucide-react';

const CATEGORIES = ['General', 'Account Issue', 'Payment', 'Purchase', 'Security', 'Other'];

export function SupportPage() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: '', category: 'General', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [liveChatOpen, setLiveChatOpen] = useState(false);
  const [liveChatMessages, setLiveChatMessages] = useState<{ sender: 'user' | 'agent'; text: string; time: string }[]>([]);
  const [liveChatInput, setLiveChatInput] = useState('');
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const ticketChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadTickets = async () => {
    if (!user) return;
    const { data } = await supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setTickets((data ?? []) as SupportTicket[]);
  };

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    loadTickets();
  }, [user, loading]);

  // Clean up the realtime channel when the component unmounts
  useEffect(() => {
    return () => {
      if (ticketChannelRef.current) {
        supabase.removeChannel(ticketChannelRef.current);
        ticketChannelRef.current = null;
      }
    };
  }, []);

  const openTicket = async (t: SupportTicket) => {
    setActiveTicket(t);
    // Clean up any previous ticket's realtime channel before subscribing to a new one
    if (ticketChannelRef.current) {
      supabase.removeChannel(ticketChannelRef.current);
      ticketChannelRef.current = null;
    }
    const { data } = await supabase.from('support_ticket_messages').select('*').eq('ticket_id', t.id).order('created_at', { ascending: true });
    setMessages((data ?? []) as SupportTicketMessage[]);
    const channel = supabase
      .channel(`ticket-${t.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_ticket_messages', filter: `ticket_id=eq.${t.id}` }, async () => {
        const { data: fresh } = await supabase.from('support_ticket_messages').select('*').eq('ticket_id', t.id).order('created_at', { ascending: true });
        setMessages((fresh ?? []) as SupportTicketMessage[]);
      })
      .subscribe();
    ticketChannelRef.current = channel;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.message) { toast('error', 'Please fill in all fields.'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('create_ticket_with_message', {
        p_user_id: user!.id,
        p_subject: form.subject,
        p_category: form.category,
        p_message: form.message,
      });
      if (error) throw error;
      toast('success', 'Support ticket created!');
      setForm({ subject: '', category: 'General', message: '' });
      setShowForm(false);
      loadTickets();
    } catch (err: any) {
      toast('error', err.message || 'Failed to create ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeTicket) return;
    setSendingReply(true);
    try {
      const { data } = await supabase.from('support_ticket_messages').insert({
        ticket_id: activeTicket.id, user_id: user!.id, sender: 'user', message: reply,
      }).select().single();
      setMessages((m) => [...m, data as SupportTicketMessage]);
      setReply('');
    } catch (err: any) {
      toast('error', err.message || 'Failed to send message.');
    } finally {
      setSendingReply(false);
    }
  };

  const startLiveChat = () => {
    setLiveChatOpen(true);
    setLiveChatMessages([
      { sender: 'agent', text: 'Hi! Welcome to Kryzo Support. How can I help you today?', time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) },
    ]);
  };

  const sendLiveChat = () => {
    if (!liveChatInput.trim()) return;
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setLiveChatMessages((m) => [...m, { sender: 'user', text: liveChatInput, time }]);
    setLiveChatInput('');
    setTimeout(() => {
      setLiveChatMessages((m) => [...m, { sender: 'agent', text: 'Thanks for your message! Our team will look into this. For urgent issues, please also create a support ticket.', time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }]);
    }, 1500);
  };

  if (loading || !user) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="mb-8">
        <span className="section-eyebrow">Help & Support</span>
        <h1 className="font-display text-3xl font-bold text-white">Premium Support Center</h1>
        <p className="mt-2 text-gray-400">We're here to help. Reach out anytime through any channel.</p>
      </div>

      {/* Contact channels */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <ChannelCard icon={<MessageCircle size={20} />} title="WhatsApp" value="+91 90000 00000" desc="Chat with us" color="text-success-400" onClick={() => window.open('https://wa.me/919000000000', '_blank')} />
        <ChannelCard icon={<Send size={20} />} title="Telegram" value="@kryzosupport" desc="Join our channel" color="text-cyan-400" onClick={() => window.open('https://t.me/kryzosupport', '_blank')} />
        <ChannelCard icon={<Mail size={20} />} title="Email" value="support@kryzo.com" desc="24/7 response" color="text-gold-400" onClick={() => window.open('mailto:support@kryzo.com', '_blank')} />
        <ChannelCard icon={<Headphones size={20} />} title="Live Chat" value="Online now" desc="Avg 2 min reply" color="text-purple-400" onClick={startLiveChat} />
      </div>

      {/* Live Chat Modal */}
      {liveChatOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setLiveChatOpen(false)}>
          <div className="glass rounded-2xl w-full max-w-md h-[500px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid place-items-center w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400"><Headphones size={18} /></span>
                <div>
                  <p className="text-sm font-semibold text-white">Live Chat</p>
                  <p className="text-xs text-success-400">● Online</p>
                </div>
              </div>
              <button onClick={() => setLiveChatOpen(false)} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {liveChatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm ${m.sender === 'user' ? 'bg-gold-gradient text-ink-950 rounded-br-sm' : 'bg-white/[0.06] text-gray-200 rounded-bl-sm'}`}>
                    {m.text}
                    <p className={`text-[10px] mt-1 ${m.sender === 'user' ? 'text-ink-900/60' : 'text-gray-600'}`}>{m.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-white/[0.06] flex gap-2">
              <input value={liveChatInput} onChange={(e) => setLiveChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendLiveChat()} placeholder="Type a message..." className="input-field text-sm flex-1" />
              <button onClick={sendLiveChat} className="btn-gold px-3"><Send size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Section */}
      <div className="glass rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-gold-400" />
          <h2 className="font-display text-lg font-bold text-white">Quick Answers</h2>
        </div>
        <div className="space-y-2.5">
          {FAQS.slice(0, 5).map((f, i) => (
            <div key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden">
              <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                <span className="text-sm font-medium text-gray-200">{f.q}</span>
                <ChevronDown size={16} className={`text-gold-400 transition-transform ${faqOpen === i ? 'rotate-180' : ''}`} />
              </button>
              {faqOpen === i && (
                <div className="px-4 pb-3 text-sm text-gray-400 animate-fade-in">{f.a}</div>
              )}
            </div>
          ))}
        </div>
        <Link to="/faq" className="inline-flex items-center gap-1.5 text-sm text-gold-400 hover:text-gold-300 mt-4">
          View all FAQs <ChevronRight size={15} />
        </Link>
      </div>

      {/* Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-white">My Tickets</h2>
            <button onClick={() => setShowForm((v) => !v)} className="btn-gold text-sm">
              <Plus size={15} /> New Ticket
            </button>
          </div>

          {showForm && (
            <form onSubmit={submit} className="glass rounded-2xl p-5 mb-4 space-y-3 animate-scale-in">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">New Support Ticket</h3>
                <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
              </div>
              <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Subject" className="input-field text-sm" />
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="input-field text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Describe your issue..." rows={4} className="input-field text-sm resize-none" />
              <button type="submit" disabled={submitting} className="btn-gold w-full text-sm">{submitting ? 'Creating...' : 'Submit Ticket'}</button>
            </form>
          )}

          {tickets.length === 0 ? (
            <div className="glass rounded-2xl py-12 text-center">
              <Ticket size={32} className="mx-auto text-gray-600" />
              <p className="mt-3 text-sm text-gray-500">No tickets yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openTicket(t)}
                  className={`w-full text-left glass rounded-xl p-4 hover:border-gold-400/30 transition-colors ${activeTicket?.id === t.id ? 'border-gold-400/40' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white truncate flex-1">{t.subject}</p>
                    <ChevronRight size={15} className="text-gray-600 shrink-0" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="badge bg-white/[0.04] text-gray-400">{t.category}</span>
                    <span className={`badge ${
                      t.status === 'open' ? 'bg-success-500/15 text-success-400' :
                      t.status === 'in_progress' ? 'bg-warning-500/15 text-warning-400' :
                      t.status === 'resolved' ? 'bg-blue-500/15 text-blue-400' :
                      'bg-white/[0.06] text-gray-400'
                    }`}>{t.status.replace('_', ' ')}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-600">{new Date(t.created_at).toLocaleString('en-IN')}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversation */}
        <div>
          {activeTicket ? (
            <div className="glass rounded-2xl flex flex-col h-[500px]">
              <div className="p-4 border-b border-white/[0.06]">
                <p className="font-semibold text-white">{activeTicket.subject}</p>
                <p className="text-xs text-gray-500">Ticket #{activeTicket.id.slice(0, 8)}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm ${
                      m.sender === 'user' ? 'bg-gold-gradient text-ink-950 rounded-br-sm' : 'bg-white/[0.06] text-gray-200 rounded-bl-sm'
                    }`}>
                      {m.message}
                      <p className={`text-[10px] mt-1 ${m.sender === 'user' ? 'text-ink-900/60' : 'text-gray-600'}`}>{new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-white/[0.06] flex gap-2">
                <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendReply()} placeholder="Type a message..." className="input-field text-sm flex-1" />
                <button onClick={sendReply} disabled={sendingReply} className="btn-gold px-3"><Send size={16} /></button>
              </div>
            </div>
          ) : (
            <div className="glass rounded-2xl h-[500px] grid place-items-center text-center">
              <div>
                <MessageCircle size={40} className="mx-auto text-gray-600" />
                <p className="mt-4 text-gray-400">Select a ticket to view the conversation</p>
                <Link to="/faq" className="btn-outline mt-4 text-sm">Browse FAQ</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelCard({ icon, title, value, desc, color, onClick }: { icon: React.ReactNode; title: string; value: string; desc: string; color: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="glass glass-hover rounded-2xl p-5 text-left">
      <span className={`grid place-items-center w-10 h-10 rounded-lg bg-white/[0.04] ${color}`}>{icon}</span>
      <p className="mt-3 text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-gray-400 mt-0.5">{value}</p>
      <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
    </button>
  );
}
