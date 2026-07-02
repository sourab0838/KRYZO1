import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { formatPrice } from '../../lib/data';
import {
  Wallet, ArrowDownLeft, ArrowUpRight, Clock, TrendingUp, TrendingDown,
  Search, Eye, User, DollarSign, CreditCard, Loader2
} from 'lucide-react';

interface WalletOverview {
  user_id: string;
  balance: number;
  pending_balance: number;
  total_earnings: number;
  total_deposits: number;
  total_withdrawals: number;
  updated_at: string;
  user: { full_name: string; username: string; email: string };
}

export function AdminWalletsPage() {
  const toast = useToast();
  const [wallets, setWallets] = useState<WalletOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getWalletsOverview();
      setWallets(data ?? []);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load wallets');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-dep

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setChecking(false);
      load();
    })();
  }, [load]);

  const filtered = wallets.filter((w) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [
      w.user.full_name,
      w.user.username,
      w.user.email,
    ].some((f) => (f ?? '').toLowerCase().includes(q));
  });

  const openWalletDetails = async (userId: string) => {
    setSelectedUserId(userId);
    setLoadingTx(true);
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setTransactions((data ?? []) as any[]);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load transactions');
    } finally {
      setLoadingTx(false);
    }
  };

  const selectedWallet = wallets.find((w) => w.user_id === selectedUserId);

  // Summary stats
  const totalBalance = wallets.reduce((sum, w) => sum + (w.balance ?? 0), 0);
  const totalPending = wallets.reduce((sum, w) => sum + (w.pending_balance ?? 0), 0);
  const totalDeposits = wallets.reduce((sum, w) => sum + (w.total_deposits ?? 0), 0);
  const totalWithdrawals = wallets.reduce((sum, w) => sum + (w.total_withdrawals ?? 0), 0);

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access...</div>;

  return (
    <AdminLayout currentPath="/admin/wallets">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-2">
          <Wallet className="text-gold-400" /> Wallet Management
        </h1>
        <p className="text-sm text-gray-400 mb-6">Monitor all user wallets, track balances, deposits, and withdrawals.</p>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard icon={Wallet} label="Total Balance" value={formatPrice(totalBalance)} gold />
          <SummaryCard icon={Clock} label="Total Pending" value={formatPrice(totalPending)} />
          <SummaryCard icon={ArrowDownLeft} label="Total Deposits" value={formatPrice(totalDeposits)} />
          <SummaryCard icon={ArrowUpRight} label="Total Withdrawals" value={formatPrice(totalWithdrawals)} />
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input-field pl-10"
            placeholder="Search by name, username, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading wallets...</div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-gray-500">No wallets found.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((w) => (
              <div key={w.user_id} className="glass glass-hover rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid place-items-center w-10 h-10 rounded-full bg-gold-400/10 text-gold-300 font-bold shrink-0">
                      {(w.user.full_name || w.user.username || '?').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{w.user.full_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400 truncate">@{w.user.username || 'N/A'} · {w.user.email}</p>
                    </div>
                  </div>
                  <span className="badge bg-gold-400/15 text-gold-300">{formatPrice(w.balance)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Pending</p>
                    <p className="text-warning-400 font-medium">{formatPrice(w.pending_balance ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Earnings</p>
                    <p className="text-success-400 font-medium">{formatPrice(w.total_earnings ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Deposits</p>
                    <p className="text-gray-200">{formatPrice(w.total_deposits ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Withdrawals</p>
                    <p className="text-gray-200">{formatPrice(w.total_withdrawals ?? 0)}</p>
                  </div>
                </div>

                <p className="text-xs text-gray-600 mb-3">Last updated: {new Date(w.updated_at).toLocaleDateString('en-IN')}</p>

                <button onClick={() => openWalletDetails(w.user_id)} className="btn-ghost w-full text-xs">
                  <Eye size={14} /> View Transactions
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction modal */}
      {selectedUserId && selectedWallet && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedUserId(null)}>
          <div className="glass-gold rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-white">Wallet Transactions</h3>
                <p className="text-sm text-gray-400">{selectedWallet.user.full_name || selectedWallet.user.username}</p>
              </div>
              <button onClick={() => setSelectedUserId(null)} className="text-gray-400 hover:text-white">
                <CreditCard size={18} />
              </button>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="glass rounded-lg px-4 py-2 flex-1 text-center">
                <p className="text-xs text-gray-500">Balance</p>
                <p className="text-lg font-bold gold-text">{formatPrice(selectedWallet.balance)}</p>
              </div>
              <div className="glass rounded-lg px-4 py-2 flex-1 text-center">
                <p className="text-xs text-gray-500">Pending</p>
                <p className="text-lg font-bold text-warning-400">{formatPrice(selectedWallet.pending_balance ?? 0)}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {loadingTx ? (
                <div className="py-8 text-center text-gray-500"><Loader2 size={20} className="animate-spin mx-auto" /></div>
              ) : transactions.length === 0 ? (
                <div className="py-8 text-center text-gray-500">No transactions found.</div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="glass rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`grid place-items-center w-8 h-8 rounded-lg ${tx.direction === 'credit' ? 'bg-success-500/15 text-success-400' : 'bg-error-500/15 text-error-400'}`}>
                        {tx.direction === 'credit' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white capitalize">{tx.type?.replace(/_/g, ' ') || 'Transaction'}</p>
                        <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${tx.direction === 'credit' ? 'text-success-400' : 'text-error-400'}`}>
                        {tx.direction === 'credit' ? '+' : '-'}{formatPrice(tx.amount)}
                      </p>
                      <TxStatusBadge status={tx.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function SummaryCard({ icon: Icon, label, value, gold }: { icon: typeof Wallet; label: string; value: string; gold?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-5 ${gold ? 'border-gold-400/30' : ''}`}>
      <span className={`grid place-items-center w-10 h-10 rounded-lg ${gold ? 'bg-gold-gradient text-ink-950' : 'bg-gold-400/10 text-gold-400'}`}>
        <Icon size={18} />
      </span>
      <p className={`mt-3 font-display text-xl font-bold ${gold ? 'gold-text' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function TxStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: 'text-success-400',
    pending: 'text-warning-400',
    failed: 'text-error-400',
    cancelled: 'text-gray-400',
  };
  return <span className={`text-[10px] uppercase ${map[status] ?? 'text-gray-400'}`}>{status}</span>;
}