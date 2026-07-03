import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from '../lib/router';
import { BR_RANKS, CS_RANKS, formatPrice, type GameKey } from '../lib/data';
import { supabase, type AccountListingWithSeller } from '../lib/supabase';
import { DbListingCard } from './HomePage';
import { Search, SlidersHorizontal, Flame, Trophy, ShieldCheck, Inbox, X, ChevronDown, Sparkles, Zap } from 'lucide-react';

type SortKey = 'newest' | 'price-low' | 'price-high' | 'latest';

export function MarketplacePage() {
  const { route } = useRouter();
  const initialGame = (route.query.get('game') as GameKey | null) ?? 'all';
  const initialQ = route.query.get('q') ?? '';

  const [game, setGame] = useState<'all' | GameKey>(initialGame);
  const [query, setQuery] = useState(initialQ);
  const [sort, setSort] = useState<SortKey>('newest');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(15000);
  const [minLevel, setMinLevel] = useState(1);
  const [brRank, setBrRank] = useState('all');
  const [csRank, setCsRank] = useState('all');
  const [minEvo, setMinEvo] = useState(0);
  const [minPrime, setMinPrime] = useState(0);
  const [hasPrime, setHasPrime] = useState(false);
  const [hasEvoGun, setHasEvoGun] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [listings, setListings] = useState<AccountListingWithSeller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from('account_listings')
        .select('*, seller:profiles!account_listings_seller_id_profiles_fkey(id, verified_seller, username, full_name, avatar_url)')
        .eq('status', 'approved');
      if (game !== 'all') q = q.eq('game', game);
      if (sort === 'price-low') q = q.order('price', { ascending: true });
      else if (sort === 'price-high') q = q.order('price', { ascending: false });
      else q = q.order('created_at', { ascending: false });
      const { data } = await q.limit(60);
      setListings((data ?? []) as AccountListingWithSeller[]);
      setLoading(false);
    })();
  }, [game, sort]);

  const filtered = useMemo(() => {
    let list = [...listings];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((l) =>
        l.title.toLowerCase().includes(q) ||
        l.br_rank.toLowerCase().includes(q) ||
        l.cs_rank.toLowerCase().includes(q) ||
        l.uid.includes(q)
      );
    }
    if (verifiedOnly) list = list.filter((l) => l.seller?.verified_seller === true);
    list = list.filter((l) => l.price <= maxPrice);
    list = list.filter((l) => l.account_level >= minLevel);
    if (brRank !== 'all') list = list.filter((l) => l.br_rank === brRank);
    if (csRank !== 'all') list = list.filter((l) => l.cs_rank === csRank);
    list = list.filter((l) => l.evo_gun_level >= minEvo);
    list = list.filter((l) => l.prime_level >= minPrime);
    if (hasPrime) list = list.filter((l) => l.prime_level > 0);
    if (hasEvoGun) list = list.filter((l) => l.evo_gun_level > 0);
    return list;
  }, [listings, query, verifiedOnly, maxPrice, minLevel, brRank, csRank, minEvo, minPrime, hasPrime, hasEvoGun]);

  const resetFilters = () => {
    setQuery(''); setVerifiedOnly(false); setMaxPrice(15000); setMinLevel(1);
    setBrRank('all'); setCsRank('all'); setMinEvo(0); setMinPrime(0);
    setHasPrime(false); setHasEvoGun(false);
  };

  const activeFilterCount = [
    verifiedOnly, maxPrice < 15000, minLevel > 1, brRank !== 'all',
    csRank !== 'all', minEvo > 0, minPrime > 0, query !== '', hasPrime, hasEvoGun
  ].filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="mb-8">
        <span className="section-eyebrow">Marketplace</span>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-white">Browse Gaming Accounts</h1>
        <p className="mt-2 text-gray-400">Verified Free Fire and BGMI accounts, escrow-protected.</p>
      </div>

      {/* Game tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <GameTab active={game === 'all'} onClick={() => setGame('all')} icon={<SlidersHorizontal size={15} />} label="All Games" />
        <GameTab active={game === 'free-fire'} onClick={() => setGame('free-fire')} icon={<Flame size={15} />} label="Free Fire" />
        <GameTab active={game === 'bgmi'} onClick={() => setGame('bgmi')} icon={<Trophy size={15} />} label="BGMI" />
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold glass text-gray-300 hover:text-gold-300 hover:border-gold-400/30 transition-all lg:hidden"
        >
          <SlidersHorizontal size={15} /> Filters
          {activeFilterCount > 0 && <span className="badge bg-gold-400 text-ink-950 text-[10px] px-1.5 py-0.5">{activeFilterCount}</span>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Filters */}
        <aside className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
          <div className="glass rounded-2xl p-5 space-y-4 lg:sticky lg:top-20">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2"><SlidersHorizontal size={16} className="text-gold-400" /> Filters</h3>
              {activeFilterCount > 0 && (
                <button onClick={resetFilters} className="text-xs text-gold-400 hover:text-gold-300 inline-flex items-center gap-1">
                  <X size={12} /> Reset
                </button>
              )}
            </div>

            <div>
              <label className="label-field">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Account, rank, UID..." className="input-field pl-9 text-sm" />
              </div>
            </div>

            {/* Sort section */}
            <FilterSection title="Sort" icon={<ChevronDown size={14} className="text-gold-400" />} defaultOpen>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input-field text-sm">
                <option value="newest">Newest</option>
                <option value="latest">Latest Listings</option>
                <option value="price-low">Lowest Price</option>
                <option value="price-high">Highest Price</option>
              </select>
            </FilterSection>

            {/* Price Range section */}
            <FilterSection title="Price Range" icon={<span className="text-gold-400 font-semibold text-xs">₹</span>} defaultOpen>
              <label className="label-field">Max Price: {formatPrice(maxPrice)}</label>
              <input type="range" min={500} max={15000} step={500} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-gold-400" />
            </FilterSection>

            {/* Game section */}
            <FilterSection title="Game" icon={<Flame size={14} className="text-gold-400" />}>
              <div className="space-y-3">
                <FilterSelect label="Game" value={game} onChange={(g) => setGame(g as 'all' | GameKey)} options={['all', 'bgmi', 'free-fire']} />
                <div>
                  <label className="label-field">Min Account Level: {minLevel}</label>
                  <input type="range" min={1} max={100} step={1} value={minLevel} onChange={(e) => setMinLevel(Number(e.target.value))} className="w-full accent-gold-400" />
                </div>
              </div>
            </FilterSection>

            {/* Rank section */}
            <FilterSection title="Rank" icon={<Trophy size={14} className="text-gold-400" />}>
              <div className="space-y-3">
                <FilterSelect label="BR Rank" value={brRank} onChange={setBrRank} options={['all', ...BR_RANKS]} />
                <FilterSelect label="CS Rank" value={csRank} onChange={setCsRank} options={['all', ...CS_RANKS]} />
              </div>
            </FilterSection>

            {/* Features section */}
            <FilterSection title="Features" icon={<Sparkles size={14} className="text-gold-400" />}>
              <div className="space-y-3">
                <div>
                  <label className="label-field">Min Evo Gun Level: {minEvo}</label>
                  <input type="range" min={0} max={10} step={1} value={minEvo} onChange={(e) => setMinEvo(Number(e.target.value))} className="w-full accent-gold-400" />
                </div>
                <div>
                  <label className="label-field">Min Prime Level: {minPrime}</label>
                  <input type="range" min={0} max={10} step={1} value={minPrime} onChange={(e) => setMinPrime(Number(e.target.value))} className="w-full accent-gold-400" />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="checkbox" checked={hasPrime} onChange={(e) => setHasPrime(e.target.checked)} className="w-4 h-4 rounded accent-gold-400" />
                  <span className="text-sm text-gray-300 inline-flex items-center gap-1.5 group-hover:text-gold-200 transition-colors">
                    <Sparkles size={14} className="text-gold-400" /> Has Prime
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="checkbox" checked={hasEvoGun} onChange={(e) => setHasEvoGun(e.target.checked)} className="w-4 h-4 rounded accent-gold-400" />
                  <span className="text-sm text-gray-300 inline-flex items-center gap-1.5 group-hover:text-gold-200 transition-colors">
                    <Zap size={14} className="text-gold-400" /> Evo Gun
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="w-4 h-4 rounded accent-gold-400" />
                  <span className="text-sm text-gray-300 inline-flex items-center gap-1.5 group-hover:text-gold-200 transition-colors">
                    <ShieldCheck size={14} className="text-gold-400" /> Verified Seller
                  </span>
                </label>
              </div>
            </FilterSection>
          </div>
        </aside>

        {/* Listings */}
        <div>
          <p className="text-sm text-gray-400 mb-4">{loading ? 'Loading...' : `${filtered.length} account${filtered.length !== 1 ? 's' : ''} found`}</p>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass rounded-2xl overflow-hidden animate-pulse">
                  <div className="aspect-[16/10] bg-ink-800" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-ink-700 rounded w-3/4" />
                    <div className="h-3 bg-ink-700 rounded w-1/2" />
                    <div className="h-3 bg-ink-700 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-2xl py-20 text-center">
              <Inbox size={40} className="mx-auto text-gray-600" />
              <p className="mt-4 text-gray-400">No accounts match your filters.</p>
              {activeFilterCount > 0 && (
                <button onClick={resetFilters} className="btn-outline mt-4 text-sm">Clear Filters</button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((l, i) => <DbListingCard key={l.id} listing={l} delay={i * 50} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field text-sm capitalize">
        {options.map((o) => <option key={o} value={o} className="capitalize">{o === 'all' ? 'All Ranks' : o}</option>)}
      </select>
    </div>
  );
}

function FilterSection({ title, icon, defaultOpen = false, children }: { title: string; icon?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-ink-950/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
          {icon}
          {title}
        </span>
        <ChevronDown size={14} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3.5 pb-3.5 pt-1 space-y-3">{children}</div>}
    </div>
  );
}

function GameTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
        active ? 'bg-gold-gradient text-ink-950 shadow-gold' : 'glass text-gray-300 hover:text-gold-300 hover:border-gold-400/30'
      }`}
    >
      {icon} {label}
    </button>
  );
}
