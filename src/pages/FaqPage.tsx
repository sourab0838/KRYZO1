import { useState } from 'react';
import { Link } from '../lib/router';
import { FAQS } from '../lib/data';
import { ChevronDown, Search, MessageCircle, HelpCircle } from 'lucide-react';

export function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const categories = ['All', ...Array.from(new Set(FAQS.map((f) => f.category)))];
  const filtered = FAQS.filter((f) => {
    const matchCat = category === 'All' || f.category === category;
    const matchQ = !query || f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="text-center mb-8">
        <span className="section-eyebrow">Help Center</span>
        <h1 className="font-display text-3xl font-bold text-white">Frequently Asked Questions</h1>
        <p className="mt-2 text-gray-400">Find quick answers to common questions about Kryzo.</p>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions..." className="input-field pl-11" />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              category === c ? 'bg-gold-gradient text-ink-950' : 'glass text-gray-300 hover:text-gold-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="glass rounded-2xl py-16 text-center">
            <HelpCircle size={36} className="mx-auto text-gray-600" />
            <p className="mt-3 text-gray-400">No questions match your search.</p>
          </div>
        ) : (
          filtered.map((f, i) => (
            <div key={i} className="glass rounded-xl overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                <div className="flex items-center gap-3">
                  <span className="badge bg-gold-400/10 text-gold-400">{f.category}</span>
                  <span className="text-sm font-semibold text-white">{f.q}</span>
                </div>
                <ChevronDown size={18} className={`text-gold-400 transition-transform shrink-0 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed animate-fade-in">{f.a}</div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-10 glass-gold rounded-2xl p-6 text-center">
        <MessageCircle size={28} className="mx-auto text-gold-400" />
        <h2 className="mt-3 font-display text-lg font-bold text-white">Still have questions?</h2>
        <p className="mt-1 text-sm text-gray-400">Our support team is available 24/7 to help you.</p>
        <Link to="/support" className="btn-gold mt-4 text-sm">Contact Support</Link>
      </div>
    </div>
  );
}
