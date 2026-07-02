import { useEffect, useState } from 'react';
import { Link, navigate } from '../lib/router';
import { GAMES, LISTINGS, REVIEWS, FAQS, maskUid, formatPrice, type AccountListing } from '../lib/data';
import { supabase, type AccountListingRow } from '../lib/supabase';
import { Search, Flame, ShieldCheck, Star, TrendingUp, BadgeCheck, ArrowRight, Quote, ChevronDown, Zap, Trophy, Users, Clock, Tag, ShoppingBag, Eye } from 'lucide-react';

export function HomePage() {
  return (
    <div className="animate-fade-in">
      <Hero />
      <CategorySection />
      <StatsSection />
      <FeaturedSection />
      <TrendingSection />
      <BestDealsSection />
      <RecentlyAddedSection />
      <VerifiedSellerBanner />
      <ReviewsSection />
      <FaqSection />
    </div>
  );
}

function Hero() {
  const [query, setQuery] = useState('');
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gold-400/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-orange-500/5 rounded-full blur-[100px]" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-gold text-xs font-semibold text-gold-300 animate-fade-up">
            <Zap size={13} className="text-gold-400" />
            Premium Gaming Account Marketplace
          </span>
          <h1 className="mt-6 font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white text-balance uppercase animate-fade-up" style={{ animationDelay: '60ms' }}>
            Buy <span className="gold-text">verified</span> gaming<br />accounts with confidence
          </h1>
          <p className="mt-5 text-base md:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed animate-fade-up" style={{ animationDelay: '120ms' }}>
            Kryzo is the secure marketplace for Free Fire and BGMI accounts. Escrow-protected transactions, verified sellers, and instant delivery.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); navigate(`/marketplace?q=${encodeURIComponent(query)}`); }}
            className="mt-8 max-w-xl mx-auto animate-fade-up"
            style={{ animationDelay: '180ms' }}
          >
            <div className="relative glass rounded-2xl p-1.5 flex items-center gap-2 focus-within:border-gold-400/40 transition-colors">
              <Search size={20} className="ml-3 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Free Fire or BGMI accounts..."
                className="flex-1 bg-transparent px-2 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
              />
              <button type="submit" className="btn-gold text-sm">Search</button>
            </div>
          </form>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-400 animate-fade-up" style={{ animationDelay: '240ms' }}>
            <Stat icon={<ShieldCheck size={16} className="text-gold-400" />} label="Escrow Protected" />
            <Stat icon={<BadgeCheck size={16} className="text-gold-400" />} label="Verified Sellers" />
            <Stat icon={<Trophy size={16} className="text-gold-400" />} label="2,400+ Accounts Sold" />
            <Stat icon={<Users size={16} className="text-gold-400" />} label="18K+ Happy Gamers" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {icon}
      <span className="font-medium">{label}</span>
    </span>
  );
}

function CategorySection() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <span className="section-eyebrow">Browse by Game</span>
        <h2 className="section-title">Choose Your Battlefield</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.values(GAMES).map((g, i) => (
          <Link
            key={g.key}
            to={`/marketplace?game=${g.key}`}
            className="group relative overflow-hidden rounded-2xl glass glass-hover p-8 animate-fade-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${g.gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-2xl font-bold text-white">{g.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">{g.tagline}</p>
                </div>
                <span className="grid place-items-center w-14 h-14 rounded-xl bg-gold-400/10 border border-gold-400/20 text-gold-400 group-hover:scale-110 transition-transform">
                  {g.key === 'free-fire' ? <Flame size={26} /> : <Trophy size={26} />}
                </span>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  {LISTINGS.filter((l) => l.game === g.key).length} accounts available
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-300 group-hover:gap-2.5 transition-all">
                  Browse <ArrowRight size={15} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatsSection() {
  const [stats, setStats] = useState({ total: 0, freeFire: 0, bgmi: 0, verifiedSellers: 0 });
  useEffect(() => {
    (async () => {
      const [{ count: total }, { count: ff }, { count: bg }, { count: vs }] = await Promise.all([
        supabase.from('account_listings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('account_listings').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('game', 'free-fire'),
        supabase.from('account_listings').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('game', 'bgmi'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('verified_seller', true),
      ]);
      setStats({ total: total ?? 0, freeFire: ff ?? 0, bgmi: bg ?? 0, verifiedSellers: vs ?? 0 });
    })();
  }, []);
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ShoppingBag size={20} />} value={stats.total} label="Active Listings" />
        <StatCard icon={<Flame size={20} />} value={stats.freeFire} label="Free Fire Accounts" />
        <StatCard icon={<Trophy size={20} />} value={stats.bgmi} label="BGMI Accounts" />
        <StatCard icon={<BadgeCheck size={20} />} value={stats.verifiedSellers} label="Verified Sellers" />
      </div>
    </section>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="glass glass-hover rounded-2xl p-5 text-center animate-fade-up">
      <span className="inline-grid place-items-center w-10 h-10 rounded-lg bg-gold-400/10 text-gold-400 mb-3">{icon}</span>
      <p className="font-display text-2xl font-bold text-white">{value.toLocaleString('en-IN')}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function FeaturedSection() {
  const [listings, setListings] = useState<AccountListingRow[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('account_listings')
        .select('*').eq('status', 'approved').eq('featured', true)
        .order('created_at', { ascending: false }).limit(3);
      setListings((data ?? []) as AccountListingRow[]);
    })();
  }, []);
  if (listings.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-end justify-between mb-8">
        <div>
          <span className="section-eyebrow">Handpicked</span>
          <h2 className="section-title">Featured Accounts</h2>
        </div>
        <Link to="/marketplace" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-gold-300 hover:text-gold-200">
          View all <ArrowRight size={15} />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((l, i) => <DbListingCard key={l.id} listing={l} delay={i * 80} />)}
      </div>
    </section>
  );
}

function TrendingSection() {
  const [listings, setListings] = useState<AccountListingRow[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('account_listings')
        .select('*').eq('status', 'approved').eq('trending', true)
        .order('created_at', { ascending: false }).limit(4);
      setListings((data ?? []) as AccountListingRow[]);
    })();
  }, []);
  if (listings.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-end justify-between mb-8">
        <div>
          <span className="section-eyebrow">Hot Right Now</span>
          <h2 className="section-title flex items-center gap-2">
            <TrendingUp size={26} className="text-gold-400" /> Trending Accounts
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {listings.map((l, i) => <DbListingCard key={l.id} listing={l} delay={i * 70} compact />)}
      </div>
    </section>
  );
}

function BestDealsSection() {
  const [listings, setListings] = useState<AccountListingRow[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('account_listings')
        .select('*').eq('status', 'approved').not('original_price', 'is', null)
        .order('created_at', { ascending: false }).limit(4);
      setListings((data ?? []) as AccountListingRow[]);
    })();
  }, []);
  if (listings.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-end justify-between mb-8">
        <div>
          <span className="section-eyebrow">Save Big</span>
          <h2 className="section-title flex items-center gap-2">
            <Tag size={26} className="text-gold-400" /> Best Deals
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {listings.map((l, i) => <DbListingCard key={l.id} listing={l} delay={i * 70} compact />)}
      </div>
    </section>
  );
}

function RecentlyAddedSection() {
  const [listings, setListings] = useState<AccountListingRow[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('account_listings')
        .select('*').eq('status', 'approved')
        .order('created_at', { ascending: false }).limit(4);
      setListings((data ?? []) as AccountListingRow[]);
    })();
  }, []);
  if (listings.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-end justify-between mb-8">
        <div>
          <span className="section-eyebrow">Fresh Listings</span>
          <h2 className="section-title flex items-center gap-2">
            <Clock size={26} className="text-gold-400" /> Recently Added
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {listings.map((l, i) => <DbListingCard key={l.id} listing={l} delay={i * 70} compact />)}
      </div>
    </section>
  );
}

export function DbListingCard({ listing, delay = 0, compact = false }: { listing: AccountListingRow; delay?: number; compact?: boolean }) {
  const game = GAMES[listing.game];
  return (
    <div
      className="group glass glass-hover rounded-2xl overflow-hidden flex flex-col animate-fade-up cursor-pointer"
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => navigate(`/account/${listing.id}`)}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-850">
        <img
          src={listing.profile_image}
          alt={listing.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className={`badge bg-ink-950/70 backdrop-blur ${game.accent}`}>{game.name}</span>
          {listing.featured && <span className="badge bg-gold-400/90 text-ink-950">Featured</span>}
        </div>
        {listing.original_price && (
          <span className="absolute top-3 right-3 badge bg-error-500/90 text-white">
            -{Math.round((1 - listing.price / listing.original_price) * 100)}%
          </span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className={`font-semibold text-white ${compact ? 'text-sm' : 'text-base'} line-clamp-1`}>{listing.title}</h3>
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1"><Trophy size={12} className="text-gold-400" /> {listing.br_rank}</span>
          <span className="inline-flex items-center gap-1"><Star size={12} className="text-gold-400" /> Lv {listing.account_level}</span>
          <span className="inline-flex items-center gap-1"><Eye size={12} className="text-gray-500" /> {maskUid(listing.uid)}</span>
        </div>
        {!compact && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="badge bg-white/[0.04] text-gray-300 border border-white/10">CS: {listing.cs_rank}</span>
            <span className="badge bg-white/[0.04] text-gray-300 border border-white/10">Evo {listing.evo_gun_level}</span>
            <span className="badge bg-white/[0.04] text-gray-300 border border-white/10">{listing.diamonds.toLocaleString('en-IN')} Diamonds</span>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <BadgeCheck size={13} className="text-gold-400" />
            <span className="text-xs font-medium text-gray-300">Verified Seller</span>
          </div>
          <div className="text-right">
            {listing.original_price && (
              <span className="block text-xs text-gray-500 line-through">{formatPrice(listing.original_price)}</span>
            )}
            <span className="font-display font-bold text-gold-300">{formatPrice(listing.price)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ListingCard({ listing, delay = 0, compact = false }: { listing: AccountListing; delay?: number; compact?: boolean }) {
  const game = GAMES[listing.game];
  return (
    <div
      className="group glass glass-hover rounded-2xl overflow-hidden flex flex-col animate-fade-up cursor-pointer"
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => navigate(`/marketplace?id=${listing.id}`)}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-850">
        <img
          src={listing.image}
          alt={listing.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className={`badge bg-ink-950/70 backdrop-blur ${game.accent}`}>{game.name}</span>
          {listing.featured && <span className="badge bg-gold-400/90 text-ink-950">Featured</span>}
        </div>
        {listing.originalPrice && (
          <span className="absolute top-3 right-3 badge bg-error-500/90 text-white">
            -{Math.round((1 - listing.price / listing.originalPrice) * 100)}%
          </span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className={`font-semibold text-white ${compact ? 'text-sm' : 'text-base'} line-clamp-1`}>{listing.title}</h3>
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1"><Trophy size={12} className="text-gold-400" /> {listing.rank}</span>
          <span className="inline-flex items-center gap-1"><Star size={12} className="text-gold-400" /> Lv {listing.level}</span>
        </div>
        {!compact && listing.badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {listing.badges.slice(0, 3).map((b) => (
              <span key={b} className="badge bg-white/[0.04] text-gray-300 border border-white/10">{b}</span>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">by</span>
            <span className="text-xs font-medium text-gray-300 inline-flex items-center gap-1">
              {listing.seller}
              {listing.verified && <BadgeCheck size={13} className="text-gold-400" />}
            </span>
          </div>
          <div className="text-right">
            {listing.originalPrice && (
              <span className="block text-xs text-gray-500 line-through">₹{listing.originalPrice.toLocaleString('en-IN')}</span>
            )}
            <span className="font-display font-bold text-gold-300">₹{listing.price.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifiedSellerBanner() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="relative overflow-hidden rounded-2xl glass-gold p-8 md:p-12">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-gold-400/10 rounded-full blur-3xl" />
        <div className="relative grid md:grid-cols-2 gap-8 items-center">
          <div>
            <span className="section-eyebrow">Trust & Safety</span>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white">
              Buy only from <span className="gold-text">verified sellers</span>
            </h2>
            <p className="mt-3 text-gray-400 leading-relaxed">
              Every verified seller on Kryzo has passed KYC verification with government ID and live face verification. Look for the gold badge — it means the seller's identity is confirmed and your purchase is protected by escrow.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register" className="btn-gold">Become a Seller</Link>
              <Link to="/faq" className="btn-outline">Learn More</Link>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="relative">
              <div className="grid place-items-center w-32 h-32 rounded-full bg-gold-400/10 border border-gold-400/30 animate-pulse-gold">
                <ShieldCheck size={56} className="text-gold-400" />
              </div>
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 badge bg-gold-400 text-ink-950 px-3 py-1.5">
                <BadgeCheck size={13} /> Verified
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewsSection() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <span className="section-eyebrow">Loved by Gamers</span>
        <h2 className="section-title">Customer Reviews</h2>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => <Star key={s} size={18} className="text-gold-400 fill-gold-400" />)}
          <span className="ml-2 text-sm text-gray-400">4.9/5 from 2,400+ reviews</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {REVIEWS.map((r, i) => (
          <div key={r.id} className="glass glass-hover rounded-2xl p-5 animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
            <Quote size={22} className="text-gold-400/40" />
            <div className="mt-2 flex gap-0.5">
              {Array.from({ length: r.rating }).map((_, s) => <Star key={s} size={13} className="text-gold-400 fill-gold-400" />)}
            </div>
            <p className="mt-3 text-sm text-gray-300 leading-relaxed line-clamp-4">{r.text}</p>
            <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-3">
              <img src={r.avatar} alt={r.name} loading="lazy" className="w-9 h-9 rounded-full object-cover" />
              <div>
                <p className="text-sm font-semibold text-white">{r.name}</p>
                <p className="text-xs text-gray-500">{r.game} · {r.date}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <span className="section-eyebrow">Quick Answers</span>
        <h2 className="section-title">Frequently Asked Questions</h2>
      </div>
      <div className="space-y-3">
        {FAQS.slice(0, 6).map((f, i) => (
          <div key={i} className="glass rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <span className="text-sm font-semibold text-white">{f.q}</span>
              <ChevronDown size={18} className={`text-gold-400 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && (
              <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed animate-fade-in">{f.a}</div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link to="/faq" className="btn-outline">View All FAQs <ArrowRight size={15} /></Link>
      </div>
    </section>
  );
}
