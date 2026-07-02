export type GameKey = 'free-fire' | 'bgmi';

export interface GameMeta {
  key: GameKey;
  name: string;
  tagline: string;
  gradient: string;
  accent: string;
}

export const GAMES: Record<GameKey, GameMeta> = {
  'free-fire': {
    key: 'free-fire',
    name: 'Free Fire',
    tagline: 'Survival shooter accounts',
    gradient: 'from-orange-500/20 via-red-500/10 to-transparent',
    accent: 'text-orange-400',
  },
  bgmi: {
    key: 'bgmi',
    name: 'BGMI',
    tagline: 'Battlegrounds Mobile India',
    gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    accent: 'text-amber-400',
  },
};

export const BR_RANKS = ['Unranked', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Heroic', 'Grandmaster', 'Conqueror'];
export const CS_RANKS = ['Unranked', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Heroic', 'Master', 'Grandmaster'];

export interface AccountListing {
  id: string;
  game: GameKey;
  title: string;
  level: number;
  rank: string;
  price: number;
  originalPrice?: number;
  seller: string;
  verified: boolean;
  trending: boolean;
  featured: boolean;
  image: string;
  badges: string[];
}

export const LISTINGS: AccountListing[] = [
  { id: 'ff-001', game: 'free-fire', title: 'Grandmaster Account — 80+ Skins', level: 75, rank: 'Grandmaster', price: 4999, originalPrice: 6500, seller: 'ProGamerX', verified: true, trending: true, featured: true, image: 'https://images.pexels.com/photos/7915226/pexels-photo-7915226.jpeg?auto=compress&cs=tinysrgb&w=800', badges: ['Rare Bundle', 'Elite Pass'] },
  { id: 'ff-002', game: 'free-fire', title: 'Heroic Rank — Full Evo Collection', level: 68, rank: 'Heroic', price: 3299, seller: 'FireQueen', verified: true, trending: true, featured: true, image: 'https://images.pexels.com/photos/167078/pexels-photo-167078.jpeg?auto=compress&cs=tinysrgb&w=800', badges: ['Evo Gun', 'Pet Max'] },
  { id: 'bgmi-001', game: 'bgmi', title: 'Conqueror Account — M416 Glacier', level: 82, rank: 'Conqueror', price: 7999, originalPrice: 9999, seller: 'BattlegroundKing', verified: true, trending: true, featured: true, image: 'https://images.pexels.com/photos/9037227/pexels-photo-9037227.jpeg?auto=compress&cs=tinysrgb&w=800', badges: ['Mythic Outfit', '100+ UC'] },
  { id: 'bgmi-002', game: 'bgmi', title: 'Ace Dominator — Premium Inventory', level: 71, rank: 'Ace Dominator', price: 5499, seller: 'SniperElite', verified: true, trending: true, featured: false, image: 'https://images.pexels.com/photos/9037227/pexels-photo-9037227.jpeg?auto=compress&cs=tinysrgb&w=800', badges: ['AWM Sniper', 'Level 100'] },
  { id: 'ff-003', game: 'free-fire', title: 'Diamond Rank — Bundle Collector', level: 54, rank: 'Diamond', price: 1899, seller: 'DiamondHunter', verified: false, trending: false, featured: false, image: 'https://images.pexels.com/photos/7915226/pexels-photo-7915226.jpeg?auto=compress&cs=tinysrgb&w=800', badges: ['Starter Pack'] },
  { id: 'bgmi-003', game: 'bgmi', title: 'Crown Account — Vehicle Skins', level: 60, rank: 'Crown', price: 2799, seller: 'RoadRider', verified: true, trending: false, featured: false, image: 'https://images.pexels.com/photos/9037227/pexels-photo-9037227.jpeg?auto=compress&cs=tinysrgb&w=800', badges: ['Lambo Skin', 'Pharaoh'] },
];

export interface Review {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  text: string;
  game: string;
  date: string;
}

export const REVIEWS: Review[] = [
  { id: 'r1', name: 'Arjun Sharma', avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200', rating: 5, text: 'Bought my Free Fire Grandmaster account here. Smooth transaction, instant delivery, and the escrow made me feel safe. Best marketplace for gaming accounts!', game: 'Free Fire', date: '2 weeks ago' },
  { id: 'r2', name: 'Priya Nair', avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200', rating: 5, text: 'Got my BGMI Conqueror account at a great price. The verified seller badge gave me confidence. Support team was super responsive on WhatsApp.', game: 'BGMI', date: '1 month ago' },
  { id: 'r3', name: 'Rahul Verma', avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200', rating: 4, text: 'Clean UI, fast checkout, and the wallet system is handy. Would love to see more Free Fire accounts with rare bundles listed.', game: 'Free Fire', date: '3 weeks ago' },
  { id: 'r4', name: 'Sneha Reddy', avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200', rating: 5, text: 'The KYC verification process was quick and professional. Felt secure buying from verified sellers. Highly recommend Kryzo!', game: 'BGMI', date: '5 days ago' },
];

export interface FaqItem {
  q: string;
  a: string;
  category: string;
}

export const FAQS: FaqItem[] = [
  { category: 'Buying', q: 'How do I buy an account on Kryzo?', a: 'Browse the marketplace, select an account, and complete the secure checkout. Your payment is held in escrow until you confirm receipt of the account credentials.' },
  { category: 'Buying', q: 'Is my payment protected?', a: 'Yes. All transactions use our escrow system. Funds are released to the seller only after you verify the account works as described.' },
  { category: 'Selling', q: 'How do I become a verified seller?', a: 'Complete your KYC verification from your dashboard. Once approved, you will receive a Verified Seller badge visible to all buyers.' },
  { category: 'Account', q: 'What games does Kryzo support?', a: 'Kryzo currently supports Free Fire and BGMI accounts only. We focus on delivering the best experience for these two titles.' },
  { category: 'Security', q: 'Is my personal data safe?', a: 'We use bank-grade encryption and never share your data with third parties. Your KYC documents are stored securely and used only for verification.' },
  { category: 'Support', q: 'How can I contact support?', a: 'You can reach us via the ticket system, live chat, WhatsApp, Telegram, or email. Our support team is available 24/7.' },
  { category: 'Wallet', q: 'What is the Kryzo wallet?', a: 'The wallet lets you store balance for faster checkout and receive refunds. You can top up and use it across all purchases on the platform.' },
  { category: 'Refunds', q: 'What if the account I bought has issues?', a: 'Open a support ticket within 24 hours. Our team will investigate and issue a full refund from escrow if the account does not match the listing.' },
];

export function maskUid(uid: string): string {
  if (uid.length <= 4) return uid;
  return uid.slice(0, 4) + '****' + uid.slice(-2);
}

export function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}
