import { useEffect, useState } from 'react';
import { navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { BadgeCheck, ShieldCheck, Wallet, Mail, Phone, User, AtSign, Camera, Save } from 'lucide-react';

export function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: '', username: '', phone_number: '', phone_country_code: '+91', avatar_url: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    if (profile) {
      setForm({
        full_name: profile.full_name,
        username: profile.username,
        phone_number: profile.phone_number,
        phone_country_code: profile.phone_country_code,
        avatar_url: profile.avatar_url ?? '',
      });
    }
  }, [user, loading, profile]);

  if (loading || !user || !profile) return <div className="min-h-[60vh] grid place-items-center text-gray-500">Loading...</div>;

  const kycInfo = {
    not_submitted: { label: 'Not Submitted', cls: 'bg-white/[0.06] text-gray-400 border-white/10' },
    pending: { label: 'Pending Review', cls: 'bg-warning-500/15 text-warning-400 border-warning-500/30' },
    approved: { label: 'Verified', cls: 'bg-success-500/15 text-success-400 border-success-500/30' },
    rejected: { label: 'Rejected', cls: 'bg-error-500/15 text-error-400 border-error-500/30' },
  }[profile.kyc_status] ?? { label: 'Not Submitted', cls: 'bg-white/[0.04] text-gray-400' };

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          username: form.username,
          phone_number: form.phone_number,
          phone_country_code: form.phone_country_code,
          avatar_url: form.avatar_url || null,
        })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setEditing(false);
      toast('success', 'Profile updated successfully.');
    } catch (err: any) {
      toast('error', err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="mb-8">
        <span className="section-eyebrow">My Profile</span>
        <h1 className="font-display text-3xl font-bold text-white">Account Settings</h1>
      </div>

      {/* Profile header card */}
      <div className="glass-gold rounded-2xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative">
            <span className="grid place-items-center w-24 h-24 rounded-full bg-gold-gradient text-ink-950 text-3xl font-bold overflow-hidden">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : (profile.username?.[0] ?? 'U').toUpperCase()}
            </span>
            {editing && (
              <button className="absolute bottom-0 right-0 grid place-items-center w-8 h-8 rounded-full bg-ink-850 border border-gold-400/40 text-gold-400 hover:bg-gold-400/10">
                <Camera size={14} />
              </button>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h2 className="font-display text-xl font-bold text-white">{profile.full_name}</h2>
              {profile.verified_seller && (
                <span className="badge bg-gold-400/15 text-gold-300 border border-gold-400/30">
                  <BadgeCheck size={13} /> Verified Seller
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-0.5">@{profile.username}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className={`badge border ${kycInfo.cls}`}>
                <ShieldCheck size={12} /> KYC: {kycInfo.label}
              </span>
              <span className="badge bg-white/[0.04] text-gray-300 border border-white/10">
                <Wallet size={12} /> Wallet Active
              </span>
            </div>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-outline text-sm">Edit Profile</button>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="glass rounded-2xl p-6">
        <h3 className="font-display text-lg font-bold text-white mb-5">Personal Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field icon={<User size={16} />} label="Full Name" value={form.full_name} editing={editing} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
          <Field icon={<AtSign size={16} />} label="Username" value={form.username} editing={editing} onChange={(v) => setForm((f) => ({ ...f, username: v.replace(/\s/g, '') }))} />
          <Field icon={<Mail size={16} />} label="Email" value={profile.email} editing={false} onChange={() => {}} />
          <div>
            <label className="label-field">Phone Number</label>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <select value={form.phone_country_code} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, phone_country_code: e.target.value }))} className="input-field text-sm disabled:opacity-60">
                {['+91', '+1', '+44', '+971', '+65'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={form.phone_number} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))} className="input-field pl-9 disabled:opacity-60" />
              </div>
            </div>
          </div>
        </div>

        {editing && (
          <div className="mt-6 flex gap-3">
            <button onClick={save} disabled={saving} className="btn-gold text-sm">
              <Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => { setEditing(false); if (profile) setForm({ full_name: profile.full_name, username: profile.username, phone_number: profile.phone_number, phone_country_code: profile.phone_country_code, avatar_url: profile.avatar_url ?? '' }); }} className="btn-ghost text-sm">Cancel</button>
          </div>
        )}
      </div>

      <div className="mt-6 glass rounded-2xl p-6">
        <h3 className="font-display text-lg font-bold text-white mb-2">Verified Seller Badge</h3>
        <p className="text-sm text-gray-400">
          {profile.verified_seller
            ? 'Congratulations! You are a verified seller. Your badge is visible across the marketplace.'
            : 'The Verified Seller badge is hidden until your account is approved. Complete KYC verification to become eligible.'}
        </p>
        {!profile.verified_seller && (
          <button onClick={() => navigate('/kyc')} className="btn-outline mt-4 text-sm">Start KYC Verification</button>
        )}
      </div>
    </div>
  );
}

function Field({ icon, label, value, editing, onChange }: { icon: React.ReactNode; label: string; value: string; editing: boolean; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{icon}</span>
        <input value={value} disabled={!editing} onChange={(e) => onChange(e.target.value)} className="input-field pl-9 disabled:opacity-60 disabled:cursor-not-allowed" />
      </div>
    </div>
  );
}
