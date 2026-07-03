-- Add admin policies for all tables that need them
-- These allow admin users to bypass ownership checks

-- Account listings admin policy
DROP POLICY IF EXISTS admin_all_account_listings ON account_listings;
CREATE POLICY admin_all_account_listings ON account_listings FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Profiles admin policy
DROP POLICY IF EXISTS admin_all_profiles ON profiles;
CREATE POLICY admin_all_profiles ON profiles FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Orders admin policy
DROP POLICY IF EXISTS admin_all_orders ON orders;
CREATE POLICY admin_all_orders ON orders FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Wallets admin policy
DROP POLICY IF EXISTS admin_all_wallets ON wallets;
CREATE POLICY admin_all_wallets ON wallets FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Wallet transactions admin policy
DROP POLICY IF EXISTS admin_all_wallet_transactions ON wallet_transactions;
CREATE POLICY admin_all_wallet_transactions ON wallet_transactions FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Withdrawals admin policy
DROP POLICY IF EXISTS admin_all_withdrawals ON withdrawals;
CREATE POLICY admin_all_withdrawals ON withdrawals FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- KYC verifications admin policy
DROP POLICY IF EXISTS admin_all_kyc_verifications ON kyc_verifications;
CREATE POLICY admin_all_kyc_verifications ON kyc_verifications FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Support tickets admin policy
DROP POLICY IF EXISTS admin_all_support_tickets ON support_tickets;
CREATE POLICY admin_all_support_tickets ON support_tickets FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Support ticket messages admin policy
DROP POLICY IF EXISTS admin_all_support_ticket_messages ON support_ticket_messages;
CREATE POLICY admin_all_support_ticket_messages ON support_ticket_messages FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Listing galleries admin policy
DROP POLICY IF EXISTS admin_all_listing_galleries ON listing_galleries;
CREATE POLICY admin_all_listing_galleries ON listing_galleries FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Chat conversations admin policy
DROP POLICY IF EXISTS admin_all_chat_conversations ON chat_conversations;
CREATE POLICY admin_all_chat_conversations ON chat_conversations FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Chat messages admin policy
DROP POLICY IF EXISTS admin_all_chat_messages ON chat_messages;
CREATE POLICY admin_all_chat_messages ON chat_messages FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Escrow holds admin policy
DROP POLICY IF EXISTS admin_all_escrow_holds ON escrow_holds;
CREATE POLICY admin_all_escrow_holds ON escrow_holds FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Notifications admin policy
DROP POLICY IF EXISTS admin_all_notifications ON notifications;
CREATE POLICY admin_all_notifications ON notifications FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Listing reviews admin policy
DROP POLICY IF EXISTS admin_all_listing_reviews ON listing_reviews;
CREATE POLICY admin_all_listing_reviews ON listing_reviews FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Listing wishlists admin policy
DROP POLICY IF EXISTS admin_all_listing_wishlists ON listing_wishlists;
CREATE POLICY admin_all_listing_wishlists ON listing_wishlists FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Listing compares admin policy
DROP POLICY IF EXISTS admin_all_listing_compares ON listing_compares;
CREATE POLICY admin_all_listing_compares ON listing_compares FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Auth sessions admin policy
DROP POLICY IF EXISTS admin_all_auth_sessions ON auth_sessions;
CREATE POLICY admin_all_auth_sessions ON auth_sessions FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- OTP codes admin policy
DROP POLICY IF EXISTS admin_all_otp_codes ON otp_codes;
CREATE POLICY admin_all_otp_codes ON otp_codes FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Pending registrations admin policy
DROP POLICY IF EXISTS admin_all_pending_registrations ON pending_registrations;
CREATE POLICY admin_all_pending_registrations ON pending_registrations FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- KYC requests admin policy
DROP POLICY IF EXISTS admin_all_kyc_requests ON kyc_requests;
CREATE POLICY admin_all_kyc_requests ON kyc_requests FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- KYC face verifications admin policy
DROP POLICY IF EXISTS admin_all_kyc_face_verifications ON kyc_face_verifications;
CREATE POLICY admin_all_kyc_face_verifications ON kyc_face_verifications FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );