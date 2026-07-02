/*
# Zonex Step 4 — Super Admin Panel, Website Control & Security
*/

-- ============================================================
-- Add suspension/ban columns to app_users
-- ============================================================
DO $$ BEGIN
  ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE app_users ADD COLUMN IF NOT EXISTS suspension_reason text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE app_users ADD COLUMN IF NOT EXISTS ban_reason text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- ADMIN_ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'moderator', 'support_staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_admin_roles" ON admin_roles;
CREATE POLICY "select_admin_roles" ON admin_roles FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- HELPER FUNCTIONS (must exist before tables that reference them in RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = public.get_current_user_id() AND role IN ('super_admin', 'moderator', 'support_staff'));
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = public.get_current_user_id() AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM admin_roles WHERE user_id = public.get_current_user_id() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text, p_target_type text DEFAULT NULL, p_target_id text DEFAULT NULL,
  p_reason text DEFAULT NULL, p_ip_address text DEFAULT NULL, p_user_agent text DEFAULT NULL, p_device_info text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin_id uuid; v_admin_name text;
BEGIN
  v_admin_id := public.get_current_user_id();
  IF v_admin_id IS NULL THEN RETURN; END IF;
  SELECT full_name INTO v_admin_name FROM app_users WHERE id = v_admin_id;
  INSERT INTO audit_logs (admin_id, admin_name, action, target_type, target_id, reason, ip_address, user_agent, device_info)
  VALUES (v_admin_id, COALESCE(v_admin_name, 'Unknown'), p_action, p_target_type, p_target_id, p_reason, p_ip_address, p_user_agent, p_device_info);
END;
$$;

-- ============================================================
-- AUDIT_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  admin_name text NOT NULL,
  action text NOT NULL,
  target_type text, target_id text, reason text,
  ip_address text, user_agent text, device_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT
  TO anon, authenticated USING (public.is_admin());
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================
-- LOGIN_HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  ip_address text, user_agent text, device_info text,
  login_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_login_history" ON login_history;
CREATE POLICY "select_login_history" ON login_history FOR SELECT
  TO anon, authenticated USING (user_id = public.get_current_user_id() OR public.is_admin());
CREATE INDEX IF NOT EXISTS idx_login_user ON login_history(user_id, login_at DESC);

CREATE OR REPLACE FUNCTION public.log_login_event(
  p_user_id uuid, p_ip_address text DEFAULT NULL, p_user_agent text DEFAULT NULL, p_device_info text DEFAULT NULL
)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO login_history (user_id, ip_address, user_agent, device_info)
  VALUES (p_user_id, p_ip_address, p_user_agent, p_device_info);
$$;

-- ============================================================
-- SUPPORT_SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS support_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number text NOT NULL DEFAULT '',
  telegram_username text NOT NULL DEFAULT '',
  support_email text NOT NULL DEFAULT '',
  business_hours text NOT NULL DEFAULT 'Mon-Sat, 9 AM - 9 PM IST',
  auto_reply text NOT NULL DEFAULT 'Thank you for contacting Zonex Support. Our team will respond shortly.',
  is_configured boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE support_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_support_settings" ON support_settings;
CREATE POLICY "select_support_settings" ON support_settings FOR SELECT
  TO anon, authenticated USING (true);
INSERT INTO support_settings (whatsapp_number, telegram_username, support_email, is_configured)
SELECT '', '', '', false
WHERE NOT EXISTS (SELECT 1 FROM support_settings);

-- ============================================================
-- LEGAL_DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL UNIQUE CHECK (doc_type IN ('terms', 'privacy', 'refund', 'seller_policy', 'buyer_policy')),
  title text NOT NULL, content text NOT NULL,
  updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_legal_docs" ON legal_documents;
CREATE POLICY "select_legal_docs" ON legal_documents FOR SELECT
  TO anon, authenticated USING (true);
INSERT INTO legal_documents (doc_type, title, content) VALUES
  ('terms', 'Terms & Conditions', 'Welcome to Zonex. By using our platform, you agree to these terms and conditions.'),
  ('privacy', 'Privacy Policy', 'Your privacy is important to us. This policy explains how we collect, use, and protect your personal information.'),
  ('refund', 'Refund Policy', 'All sales on Zonex are protected by our escrow system. If a seller fails to deliver, you are eligible for a full refund.'),
  ('seller_policy', 'Seller Policy', 'Sellers must provide accurate account information and deliver accounts promptly after purchase.'),
  ('buyer_policy', 'Buyer Policy', 'Buyers must verify account details before confirming delivery. Once confirmed, escrow funds are released to the seller.')
ON CONFLICT (doc_type) DO NOTHING;

-- ============================================================
-- FAQ_ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS faq_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL, answer text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE faq_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_faq" ON faq_entries;
CREATE POLICY "select_faq" ON faq_entries FOR SELECT
  TO anon, authenticated USING (is_published = true);
INSERT INTO faq_entries (question, answer, category, sort_order) VALUES
  ('How do I buy an account?', 'Browse the marketplace, select an account, and click Buy Now. Complete the payment via Razorpay. Funds are held in escrow until you confirm delivery.', 'buying', 1),
  ('How do I sell an account?', 'Complete KYC verification, then go to Sell Account. Fill in the details and upload 10-25 images.', 'selling', 2),
  ('What is escrow?', 'When you buy an account, your payment is held in escrow. The seller delivers the account, you confirm receipt, and only then is the payment released.', 'escrow', 3),
  ('How long do withdrawals take?', 'Withdrawals are processed within 24-48 hours after admin approval.', 'wallet', 4),
  ('What is the commission fee?', 'Buyers pay a 10% platform fee. Sellers are charged a 10% commission. Total platform revenue is 20%.', 'fees', 5)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ADMIN_NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('broadcast', 'maintenance', 'security', 'push', 'email')),
  title text NOT NULL, message text NOT NULL,
  target_audience text NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'buyers', 'sellers', 'admins')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_admin_notifications" ON admin_notifications;
CREATE POLICY "select_admin_notifications" ON admin_notifications FOR SELECT
  TO anon, authenticated USING (is_active = true);

-- ============================================================
-- ADMIN ACTION FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_kyc_status(p_kyc_id uuid, p_status text, p_rejection_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  SELECT user_id INTO v_user_id FROM kyc_requests WHERE id = p_kyc_id;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'KYC request not found'; END IF;
  UPDATE kyc_requests SET status = p_status::kyc_status, rejection_reason = p_rejection_reason, reviewed_at = now() WHERE id = p_kyc_id;
  UPDATE profiles SET kyc_status = p_status::kyc_status, verified_seller = (p_status = 'approved'), updated_at = now() WHERE id = v_user_id;
  PERFORM public.log_admin_action('kyc_' || p_status, 'kyc_request', p_kyc_id::text, p_rejection_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_listing_status(p_listing_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  v_status := CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' WHEN 'hide' THEN 'draft' ELSE NULL END;
  IF v_status IS NOT NULL THEN
    UPDATE account_listings SET status = v_status, rejection_reason = p_reason, updated_at = now() WHERE id = p_listing_id;
  END IF;
  IF p_action = 'feature' THEN UPDATE account_listings SET featured = true, updated_at = now() WHERE id = p_listing_id; END IF;
  IF p_action = 'unfeature' THEN UPDATE account_listings SET featured = false, updated_at = now() WHERE id = p_listing_id; END IF;
  PERFORM public.log_admin_action('listing_' || p_action, 'listing', p_listing_id::text, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_status(p_user_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  IF p_action = 'suspend' THEN
    UPDATE app_users SET is_suspended = true, suspension_reason = p_reason, updated_at = now() WHERE id = p_user_id;
    UPDATE profiles SET is_suspended = true, updated_at = now() WHERE id = p_user_id;
  ELSIF p_action = 'unsuspend' THEN
    UPDATE app_users SET is_suspended = false, suspension_reason = NULL, updated_at = now() WHERE id = p_user_id;
    UPDATE profiles SET is_suspended = false, updated_at = now() WHERE id = p_user_id;
  ELSIF p_action = 'ban' THEN
    UPDATE app_users SET is_banned = true, ban_reason = p_reason, updated_at = now() WHERE id = p_user_id;
    UPDATE profiles SET is_banned = true, updated_at = now() WHERE id = p_user_id;
  ELSIF p_action = 'unban' THEN
    UPDATE app_users SET is_banned = false, ban_reason = NULL, updated_at = now() WHERE id = p_user_id;
    UPDATE profiles SET is_banned = false, updated_at = now() WHERE id = p_user_id;
  END IF;
  PERFORM public.log_admin_action('user_' || p_action, 'user', p_user_id::text, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_withdrawal_status(p_withdrawal_id uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid; v_amount numeric(12,2); v_current_status text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  SELECT user_id, amount, status INTO v_user_id, v_amount, v_current_status FROM withdrawals WHERE id = p_withdrawal_id;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF p_status = 'rejected' AND v_current_status = 'pending' THEN
    UPDATE wallets SET balance = balance + v_amount, total_withdrawals = GREATEST(total_withdrawals - v_amount, 0), updated_at = now() WHERE user_id = v_user_id;
    INSERT INTO wallet_transactions (user_id, type, amount, direction, status, description)
    VALUES (v_user_id, 'refund', v_amount, 'credit', 'success', 'Withdrawal rejected: ' || COALESCE(p_reason, 'No reason provided'));
  END IF;
  UPDATE withdrawals SET status = p_status, reason = p_reason, processed_at = CASE WHEN p_status IN ('completed', 'rejected') THEN now() ELSE processed_at END, updated_at = now() WHERE id = p_withdrawal_id;
  IF p_status = 'approved' THEN
    PERFORM public.create_notification(v_user_id, 'withdrawal_approved'::notification_type, 'Withdrawal Approved', 'Your withdrawal request has been approved.');
  ELSIF p_status = 'rejected' THEN
    PERFORM public.create_notification(v_user_id, 'withdrawal_rejected'::notification_type, 'Withdrawal Rejected', 'Your withdrawal request has been rejected. ' || COALESCE(p_reason, ''));
  ELSIF p_status = 'completed' THEN
    PERFORM public.create_notification(v_user_id, 'wallet_credited'::notification_type, 'Withdrawal Completed', 'Your withdrawal has been completed.');
  END IF;
  PERFORM public.log_admin_action('withdrawal_' || p_status, 'withdrawal', p_withdrawal_id::text, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_release_escrow(p_order_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Access denied: super admin role required'; END IF;
  PERFORM public.release_escrow(p_order_id);
  PERFORM public.log_admin_action('escrow_release', 'order', p_order_id::text, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_refund_escrow(p_order_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Access denied: super admin role required'; END IF;
  PERFORM public.refund_escrow(p_order_id);
  PERFORM public.log_admin_action('escrow_refund', 'order', p_order_id::text, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_broadcast_notification(p_type text, p_title text, p_message text, p_target_audience text DEFAULT 'all')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin_id uuid;
BEGIN
  v_admin_id := public.get_current_user_id();
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  INSERT INTO admin_notifications (admin_id, type, title, message, target_audience, is_active)
  VALUES (v_admin_id, p_type, p_title, p_message, p_target_audience, true);
  IF p_target_audience = 'all' THEN
    INSERT INTO notifications (user_id, type, title, message)
    SELECT id, p_type::notification_type, p_title, p_message FROM app_users WHERE is_banned = false;
  ELSIF p_target_audience = 'sellers' THEN
    INSERT INTO notifications (user_id, type, title, message)
    SELECT au.id, p_type::notification_type, p_title, p_message FROM app_users au
    WHERE au.is_banned = false AND EXISTS (SELECT 1 FROM account_listings al WHERE al.seller_id = au.id);
  ELSIF p_target_audience = 'buyers' THEN
    INSERT INTO notifications (user_id, type, title, message)
    SELECT au.id, p_type::notification_type, p_title, p_message FROM app_users au
    WHERE au.is_banned = false AND EXISTS (SELECT 1 FROM orders o WHERE o.buyer_id = au.id);
  END IF;
  PERFORM public.log_admin_action('broadcast_notification', 'notification', NULL, p_title);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_legal_doc(p_doc_type text, p_title text, p_content text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin_id uuid;
BEGIN
  v_admin_id := public.get_current_user_id();
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  INSERT INTO legal_documents (doc_type, title, content, updated_by, updated_at)
  VALUES (p_doc_type, p_title, p_content, v_admin_id, now())
  ON CONFLICT (doc_type) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  PERFORM public.log_admin_action('update_legal_doc', 'legal_document', p_doc_type, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_support_settings(
  p_whatsapp_number text, p_telegram_username text, p_support_email text,
  p_business_hours text, p_auto_reply text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin_id uuid; v_existing_id uuid;
BEGIN
  v_admin_id := public.get_current_user_id();
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  SELECT id INTO v_existing_id FROM support_settings LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE support_settings SET whatsapp_number = p_whatsapp_number, telegram_username = p_telegram_username, support_email = p_support_email, business_hours = p_business_hours, auto_reply = p_auto_reply, is_configured = true, updated_at = now() WHERE id = v_existing_id;
  ELSE
    INSERT INTO support_settings (whatsapp_number, telegram_username, support_email, business_hours, auto_reply, is_configured)
    VALUES (p_whatsapp_number, p_telegram_username, p_support_email, p_business_hours, p_auto_reply, true);
  END IF;
  PERFORM public.log_admin_action('update_support_settings', 'support_settings', NULL, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_faq(
  p_question text, p_answer text, p_category text DEFAULT 'general',
  p_sort_order integer DEFAULT 0, p_is_published boolean DEFAULT true, p_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result_id uuid; v_admin_id uuid;
BEGIN
  v_admin_id := public.get_current_user_id();
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  IF p_id IS NOT NULL THEN
    UPDATE faq_entries SET question = p_question, answer = p_answer, category = p_category, sort_order = p_sort_order, is_published = p_is_published, updated_at = now() WHERE id = p_id RETURNING id INTO v_result_id;
  ELSE
    INSERT INTO faq_entries (question, answer, category, sort_order, is_published)
    VALUES (p_question, p_answer, p_category, p_sort_order, p_is_published) RETURNING id INTO v_result_id;
  END IF;
  PERFORM public.log_admin_action('upsert_faq', 'faq', v_result_id::text, NULL);
  RETURN v_result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_faq(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  DELETE FROM faq_entries WHERE id = p_id;
  PERFORM public.log_admin_action('delete_faq', 'faq', p_id::text, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_site_setting(p_key text, p_value text, p_description text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  INSERT INTO website_settings (key, value, description, updated_at)
  VALUES (p_key, p_value, p_description, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = COALESCE(EXCLUDED.description, website_settings.description), updated_at = EXCLUDED.updated_at;
  PERFORM public.log_admin_action('update_site_setting', 'website_settings', p_key, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_role(p_user_id uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Access denied: super admin role required'; END IF;
  INSERT INTO admin_roles (user_id, role) VALUES (p_user_id, p_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();
  PERFORM public.log_admin_action('assign_role', 'user', p_user_id::text, p_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_role(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Access denied: super admin role required'; END IF;
  DELETE FROM admin_roles WHERE user_id = p_user_id;
  PERFORM public.log_admin_action('revoke_role', 'user', p_user_id::text, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total_users int; v_total_sellers int; v_total_buyers int; v_verified_sellers int;
  v_pending_kyc int; v_approved_kyc int; v_rejected_kyc int;
  v_active_listings int; v_pending_listings int; v_sold_listings int;
  v_total_orders int; v_pending_orders int; v_completed_orders int; v_cancelled_orders int; v_disputed_orders int;
  v_wallet_deposits numeric(14,2); v_wallet_withdrawals numeric(14,2); v_escrow_balance numeric(14,2);
  v_buyer_fee_revenue numeric(14,2); v_seller_commission_revenue numeric(14,2); v_total_platform_revenue numeric(14,2);
  v_daily_revenue numeric(14,2); v_weekly_revenue numeric(14,2); v_monthly_revenue numeric(14,2); v_yearly_revenue numeric(14,2);
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  SELECT COUNT(*) INTO v_total_users FROM app_users;
  SELECT COUNT(*) INTO v_total_sellers FROM app_users WHERE EXISTS (SELECT 1 FROM account_listings WHERE seller_id = app_users.id);
  SELECT COUNT(*) INTO v_total_buyers FROM app_users WHERE EXISTS (SELECT 1 FROM orders WHERE buyer_id = app_users.id);
  SELECT COUNT(*) INTO v_verified_sellers FROM profiles WHERE verified_seller = true;
  SELECT COUNT(*) INTO v_pending_kyc FROM kyc_requests WHERE status = 'pending';
  SELECT COUNT(*) INTO v_approved_kyc FROM kyc_requests WHERE status = 'approved';
  SELECT COUNT(*) INTO v_rejected_kyc FROM kyc_requests WHERE status = 'rejected';
  SELECT COUNT(*) INTO v_active_listings FROM account_listings WHERE status = 'approved';
  SELECT COUNT(*) INTO v_pending_listings FROM account_listings WHERE status = 'pending';
  SELECT COUNT(*) INTO v_sold_listings FROM account_listings WHERE status = 'sold';
  SELECT COUNT(*) INTO v_total_orders FROM orders;
  SELECT COUNT(*) INTO v_pending_orders FROM orders WHERE status IN ('pending', 'payment_successful', 'awaiting_delivery', 'buyer_reviewing');
  SELECT COUNT(*) INTO v_completed_orders FROM orders WHERE status = 'completed';
  SELECT COUNT(*) INTO v_cancelled_orders FROM orders WHERE status = 'cancelled';
  SELECT COUNT(*) INTO v_disputed_orders FROM orders WHERE status = 'disputed' OR escrow_status = 'disputed';
  SELECT COALESCE(SUM(amount), 0) INTO v_wallet_deposits FROM wallet_transactions WHERE type = 'deposit' AND status = 'success';
  SELECT COALESCE(SUM(amount), 0) INTO v_wallet_withdrawals FROM wallet_transactions WHERE type = 'withdrawal' AND status = 'success';
  SELECT COALESCE(SUM(total_amount), 0) INTO v_escrow_balance FROM escrow_holds WHERE status = 'held';
  SELECT COALESCE(SUM(platform_fee), 0) INTO v_buyer_fee_revenue FROM orders WHERE status = 'completed';
  SELECT COALESCE(SUM(seller_commission), 0) INTO v_seller_commission_revenue FROM orders WHERE status = 'completed';
  v_total_platform_revenue := v_buyer_fee_revenue + v_seller_commission_revenue;
  SELECT COALESCE(SUM(platform_fee + seller_commission), 0) INTO v_daily_revenue FROM orders WHERE status = 'completed' AND updated_at >= date_trunc('day', now());
  SELECT COALESCE(SUM(platform_fee + seller_commission), 0) INTO v_weekly_revenue FROM orders WHERE status = 'completed' AND updated_at >= date_trunc('week', now());
  SELECT COALESCE(SUM(platform_fee + seller_commission), 0) INTO v_monthly_revenue FROM orders WHERE status = 'completed' AND updated_at >= date_trunc('month', now());
  SELECT COALESCE(SUM(platform_fee + seller_commission), 0) INTO v_yearly_revenue FROM orders WHERE status = 'completed' AND updated_at >= date_trunc('year', now());
  RETURN jsonb_build_object(
    'total_users', v_total_users, 'total_sellers', v_total_sellers, 'total_buyers', v_total_buyers,
    'verified_sellers', v_verified_sellers, 'pending_kyc', v_pending_kyc, 'approved_kyc', v_approved_kyc, 'rejected_kyc', v_rejected_kyc,
    'active_listings', v_active_listings, 'pending_listings', v_pending_listings, 'sold_listings', v_sold_listings,
    'total_orders', v_total_orders, 'pending_orders', v_pending_orders, 'completed_orders', v_completed_orders,
    'cancelled_orders', v_cancelled_orders, 'disputed_orders', v_disputed_orders,
    'wallet_deposits', v_wallet_deposits, 'wallet_withdrawals', v_wallet_withdrawals, 'escrow_balance', v_escrow_balance,
    'buyer_fee_revenue', v_buyer_fee_revenue, 'seller_commission_revenue', v_seller_commission_revenue,
    'total_platform_revenue', v_total_platform_revenue,
    'daily_revenue', v_daily_revenue, 'weekly_revenue', v_weekly_revenue, 'monthly_revenue', v_monthly_revenue, 'yearly_revenue', v_yearly_revenue
  );
END;
$$;

-- ============================================================
-- Grant execute on all helper functions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.is_admin TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_role TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_login_event TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_kyc_status TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_listing_status TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_withdrawal_status TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_release_escrow TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_escrow TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_broadcast_notification TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_legal_doc TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_support_settings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_faq TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_faq TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_site_setting TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_role TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats TO anon, authenticated;

-- ============================================================
-- Assign super_admin role to the first user
-- ============================================================
INSERT INTO admin_roles (user_id, role)
SELECT '06896c50-020f-4c8b-892c-ab7018440ec2', 'super_admin'
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = '06896c50-020f-4c8b-892c-ab7018440ec2');
