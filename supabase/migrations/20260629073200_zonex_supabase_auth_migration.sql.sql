/*
# Zonex Supabase Auth Migration

## Overview
Migrates from custom app_users table to Supabase Auth's built-in auth.users.
This is a comprehensive migration that updates all FK constraints and RLS policies.
*/

-- ============================================================
-- Step 1: Drop ALL existing RLS policies on affected tables
-- ============================================================

-- Account listings
DROP POLICY IF EXISTS "select_listings" ON account_listings;
DROP POLICY IF EXISTS "insert_own_listings" ON account_listings;
DROP POLICY IF EXISTS "update_own_listings" ON account_listings;
DROP POLICY IF EXISTS "delete_own_listings" ON account_listings;

-- Listing galleries
DROP POLICY IF EXISTS "select_gallery" ON listing_galleries;
DROP POLICY IF EXISTS "insert_own_gallery" ON listing_galleries;
DROP POLICY IF EXISTS "delete_own_gallery" ON listing_galleries;

-- Listing wishlists
DROP POLICY IF EXISTS "select_own_wishlist" ON listing_wishlists;
DROP POLICY IF EXISTS "insert_own_wishlist" ON listing_wishlists;
DROP POLICY IF EXISTS "delete_own_wishlist" ON listing_wishlists;

-- Listing compares
DROP POLICY IF EXISTS "select_own_compare" ON listing_compares;
DROP POLICY IF EXISTS "insert_own_compare" ON listing_compares;
DROP POLICY IF EXISTS "delete_own_compare" ON listing_compares;

-- Listing reviews
DROP POLICY IF EXISTS "select_reviews" ON listing_reviews;
DROP POLICY IF EXISTS "insert_own_review" ON listing_reviews;
DROP POLICY IF EXISTS "delete_own_review" ON listing_reviews;

-- Chat conversations
DROP POLICY IF EXISTS "select_own_conversations" ON chat_conversations;
DROP POLICY IF EXISTS "insert_own_conversations" ON chat_conversations;
DROP POLICY IF EXISTS "update_own_conversations" ON chat_conversations;

-- Chat messages
DROP POLICY IF EXISTS "select_own_messages" ON chat_messages;
DROP POLICY IF EXISTS "insert_own_messages" ON chat_messages;
DROP POLICY IF EXISTS "update_own_messages" ON chat_messages;

-- Orders
DROP POLICY IF EXISTS "select_own_orders" ON orders;
DROP POLICY IF EXISTS "insert_own_orders" ON orders;
DROP POLICY IF EXISTS "update_own_orders" ON orders;

-- KYC face verifications
DROP POLICY IF EXISTS "select_own_face_verify" ON kyc_face_verifications;
DROP POLICY IF EXISTS "insert_own_face_verify" ON kyc_face_verifications;

-- Wallet transactions
DROP POLICY IF EXISTS "select_own_transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "insert_own_transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "update_own_transactions" ON wallet_transactions;

-- Withdrawals
DROP POLICY IF EXISTS "select_own_withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "insert_own_withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "update_own_withdrawals" ON withdrawals;

-- Escrow holds
DROP POLICY IF EXISTS "select_own_escrow" ON escrow_holds;
DROP POLICY IF EXISTS "insert_own_escrow" ON escrow_holds;
DROP POLICY IF EXISTS "update_own_escrow" ON escrow_holds;

-- Login history
DROP POLICY IF EXISTS "select_login_history" ON login_history;

-- Profiles, wallets, notifications, support_tickets, support_ticket_messages, kyc_requests
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
DROP POLICY IF EXISTS "select_own_wallet" ON wallets;
DROP POLICY IF EXISTS "insert_own_wallet" ON wallets;
DROP POLICY IF EXISTS "update_own_wallet" ON wallets;
DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
DROP POLICY IF EXISTS "select_own_tickets" ON support_tickets;
DROP POLICY IF EXISTS "insert_own_tickets" ON support_tickets;
DROP POLICY IF EXISTS "update_own_tickets" ON support_tickets;
DROP POLICY IF EXISTS "select_own_ticket_messages" ON support_ticket_messages;
DROP POLICY IF EXISTS "insert_own_ticket_messages" ON support_ticket_messages;
DROP POLICY IF EXISTS "select_own_kyc" ON kyc_requests;
DROP POLICY IF EXISTS "insert_own_kyc" ON kyc_requests;
DROP POLICY IF EXISTS "update_own_kyc" ON kyc_requests;

-- ============================================================
-- Step 2: Drop obsolete function
-- ============================================================
DROP FUNCTION IF EXISTS public.get_current_user_id();

-- ============================================================
-- Step 3: Drop all FK constraints to app_users
-- ============================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_app_users_fkey;
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_app_users_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_app_users_fkey;
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_app_users_fkey;
ALTER TABLE support_ticket_messages DROP CONSTRAINT IF EXISTS support_ticket_messages_user_id_app_users_fkey;
ALTER TABLE kyc_requests DROP CONSTRAINT IF EXISTS kyc_requests_user_id_app_users_fkey;
ALTER TABLE account_listings DROP CONSTRAINT IF EXISTS account_listings_seller_id_fkey;
ALTER TABLE listing_wishlists DROP CONSTRAINT IF EXISTS listing_wishlists_user_id_fkey;
ALTER TABLE listing_compares DROP CONSTRAINT IF EXISTS listing_compares_user_id_fkey;
ALTER TABLE listing_reviews DROP CONSTRAINT IF EXISTS listing_reviews_reviewer_id_fkey;
ALTER TABLE listing_reviews DROP CONSTRAINT IF EXISTS listing_reviews_seller_id_fkey;
ALTER TABLE chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_buyer_id_fkey;
ALTER TABLE chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_seller_id_fkey;
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_seller_id_fkey;
ALTER TABLE kyc_face_verifications DROP CONSTRAINT IF EXISTS kyc_face_verifications_user_id_fkey;
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;
ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_user_id_fkey;
ALTER TABLE escrow_holds DROP CONSTRAINT IF EXISTS escrow_holds_buyer_id_fkey;
ALTER TABLE escrow_holds DROP CONSTRAINT IF EXISTS escrow_holds_seller_id_fkey;
ALTER TABLE admin_roles DROP CONSTRAINT IF EXISTS admin_roles_user_id_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_id_fkey;
ALTER TABLE login_history DROP CONSTRAINT IF EXISTS login_history_user_id_fkey;
ALTER TABLE legal_documents DROP CONSTRAINT IF EXISTS legal_documents_updated_by_fkey;
ALTER TABLE admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_admin_id_fkey;
ALTER TABLE backup_logs DROP CONSTRAINT IF EXISTS backup_logs_triggered_by_fkey;
ALTER TABLE fraud_flags DROP CONSTRAINT IF EXISTS fraud_flags_user_id_fkey;
ALTER TABLE fraud_flags DROP CONSTRAINT IF EXISTS fraud_flags_resolved_by_fkey;
ALTER TABLE site_control DROP CONSTRAINT IF EXISTS site_control_updated_by_fkey;
ALTER TABLE auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_user_id_fkey;

-- ============================================================
-- Step 4: Clean up orphaned data
-- ============================================================
DELETE FROM kyc_face_verifications;
DELETE FROM escrow_holds;
DELETE FROM wallet_transactions;
DELETE FROM withdrawals;
DELETE FROM chat_messages;
DELETE FROM chat_conversations;
DELETE FROM orders;
DELETE FROM listing_reviews;
DELETE FROM listing_compares;
DELETE FROM listing_wishlists;
DELETE FROM listing_galleries;
DELETE FROM account_listings;
DELETE FROM kyc_requests;
DELETE FROM support_ticket_messages;
DELETE FROM support_tickets;
DELETE FROM notifications;
DELETE FROM wallets;
DELETE FROM profiles;
DELETE FROM fraud_flags;
DELETE FROM login_history;
DELETE FROM audit_logs;
DELETE FROM admin_notifications;
DELETE FROM backup_logs;
DELETE FROM admin_roles;
DELETE FROM legal_documents WHERE updated_by IS NOT NULL;
DELETE FROM site_control WHERE updated_by IS NOT NULL;
DELETE FROM auth_sessions;
DELETE FROM otp_codes;
DELETE FROM app_users;

-- ============================================================
-- Step 5: Add FK constraints to auth.users
-- ============================================================
ALTER TABLE profiles ADD CONSTRAINT profiles_id_auth_users_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE support_ticket_messages ADD CONSTRAINT support_ticket_messages_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE kyc_requests ADD CONSTRAINT kyc_requests_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE account_listings ADD CONSTRAINT account_listings_seller_id_auth_users_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE listing_wishlists ADD CONSTRAINT listing_wishlists_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE listing_compares ADD CONSTRAINT listing_compares_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE listing_reviews ADD CONSTRAINT listing_reviews_reviewer_id_auth_users_fkey
  FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE listing_reviews ADD CONSTRAINT listing_reviews_seller_id_auth_users_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE chat_conversations ADD CONSTRAINT chat_conversations_buyer_id_auth_users_fkey
  FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE chat_conversations ADD CONSTRAINT chat_conversations_seller_id_auth_users_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_id_auth_users_fkey
  FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE orders ADD CONSTRAINT orders_buyer_id_auth_users_fkey
  FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE orders ADD CONSTRAINT orders_seller_id_auth_users_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE kyc_face_verifications ADD CONSTRAINT kyc_face_verifications_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE escrow_holds ADD CONSTRAINT escrow_holds_buyer_id_auth_users_fkey
  FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE escrow_holds ADD CONSTRAINT escrow_holds_seller_id_auth_users_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE admin_roles ADD CONSTRAINT admin_roles_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_admin_id_auth_users_fkey
  FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE login_history ADD CONSTRAINT login_history_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE legal_documents ADD CONSTRAINT legal_documents_updated_by_auth_users_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE admin_notifications ADD CONSTRAINT admin_notifications_admin_id_auth_users_fkey
  FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE backup_logs ADD CONSTRAINT backup_logs_triggered_by_auth_users_fkey
  FOREIGN KEY (triggered_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE fraud_flags ADD CONSTRAINT fraud_flags_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE fraud_flags ADD CONSTRAINT fraud_flags_resolved_by_auth_users_fkey
  FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE site_control ADD CONSTRAINT site_control_updated_by_auth_users_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- Step 6: Create RLS policies using auth.uid()
-- ============================================================

-- Profiles
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Wallets
CREATE POLICY "select_own_wallet" ON wallets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_wallet" ON wallets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_wallet" ON wallets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Notifications
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Support Tickets
CREATE POLICY "select_own_tickets" ON support_tickets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_tickets" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Support Ticket Messages
CREATE POLICY "select_own_ticket_messages" ON support_ticket_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_ticket_messages.ticket_id AND support_tickets.user_id = auth.uid())
  );
CREATE POLICY "insert_own_ticket_messages" ON support_ticket_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_ticket_messages.ticket_id AND support_tickets.user_id = auth.uid())
  );

-- KYC Requests
CREATE POLICY "select_own_kyc" ON kyc_requests FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_kyc" ON kyc_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_kyc" ON kyc_requests FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Account Listings
CREATE POLICY "select_listings" ON account_listings FOR SELECT
  TO authenticated USING (status = 'approved' OR seller_id = auth.uid());
CREATE POLICY "insert_own_listings" ON account_listings FOR INSERT
  TO authenticated WITH CHECK (seller_id = auth.uid());
CREATE POLICY "update_own_listings" ON account_listings FOR UPDATE
  TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
CREATE POLICY "delete_own_listings" ON account_listings FOR DELETE
  TO authenticated USING (seller_id = auth.uid());

-- Listing Galleries
CREATE POLICY "select_gallery" ON listing_galleries FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM account_listings WHERE account_listings.id = listing_galleries.listing_id AND (account_listings.status = 'approved' OR account_listings.seller_id = auth.uid()))
  );
CREATE POLICY "insert_own_gallery" ON listing_galleries FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM account_listings WHERE account_listings.id = listing_galleries.listing_id AND account_listings.seller_id = auth.uid())
  );
CREATE POLICY "delete_own_gallery" ON listing_galleries FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM account_listings WHERE account_listings.id = listing_galleries.listing_id AND account_listings.seller_id = auth.uid())
  );

-- Listing Wishlists
CREATE POLICY "select_own_wishlist" ON listing_wishlists FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_wishlist" ON listing_wishlists FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_wishlist" ON listing_wishlists FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Listing Compares
CREATE POLICY "select_own_compare" ON listing_compares FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_compare" ON listing_compares FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_compare" ON listing_compares FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Listing Reviews
CREATE POLICY "select_all_reviews" ON listing_reviews FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_own_review" ON listing_reviews FOR INSERT
  TO authenticated WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY "delete_own_review" ON listing_reviews FOR DELETE
  TO authenticated USING (reviewer_id = auth.uid());

-- Chat Conversations
CREATE POLICY "select_own_conversations" ON chat_conversations FOR SELECT
  TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "insert_own_conversations" ON chat_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "update_own_conversations" ON chat_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Chat Messages
CREATE POLICY "select_own_messages" ON chat_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND (chat_conversations.buyer_id = auth.uid() OR chat_conversations.seller_id = auth.uid()))
  );
CREATE POLICY "insert_own_messages" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "update_own_messages" ON chat_messages FOR UPDATE
  TO authenticated USING (sender_id = auth.uid());

-- Orders
CREATE POLICY "select_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "insert_own_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "update_own_orders" ON orders FOR UPDATE
  TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- KYC Face Verifications
CREATE POLICY "select_own_face_verify" ON kyc_face_verifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_face_verify" ON kyc_face_verifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Wallet Transactions
CREATE POLICY "select_own_transactions" ON wallet_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_transactions" ON wallet_transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_transactions" ON wallet_transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Withdrawals
CREATE POLICY "select_own_withdrawals" ON withdrawals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_withdrawals" ON withdrawals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_withdrawals" ON withdrawals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Escrow Holds
CREATE POLICY "select_own_escrow" ON escrow_holds FOR SELECT
  TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "insert_own_escrow" ON escrow_holds FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "update_own_escrow" ON escrow_holds FOR UPDATE
  TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Login History
CREATE POLICY "select_login_history" ON login_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Step 7: Recreate handle_new_user trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, email, phone_number, phone_country_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_country_code', '+91')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Step 8: Grant permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user TO postgres;
