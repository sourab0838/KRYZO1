/*
# Zonex Admin Enhancements — Bank Details, Order Management RPCs, User Edit
Updated to use auth.uid() for Supabase Auth
*/

-- ============================================================
-- BANK_DETAILS table for permanent KYC storage
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name text NOT NULL DEFAULT '',
  account_holder_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  ifsc_code text NOT NULL DEFAULT '',
  upi_id text DEFAULT '',
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_bank_details" ON bank_details;
CREATE POLICY "select_bank_details" ON bank_details FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "insert_bank_details" ON bank_details;
CREATE POLICY "insert_bank_details" ON bank_details FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_bank_details" ON bank_details;
CREATE POLICY "update_bank_details" ON bank_details FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- Add bank_details_id to profiles for linking
-- ============================================================
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_details_id uuid REFERENCES bank_details(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- Add deleted_at to profiles for soft delete
-- ============================================================
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- Add request_reupload flag to kyc_requests
-- ============================================================
DO $$ BEGIN
  ALTER TABLE kyc_requests ADD COLUMN IF NOT EXISTS reupload_requested boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE kyc_requests ADD COLUMN IF NOT EXISTS reupload_reason text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- Add video_url for KYC verification videos
-- ============================================================
DO $$ BEGIN
  ALTER TABLE kyc_requests ADD COLUMN IF NOT EXISTS verification_video_url text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE kyc_face_verifications ADD COLUMN IF NOT EXISTS verification_video_url text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- Update is_admin and is_super_admin to use auth.uid()
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'moderator', 'support_staff'));
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM admin_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- Update log_admin_action to use auth.uid()
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text, p_target_type text DEFAULT NULL, p_target_id text DEFAULT NULL,
  p_reason text DEFAULT NULL, p_ip_address text DEFAULT NULL, p_user_agent text DEFAULT NULL, p_device_info text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin_id uuid; v_admin_name text;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN RETURN; END IF;
  SELECT full_name INTO v_admin_name FROM profiles WHERE id = v_admin_id;
  INSERT INTO audit_logs (admin_id, admin_name, action, target_type, target_id, reason, ip_address, user_agent, device_info)
  VALUES (v_admin_id, COALESCE(v_admin_name, 'Unknown'), p_action, p_target_type, p_target_id, p_reason, p_ip_address, p_user_agent, p_device_info);
END;
$$;

-- ============================================================
-- Admin function: Request KYC Re-upload
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_request_kyc_reupload(p_kyc_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  UPDATE kyc_requests 
  SET status = 'pending', 
      reupload_requested = true, 
      reupload_reason = p_reason,
      rejection_reason = NULL,
      reviewed_at = NULL
  WHERE id = p_kyc_id;
  PERFORM public.log_admin_action('kyc_reupload_requested', 'kyc_request', p_kyc_id::text, p_reason);
END;
$$;

-- ============================================================
-- Admin function: Update user details
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_user(p_user_id uuid, p_full_name text DEFAULT NULL, p_username text DEFAULT NULL, p_phone_country_code text DEFAULT NULL, p_phone_number text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  UPDATE profiles SET
    full_name = COALESCE(p_full_name, full_name),
    username = COALESCE(p_username, username),
    phone_country_code = COALESCE(p_phone_country_code, phone_country_code),
    phone_number = COALESCE(p_phone_number, phone_number),
    updated_at = now()
  WHERE id = p_user_id;
  PERFORM public.log_admin_action('user_updated', 'user', p_user_id::text, NULL);
END;
$$;

-- ============================================================
-- Admin function: Soft delete user
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Access denied: super admin role required'; END IF;
  UPDATE profiles SET deleted_at = now() WHERE id = p_user_id;
  PERFORM public.log_admin_action('user_deleted', 'user', p_user_id::text, p_reason);
END;
$$;

-- ============================================================
-- Admin function: Update order status
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_status text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  SELECT status INTO v_current_status FROM orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  UPDATE orders SET status = p_status, updated_at = now() WHERE id = p_order_id;
  PERFORM public.log_admin_action('order_' || p_status, 'order', p_order_id::text, p_reason);
END;
$$;

-- ============================================================
-- Admin function: Grant seller verification badge
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_grant_verified_seller(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  UPDATE profiles SET verified_seller = true, updated_at = now() WHERE id = p_user_id;
  PERFORM public.log_admin_action('seller_verified', 'user', p_user_id::text, p_reason);
END;
$$;

-- ============================================================
-- Admin function: Revoke seller verification badge
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_revoke_verified_seller(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  UPDATE profiles SET verified_seller = false, updated_at = now() WHERE id = p_user_id;
  PERFORM public.log_admin_action('seller_verification_revoked', 'user', p_user_id::text, p_reason);
END;
$$;

-- ============================================================
-- Admin function: Get wallets overview
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_wallets_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'user_id', w.user_id,
        'balance', w.balance,
        'pending_balance', w.pending_balance,
        'total_earnings', w.total_earnings,
        'total_deposits', w.total_deposits,
        'total_withdrawals', w.total_withdrawals,
        'updated_at', w.updated_at,
        'user', jsonb_build_object(
          'full_name', p.full_name,
          'username', p.username,
          'email', p.email
        )
      )
    )
    FROM wallets w
    JOIN profiles p ON p.id = w.user_id
    WHERE p.deleted_at IS NULL
    ORDER BY w.balance DESC
    LIMIT 100
  );
END;
$$;

-- ============================================================
-- Admin function: Get order details with parties
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_order_details(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order record;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'order', row_to_json(v_order),
    'buyer', (SELECT row_to_json(b) FROM (SELECT id, full_name, username, email, phone_country_code, phone_number FROM profiles WHERE id = v_order.buyer_id) b),
    'seller', (SELECT row_to_json(s) FROM (SELECT id, full_name, username, email, phone_country_code, phone_number FROM profiles WHERE id = v_order.seller_id) s),
    'listing', (SELECT row_to_json(l) FROM (SELECT id, title, game, price, status FROM account_listings WHERE id = v_order.listing_id) l),
    'escrow', (SELECT row_to_json(e) FROM (SELECT * FROM escrow_holds WHERE order_id = p_order_id) e)
  );
END;
$$;

-- ============================================================
-- Admin function: Get all orders filtered
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_orders(p_status text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'listing_id', o.listing_id,
        'buyer_id', o.buyer_id,
        'seller_id', o.seller_id,
        'amount', o.amount,
        'status', o.status,
        'escrow_status', o.escrow_status,
        'delivery_status', o.delivery_status,
        'platform_fee', o.platform_fee,
        'seller_commission', o.seller_commission,
        'seller_payout', o.seller_payout,
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'buyer', jsonb_build_object('full_name', bp.full_name, 'username', bp.username, 'email', bp.email),
        'seller', jsonb_build_object('full_name', sp.full_name, 'username', sp.username, 'email', sp.email),
        'listing', jsonb_build_object('title', l.title, 'game', l.game)
      )
    )
    FROM orders o
    JOIN profiles bp ON bp.id = o.buyer_id
    JOIN profiles sp ON sp.id = o.seller_id
    LEFT JOIN account_listings l ON l.id = o.listing_id
    WHERE (p_status IS NULL OR o.status = p_status)
    ORDER BY o.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  );
END;
$$;

-- ============================================================
-- Admin function: Get bank details for user
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_bank_details(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  RETURN (SELECT row_to_json(b) FROM bank_details b WHERE user_id = p_user_id);
END;
$$;

-- ============================================================
-- Admin function: Verify bank details
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_verify_bank_details(p_user_id uuid, p_verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  UPDATE bank_details SET is_verified = p_verified, verified_at = CASE WHEN p_verified THEN now() ELSE NULL END WHERE user_id = p_user_id;
  PERFORM public.log_admin_action('bank_details_' || CASE WHEN p_verified THEN 'verified' ELSE 'unverified' END, 'user', p_user_id::text, NULL);
END;
$$;

-- ============================================================
-- Grant execute permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_request_kyc_reupload TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_verified_seller TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_verified_seller TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_wallets_overview TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_order_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_orders TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_bank_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_bank_details TO authenticated;

-- ============================================================
-- Create index for bank_details
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bank_details_user ON bank_details(user_id);