-- Fix ALL remaining foreign key constraints that still reference
-- the legacy app_users table (which no longer exists). The Supabase
-- Auth migration was supposed to repoint these to auth.users but
-- the constraint changes were never applied, causing INSERT/UPDATE
-- failures on kyc_requests, account_listings, orders, withdrawals,
-- chat tables, notifications, support tickets, etc.

-- account_listings
ALTER TABLE account_listings DROP CONSTRAINT IF EXISTS account_listings_seller_id_fkey;
ALTER TABLE account_listings ADD CONSTRAINT account_listings_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- auth_sessions (legacy table, keep FK for consistency)
ALTER TABLE auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_user_id_fkey;
ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- chat_conversations
ALTER TABLE chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_buyer_id_fkey;
ALTER TABLE chat_conversations ADD CONSTRAINT chat_conversations_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_seller_id_fkey;
ALTER TABLE chat_conversations ADD CONSTRAINT chat_conversations_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- chat_messages
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- escrow_holds
ALTER TABLE escrow_holds DROP CONSTRAINT IF EXISTS escrow_holds_seller_id_fkey;
ALTER TABLE escrow_holds ADD CONSTRAINT escrow_holds_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE escrow_holds DROP CONSTRAINT IF EXISTS escrow_holds_buyer_id_fkey;
ALTER TABLE escrow_holds ADD CONSTRAINT escrow_holds_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- kyc_face_verifications
ALTER TABLE kyc_face_verifications DROP CONSTRAINT IF EXISTS kyc_face_verifications_user_id_fkey;
ALTER TABLE kyc_face_verifications ADD CONSTRAINT kyc_face_verifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- kyc_requests
ALTER TABLE kyc_requests DROP CONSTRAINT IF EXISTS kyc_requests_user_id_app_users_fkey;
ALTER TABLE kyc_requests ADD CONSTRAINT kyc_requests_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- listing_compares
ALTER TABLE listing_compares DROP CONSTRAINT IF EXISTS listing_compares_user_id_fkey;
ALTER TABLE listing_compares ADD CONSTRAINT listing_compares_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- listing_reviews
ALTER TABLE listing_reviews DROP CONSTRAINT IF EXISTS listing_reviews_seller_id_fkey;
ALTER TABLE listing_reviews ADD CONSTRAINT listing_reviews_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE listing_reviews DROP CONSTRAINT IF EXISTS listing_reviews_reviewer_id_fkey;
ALTER TABLE listing_reviews ADD CONSTRAINT listing_reviews_reviewer_id_fkey
  FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- listing_wishlists
ALTER TABLE listing_wishlists DROP CONSTRAINT IF EXISTS listing_wishlists_user_id_fkey;
ALTER TABLE listing_wishlists ADD CONSTRAINT listing_wishlists_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_app_users_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_seller_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- support_ticket_messages
ALTER TABLE support_ticket_messages DROP CONSTRAINT IF EXISTS support_ticket_messages_user_id_app_users_fkey;
ALTER TABLE support_ticket_messages ADD CONSTRAINT support_ticket_messages_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- support_tickets
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_app_users_fkey;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- wallet_transactions
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- withdrawals
ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_user_id_fkey;
ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
