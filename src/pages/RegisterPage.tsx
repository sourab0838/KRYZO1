import { useState, useEffect } from 'react';
import { Link, navigate } from '../lib/router';
import { authApi, useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { AuthShell } from './LoginPage';
import { Mail, Lock, Eye, EyeOff, ArrowRight, User, Phone, ShieldCheck, KeyRound } from 'lucide-react';

const PENDING_REG_KEY = 'kryzo_pending_registration';

interface PendingRegistration {
  fullName: string;
  username: string;
  countryCode: string;
  phone: string;
  email: string;
  password: string;
}

function loadPendingRegistration(): PendingRegistration | null {
  try {
    const raw = sessionStorage.getItem(PENDING_REG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingRegistration;
  } catch {
    return null;
  }
}

function savePendingRegistration(data: PendingRegistration): void {
  try {
    sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function clearPendingRegistration(): void {
  try {
    sessionStorage.removeItem(PENDING_REG_KEY);
  } catch { /* ignore */ }
}

const COUNTRY_CODES = [
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'USA (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+65', label: 'Singapore (+65)' },
];

export function RegisterPage() {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({
    fullName: '', username: '', countryCode: '+91', phone: '',
    email: '', otp: '', password: '', confirmPassword: '',
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [otpSending, setOtpSending] = useState(false);

  // Restore pending registration data on mount so a page refresh or
  // navigation during the OTP step does not lose the form state.
  useEffect(() => {
    const saved = loadPendingRegistration();
    if (saved) {
      setForm((f) => ({
        ...f,
        fullName: saved.fullName,
        username: saved.username,
        countryCode: saved.countryCode,
        phone: saved.phone,
        email: saved.email,
        password: saved.password,
        confirmPassword: saved.password,
      }));
      setStep(2);
    }
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.username || !form.phone || !form.email || !form.password) {
      toast('error', 'Please fill in all required fields.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast('error', 'Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      toast('error', 'Password must be at least 8 characters.');
      return;
    }
    if (!agreeTerms || !agreePrivacy) {
      toast('error', 'You must accept the Terms and Privacy Policy.');
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.register({
        fullName: form.fullName,
        username: form.username,
        email: form.email,
        phoneCountryCode: form.countryCode,
        phoneNumber: form.phone,
        password: form.password,
      });
      toast('success', 'OTP sent to your email. Please check your inbox.');
      savePendingRegistration({
        fullName: form.fullName,
        username: form.username,
        countryCode: form.countryCode,
        phone: form.phone,
        email: form.email,
        password: form.password,
      });
      setStep(2);
    } catch (err: any) {
      toast('error', err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.otp) {
      toast('error', 'Please enter the OTP code.');
      return;
    }

    setLoading(true);
    try {
      await authApi.completeRegistration(form.email, form.otp);
      clearPendingRegistration();
      toast('success', 'Account created! Welcome to Kryzo.');
      // Auto-login after registration
      const loginData = await authApi.login(form.email, form.password, true);
      await refreshUser();
      navigate('/dashboard');
    } catch (err: any) {
      toast('error', err.message || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpSending(true);
    try {
      await authApi.sendOtp(form.email, 'registration');
      toast('success', 'OTP resent! Check your inbox.');
    } catch (err: any) {
      toast('error', err.message || 'Failed to resend OTP.');
    } finally {
      setOtpSending(false);
    }
  };

  return (
    <AuthShell title="Create Your Account" subtitle="Join Kryzo — the premium gaming marketplace">
      {step === 2 ? (
        <form onSubmit={handleCompleteRegistration} className="space-y-4">
          <div className="text-center mb-6">
            <div className="grid place-items-center w-16 h-16 rounded-full bg-gold-400/10 mx-auto">
              <Mail size={32} className="text-gold-400" />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold text-white">Verify Your Email</h2>
            <p className="mt-1.5 text-sm text-gray-400">We sent a verification code to {form.email}</p>
          </div>
          <div>
            <label className="label-field">Verification Code</label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={form.otp}
                onChange={(e) => set('otp', e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="input-field pl-9 tracking-widest text-center text-lg"
                autoFocus
              />
            </div>
          </div>
          <button type="submit" disabled={loading || form.otp.length < 6} className="btn-gold w-full">
            {loading ? 'Verifying...' : <>Verify & Create Account <ArrowRight size={16} /></>}
          </button>
          <div className="text-center">
            <button type="button" onClick={handleResendOtp} disabled={otpSending} className="text-sm text-gold-400 hover:text-gold-300 font-medium">
              {otpSending ? 'Sending...' : "Didn't receive the code? Resend"}
            </button>
          </div>
          <button type="button" onClick={() => setStep(1)} className="btn-ghost w-full text-sm">
            Back to registration
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="label-field">Full Name</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="John Doe" className="input-field pl-9" />
            </div>
          </div>
          <div>
            <label className="label-field">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
              <input value={form.username} onChange={(e) => set('username', e.target.value.replace(/\s/g, ''))} placeholder="johndoe" className="input-field pl-9" />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div>
              <label className="label-field">Code</label>
              <select value={form.countryCode} onChange={(e) => set('countryCode', e.target.value)} className="input-field text-sm">
                {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Phone Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="9876543210" className="input-field pl-9" />
              </div>
            </div>
          </div>
          <div>
            <label className="label-field">Email Address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" className="input-field pl-9" />
            </div>
          </div>
          <div>
            <label className="label-field">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type={show ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min 8 characters" className="input-field pl-9 pr-10" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gold-300">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label-field">Confirm Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type={show ? 'text' : 'password'} value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} placeholder="Re-enter password" className="input-field pl-9" />
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="w-4 h-4 mt-0.5 rounded accent-gold-400 shrink-0" />
              <span className="text-sm text-gray-300">I agree to the <Link to="/terms" className="text-gold-400 hover:text-gold-300">Terms & Conditions</Link></span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="w-4 h-4 mt-0.5 rounded accent-gold-400 shrink-0" />
              <span className="text-sm text-gray-300">I agree to the <Link to="/privacy" className="text-gold-400 hover:text-gold-300">Privacy Policy</Link></span>
            </label>
          </div>

          <button type="submit" disabled={loading} className="btn-gold w-full">
            {loading ? 'Sending OTP...' : <>Create Account <ArrowRight size={16} /></>}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-gray-400">
        Already have an account? <Link to="/login" className="text-gold-400 hover:text-gold-300 font-semibold">Sign in</Link>
      </p>
      <p className="mt-4 text-center text-xs text-gray-500 inline-flex items-center justify-center gap-1.5 w-full">
        <ShieldCheck size={13} className="text-gold-400" /> Registration requires email verification
      </p>
    </AuthShell>
  );
}
