import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { adminApi, checkAdminRole } from '../../lib/admin';
import { useToast } from '../../components/Toast';
import { formatPrice } from '../../lib/data';
import {
  Activity, Search, Filter, ArrowDownLeft, ArrowUpRight, Clock,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, CreditCard, Wallet
} from 'lucide-react';

interface PaymentLogRow {
  id: string;
  gateway_name: string;
  gateway_transaction_id: string | null;
  order_id: string | null;
  user_id: string | null;
  amount: number;
  currency: string;
  event_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
}

export function AdminPaymentLogsPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<PaymentLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [filters, setFilters] = useState({
    gateway_name: '',
    event_type: '',
    status: '',
  });
  const [summary, setSummary] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logsData, summaryData] = await Promise.all([
        adminApi.getPaymentLogs({
          gateway_name: filters.gateway_name || undefined,
          event_type: filters.event_type || undefined,
          status: filters.status || undefined,
          limit: 100,
        }),
        adminApi.getPaymentLogsSummary(),
      ]);
      setLogs((logsData ?? []) as PaymentLogRow[]);
      setSummary(summaryData);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load payment logs');
    } finally {
      setLoading(false);
    }
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-dep

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setChecking(false);
      load();
    })();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'payment_initiated':
      case 'payment_success':
        return <ArrowDownLeft size={14} className="text-success-400" />;
      case 'payment_failed':
        return <XCircle size={14} className="text-error-400" />;
      case 'refund_initiated':
      case 'refund_success':
        return <ArrowUpRight size={14} className="text-warning-400" />;
      case 'refund_failed':
        return <XCircle size={14} className="text-error-400" />;
      case 'webhook_received':
        return <Activity size={14} className="text-info-400" />;
      default:
        return <CreditCard size={14} className="text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-warning-500/15 text-warning-400',
      success: 'bg-success-500/15 text-success-400',
      failed: 'bg-error-500/15 text-error-400',
      cancelled: 'bg-gray-500/15 text-gray-400',
    };
    return styles[status] ?? 'bg-gray-500/15 text-gray-400';
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access...</div>;

  return (
    <AdminLayout currentPath="/admin/payment-logs">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-2">
          <Activity className="text-gold-400" /> Payment Logs
        </h1>
        <p className="text-sm text-gray-400 mb-6">Monitor all payment gateway transactions and events.</p>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-gray-500">Total Transactions</p>
              <p className="text-xl font-bold text-white mt-1">{summary.total_transactions || 0}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-gray-500">Successful</p>
              <p className="text-xl font-bold text-success-400 mt-1">{summary.successful_payments || 0}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-gray-500">Failed</p>
              <p className="text-xl font-bold text-error-400 mt-1">{summary.failed_payments || 0}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-gray-500">Refunds</p>
              <p className="text-xl font-bold text-warning-400 mt-1">{summary.total_refunds || 0}</p>
            </div>
            <div className="glass rounded-xl p-4 border border-gold-400/20">
              <p className="text-xs text-gray-500">Total Processed</p>
              <p className="text-xl font-bold gold-text mt-1">{formatPrice(summary.total_amount_processed || 0)}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="glass rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="label-field text-xs mb-1">Gateway</label>
              <select
                value={filters.gateway_name}
                onChange={(e) => setFilters((f) => ({ ...f, gateway_name: e.target.value }))}
                className="input-field text-sm"
              >
                <option value="">All Gateways</option>
                <option value="razorpay">Razorpay</option>
                <option value="cashfree">Cashfree</option>
                <option value="phonepe">PhonePe</option>
                <option value="payu">PayU</option>
                <option value="stripe">Stripe</option>
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="label-field text-xs mb-1">Event Type</label>
              <select
                value={filters.event_type}
                onChange={(e) => setFilters((f) => ({ ...f, event_type: e.target.value }))}
                className="input-field text-sm"
              >
                <option value="">All Events</option>
                <option value="payment_initiated">Payment Initiated</option>
                <option value="payment_success">Payment Success</option>
                <option value="payment_failed">Payment Failed</option>
                <option value="refund_initiated">Refund Initiated</option>
                <option value="refund_success">Refund Success</option>
                <option value="refund_failed">Refund Failed</option>
                <option value="webhook_received">Webhook Received</option>
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="label-field text-xs mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="input-field text-sm"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button onClick={refresh} disabled={refreshing} className="btn-ghost px-3 py-2">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-gray-500">No payment logs found.</div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Event</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Gateway</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">User</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`grid place-items-center w-8 h-8 rounded-lg ${log.event_type.includes('refund') ? 'bg-warning-500/10' : log.event_type.includes('success') ? 'bg-success-500/10' : 'bg-white/[0.04]'}`}>
                            {getEventIcon(log.event_type)}
                          </span>
                          <div>
                            <p className="text-sm text-white capitalize">{log.event_type?.replace(/_/g, ' ')}</p>
                            {log.gateway_transaction_id && (
                              <p className="text-xs text-gray-500 font-mono truncate max-w-[150px]">{log.gateway_transaction_id}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge bg-white/[0.06] text-gray-300 capitalize">{log.gateway_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`text-sm font-medium ${log.event_type.includes('refund') ? 'text-warning-400' : log.status === 'success' ? 'text-success-400' : 'text-white'}`}>
                          {log.event_type.includes('refund') ? '-' : '+'}{formatPrice(log.amount)}
                        </p>
                        <p className="text-xs text-gray-500">{log.currency}</p>
                      </td>
                      <td className="px-4 py-3">
                        {log.user_email ? (
                          <div>
                            <p className="text-sm text-white">{log.user_name || 'User'}</p>
                            <p className="text-xs text-gray-500">{log.user_email}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${getStatusBadge(log.status)}`}>
                          {log.status}
                        </span>
                        {log.error_message && (
                          <p className="text-xs text-error-400 mt-1 max-w-[200px] truncate" title={log.error_message}>
                            {log.error_message}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-400">
                          {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Gateway Breakdown */}
        {summary?.by_gateway && summary.by_gateway.length > 0 && (
          <div className="mt-6">
            <h3 className="font-display text-lg font-bold text-white mb-3">By Gateway</h3>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {summary.by_gateway.map((gw: any) => (
                <div key={gw.gateway_name} className="glass rounded-xl p-4">
                  <p className="text-xs text-gray-500 capitalize">{gw.gateway_name}</p>
                  <p className="text-lg font-bold text-white mt-1">{gw.count} txns</p>
                  <p className="text-xs text-gold-400">{formatPrice(gw.total_amount || 0)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
