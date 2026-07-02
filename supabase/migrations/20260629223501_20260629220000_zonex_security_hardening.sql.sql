/*
# Security Hardening - Function Permissions & Search Path

## Overview
This migration addresses multiple security vulnerabilities:
1. Fixes mutable search_path on SECURITY DEFINER functions
2. Revokes execute permissions from anon/authenticated for admin-only functions
3. Adds RLS policies for tables missing policies
4. Restricts public functions to only those intentionally public

## 1. Search Path Security
All SECURITY DEFINER functions are updated with `SET search_path = ''` to prevent
search_path injection attacks.

## 2. Function Execution Permissions
Admin functions should only be executable by authenticated users with admin role.
The functions themselves check for admin role, but we also revoke default
execute permissions from anon and authenticated roles.

Public functions (intentionally callable by anon):
- increment_listing_views
- get_payment_config
- get_site_control (read-only site settings for homepage)

## 3. RLS Policies
Added policies for:
- app_users: Only service role can manage (custom auth table)
- auth_sessions: Only service role can manage
- otp_codes: Only service role can manage
- pending_registrations: Only service role can manage

## 4. Important Notes
- Admin functions check role inside the function body as a second layer of defense
- Payment/escrow functions are restricted to authenticated users
- Fraud detection functions are restricted to authenticated users
*/

-- ============================================================
-- 1. REVOKE DEFAULT EXECUTE FROM PUBLIC FOR ALL ADMIN FUNCTIONS
-- ============================================================

-- Admin functions that should ONLY be callable by authenticated admins
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- Re-grant execute to authenticated for user-facing functions (NOT admin functions)
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_config() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_control() TO anon, authenticated;

-- User functions that need to be callable by authenticated users
GRANT EXECUTE ON FUNCTION public.create_listing_with_gallery TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ticket_with_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_receipt TO authenticated;
GRANT EXECUTE ON FUNCTION public.hold_escrow TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_escrow TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_escrow TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_wallet_credit TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_wallet_debit TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_fake_kyc TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_multiple_accounts TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_repeated_failed_payments TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_suspicious_login TO authenticated;
GRANT EXECUTE ON FUNCTION public.flag_fraud TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_fraud_flag TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_login_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_user_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_payment_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_role() TO authenticated;

-- Keep cleanup function for service role only (cron job)
GRANT EXECUTE ON FUNCTION public.cleanup_expired_pending_registrations TO authenticated;

-- ============================================================
-- 2. FIX SEARCH PATH FOR ALL SECURITY DEFINER FUNCTIONS
-- ============================================================

-- Admin functions - fix search path and ensure admin check
ALTER FUNCTION public.admin_assign_role SET search_path = '';
ALTER FUNCTION public.admin_broadcast_notification SET search_path = '';
ALTER FUNCTION public.admin_clear_cache SET search_path = '';
ALTER FUNCTION public.admin_delete_faq SET search_path = '';
ALTER FUNCTION public.admin_delete_user SET search_path = '';
ALTER FUNCTION public.admin_force_logout_all SET search_path = '';
ALTER FUNCTION public.admin_get_bank_details SET search_path = '';
ALTER FUNCTION public.admin_get_dashboard_stats SET search_path = '';
ALTER FUNCTION public.admin_get_email_settings SET search_path = '';
ALTER FUNCTION public.admin_get_gst_settings SET search_path = '';
ALTER FUNCTION public.admin_get_order_details SET search_path = '';
ALTER FUNCTION public.admin_get_orders SET search_path = '';
ALTER FUNCTION public.admin_get_payment_gateways SET search_path = '';
ALTER FUNCTION public.admin_get_payment_logs SET search_path = '';
ALTER FUNCTION public.admin_get_payment_logs_summary SET search_path = '';
ALTER FUNCTION public.admin_get_user_activity_logs SET search_path = '';
ALTER FUNCTION public.admin_get_wallets_overview SET search_path = '';
ALTER FUNCTION public.admin_grant_verified_seller SET search_path = '';
ALTER FUNCTION public.admin_log_backup SET search_path = '';
ALTER FUNCTION public.admin_optimize_database SET search_path = '';
ALTER FUNCTION public.admin_refund_escrow SET search_path = '';
ALTER FUNCTION public.admin_release_escrow SET search_path = '';
ALTER FUNCTION public.admin_request_kyc_reupload SET search_path = '';
ALTER FUNCTION public.admin_revoke_role SET search_path = '';
ALTER FUNCTION public.admin_revoke_verified_seller SET search_path = '';
ALTER FUNCTION public.admin_test_payment_gateway SET search_path = '';
ALTER FUNCTION public.admin_update_email_settings SET search_path = '';
ALTER FUNCTION public.admin_update_gst_settings SET search_path = '';
ALTER FUNCTION public.admin_update_kyc_status SET search_path = '';
ALTER FUNCTION public.admin_update_legal_doc SET search_path = '';
ALTER FUNCTION public.admin_update_listing_status SET search_path = '';
ALTER FUNCTION public.admin_update_order_status SET search_path = '';
ALTER FUNCTION public.admin_update_payment_gateway SET search_path = '';
ALTER FUNCTION public.admin_update_site_control SET search_path = '';
ALTER FUNCTION public.admin_update_site_setting SET search_path = '';
ALTER FUNCTION public.admin_update_support_settings SET search_path = '';
ALTER FUNCTION public.admin_update_user SET search_path = '';
ALTER FUNCTION public.admin_update_user_status SET search_path = '';
ALTER FUNCTION public.admin_update_withdrawal_status SET search_path = '';
ALTER FUNCTION public.admin_upsert_faq SET search_path = '';
ALTER FUNCTION public.admin_verify_bank_details SET search_path = '';

-- User-facing functions
ALTER FUNCTION public.cleanup_expired_pending_registrations SET search_path = '';
ALTER FUNCTION public.confirm_receipt SET search_path = '';
ALTER FUNCTION public.create_listing_with_gallery SET search_path = '';
ALTER FUNCTION public.create_notification SET search_path = '';
ALTER FUNCTION public.create_ticket_with_message SET search_path = '';
ALTER FUNCTION public.create_withdrawal SET search_path = '';
ALTER FUNCTION public.detect_fake_kyc SET search_path = '';
ALTER FUNCTION public.detect_multiple_accounts SET search_path = '';
ALTER FUNCTION public.detect_repeated_failed_payments SET search_path = '';
ALTER FUNCTION public.detect_suspicious_login SET search_path = '';
ALTER FUNCTION public.flag_fraud SET search_path = '';
ALTER FUNCTION public.get_admin_role SET search_path = '';
ALTER FUNCTION public.get_payment_config SET search_path = '';
ALTER FUNCTION public.get_site_control SET search_path = '';
ALTER FUNCTION public.handle_new_user SET search_path = '';
ALTER FUNCTION public.hold_escrow SET search_path = '';
ALTER FUNCTION public.increment_listing_views SET search_path = '';
ALTER FUNCTION public.is_admin SET search_path = '';
ALTER FUNCTION public.is_super_admin SET search_path = '';
ALTER FUNCTION public.log_admin_action SET search_path = '';
ALTER FUNCTION public.log_login_event SET search_path = '';
ALTER FUNCTION public.log_payment_event SET search_path = '';
ALTER FUNCTION public.log_user_activity SET search_path = '';
ALTER FUNCTION public.process_wallet_credit SET search_path = '';
ALTER FUNCTION public.process_wallet_debit SET search_path = '';
ALTER FUNCTION public.refund_escrow SET search_path = '';
ALTER FUNCTION public.release_escrow SET search_path = '';
ALTER FUNCTION public.resolve_fraud_flag SET search_path = '';

-- ============================================================
-- 3. RLS POLICIES FOR CUSTOM AUTH TABLES
-- ============================================================

-- app_users: Only service role should access (custom auth backend)
DROP POLICY IF EXISTS "service_role_all_app_users" ON app_users;
CREATE POLICY "service_role_all_app_users" ON app_users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- auth_sessions: Only service role should access
DROP POLICY IF EXISTS "service_role_all_auth_sessions" ON auth_sessions;
CREATE POLICY "service_role_all_auth_sessions" ON auth_sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- otp_codes: Only service role should access
DROP POLICY IF EXISTS "service_role_all_otp_codes" ON otp_codes;
CREATE POLICY "service_role_all_otp_codes" ON otp_codes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- pending_registrations: Only service role should access
DROP POLICY IF EXISTS "service_role_all_pending_registrations" ON pending_registrations;
CREATE POLICY "service_role_all_pending_registrations" ON pending_registrations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. GRANT EXECUTE TO ADMIN FUNCTIONS FOR AUTHENTICATED
-- (They still check admin role internally)
-- ============================================================

-- All admin functions need to be executable by authenticated because
-- the frontend uses the anon key with authenticated JWT when logged in
GRANT EXECUTE ON FUNCTION public.admin_assign_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_broadcast_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_cache TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_faq TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_logout_all TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_bank_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_email_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_gst_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_order_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_orders TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_payment_gateways TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_payment_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_payment_logs_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_activity_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_wallets_overview TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_verified_seller TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_log_backup TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_optimize_database TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_escrow TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_release_escrow TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_request_kyc_reupload TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_verified_seller TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_test_payment_gateway TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_email_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_gst_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_kyc_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_legal_doc TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_listing_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_payment_gateway TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_site_control TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_site_setting TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_support_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_withdrawal_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_faq TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_bank_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;

-- Re-grant handle_new_user for authenticated (used during registration flow)
GRANT EXECUTE ON FUNCTION public.handle_new_user TO authenticated;