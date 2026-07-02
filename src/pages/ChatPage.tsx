import { useEffect, useRef, useState, useCallback } from 'react';
import { navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { supabase, type ChatConversationRow, type ChatMessageRow, type AccountListingRow, type Profile } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { createNotification } from '../lib/notify';
import { ArrowLeft, Send, Image as ImageIcon, Tag, Check, CheckCheck, X, ArrowRight, ShieldCheck, MessageCircle, AlertTriangle } from 'lucide-react';

const BLOCKED_PATTERNS = [
  /\b\d{10}\b/g,
  /\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/g,
  /\+?\d{1,3}[-\s]?\d{6,14}\b/g,
  /@[\w_.]{3,}/g,
  /t\.me\/\S+/gi,
  /telegram\.me\/\S+/gi,
  /discord\.gg\/\S+/gi,
  /discord\.com\/(?:users\/|invite\/)?\S+/gi,
  /facebook\.com\/\S+/gi,
  /instagram\.com\/\S+/gi,
  /wa\.me\/\S+/gi,
  /whatsapp\.com\/\S+/gi,
  /https?:\/\/\S+/gi,
  /www\.\S+/gi,
  /\b[\w.-]+@[\w.-]+\.\w+\b/gi,
  // QR code mentions
  /\bqr\s?code\b/gi,
  /\bscan\s+(this\s+)?qr\b/gi,
  /\bscan\s+me\b/gi,
  // Payment requests
  /\bpaytm\s+to\b/gi,
  /\bgpay\s+to\b/gi,
  /\bphonepe\s+to\b/gi,
  /\bupi\s+id\b/gi,
  /\bsend\s+money\s+to\b/gi,
  /\bpay\s+me\b/gi,
  // Shortened URL services
  /\bbit\.ly\/\S+/gi,
  /\btinyurl\.com\/\S+/gi,
  /\bt\.co\/\S+/gi,
  /\bgoo\.gl\/\S+/gi,
  /\bow\.ly\/\S+/gi,
  /\bis\.gd\/\S+/gi,
];

const BLOCKED_WARNING = 'Never communicate or pay outside the Kryzo Escrow Platform.';
const PERSISTENT_WARNING = 'Never communicate outside Kryzo. Sharing contact information, external links, or payment details is prohibited and may result in account suspension.';

function sanitizeMessage(text: string): { blocked: boolean; text: string } {
  let clean = text;
  let blocked = false;
  for (const pattern of BLOCKED_PATTERNS) {
    const before = clean;
    clean = clean.replace(pattern, '***');
    if (clean !== before) blocked = true;
  }
  return { blocked, text: clean };
}

export function ChatPage({ conversationId }: { conversationId: string }) {
  const { user, loading } = useAuth();
  const toast = useToast();
  const [conversation, setConversation] = useState<ChatConversationRow | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [listing, setListing] = useState<AccountListingRow | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [offerAmount, setOfferAmount] = useState(0);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase.from('chat_conversations').select('*').eq('id', conversationId).maybeSingle();
      if (!conv) { toast('error', 'Conversation not found.'); navigate('/marketplace'); return; }
      setConversation(conv as ChatConversationRow);
      const isBuyer = (conv as ChatConversationRow).buyer_id === user.id;
      const otherId = isBuyer ? (conv as ChatConversationRow).seller_id : (conv as ChatConversationRow).buyer_id;
      const [m, l, u] = await Promise.all([
        supabase.from('chat_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
        supabase.from('account_listings').select('*').eq('id', (conv as ChatConversationRow).listing_id).maybeSingle(),
        supabase.from('profiles').select('*').eq('id', otherId).maybeSingle(),
      ]);
      setMessages((m.data ?? []) as ChatMessageRow[]);
      setListing(l.data as AccountListingRow | null);
      setOtherUser(u.data as Profile | null);
      // Mark unread as read
      const updateField = isBuyer ? 'buyer_unread' : 'seller_unread';
      await supabase.from('chat_conversations').update({ [updateField]: 0 }).eq('id', conversationId);
      // Mark messages from other user as read
      await supabase.from('chat_messages').update({ is_read: true }).eq('conversation_id', conversationId).neq('sender_id', user.id).eq('is_read', false);
    })();
  }, [conversationId, user, loading]);

  // Realtime subscription
  useEffect(() => {
    if (!conversation) return;
    const channel = supabase.channel(`chat:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const newMsg = payload.new as ChatMessageRow;
        setMessages((m) => [...m, newMsg]);
        if (newMsg.sender_id !== user?.id) {
          supabase.from('chat_messages').update({ is_read: true }).eq('id', newMsg.id).eq('is_read', false);
          setTyping(false);
        }
        scrollToBottom();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const updated = payload.new as ChatMessageRow;
        setMessages((m) => m.map((msg) => msg.id === updated.id ? updated : msg));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, conversation, user, scrollToBottom]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleTyping = (value: string) => {
    setText(value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTyping(true);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
  };

  const sendMessage = async (type: 'text' | 'image' | 'offer' | 'counter_offer', content: string, offerAmount?: number) => {
    if (!user || !conversation) return;
    setSending(true);
    try {
      const { data: msg, error } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        message_type: type,
        content,
        offer_amount: offerAmount ?? null,
        offer_status: (type === 'offer' || type === 'counter_offer') ? 'pending' : null,
      }).select().single();
      if (error) throw error;
      setMessages((m) => [...m, msg as ChatMessageRow]);
      const isBuyer = conversation.buyer_id === user.id;
      const updateField = isBuyer ? 'seller_unread' : 'buyer_unread';
      await supabase.from('chat_conversations').update({
        last_message: type === 'image' ? '[Image]' : type === 'offer' || type === 'counter_offer' ? `Offer: ₹${offerAmount}` : content,
        last_message_at: new Date().toISOString(),
        [updateField]: (isBuyer ? conversation.seller_unread : conversation.buyer_unread) + 1,
      }).eq('id', conversationId);
      const otherId = isBuyer ? conversation.seller_id : conversation.buyer_id;
      const notifType = type === 'offer' ? 'new_offer' : type === 'counter_offer' ? 'counter_offer' : 'new_chat';
      const notifTitle = type === 'offer' ? 'New Offer' : type === 'counter_offer' ? 'Counter Offer' : 'New Message';
      await createNotification(otherId, notifType, notifTitle, `New ${type} regarding "${listing?.title ?? 'a listing'}".`);
      setText('');
      setShowOffer(false);
      setOfferAmount(0);
      scrollToBottom();
    } catch (err: any) {
      toast('error', err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleSendText = () => {
    if (!text.trim()) return;
    const { text: clean, blocked } = sanitizeMessage(text);
    if (blocked) toast('info', 'Blocked: Sharing contact information or external links is not allowed.');
    sendMessage('text', clean);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 5) { toast('error', 'Maximum 5 images per message.'); return; }
    files.forEach((file) => {
      if (file.size > 2 * 1024 * 1024) { toast('error', `${file.name} is too large (max 2MB).`); return; }
      const reader = new FileReader();
      reader.onload = () => sendMessage('image', reader.result as string);
      reader.readAsDataURL(file);
    });
    setShowImagePicker(false);
  };

  const respondToOffer = async (msg: ChatMessageRow, status: 'accepted' | 'rejected') => {
    await supabase.from('chat_messages').update({ offer_status: status }).eq('id', msg.id);
    setMessages((m) => m.map((mm) => mm.id === msg.id ? { ...mm, offer_status: status } : mm));
    if (status === 'accepted') toast('success', 'Offer accepted!');
    else toast('info', 'Offer rejected.');
  };

  if (loading || !user || !conversation) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;

  const isBuyer = conversation.buyer_id === user.id;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
      <button onClick={() => navigate('/marketplace')} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gold-300 mb-4">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="glass rounded-2xl flex flex-col h-[600px]">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          {listing && <img src={listing.profile_image} alt="" className="w-10 h-10 rounded-lg object-cover" />}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm truncate">{otherUser?.username ?? 'Unknown'}</p>
            <p className="text-xs text-gray-500 truncate">{listing?.title ?? 'Listing'}</p>
          </div>
          <span className="badge bg-gold-400/10 text-gold-400">{listing ? `₹${listing.price.toLocaleString('en-IN')}` : ''}</span>
        </div>

        {/* Escrow warning */}
        <div className="px-4 py-2 bg-gold-400/5 border-b border-gold-400/10 flex items-center gap-2">
          <ShieldCheck size={13} className="text-gold-400 shrink-0" />
          <p className="text-xs text-gray-400">{BLOCKED_WARNING}</p>
        </div>

        {/* Persistent safety banner */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-gold-400/10 via-gold-400/5 to-gold-400/10 border-b border-gold-400/20 flex items-center gap-2">
          <AlertTriangle size={13} className="text-gold-400 shrink-0" />
          <p className="text-xs text-gold-200/90 leading-snug">{PERSISTENT_WARNING}</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {messages.length === 0 && (
            <div className="h-full grid place-items-center text-center">
              <div>
                <MessageCircle size={32} className="mx-auto text-gray-600" />
                <p className="mt-3 text-sm text-gray-500">Start the conversation</p>
              </div>
            </div>
          )}
          {messages.map((m) => {
            const isMine = m.sender_id === user.id;
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {m.message_type === 'image' ? (
                    <img src={m.content} alt="Shared" className="max-w-[200px] rounded-xl border border-white/10" />
                  ) : m.message_type === 'offer' || m.message_type === 'counter_offer' ? (
                    <div className={`px-4 py-3 rounded-2xl ${isMine ? 'bg-gold-gradient text-ink-950 rounded-br-sm' : 'bg-white/[0.06] text-gray-200 rounded-bl-sm'}`}>
                      <p className="text-xs font-semibold opacity-70">{m.message_type === 'offer' ? 'Offer' : 'Counter Offer'}</p>
                      <p className="text-lg font-bold">₹{m.offer_amount?.toLocaleString('en-IN')}</p>
                      {m.offer_status === 'pending' && !isMine && (
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => respondToOffer(m, 'accepted')} className="px-3 py-1 rounded-lg bg-success-500/20 text-success-400 text-xs font-semibold">Accept</button>
                          <button onClick={() => respondToOffer(m, 'rejected')} className="px-3 py-1 rounded-lg bg-error-500/20 text-error-400 text-xs font-semibold">Reject</button>
                        </div>
                      )}
                      {m.offer_status === 'accepted' && <span className="text-xs font-semibold text-success-500">Accepted</span>}
                      {m.offer_status === 'rejected' && <span className="text-xs font-semibold text-error-500">Rejected</span>}
                    </div>
                  ) : (
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${isMine ? 'bg-gold-gradient text-ink-950 rounded-br-sm' : 'bg-white/[0.06] text-gray-200 rounded-bl-sm'}`}>
                      {m.content}
                    </div>
                  )}
                  <div className={`flex items-center gap-1 text-[10px] ${isMine ? 'text-gray-500' : 'text-gray-600'}`}>
                    {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {isMine && (m.is_read ? <CheckCheck size={12} className="text-gold-400" /> : <Check size={12} />)}
                  </div>
                </div>
              </div>
            );
          })}
          {typing && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl bg-white/[0.06] text-gray-400 text-sm">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Offer modal */}
        {showOffer && (
          <div className="p-3 border-t border-white/[0.06] bg-ink-900/50 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <Tag size={15} className="text-gold-400" />
              <span className="text-sm font-semibold text-white">{isBuyer ? 'Make an Offer' : 'Counter Offer'}</span>
              <button onClick={() => setShowOffer(false)} className="ml-auto text-gray-500 hover:text-gray-300"><X size={15} /></button>
            </div>
            <div className="flex gap-2">
              <input type="number" min={1} value={offerAmount} onChange={(e) => setOfferAmount(Number(e.target.value))} placeholder="Enter amount (₹)" className="input-field text-sm flex-1" />
              <button onClick={() => { if (offerAmount > 0) { sendMessage(isBuyer ? 'offer' : 'counter_offer', `Offer: ₹${offerAmount}`, offerAmount); } }} className="btn-gold text-sm">
                Send <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Image picker */}
        {showImagePicker && (
          <div className="p-3 border-t border-white/[0.06] bg-ink-900/50 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon size={15} className="text-gold-400" />
              <span className="text-sm font-semibold text-white">Share Images (max 5)</span>
              <button onClick={() => setShowImagePicker(false)} className="ml-auto text-gray-500 hover:text-gray-300"><X size={15} /></button>
            </div>
            <label className="block border-2 border-dashed border-white/10 rounded-xl p-4 text-center hover:border-gold-400/40 transition-colors cursor-pointer">
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              <ImageIcon size={20} className="mx-auto text-gray-500" />
              <p className="mt-1 text-xs text-gray-400">Click to select images (max 2MB each)</p>
            </label>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-white/[0.06] flex items-center gap-2">
          <button onClick={() => { setShowImagePicker((v) => !v); setShowOffer(false); }} className={`p-2 rounded-lg transition-colors ${showImagePicker ? 'bg-gold-400/10 text-gold-400' : 'text-gray-500 hover:text-gold-300'}`}>
            <ImageIcon size={18} />
          </button>
          <button onClick={() => { setShowOffer((v) => !v); setShowImagePicker(false); }} className={`p-2 rounded-lg transition-colors ${showOffer ? 'bg-gold-400/10 text-gold-400' : 'text-gray-500 hover:text-gold-300'}`}>
            <Tag size={18} />
          </button>
          <input
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendText())}
            placeholder="Type a message..."
            className="input-field text-sm flex-1"
          />
          <button onClick={handleSendText} disabled={sending || !text.trim()} className="btn-gold px-3">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
