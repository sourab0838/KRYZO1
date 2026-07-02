import { Link } from '../lib/router';
import { Logo } from './Header';
import { Mail, MessageCircle, Send, ShieldCheck, Award, Headphones } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-white/[0.06] bg-ink-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          <div className="col-span-2 lg:col-span-2">
            <Logo />
            <p className="mt-4 text-sm text-gray-400 max-w-sm leading-relaxed">
              Kryzo is a premium marketplace for verified Free Fire and BGMI gaming accounts. Buy with confidence through our secure, escrow-protected platform.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <SocialIcon icon={<MessageCircle size={16} />} label="WhatsApp" />
              <SocialIcon icon={<Send size={16} />} label="Telegram" />
              <SocialIcon icon={<Mail size={16} />} label="Email" />
            </div>
          </div>

          <FooterCol title="Marketplace" links={[
            { label: 'All Accounts', to: '/marketplace' },
            { label: 'Free Fire', to: '/marketplace?game=free-fire' },
            { label: 'BGMI', to: '/marketplace?game=bgmi' },
            { label: 'Trending', to: '/marketplace?filter=trending' },
          ]} />

          <FooterCol title="Account" links={[
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'My Profile', to: '/profile' },
            { label: 'Wallet', to: '/wallet' },
            { label: 'KYC Verification', to: '/kyc' },
            { label: 'Sell Account', to: '/sell' },
            { label: 'Seller Dashboard', to: '/seller-dashboard' },
            { label: 'Buyer Dashboard', to: '/buyer-dashboard' },
          ]} />

          <FooterCol title="Support & Legal" links={[
            { label: 'Customer Support', to: '/support' },
            { label: 'FAQ', to: '/faq' },
            { label: 'Terms & Conditions', to: '/terms' },
            { label: 'Privacy Policy', to: '/privacy' },
          ]} />
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          <TrustBadge icon={<ShieldCheck size={18} />} title="Secure Escrow" desc="Protected transactions" />
          <TrustBadge icon={<Award size={18} />} title="Verified Sellers" desc="KYC-confirmed accounts" />
          <TrustBadge icon={<Headphones size={18} />} title="24/7 Support" desc="Always here to help" />
        </div>

        <div className="mt-10 pt-6 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} Kryzo. All rights reserved.</p>
          <p className="text-xs text-gray-500">Built for gamers, by gamers.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-white mb-3">{title}</h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-sm text-gray-400 hover:text-gold-300 transition-colors">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SocialIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      title={label}
      className="grid place-items-center w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 text-gray-400 hover:text-gold-300 hover:border-gold-400/30 transition-colors cursor-pointer"
    >
      {icon}
    </span>
  );
}

function TrustBadge({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 glass rounded-xl px-4 py-3">
      <span className="grid place-items-center w-10 h-10 rounded-lg bg-gold-400/10 text-gold-400">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </div>
  );
}
