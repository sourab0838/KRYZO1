import { FileText, Shield } from 'lucide-react';

export function LegalPage({ type }: { type: 'terms' | 'privacy' }) {
  const isTerms = type === 'terms';
  const data = isTerms ? TERMS : PRIVACY;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="text-center mb-10">
        <span className="grid place-items-center w-14 h-14 rounded-2xl bg-gold-400/10 text-gold-400 mx-auto">
          {isTerms ? <FileText size={26} /> : <Shield size={26} />}
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-white">{data.title}</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="glass rounded-2xl p-6 md:p-8 space-y-6">
        <p className="text-sm text-gray-400 leading-relaxed">{data.intro}</p>
        {data.sections.map((s, i) => (
          <section key={i}>
            <h2 className="font-display text-lg font-bold text-white mb-2">{i + 1}. {s.title}</h2>
            <p className="text-sm text-gray-400 leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-gray-600">
        For questions about this document, contact us at <span className="text-gold-400">support@kryzo.com</span>
      </p>
    </div>
  );
}

interface LegalData {
  title: string;
  intro: string;
  sections: { title: string; body: string }[];
}

const TERMS: LegalData = {
  title: 'Terms & Conditions',
  intro: 'Welcome to Kryzo. By accessing or using our platform, you agree to be bound by these Terms & Conditions. Please read them carefully before using our services.',
  sections: [
    { title: 'Acceptance of Terms', body: 'By creating an account, browsing listings, or completing a transaction on Kryzo, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.' },
    { title: 'Eligibility', body: 'You must be at least 18 years old and legally capable of entering into binding contracts to use Kryzo. By registering, you confirm that you meet these requirements.' },
    { title: 'Account Registration', body: 'You must provide accurate and complete information during registration, including a valid email address and phone number. Email OTP verification is required to complete registration. You are responsible for maintaining the security of your account and password.' },
    { title: 'Supported Games', body: 'Kryzo currently supports only Free Fire and BGMI accounts. Listings for any other game are not permitted and will be removed.' },
    { title: 'Marketplace Transactions', body: 'All purchases are protected by our escrow system. Payment is released to the seller only after the buyer confirms receipt and verification of the account. Buyers must report any issues within 24 hours of receiving account credentials.' },
    { title: 'KYC Verification', body: 'Sellers must complete KYC verification to receive a Verified Seller badge. You agree to provide authentic government-issued identification. Providing false documents may result in permanent account suspension.' },
    { title: 'Prohibited Activities', body: 'You may not list stolen accounts, use fraudulent payment methods, attempt to circumvent escrow, harass other users, or engage in any illegal activity. Violations result in immediate account termination and potential legal action.' },
    { title: 'Fees', body: 'Kryzo charges a platform fee on completed transactions. The current fee structure is displayed at checkout. Wallet top-ups and withdrawals may be subject to processing fees.' },
    { title: 'Refunds', body: 'Refunds are issued from escrow when an account does not match its listing description. Refund requests must be submitted via a support ticket within 24 hours of purchase. Approved refunds are credited to your Kryzo wallet.' },
    { title: 'Limitation of Liability', body: 'Kryzo acts as an intermediary platform. We are not liable for the conduct of buyers or sellers, the quality of accounts sold, or any indirect, incidental, or consequential damages arising from platform use.' },
    { title: 'Account Suspension', body: 'We reserve the right to suspend or terminate accounts that violate these Terms, engage in fraudulent activity, or pose a risk to the platform or its users.' },
    { title: 'Changes to Terms', body: 'We may update these Terms at any time. Continued use of Kryzo after changes constitutes acceptance of the revised Terms. Material changes will be notified via email.' },
    { title: 'Governing Law', body: 'These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Bengaluru, Karnataka.' },
  ],
};

const PRIVACY: LegalData = {
  title: 'Privacy Policy',
  intro: 'Your privacy is important to us. This Privacy Policy explains how Kryzo collects, uses, stores, and protects your personal information when you use our platform.',
  sections: [
    { title: 'Information We Collect', body: 'We collect your full name, username, email address, phone number (with country code), and KYC documents. We also collect transaction data, wallet activity, and device/browser information for security and analytics.' },
    { title: 'How We Use Your Information', body: 'We use your data to create and manage your account, verify your identity (KYC), process transactions, send notifications, provide customer support, prevent fraud, and comply with legal obligations.' },
    { title: 'Email OTP Verification', body: 'During registration, we send a one-time password (OTP) to your email to verify ownership. This OTP is valid for a limited time and is not stored after verification.' },
    { title: 'KYC Data Handling', body: 'Your KYC documents are encrypted at rest and access is restricted to authorized verification personnel only. We do not share KYC documents with buyers, sellers, or any third party. Documents are retained as required by law and permanently deleted after the retention period.' },
    { title: 'Data Storage & Security', body: 'We use bank-grade encryption (TLS in transit, AES-256 at rest) to protect your data. Access is role-based and audited. Despite these measures, no system is 100% secure, and we cannot guarantee absolute security.' },
    { title: 'Cookies & Tracking', body: 'We use cookies and similar technologies to maintain your session, remember preferences, and analyze platform usage. You can disable cookies in your browser, but some features may not function correctly.' },
    { title: 'Data Sharing', body: 'We do not sell your personal data. We share data only with payment processors (for transactions), identity verification services (for KYC), and legal authorities when required by law. All third parties are bound by confidentiality agreements.' },
    { title: 'Your Rights', body: 'You have the right to access, correct, or delete your personal data. You can update your profile from your dashboard or request data deletion by contacting support. KYC data deletion is subject to legal retention requirements.' },
    { title: 'Notifications', body: 'We send in-app and email notifications for account activity including registration, login, OTP, password resets, KYC updates, wallet activity, orders, and support responses. You can manage notification preferences from your dashboard.' },
    { title: 'Data Retention', body: 'We retain your account data for as long as your account is active. Inactive accounts are retained for 2 years before deletion. Transaction records are retained for 7 years as required by financial regulations.' },
    { title: 'Children Privacy', body: 'Kryzo is not intended for users under 18. We do not knowingly collect data from minors. If we learn we have collected data from a minor, we will delete it immediately.' },
    { title: 'Policy Changes', body: 'We may update this Privacy Policy periodically. Material changes will be communicated via email or in-app notification. Continued use after changes constitutes acceptance.' },
    { title: 'Contact', body: 'For privacy questions or data requests, contact us at support@kryzo.com. We respond to all legitimate requests within 30 days.' },
  ],
};
