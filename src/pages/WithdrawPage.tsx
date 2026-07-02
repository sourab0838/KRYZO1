import { useState, useEffect } from 'react';
import { navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { supabase, type Wallet, type WithdrawalRow } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { ArrowLeft, ArrowUpRight, ShieldCheck, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export function WithdrawPage() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [upiId, setUpiId] = useState('');
  const [amount, setAmount] = useState(0);
  const [amountInput, setAmountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!user) return;
    const [w, wd] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    setWallet(w.data as Wallet | null);
    setWithdrawals((wd.data ?? []) as WithdrawalRow[]);
  };

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    loadData();
  }, [loading, user]);

  if (loading || !user) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;

  const balance = wallet?.balance ?? 0;
  const pendingBalance = wallet?.pending_balance ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upiId.trim()) { toast('error', 'Please enter your UPI ID.'); return; }
    if (!/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z0-9]{2,}$/.test(upiId.trim())) { toast('error', 'Invalid UPI ID format. Example: name@bank'); return; }
    if (amount < 1) { toast('error', 'Please enter a valid amount.'); return; }
    if (amount > balance) { toast('error', `Insufficient balance. Available: ₹${balance.toLocaleString('en-IN')}`); return; }

    setSubmitting(true);
    try {
      const { error: withdrawError } = await supabase.rpc('create_withdrawal', {
        p_user_id: user.id,
        p_amount: amount,
        p_upi_id: upiId.trim(),
      });
      if (withdrawError) throw new Error(withdrawError.message);

      toast('success', 'Withdrawal request submitted!');
      setUpiId(''); setAmount(0); setAmountInput('');
      loadData();
    } catch (err: any) {
      toast('error', err.message || 'Failed to submit withdrawal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <button onClick={() => navigate('/wallet')} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gold-300 mb-6">
        <ArrowLeft size={16} /> Back to Wallet
      </button>

      <div className="mb-8">
        <span className="section-eyebrow">Wallet</span>
        <h1 className="font-display text-3xl font-bold text-white">Withdraw Funds</h1>
        <p className="mt-2 text-gray-400">Withdraw your available balance to your UPI account.</p>
      </div>

      {/* Balance info */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="glass rounded-2xl p-5">
          <span className="text-xs text-gray-400">Available Balance</span>
          <p className="mt-1 font-display text-2xl font-bold text-gold-300">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <span className="text-xs text-gray-400">Pending Balance</span>
          <p className="mt-1 font-display text-2xl font-bold text-warning-400">₹{pendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-600 mt-1">Cannot be withdrawn</p>
        </div>
      </div>

      {/* Withdrawal form */}
      <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 mb-6 space-y-4">
        <div>
          <label className="label-field">UPI ID</label>
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="yourname@bank"
            className="input-field"
          />
        </div>
        <div>
          <label className="label-field">Amount (₹)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gold-400">₹</span>
            <input
              type="number"
              value={amountInput}
              onChange={(e) => { setAmountInput(e.target.value); setAmount(e.target.value ? Number(e.target.value) : 0); }}
              placeholder="0"
              min="1"
              max={balance}
              className="input-field text-xl font-bold pl-10 py-3.5"
            />
          </div>
          {amount > balance && <p className="mt-1 text-xs text-error-400">Amount exceeds available balance.</p>}
        </div>
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gold-400/5 border border-gold-400/15">
          <ShieldCheck size={15} className="text-gold-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400">Only available balance can be withdrawn. Pending balance from escrow will become available after the buyer confirms delivery. Withdrawals are processed by admin within 24-48 hours.</p>
        </div>
        <button type="submit" disabled={submitting || amount < 1 || amount > balance || !upiId.trim()} className="btn-gold w-full">
          {submitting ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <><ArrowUpRight size={16} /> Request Withdrawal</>}
        </button>
      </form>

      {/* Withdrawal history */}
      {withdrawals.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-white mb-4">Withdrawal History</h2>
          <div className="space-y-2">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className={`grid place-items-center w-9 h-9 rounded-lg ${
                  w.status === 'completed' ? 'bg-success-500/10 text-success-400' :
                  w.status === 'pending' || w.status === 'processing' ? 'bg-warning-500/10 text-warning-400' :
                  'bg-error-500/10 text-error-400'
                }`}>
                  {w.status === 'completed' ? <CheckCircle2 size={16} /> : w.status === 'rejected' ? <XCircle size={16} /> : <Clock size={16} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200">{w.upi_id}</p>
                  <p className="text-xs text-gray-500">{new Date(w.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  {w.reason && <p className="text-xs text-error-400 mt-0.5">{w.reason}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-error-400">−₹{w.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  <span className={`badge text-[10px] ${
                    w.status === 'completed' ? 'bg-success-500/15 text-success-400' :
                    w.status === 'pending' ? 'bg-warning-500/15 text-warning-400' :
                    w.status === 'processing' ? 'bg-blue-500/15 text-blue-400' :
                    'bg-error-500/15 text-error-400'
                  }`}>{w.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
