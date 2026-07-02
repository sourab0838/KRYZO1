/*
# Security Hardening Part 2 - Revoke PUBLIC Execute

PostgreSQL grants EXECUTE to PUBLIC by default for functions.
PUBLIC is a special role that includes all users.
We must explicitly REVOKE EXECUTE FROM PUBLIC for all sensitive functions.
*/

-- Revoke all function execute from PUBLIC (the special role, not anon)
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Re-grant only the intentionally public functions
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payment_config() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_control() TO PUBLIC;

-- For authenticated users, grant the necessary functions
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
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_pending_registrations() TO authenticated;

-- Admin functions - only authenticated (with internal role check)
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