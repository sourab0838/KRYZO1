import { useState } from 'react';
import { Link, navigate } from '../lib/router';
import { authApi, useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';

export function LoginPage() {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast('error', 'Please fill in all fields.'); return; }
    setLoading(true);
    try {
      await authApi.login(email, password, remember);
      const sessionUser = await refreshUser();
      if (!sessionUser) {
        toast('error', 'Login succeeded but session could not be established.');
        return;
      }
      toast('success', 'Welcome back to Kryzo!');
      navigate('/dashboard');
    } catch (err: any) {
      toast('error', err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome Back" subtitle="Sign in to your Kryzo account">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label-field">Username or Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-field pl-9"
              autoComplete="email"
            />
          </div>
        </div>
        <div>
          <label className="label-field">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-field pl-9 pr-10"
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gold-300">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded accent-gold-400" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span className="text-gray-400">Remember me</span>
          </label>
          <Link to="/forgot-password" className="text-gold-400 hover:text-gold-300 font-medium">Forgot password?</Link>
        </div>

        <button type="submit" disabled={loading} className="btn-gold w-full">
          {loading ? 'Signing in...' : <>Sign In <ArrowRight size={16} /></>}
        </button>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <Link to="/register" className="btn-ghost flex-1 text-sm">Create Account</Link>
        <Link to="/forgot-password" className="btn-outline flex-1 text-sm">Reset Password</Link>
      </div>

      <p className="mt-6 text-center text-xs text-gray-500 inline-flex items-center justify-center gap-1.5 w-full">
        <ShieldCheck size={13} className="text-gold-400" /> Your login is protected with bank-grade encryption
      </p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 animate-fade-in">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gold-400/8 rounded-full blur-[120px]" />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <span className="font-display text-2xl font-extrabold"><span className="text-white">KRYZ</span><span className="gold-text">O</span></span>
          </Link>
          <h1 className="mt-4 font-display text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1.5 text-sm text-gray-400">{subtitle}</p>
        </div>
        <div className="glass-gold rounded-2xl p-6 md:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
