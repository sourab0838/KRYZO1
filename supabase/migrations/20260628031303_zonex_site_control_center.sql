/*
# Zonex — Site Control Center

## Overview
Creates a comprehensive single-row configuration table `site_control` that stores
ALL site-wide settings as JSONB columns grouped by category. This allows the Super Admin
to manage the entire website from one interface without editing source code.

## New Tables
1. `site_control` — Single-row table with JSONB columns for each settings category:
   general, homepage, payment, commission, support, security, notifications, marketplace
2. `backup_logs` — Records of database backup operations (manual and scheduled)

## Security
- RLS enabled on both tables.
- `site_control` is readable by all authenticated users (so the website can read config),
  but writable only via SECURITY DEFINER functions that check is_super_admin().
- `backup_logs` is admin-only (readable by is_admin()).

## Important Notes
1. All settings are stored as JSONB, allowing flexible schema evolution without migrations.
2. The `admin_update_site_control` function merges new values into existing JSONB,
   so partial updates are supported (e.g., update only general settings without touching payment).
3. A SECURITY DEFINER function `get_site_control()` exposes all settings to authenticated users
   (no secrets — payment keys are NOT stored here; they remain in payment_settings).
4. Commission changes apply instantly to new orders. Existing orders keep their original commission.
5. Security toggles (registration, login, etc.) are read by the frontend and edge functions
   to enable/disable features dynamically.
*/

-- ============================================================
-- SITE_CONTROL (single-row config table)
-- ============================================================
CREATE TABLE IF NOT EXISTS site_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  general jsonb NOT NULL DEFAULT '{}'::jsonb,
  homepage jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment jsonb NOT NULL DEFAULT '{}'::jsonb,
  commission jsonb NOT NULL DEFAULT '{}'::jsonb,
  support jsonb NOT NULL DEFAULT '{}'::jsonb,
  security jsonb NOT NULL DEFAULT '{}'::jsonb,
  notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  marketplace jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL
);

ALTER TABLE site_control ENABLE ROW LEVEL SECURITY;

-- Readable by all authenticated users (website reads config)
DROP POLICY IF EXISTS "select_site_control" ON site_control;
CREATE POLICY "select_site_control" ON site_control FOR SELECT
  TO anon, authenticated USING (true);

-- No INSERT/UPDATE/DELETE policies — only via SECURITY DEFINER function

-- ============================================================
-- Seed default row with all default settings
-- ============================================================
INSERT INTO site_control (general, homepage, payment, commission, support, security, notifications, marketplace)
SELECT
  -- GENERAL
  jsonb_build_object(
    'website_name', 'Zonex',
    'logo_url', '',
    'favicon_url', '',
    'description', 'Premium Gaming ID & Account Marketplace',
    'keywords', 'gaming accounts, free fire, bgmi, buy accounts, sell accounts',
    'contact_email', 'support@zonex.com',
    'contact_phone', '',
    'language', 'en',
    'currency', 'INR',
    'timezone', 'Asia/Kolkata'
  ),
  -- HOMEPAGE
  jsonb_build_object(
    'banner_image_url', '',
    'hero_title', 'Premium Gaming Accounts',
    'hero_subtitle', 'Buy and sell verified gaming accounts with escrow protection',
    'hero_button1_text', 'Browse Marketplace',
    'hero_button1_link', '/marketplace',
    'hero_button2_text', 'Sell Account',
    'hero_button2_link', '/sell',
    'announcement_text', '',
    'announcement_enabled', false,
    'show_featured', true,
    'show_trending', true,
    'show_reviews', true,
    'show_faq', true,
    'show_stats', true
  ),
  -- PAYMENT (no secrets here — those are in payment_settings)
  jsonb_build_object(
    'min_topup', 100,
    'max_topup', 50000,
    'min_withdrawal', 500,
    'max_withdrawal', 100000
  ),
  -- COMMISSION
  jsonb_build_object(
    'buyer_fee_percent', 10,
    'seller_commission_percent', 10,
    'referral_bonus_percent', 5,
    'coupon_discount_percent', 0
  ),
  -- SUPPORT
  jsonb_build_object(
    'whatsapp_number', '',
    'telegram_username', '',
    'support_email', '',
    'business_hours', 'Mon-Sat, 9 AM - 9 PM IST',
    'auto_reply', 'Thank you for contacting Zonex Support. Our team will respond shortly.',
    'live_chat_enabled', true
  ),
  -- SECURITY
  jsonb_build_object(
    'registration_enabled', true,
    'email_otp_enabled', true,
    'login_enabled', true,
    'kyc_required', true,
    'selling_enabled', true,
    'buying_enabled', true,
    'wallet_enabled', true,
    'withdrawals_enabled', true,
    'escrow_enabled', true,
    'chat_enabled', true,
    'maintenance_mode', false,
    'force_logout', false
  ),
  -- NOTIFICATIONS
  jsonb_build_object(
    'push_enabled', true,
    'email_enabled', true,
    'maintenance_notification', true,
    'broadcast_enabled', true,
    'promotional_enabled', false
  ),
  -- MARKETPLACE
  jsonb_build_object(
    'featured_count', 8,
    'trending_count', 8,
    'auto_listing_approval', false,
    'auto_kyc_approval', false,
    'max_gallery_images', 25,
    'min_gallery_images', 10,
    'listing_expiry_days', 90
  )
WHERE NOT EXISTS (SELECT 1 FROM site_control);

-- ============================================================
-- HELPER: get_site_control() — expose all settings to authenticated users
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_site_control()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'general', general,
    'homepage', homepage,
    'payment', payment,
    'commission', commission,
    'support', support,
    'security', security,
    'notifications', notifications,
    'marketplace', marketplace
  )
  FROM site_control
  LIMIT 1;
$$;

-- ============================================================
-- HELPER: admin_update_site_control — merge new values into a category
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_site_control(
  p_category text,
  p_values jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_existing_id uuid;
BEGIN
  v_admin_id := public.get_current_user_id();
  IF v_admin_id IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super admin role required';
  END IF;

  SELECT id INTO v_existing_id FROM site_control LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    EXECUTE format(
      'UPDATE site_control SET %I = %I || $1, updated_at = now(), updated_by = $2 WHERE id = $3',
      p_category, p_category
    )
    USING p_values, v_admin_id, v_existing_id;
  ELSE
    EXECUTE format(
      'INSERT INTO site_control (%I, updated_at, updated_by) VALUES ($1, now(), $2)',
      p_category
    )
    USING p_values, v_admin_id;
  END IF;

  PERFORM public.log_admin_action('update_site_control', 'site_control', p_category, NULL);
END;
$$;

-- ============================================================
-- BACKUP_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('manual', 'scheduled', 'restore')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'in_progress')),
  file_name text,
  file_size_bytes bigint,
  triggered_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  triggered_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_backup_logs" ON backup_logs;
CREATE POLICY "select_backup_logs" ON backup_logs FOR SELECT
  TO anon, authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_backup_created ON backup_logs(created_at DESC);

-- ============================================================
-- HELPER: admin_log_backup — record a backup operation
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_log_backup(
  p_type text, p_status text DEFAULT 'completed', p_file_name text DEFAULT NULL, p_file_size_bytes bigint DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_name text;
  v_result_id uuid;
BEGIN
  v_admin_id := public.get_current_user_id();
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT full_name INTO v_admin_name FROM app_users WHERE id = v_admin_id;

  INSERT INTO backup_logs (type, status, file_name, file_size_bytes, triggered_by, triggered_by_name)
  VALUES (p_type, p_status, p_file_name, p_file_size_bytes, v_admin_id, COALESCE(v_admin_name, 'System'))
  RETURNING id INTO v_result_id;

  PERFORM public.log_admin_action('backup_' || p_type, 'backup', v_result_id::text, NULL);
  RETURN v_result_id;
END;
$$;

-- ============================================================
-- HELPER: admin_force_logout_all — invalidate all sessions
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_force_logout_all()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super admin role required';
  END IF;

  DELETE FROM auth_sessions;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM public.log_admin_action('force_logout_all', 'security', NULL, 'All sessions invalidated');
  RETURN v_count;
END;
$$;

-- ============================================================
-- HELPER: admin_clear_cache — placeholder for cache clear action
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_clear_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super admin role required';
  END IF;
  PERFORM public.log_admin_action('clear_cache', 'system', NULL, NULL);
END;
$$;

-- ============================================================
-- HELPER: admin_optimize_database — run VACUUM ANALYZE on key tables
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_optimize_database()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super admin role required';
  END IF;
  -- VACUUM cannot run inside a transaction, so we just log the action.
  -- The actual optimization would be handled by the edge function.
  PERFORM public.log_admin_action('optimize_database', 'system', NULL, NULL);
END;
$$;

-- ============================================================
-- Grant execute
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_site_control TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_site_control TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_log_backup TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_logout_all TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_cache TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_optimize_database TO anon, authenticated;
