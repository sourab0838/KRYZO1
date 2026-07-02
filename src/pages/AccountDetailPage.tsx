import { useEffect, useState } from 'react';
import { navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { supabase, type AccountListingRow, type ListingGalleryRow, type Profile, type ListingReviewRow } from '../lib/supabase';
import { GAMES, maskUid, formatPrice } from '../lib/data';
import { useToast } from '../components/Toast';
import { createNotification } from '../lib/notify';
import { paymentApi } from '../lib/payments';
import { Trophy, Star, Eye, BadgeCheck, ShieldCheck, Heart, GitCompare, MessageCircle, ShoppingBag, ArrowLeft, Gem, Crown, Swords, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

export function AccountDetailPage({ id }: { id: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [listing, setListing] = useState<AccountListingRow | null>(null);
  const [gallery, setGallery] = useState<ListingGalleryRow[]>([]);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<ListingReviewRow[]>([]);
  const [wishlisted, setWishlisted] = useState(false);
  const [compared, setCompared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingBuy, setProcessingBuy] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data: l } = await supabase.from('account_listings').select('*').eq('id', id).maybeSingle();
        if (!l) { return; }
        setListing(l as AccountListingRow);
        await supabase.rpc('increment_listing_views', { p_listing_id: id });
        const [g, s, r, w, c] = await Promise.all([
          supabase.from('listing_galleries').select('*').eq('listing_id', id).order('sort_order', { ascending: true }),
          supabase.from('profiles').select('*').eq('id', (l as AccountListingRow).seller_id).maybeSingle(),
          supabase.from('listing_reviews').select('*').eq('seller_id', (l as AccountListingRow).seller_id).order('created_at', { ascending: false }).limit(5),
          user ? supabase.from('listing_wishlists').select('id').eq('listing_id', id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
          user ? supabase.from('listing_compares').select('id').eq('listing_id', id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        setGallery((g.data ?? []) as ListingGalleryRow[]);
        setSeller(s.data as Profile | null);
        setReviews((r.data ?? []) as ListingReviewRow[]);
        setWishlisted(!!w.data);
        setCompared(!!c.data);
      } catch {
        /* loading completes regardless of query success */
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user]);

  if (loading) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;
  if (!listing) return (
    <div className="min-h-[60vh] grid place-items-center text-center px-4">
      <div>
        <p className="font-display text-2xl font-bold text-white">Listing not found</p>
        <button onClick={() => navigate('/marketplace')} className="btn-gold mt-6">Back to Marketplace</button>
      </div>
    </div>
  );

  const game = GAMES[listing.game];
  const images = [listing.profile_image, ...gallery.map((g) => g.image_url)].filter(Boolean);
  const avgRating = reviews.length > 0 ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const isOwner = user?.id === listing.seller_id;

  const toggleWishlist = async () => {
    if (!user) { toast('info', 'Please log in to save listings.'); navigate('/login'); return; }
    if (wishlisted) {
      await supabase.from('listing_wishlists').delete().eq('listing_id', id).eq('user_id', user.id);
      setWishlisted(false);
      toast('info', 'Removed from wishlist.');
    } else {
      await supabase.from('listing_wishlists').insert({ listing_id: id, user_id: user.id });
      setWishlisted(true);
      toast('success', 'Added to wishlist!');
    }
  };

  const toggleCompare = async () => {
    if (!user) { toast('info', 'Please log in to compare listings.'); navigate('/login'); return; }
    if (compared) {
      await supabase.from('listing_compares').delete().eq('listing_id', id).eq('user_id', user.id);
      setCompared(false);
      toast('info', 'Removed from compare list.');
    } else {
      const { count } = await supabase.from('listing_compares').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      if ((count ?? 0) >= 4) { toast('error', 'You can compare up to 4 listings at a time.'); return; }
      await supabase.from('listing_compares').insert({ listing_id: id, user_id: user.id });
      setCompared(true);
      toast('success', 'Added to compare list!');
    }
  };

  const startChat = async () => {
    if (!user) { toast('info', 'Please log in to chat with sellers.'); navigate('/login'); return; }
    if (isOwner) { toast('info', 'You cannot chat with yourself.'); return; }
    const { data: existing } = await supabase.from('chat_conversations')
      .select('id').eq('listing_id', id).eq('buyer_id', user.id).eq('seller_id', listing.seller_id).maybeSingle();
    if (existing) { navigate(`/chat/${existing.id}`); return; }
    const { data: conv, error } = await supabase.from('chat_conversations').insert({
      listing_id: id, buyer_id: user.id, seller_id: listing.seller_id,
    }).select().single();
    if (error) { toast('error', 'Could not start chat.'); return; }
    await createNotification(listing.seller_id, 'new_chat', 'New Chat', `Someone started a chat about "${listing.title}".`);
    navigate(`/chat/${conv.id}`);
  };

  const buyNow = async () => {
    if (!user) { toast('info', 'Please log in to purchase.'); navigate('/login'); return; }
    if (isOwner) { toast('error', 'You cannot buy your own listing.'); return; }
    if (!listing) return;
    setProcessingBuy(true);
    try {
      await paymentApi.openPurchaseCheckout(
        listing.id,
        { email: user.email, username: user.username },
        async (paymentId, orderId, signature, purchaseData) => {
          try {
            const result = await paymentApi.verifyPurchase({
              order_id: purchaseData.order_id,
              razorpay_order_id: orderId,
              razorpay_payment_id: paymentId,
              razorpay_signature: signature,
            });
            if (result.success) {
              toast('success', 'Payment successful! Funds held in escrow. Seller will deliver the account.');
              navigate(`/buyer-dashboard`);
            } else {
              toast('error', result.message || 'Payment verification failed.');
            }
          } catch (err: any) {
            toast('error', err.message || 'Payment verification failed.');
          }
          setProcessingBuy(false);
        },
        () => {
          setProcessingBuy(false);
          toast('info', 'Payment cancelled.');
        },
      );
    } catch (err: any) {
      toast('error', err.message || 'Failed to initiate purchase.');
      setProcessingBuy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <button onClick={() => navigate('/marketplace')} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gold-300 mb-6">
        <ArrowLeft size={16} /> Back to Marketplace
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8">
        {/* Gallery */}
        <div>
          <div className="relative aspect-[16/10] rounded-2xl overflow-hidden glass">
            <img src={images[activeImage] ?? listing.profile_image} alt={listing.title} className="w-full h-full object-cover" />
            {images.length > 1 && (
              <>
                <button onClick={() => setActiveImage((i) => (i - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-ink-950/70 backdrop-blur text-white grid place-items-center hover:bg-gold-400 hover:text-ink-950 transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => setActiveImage((i) => (i + 1) % images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-ink-950/70 backdrop-blur text-white grid place-items-center hover:bg-gold-400 hover:text-ink-950 transition-colors">
                  <ChevronRight size={18} />
                </button>
              </>
            )}
            <div className="absolute top-3 left-3 flex gap-1.5">
              <span className={`badge bg-ink-950/70 backdrop-blur ${game.accent}`}>{game.name}</span>
              {listing.featured && <span className="badge bg-gold-400/90 text-ink-950">Featured</span>}
              {listing.trending && <span className="badge bg-error-500/90 text-white">Trending</span>}
            </div>
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImage(i)} className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${activeImage === i ? 'border-gold-400' : 'border-transparent'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">{listing.title}</h1>
          <div className="mt-3 flex items-center gap-3">
            <span className="font-display text-3xl font-bold text-gold-300">{formatPrice(listing.price)}</span>
            {listing.original_price && (
              <span className="text-lg text-gray-500 line-through">{formatPrice(listing.original_price)}</span>
            )}
            {listing.original_price && (
              <span className="badge bg-error-500/15 text-error-400">
                Save {formatPrice(listing.original_price - listing.price)}
              </span>
            )}
          </div>

          {/* Seller info */}
          <div className="mt-5 glass rounded-xl p-4 flex items-center gap-3">
            <span className="grid place-items-center w-12 h-12 rounded-full bg-gold-gradient text-ink-950 font-bold overflow-hidden">
              {seller?.avatar_url ? <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" /> : (seller?.username?.[0] ?? 'S').toUpperCase()}
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                {seller?.username ?? 'Unknown'}
                {seller?.verified_seller && <BadgeCheck size={15} className="text-gold-400" />}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <Star size={12} className="text-gold-400 fill-gold-400" /> {avgRating.toFixed(1)} ({reviews.length})
                </span>
                <span>·</span>
                <span>{listing.views} views</span>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <StatBox icon={<Trophy size={16} className="text-gold-400" />} label="BR Rank" value={listing.br_rank} />
            <StatBox icon={<Swords size={16} className="text-gold-400" />} label="CS Rank" value={listing.cs_rank} />
            <StatBox icon={<Star size={16} className="text-gold-400" />} label="Account Level" value={`Level ${listing.account_level}`} />
            <StatBox icon={<Sparkles size={16} className="text-gold-400" />} label="Evo Gun Level" value={`Level ${listing.evo_gun_level}`} />
            <StatBox icon={<Crown size={16} className="text-gold-400" />} label="Prime Level" value={`Level ${listing.prime_level}`} />
            <StatBox icon={<Gem size={16} className="text-gold-400" />} label="Diamonds" value={listing.diamonds.toLocaleString('en-IN')} />
            <StatBox icon={<Eye size={16} className="text-gold-400" />} label="UID" value={maskUid(listing.uid)} />
            <StatBox icon={<ShieldCheck size={16} className="text-gold-400" />} label="Verified" value={seller?.verified_seller ? 'Yes' : 'No'} />
          </div>

          {/* Description */}
          {listing.description && (
            <div className="mt-5 glass rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Description</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{listing.description}</p>
            </div>
          )}

          {/* Action buttons */}
          {!isOwner && (
            <div className="mt-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={buyNow} disabled={processingBuy} className="btn-gold">
                  {processingBuy ? 'Processing...' : <><ShoppingBag size={16} /> Buy Now</>}
                </button>
                <button onClick={startChat} className="btn-outline">
                  <MessageCircle size={16} /> Chat with Seller
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={toggleWishlist} className={`btn-ghost text-sm ${wishlisted ? 'text-gold-300 border-gold-400/30' : ''}`}>
                  <Heart size={15} className={wishlisted ? 'fill-gold-400 text-gold-400' : ''} /> {wishlisted ? 'Wishlisted' : 'Wishlist'}
                </button>
                <button onClick={toggleCompare} className={`btn-ghost text-sm ${compared ? 'text-gold-300 border-gold-400/30' : ''}`}>
                  <GitCompare size={15} /> {compared ? 'Comparing' : 'Compare'}
                </button>
              </div>
            </div>
          )}

          {/* WhatsApp privacy notice */}
          <div className="mt-4 flex items-start gap-2.5 p-3 rounded-lg bg-gold-400/5 border border-gold-400/15">
            <ShieldCheck size={15} className="text-gold-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-400">Seller's WhatsApp number is hidden and will only be revealed after a successful purchase. Never pay outside the Kryzo Escrow Platform.</p>
          </div>
        </div>
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-bold text-white mb-4">Seller Reviews</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <div key={r.id} className="glass rounded-xl p-4">
                <div className="flex gap-0.5 mb-2">
                  {Array.from({ length: r.rating }).map((_, s) => <Star key={s} size={13} className="text-gold-400 fill-gold-400" />)}
                </div>
                <p className="text-sm text-gray-300">{r.comment}</p>
                <p className="mt-2 text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('en-IN')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3.5">
      <div className="flex items-center gap-2 text-xs text-gray-500">{icon} {label}</div>
      <p className="mt-1.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
