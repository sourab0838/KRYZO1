import { useState } from 'react';
import { Link, navigate } from '../lib/router';
import { authApi } from '../lib/auth';
import { useToast } from '../components/Toast';
import { AuthShell } from './LoginPage';
import { Mail, ArrowRight, ArrowLeft, KeyRound, CheckCircle2, Lock } from 'lucide-react';

export function ForgotPasswordPage() {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast('error', 'Enter your email address.');
      return;
    }
    setSending(true);
    try {
      await authApi.forgotPassword(email);
      setStep(2);
      toast('success', 'Password reset code sent to your email.');
    } catch (err: any) {
      toast('error', err.message || 'Failed to send reset code.');
    } finally {
      setSending(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp || !newPassword) {
      toast('error', 'All fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      toast('error', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(email, otp, newPassword);
      setStep(3);
      toast('success', 'Password reset successfully!');
    } catch (err: any) {
      toast('error', err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setSending(true);
    try {
      await authApi.forgotPassword(email);
      toast('success', 'Reset code resent!');
    } catch (err: any) {
      toast('error', err.message || 'Failed to resend code.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell title="Forgot Password" subtitle="We'll send a reset code to your email">
      {step === 3 ? (
        <div className="text-center py-4">
          <div className="grid place-items-center w-16 h-16 rounded-full bg-success-500/10 mx-auto">
            <CheckCircle2 size={32} className="text-success-400" />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-white">Password Reset</h2>
          <p className="mt-2 text-sm text-gray-400">Your password has been reset successfully. Please log in with your new password.</p>
          <button onClick={() => navigate('/login')} className="btn-gold w-full mt-6">Back to Login</button>
        </div>
      ) : step === 2 ? (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="label-field">Reset Code</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" maxLength={6} className="input-field pl-9 tracking-widest" />
              </div>
              <button type="button" onClick={handleResendOtp} disabled={sending} className="btn-outline whitespace-nowrap text-sm">
                {sending ? 'Sending...' : 'Resend'}
              </button>
            </div>
          </div>
          <div>
            <label className="label-field">New Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" className="input-field pl-9" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-gold w-full">
            {loading ? 'Resetting...' : <>Reset Password <ArrowRight size={16} /></>}
          </button>
          <button type="button" onClick={() => setStep(1)} className="btn-ghost w-full text-sm">
            <ArrowLeft size={15} /> Back
          </button>
        </form>
      ) : (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label className="label-field">Email Address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input-field pl-9" />
            </div>
          </div>
          <button type="submit" disabled={sending} className="btn-gold w-full">
            {sending ? 'Sending...' : <>Send Reset Code <ArrowRight size={16} /></>}
          </button>
          <Link to="/login" className="btn-ghost w-full text-sm">
            <ArrowLeft size={15} /> Back to Login
          </Link>
        </form>
      )}
    </AuthShell>
  );
}

export function OtpVerifyPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSendOtp = async () => {
    if (!email) {
      toast('error', 'Enter your email.');
      return;
    }
    setSending(true);
    try {
      await authApi.sendOtp(email, 'registration');
      toast('success', 'OTP sent to your email.');
    } catch (err: any) {
      toast('error', err.message || 'Failed to send OTP.');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) {
      toast('error', 'Enter email and OTP.');
      return;
    }
    setLoading(true);
    try {
      await authApi.verifyOtp(email, otp, 'registration');
      toast('success', 'Email verified!');
      navigate('/register');
    } catch (err: any) {
      toast('error', err.message || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Email OTP Verification" subtitle="Verify your email address">
      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="label-field">Email Address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input-field pl-9" />
          </div>
        </div>
        <div>
          <label className="label-field">OTP Code</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" maxLength={6} className="input-field pl-9 tracking-widest text-center text-lg" />
            </div>
            <button type="button" onClick={handleSendOtp} disabled={sending} className="btn-outline whitespace-nowrap text-sm">
              {sending ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-gold w-full">
          {loading ? 'Verifying...' : <>Verify Email <ArrowRight size={16} /></>}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-400">
        <Link to="/login" className="text-gold-400 hover:text-gold-300 font-semibold">Back to Login</Link>
      </p>
    </AuthShell>
  );
}
