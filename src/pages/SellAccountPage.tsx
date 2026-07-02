import { useState } from 'react';
import { navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { GAMES, BR_RANKS, CS_RANKS } from '../lib/data';
import { ShieldCheck, Upload, X, Image as ImageIcon, AlertTriangle, ArrowRight, Flame, Trophy, Sparkles, Gem, Crown, Swords, Star } from 'lucide-react';

const MAX_IMAGES = 25;
const MIN_IMAGES = 10;

export function SellAccountPage() {
  const { user, profile, loading } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '', game: 'free-fire' as 'free-fire' | 'bgmi', uid: '', account_level: 1,
    br_rank: 'Unranked', cs_rank: 'Unranked', evo_gun_level: 0, prime_level: 0,
    diamonds: 0, price: 0, original_price: 0, description: '', seller_whatsapp: '',
    profile_image: '',
  });
  const [gallery, setGallery] = useState<string[]>([]);

  if (loading || !user || !profile) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;

  if (profile.kyc_status !== 'approved') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-fade-in">
        <div className="glass rounded-2xl p-8 text-center">
          <span className="grid place-items-center w-16 h-16 rounded-full bg-warning-500/10 text-warning-400 mx-auto">
            <ShieldCheck size={32} />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold text-white">Complete KYC Verification before selling</h1>
          <p className="mt-3 text-gray-400">You must complete KYC verification with government ID and live face verification before you can list accounts for sale.</p>
          <button onClick={() => navigate('/kyc')} className="btn-gold mt-6">
            Complete KYC <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  const handleProfileImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('error', 'Image must be under 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, profile_image: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleGalleryImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_IMAGES - gallery.length;
    if (files.length > remaining) { toast('error', `You can upload ${remaining} more images (max ${MAX_IMAGES}).`); return; }
    files.forEach((file) => {
      if (file.size > 3 * 1024 * 1024) { toast('error', `${file.name} is too large (max 3MB).`); return; }
      const reader = new FileReader();
      reader.onload = () => setGallery((g) => [...g, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removeGalleryImage = (index: number) => {
    setGallery((g) => g.filter((_, i) => i !== index));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.uid || !form.seller_whatsapp || !form.profile_image) {
      toast('error', 'Please fill all required fields.'); return;
    }
    if (gallery.length < MIN_IMAGES) {
      toast('error', `Gallery needs at least ${MIN_IMAGES} images. You have ${gallery.length}.`); return;
    }
    if (gallery.length > MAX_IMAGES) {
      toast('error', `Gallery can have at most ${MAX_IMAGES} images.`); return;
    }
    if (form.price <= 0) { toast('error', 'Price must be greater than 0.'); return; }
    setSubmitting(true);
    try {
      const galleryArray = gallery.filter(img => img && img.trim() !== '');
      const { error } = await supabase.rpc('create_listing_with_gallery', {
        p_seller_id: user.id,
        p_title: form.title,
        p_description: form.description,
        p_game: form.game,
        p_price: Number(form.price),
        p_level: Number(form.account_level) || 0,
        p_br_rank: form.br_rank || '',
        p_cs_rank: form.cs_rank || '',
        p_prime_level: Number(form.prime_level) || 0,
        p_evo_gun_level: Number(form.evo_gun_level) || 0,
        p_seller_whatsapp: form.seller_whatsapp || null,
        p_profile_image: form.profile_image || null,
        p_gallery_images: galleryArray,
      });
      if (error) throw error;
      toast('success', 'Listing submitted! It will appear in the marketplace after admin approval.');
      navigate('/seller-dashboard');
    } catch (err: any) {
      toast('error', err.message || 'Failed to create listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="mb-8">
        <span className="section-eyebrow">Sell Account</span>
        <h1 className="font-display text-3xl font-bold text-white">List Your Gaming Account</h1>
        <p className="mt-2 text-gray-400">Fill in the details below. Your listing will be reviewed before going live.</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Basic info */}
        <div className="glass rounded-2xl p-6 space-y-5">
          <h2 className="font-display text-lg font-bold text-white">Account Information</h2>
          <div>
            <label className="label-field">Account Title *</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Grandmaster Account — 80+ Skins" className="input-field" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Game *</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(GAMES).map((g) => (
                  <button key={g.key} type="button" onClick={() => setForm((f) => ({ ...f, game: g.key }))} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${form.game === g.key ? 'bg-gold-gradient text-ink-950' : 'glass text-gray-300'}`}>
                    {g.key === 'free-fire' ? <Flame size={15} /> : <Trophy size={15} />} {g.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label-field">UID *</label>
              <input value={form.uid} onChange={(e) => setForm((f) => ({ ...f, uid: e.target.value }))} placeholder="123456789" className="input-field" />
            </div>
          </div>
          <div>
            <label className="label-field">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} placeholder="Describe the account, skins, bundles, and other details..." className="input-field resize-none" />
          </div>
        </div>

        {/* Game stats */}
        <div className="glass rounded-2xl p-6 space-y-5">
          <h2 className="font-display text-lg font-bold text-white">Game Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field icon={<Star size={14} className="text-gold-400" />} label="Account Level">
              <input type="number" min={1} max={100} value={form.account_level} onChange={(e) => setForm((f) => ({ ...f, account_level: Number(e.target.value) }))} className="input-field" />
            </Field>
            <Field icon={<Trophy size={14} className="text-gold-400" />} label="BR Rank">
              <select value={form.br_rank} onChange={(e) => setForm((f) => ({ ...f, br_rank: e.target.value }))} className="input-field text-sm">
                {BR_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field icon={<Swords size={14} className="text-gold-400" />} label="CS Rank">
              <select value={form.cs_rank} onChange={(e) => setForm((f) => ({ ...f, cs_rank: e.target.value }))} className="input-field text-sm">
                {CS_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field icon={<Sparkles size={14} className="text-gold-400" />} label="Evo Gun Level">
              <input type="number" min={0} max={10} value={form.evo_gun_level} onChange={(e) => setForm((f) => ({ ...f, evo_gun_level: Number(e.target.value) }))} className="input-field" />
            </Field>
            <Field icon={<Crown size={14} className="text-gold-400" />} label="Prime Level">
              <input type="number" min={0} max={10} value={form.prime_level} onChange={(e) => setForm((f) => ({ ...f, prime_level: Number(e.target.value) }))} className="input-field" />
            </Field>
            <Field icon={<Gem size={14} className="text-gold-400" />} label="Diamonds">
              <input type="number" min={0} value={form.diamonds} onChange={(e) => setForm((f) => ({ ...f, diamonds: Number(e.target.value) }))} className="input-field" />
            </Field>
          </div>
        </div>

        {/* Pricing */}
        <div className="glass rounded-2xl p-6 space-y-5">
          <h2 className="font-display text-lg font-bold text-white">Pricing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Price (₹) *</label>
              <input type="number" min={1} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} className="input-field" />
            </div>
            <div>
              <label className="label-field">Original Price (₹) — optional</label>
              <input type="number" min={0} value={form.original_price} onChange={(e) => setForm((f) => ({ ...f, original_price: Number(e.target.value) }))} className="input-field" />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="glass rounded-2xl p-6 space-y-5">
          <h2 className="font-display text-lg font-bold text-white">Seller Contact</h2>
          <div>
            <label className="label-field">Seller WhatsApp Number *</label>
            <input value={form.seller_whatsapp} onChange={(e) => setForm((f) => ({ ...f, seller_whatsapp: e.target.value }))} placeholder="+919876543210" className="input-field" />
          </div>
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gold-400/5 border border-gold-400/15">
            <ShieldCheck size={15} className="text-gold-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-400">Your WhatsApp number is hidden from all visitors, marketplace, and search results. It will only be revealed to the buyer after a successful payment. Admin can always view it.</p>
          </div>
        </div>

        {/* Profile image */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-white">Profile Image *</h2>
          {form.profile_image ? (
            <div className="relative rounded-xl overflow-hidden border border-gold-400/30 max-w-xs">
              <img src={form.profile_image} alt="Profile" className="w-full aspect-[16/10] object-cover" />
              <button type="button" onClick={() => setForm((f) => ({ ...f, profile_image: '' }))} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-ink-950/80 text-white grid place-items-center hover:bg-error-500">
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="block border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-gold-400/40 transition-colors cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleProfileImage} />
              <Upload size={24} className="mx-auto text-gray-500" />
              <p className="mt-2 text-sm text-gray-400">Upload profile image</p>
            </label>
          )}
        </div>

        {/* Gallery */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">Collection Gallery</h2>
            <span className={`badge ${gallery.length >= MIN_IMAGES ? 'bg-success-500/15 text-success-400' : 'bg-warning-500/15 text-warning-400'}`}>
              {gallery.length}/{MAX_IMAGES} images
            </span>
          </div>
          <p className="text-xs text-gray-500">Minimum {MIN_IMAGES} images, maximum {MAX_IMAGES} images.</p>
          {gallery.length < MAX_IMAGES && (
            <label className="block border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-gold-400/40 transition-colors cursor-pointer">
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryImages} />
              <ImageIcon size={24} className="mx-auto text-gray-500" />
              <p className="mt-2 text-sm text-gray-400">Add gallery images ({MAX_IMAGES - gallery.length} remaining)</p>
            </label>
          )}
          {gallery.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {gallery.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeGalleryImage(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-ink-950/80 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error-500">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {gallery.length < MIN_IMAGES && (
            <div className="flex items-center gap-2 text-xs text-warning-400">
              <AlertTriangle size={13} /> You need at least {MIN_IMAGES - gallery.length} more image(s).
            </div>
          )}
        </div>

        <button type="submit" disabled={submitting} className="btn-gold w-full text-base">
          {submitting ? 'Submitting...' : <>Submit Listing <ArrowRight size={18} /></>}
        </button>
      </form>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-field inline-flex items-center gap-1.5">{icon} {label}</label>
      {children}
    </div>
  );
}
