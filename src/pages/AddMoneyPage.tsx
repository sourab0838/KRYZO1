import { useState, useEffect } from 'react';
import { navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { paymentApi } from '../lib/payments';
import { useToast } from '../components/Toast';
import { ArrowLeft, Plus, ShieldCheck, CreditCard, Smartphone, Building2, Wallet, Loader2 } from 'lucide-react';

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000];

export function AddMoneyPage() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const [amount, setAmount] = useState<number>(0);
  const [amountInput, setAmountInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [config, setConfig] = useState<{ is_configured: boolean; payment_mode: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    paymentApi.getConfig().then(setConfig).catch(() => {});
  }, [loading, user]);

  if (loading || !user) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;

  const handleAmountChange = (val: string) => {
    setAmountInput(val);
    setAmount(val ? Math.max(0, Number(val)) : 0);
  };

  const handleProceed = async () => {
    if (amount < 1) { toast('error', 'Please enter a valid amount.'); return; }
    if (config && !config.is_configured) {
      toast('error', 'Payments are not configured yet. Please contact admin.');
      return;
    }
    setProcessing(true);
    try {
      await paymentApi.openCheckout(
        amount,
        { email: user.email, username: user.username },
        async (paymentId, orderId, signature) => {
          try {
            const result = await paymentApi.verifyPayment({
              razorpay_order_id: orderId,
              razorpay_payment_id: paymentId,
              razorpay_signature: signature,
              amount,
            });
            if (result.success) {
              toast('success', `₹${amount} added to your wallet!`);
              navigate('/wallet');
            } else {
              toast('error', result.message || 'Payment verification failed.');
            }
          } catch (err: any) {
            toast('error', err.message || 'Payment verification failed.');
          }
        },
        () => {
          setProcessing(false);
          toast('info', 'Payment cancelled.');
        },
      );
    } catch (err: any) {
      toast('error', err.message || 'Failed to initiate payment.');
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <button onClick={() => navigate('/wallet')} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gold-300 mb-6">
        <ArrowLeft size={16} /> Back to Wallet
      </button>

      <div className="mb-8">
        <span className="section-eyebrow">Wallet</span>
        <h1 className="font-display text-3xl font-bold text-white">Add Money</h1>
        <p className="mt-2 text-gray-400">Top up your wallet using Razorpay. Secure and instant.</p>
      </div>

      {/* Payment mode badge */}
      {config && (
        <div className="flex items-center gap-2 mb-6">
          <span className={`badge ${config.payment_mode === 'live' ? 'bg-success-500/15 text-success-400' : 'bg-warning-500/15 text-warning-400'}`}>
            {config.payment_mode === 'live' ? 'Live Mode' : 'Test Mode'}
          </span>
          <span className="text-xs text-gray-500">Razorpay Checkout</span>
        </div>
      )}

      {/* Amount input */}
      <div className="glass rounded-2xl p-6 mb-6">
        <label className="label-field">Enter Amount (₹)</label>
        <div className="relative mt-2">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gold-400">₹</span>
          <input
            type="number"
            value={amountInput}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0"
            min="1"
            className="input-field text-2xl font-bold pl-10 py-4"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => { setAmount(a); setAmountInput(String(a)); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${amount === a ? 'bg-gold-gradient text-ink-950' : 'glass text-gray-300 hover:text-gold-300'}`}
            >
              +₹{a}
            </button>
          ))}
        </div>
      </div>

      {/* Payment methods preview */}
      <div className="glass rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Available Payment Methods</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <PaymentMethod icon={<Smartphone size={18} />} label="Google Pay" />
          <PaymentMethod icon={<Smartphone size={18} />} label="PhonePe" />
          <PaymentMethod icon={<Smartphone size={18} />} label="Paytm" />
          <PaymentMethod icon={<Smartphone size={18} />} label="BHIM UPI" />
          <PaymentMethod icon={<CreditCard size={18} />} label="Credit Card" />
          <PaymentMethod icon={<CreditCard size={18} />} label="Debit Card" />
          <PaymentMethod icon={<Building2 size={18} />} label="Net Banking" />
          <PaymentMethod icon={<Wallet size={18} />} label="UPI" />
          <PaymentMethod icon={<Smartphone size={18} />} label="QR Code" />
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gold-400/5 border border-gold-400/15 mb-6">
        <ShieldCheck size={15} className="text-gold-400 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-400">Payments are processed securely via Razorpay. Your card details are never stored on our servers. Payment signature is verified server-side.</p>
      </div>

      {/* Proceed button */}
      <button
        onClick={handleProceed}
        disabled={processing || amount < 1}
        className="btn-gold w-full text-base"
      >
        {processing ? (
          <><Loader2 size={18} className="animate-spin" /> Processing...</>
        ) : (
          <><Plus size={18} /> Proceed to Pay ₹{amount.toLocaleString('en-IN')}</>
        )}
      </button>

      {config && !config.is_configured && (
        <p className="mt-4 text-center text-xs text-warning-400">
          Payments are not configured. Please ask the admin to set up Razorpay keys.
        </p>
      )}
    </div>
  );
}

function PaymentMethod({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      <span className="text-gold-400">{icon}</span>
      <span className="text-sm text-gray-300">{label}</span>
    </div>
  );
}
