import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { supabase, type Wallet, type WalletTransactionRow } from '../lib/supabase';
import { Wallet as WalletIcon, Plus, ArrowDownLeft, ArrowUpRight, ShieldCheck, TrendingUp, Clock, ArrowUpCircle, ArrowDownCircle, Receipt } from 'lucide-react';

export function WalletPage() {
  const { user, loading } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [w, t] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);
    setWallet(w.data as Wallet | null);
    setTransactions((t.data ?? []) as WalletTransactionRow[]);
    setLoadingData(false);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    loadData();
  }, [loading, user, loadData]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('wallet-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user.id}` }, loadData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadData]);

  if (loading || !user) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;

  const balance = wallet?.balance ?? 0;
  const pendingBalance = wallet?.pending_balance ?? 0;
  const totalEarnings = wallet?.total_earnings ?? 0;
  const totalDeposits = wallet?.total_deposits ?? 0;
  const totalWithdrawals = wallet?.total_withdrawals ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="mb-8">
        <span className="section-eyebrow">Wallet</span>
        <h1 className="font-display text-3xl font-bold text-white">My Wallet</h1>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="relative overflow-hidden rounded-2xl glass-gold p-6">
          <div className="absolute -right-8 -top-8 w-48 h-48 bg-gold-400/10 rounded-full blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 text-sm text-gray-400">
              <WalletIcon size={16} className="text-gold-400" /> Available Balance
            </span>
            <p className="mt-3 font-display text-4xl font-extrabold gold-text">
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => navigate('/wallet/add-money')} className="btn-gold text-sm"><Plus size={15} /> Add Money</button>
              <button onClick={() => navigate('/wallet/withdraw')} className="btn-outline text-sm">Withdraw</button>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <span className="inline-flex items-center gap-2 text-sm text-gray-400">
            <Clock size={16} className="text-warning-400" /> Pending Balance
          </span>
          <p className="mt-3 font-display text-4xl font-extrabold text-warning-400">
            ₹{pendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-3 text-xs text-gray-500">Funds from escrow will appear here until the buyer confirms delivery.</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<TrendingUp size={18} />} value={`₹${totalEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} label="Total Earnings" />
        <StatCard icon={<ArrowDownCircle size={18} />} value={`₹${totalDeposits.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} label="Total Deposits" />
        <StatCard icon={<ArrowUpCircle size={18} />} value={`₹${totalWithdrawals.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} label="Total Withdrawals" />
        <StatCard icon={<Receipt size={18} />} value={transactions.length} label="Transactions" />
      </div>

      {/* Transaction history */}
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-lg font-bold text-white mb-4">Transaction History</h2>
        {loadingData ? (
          <div className="py-10 text-center text-gray-500">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="py-10 text-center">
            <ShieldCheck size={32} className="mx-auto text-gray-600" />
            <p className="mt-3 text-sm text-gray-500">No transactions yet. Add money to your wallet to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className={`grid place-items-center w-9 h-9 rounded-lg ${t.direction === 'credit' ? 'bg-success-500/10 text-success-400' : 'bg-error-500/10 text-error-400'}`}>
                  {t.direction === 'credit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 capitalize">{t.type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {t.description || '—'}
                    {t.razorpay_payment_id && ` · ${t.razorpay_payment_id.slice(0, 12)}...`}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {new Date(t.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${t.direction === 'credit' ? 'text-success-400' : 'text-error-400'}`}>
                    {t.direction === 'credit' ? '+' : '−'}₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <span className={`badge text-[10px] ${
                    t.status === 'success' ? 'bg-success-500/15 text-success-400' :
                    t.status === 'pending' ? 'bg-warning-500/15 text-warning-400' :
                    t.status === 'failed' ? 'bg-error-500/15 text-error-400' :
                    'bg-white/[0.06] text-gray-400'
                  }`}>{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="glass glass-hover rounded-2xl p-5">
      <span className="grid place-items-center w-10 h-10 rounded-lg bg-gold-400/10 text-gold-400">{icon}</span>
      <p className="mt-3 font-display text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
