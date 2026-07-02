import { useEffect, useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AdminLayout } from '../../components/AdminLayout';
import { checkAdminRole } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { formatPrice } from '../../lib/data';
import {
  Ticket, Plus, Pencil, Trash2, X, Save, Loader2, Search,
  Calendar, Percent, Tag, Users, CheckCircle2, XCircle, Clock
} from 'lucide-react';

interface CouponRow {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount: number;
  usage_limit: number;
  used_count: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
}

const FILTERS = ['all', 'active', 'expired', 'used'] as const;

export function AdminCouponsPage() {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0,
    min_order_amount: 0,
    max_discount: 0,
    usage_limit: 100,
    valid_from: '',
    valid_until: '',
    is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCoupons((data ?? []) as CouponRow[]);
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const role = await checkAdminRole();
      if (!role) { navigate('/dashboard'); return; }
      setChecking(false);
      load();
    })();
  }, [load]);

  const now = new Date();
  const filtered = coupons.filter((c) => {
    if (filter === 'active') return c.is_active && new Date(c.valid_until) > now;
    if (filter === 'expired') return new Date(c.valid_until) <= now;
    if (filter === 'used') return c.used_count >= c.usage_limit;
    return true;
  }).filter((c) => {
    if (!search.trim()) return true;
    return c.code.toLowerCase().includes(search.toLowerCase());
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      code: '',
      discount_type: 'percentage',
      discount_value: 0,
      min_order_amount: 0,
      max_discount: 0,
      usage_limit: 100,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      is_active: true,
    });
    setShowForm(true);
  };

  const openEdit = (c: CouponRow) => {
    setEditing(c);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      min_order_amount: c.min_order_amount,
      max_discount: c.max_discount,
      usage_limit: c.usage_limit,
      valid_from: c.valid_from?.split('T')[0] || '',
      valid_until: c.valid_until?.split('T')[0] || '',
      is_active: c.is_active,
    });
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      toast('error', 'Coupon code is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('coupons')
          .update({
            code: form.code.toUpperCase(),
            discount_type: form.discount_type,
            discount_value: form.discount_value,
            min_order_amount: form.min_order_amount,
            max_discount: form.max_discount,
            usage_limit: form.usage_limit,
            valid_from: form.valid_from,
            valid_until: form.valid_until,
            is_active: form.is_active,
          })
          .eq('id', editing.id);
        if (error) throw error;
        toast('success', 'Coupon updated');
      } else {
        const { error } = await supabase
          .from('coupons')
          .insert({
            code: form.code.toUpperCase(),
            discount_type: form.discount_type,
            discount_value: form.discount_value,
            min_order_amount: form.min_order_amount,
            max_discount: form.max_discount,
            usage_limit: form.usage_limit,
            valid_from: form.valid_from,
            valid_until: form.valid_until,
            is_active: form.is_active,
          });
        if (error) throw error;
        toast('success', 'Coupon created');
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    setDeleting(id);
    try {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;
      toast('success', 'Coupon deleted');
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to delete coupon');
    } finally {
      setDeleting(null);
    }
  };

  const toggleActive = async (c: CouponRow) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: !c.is_active })
        .eq('id', c.id);
      if (error) throw error;
      toast('success', c.is_active ? 'Coupon deactivated' : 'Coupon activated');
      await load();
    } catch (e: any) {
      toast('error', e?.message ?? 'Failed to update coupon');
    }
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-gray-500">Checking access...</div>;

  return (
    <AdminLayout currentPath="/admin/coupons">
      <div className="animate-fade-in">
        <span className="section-eyebrow">Admin Panel</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-2">
          <Ticket className="text-gold-400" /> Coupon Management
        </h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button onClick={openNew} className="btn-gold">
            <Plus size={16} /> Create Coupon
          </button>
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coupons..."
              className="input-field pl-10"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                filter === f ? 'bg-gold-400/10 text-gold-300 border border-gold-400/20' : 'text-gray-400 border border-white/10 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading coupons...</div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-gray-500">No coupons found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <div key={c.id} className="glass glass-hover rounded-2xl p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${c.discount_type === 'percentage' ? 'bg-gold-400/20 text-gold-300' : 'bg-success-500/20 text-success-400'}`}>
                      {c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `${formatPrice(c.discount_value)} OFF`}
                    </span>
                    {c.is_active && new Date(c.valid_until) > now ? (
                      <span className="badge bg-success-500/15 text-success-400"><CheckCircle2 size={11} /> Active</span>
                    ) : (
                      <span className="badge bg-error-500/15 text-error-400"><XCircle size={11} /> Inactive</span>
                    )}
                  </div>
                  <span className={`text-xs font-mono px-2 py-1 rounded bg-white/[0.04] ${c.used_count >= c.usage_limit ? 'text-error-400' : 'text-gray-400'}`}>
                    {c.used_count}/{c.usage_limit} used
                  </span>
                </div>

                <p className="font-display text-lg font-bold text-white mb-1">{c.code}</p>
                <p className="text-xs text-gray-500 mb-3">
                  Min order: {formatPrice(c.min_order_amount)}
                  {c.max_discount > 0 && ` · Max discount: ${formatPrice(c.max_discount)}`}
                </p>

                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <Calendar size={12} />
                  <span>
                    {new Date(c.valid_from).toLocaleDateString()} - {new Date(c.valid_until).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => toggleActive(c)} className="btn-ghost px-3 py-1.5 text-xs">
                    {c.is_active ? <><XCircle size={13} /> Deactivate</> : <><CheckCircle2 size={13} /> Activate</>}
                  </button>
                  <button onClick={() => openEdit(c)} className="btn-ghost px-3 py-1.5 text-xs">
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={() => deleteCoupon(c.id)}
                    disabled={deleting === c.id}
                    className="btn-outline px-3 py-1.5 text-xs text-error-400 border-error-500/30 hover:bg-error-500/10"
                  >
                    {deleting === c.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
          <form onSubmit={save} className="glass-gold rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-white">{editing ? 'Edit Coupon' : 'Create Coupon'}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-field">Coupon Code</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="SUMMER20"
                  className="input-field uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Discount Type</label>
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as 'percentage' | 'fixed' }))}
                    className="input-field"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="label-field">Discount Value</label>
                  <input
                    type="number"
                    value={form.discount_value}
                    onChange={(e) => setForm((f) => ({ ...f, discount_value: Number(e.target.value) }))}
                    className="input-field"
                    min={0}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Min Order Amount (₹)</label>
                  <input
                    type="number"
                    value={form.min_order_amount}
                    onChange={(e) => setForm((f) => ({ ...f, min_order_amount: Number(e.target.value) }))}
                    className="input-field"
                    min={0}
                  />
                </div>
                <div>
                  <label className="label-field">Max Discount (₹)</label>
                  <input
                    type="number"
                    value={form.max_discount}
                    onChange={(e) => setForm((f) => ({ ...f, max_discount: Number(e.target.value) }))}
                    className="input-field"
                    min={0}
                  />
                </div>
              </div>

              <div>
                <label className="label-field">Usage Limit</label>
                <input
                  type="number"
                  value={form.usage_limit}
                  onChange={(e) => setForm((f) => ({ ...f, usage_limit: Number(e.target.value) }))}
                  className="input-field"
                  min={1}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Valid From</label>
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="label-field">Valid Until</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="accent-gold-400"
                />
                Active (can be used immediately)
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button type="submit" disabled={saving} className="btn-gold flex-1">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {editing ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
