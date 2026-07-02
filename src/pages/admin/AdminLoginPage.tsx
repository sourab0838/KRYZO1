import { useState } from 'react';
import { navigate } from '../../lib/router';
import { authApi, useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Crown, AlertCircle } from 'lucide-react';

export function AdminLoginPage() {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast('error', 'Please fill in all fields.'); return; }
    setLoading(true);
    try {
      await authApi.login(email, password, true);
      const sessionUser = await refreshUser();
      if (!sessionUser) {
        toast('error', 'Login succeeded but session could not be established.');
        return;
      }

      // Check if user has admin role
      const { data: role } = await supabase.rpc('get_admin_role');
      if (!role) {
        toast('error', 'Access denied. Admin privileges required.');
        await authApi.logout();
        return;
      }

      toast('success', 'Welcome to Admin Panel');
      navigate('/admin/dashboard');
    } catch (err: any) {
      toast('error', err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4 py-12 animate-fade-in">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gold-400/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-400/20 to-transparent" />
      </div>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold-gradient text-ink-950 mb-4">
            <Crown size={32} />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Admin Portal</h1>
          <p className="mt-2 text-sm text-gray-400">Sign in to access the administration panel</p>
        </div>

        {/* Login Card */}
        <div className="glass-gold rounded-2xl p-6 md:p-8">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label-field">Admin Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@kryzo.com"
                  className="input-field pl-10"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="label-field">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gold-300"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-gold w-full py-3 text-base">
              {loading ? (
                'Signing in...'
              ) : (
                <>
                  Sign In to Admin Panel
                  <ArrowRight size={18} className="ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 p-3 bg-ink-800/50 rounded-xl border border-gold-400/10">
            <div className="flex items-start gap-2.5">
              <Shield size={16} className="text-gold-400 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400">
                This area is restricted to authorized administrators only. All login attempts are logged and monitored for security purposes.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Return to main site login
          </button>
        </div>

        {/* Powered by */}
        <p className="mt-8 text-center text-[11px] text-gray-600">
          Kryzo Admin Panel v2.0 — Protected by Supabase Auth
        </p>
      </div>
    </div>
  );
}
