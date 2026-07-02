/*
# Security Fixes - Audit Warnings Addressed

## Issues Fixed:
1. payment_logs INSERT policy was too permissive (WITH CHECK = true)
2. Revoked anon execute on functions that shouldn't be public

## Note on Admin Functions:
- admin_* functions have internal is_admin()/is_super_admin() checks
- These intentionally return meaningful error messages
- Security is enforced through these internal checks
*/

-- ============================================================
-- 1. FIX payment_logs RLS POLICY - Too Permissive
-- ============================================================

DROP POLICY IF EXISTS "payment_logs_insert" ON payment_logs;

CREATE POLICY "payment_logs_insert" ON payment_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR user_id = auth.uid());

-- ============================================================
-- 2. Revoke anon from functions that should require authentication
-- ============================================================

-- Auth helper functions
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_role() FROM anon;

-- Fraud detection functions
REVOKE EXECUTE ON FUNCTION public.detect_fake_kyc(p_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.detect_multiple_accounts(p_user_id uuid, p_ip_address text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.detect_repeated_failed_payments(p_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.detect_suspicious_login(p_user_id uuid, p_ip_address text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.flag_fraud(p_user_id uuid, p_type text, p_severity text, p_description text, p_metadata jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_fraud_flag(p_flag_id uuid) FROM anon;

-- User action functions
REVOKE EXECUTE ON FUNCTION public.confirm_receipt(p_order_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_listing_with_gallery(p_seller_id uuid, p_title text, p_description text, p_game text, p_price numeric, p_level integer, p_br_rank text, p_cs_rank text, p_prime_level integer, p_evo_gun_level integer, p_seller_whatsapp text, p_profile_image text, p_gallery_images text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_notification(p_user_id uuid, p_type notification_type, p_title text, p_message text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_ticket_with_message(p_user_id uuid, p_subject text, p_category text, p_message text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_withdrawal(p_user_id uuid, p_amount numeric, p_upi_id text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.hold_escrow(p_order_id uuid, p_buyer_id uuid, p_seller_id uuid, p_total_amount numeric, p_platform_fee numeric, p_seller_commission numeric, p_seller_payout numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_escrow(p_order_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_escrow(p_order_id uuid) FROM anon;

-- Wallet functions
REVOKE EXECUTE ON FUNCTION public.process_wallet_credit(p_user_id uuid, p_amount numeric, p_type text, p_description text, p_razorpay_payment_id text, p_razorpay_order_id text, p_related_order_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_wallet_debit(p_user_id uuid, p_amount numeric, p_type text, p_description text, p_related_order_id uuid) FROM anon;

-- Logging functions
REVOKE EXECUTE ON FUNCTION public.log_admin_action(p_action text, p_target_type text, p_target_id text, p_reason text, p_ip_address text, p_user_agent text, p_device_info text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_login_event(p_user_id uuid, p_ip_address text, p_user_agent text, p_device_info text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_payment_event(p_gateway_name text, p_event_type text, p_gateway_transaction_id text, p_order_id uuid, p_user_id uuid, p_amount numeric, p_currency text, p_status text, p_request_payload jsonb, p_response_payload jsonb, p_error_message text, p_ip_address text, p_user_agent text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_user_activity(p_user_id uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb, p_ip_address text, p_user_agent text, p_device_info text) FROM anon;

-- User management
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_pending_registrations() FROM anon;

-- ============================================================
-- 3. Note: The following functions ARE intentionally public:
-- ============================================================
-- get_payment_config: Required for payment flow (config needed before auth)
-- get_site_control: Required for site settings display (maintenance mode check)
-- increment_listing_views: Required for view counting (anon visitors)

-- ============================================================
-- Security Pattern Explanation:
-- ============================================================
-- Admin functions have internal role checks for better UX:
-- - Returns "Access denied: admin role required" 
-- - Instead of generic "permission denied for function"
-- - Security is still fully enforced through internal checks
-- - This pattern is considered secure when combined with:
--   1. SECURITY DEFINER with search_path = ''
--   2. Internal role verification before any action
--   3. Defense-in-depth approach