-- Add FK for orders buyer_id and seller_id to profiles
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_buyer_id_profiles_fkey;

ALTER TABLE orders 
ADD CONSTRAINT orders_buyer_id_profiles_fkey 
FOREIGN KEY (buyer_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_seller_id_profiles_fkey;

ALTER TABLE orders 
ADD CONSTRAINT orders_seller_id_profiles_fkey 
FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Add FK for withdrawals
ALTER TABLE withdrawals 
DROP CONSTRAINT IF EXISTS withdrawals_user_id_profiles_fkey;

ALTER TABLE withdrawals 
ADD CONSTRAINT withdrawals_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Add FK for kyc_verifications
ALTER TABLE kyc_verifications 
DROP CONSTRAINT IF EXISTS kyc_verifications_user_id_profiles_fkey;

ALTER TABLE kyc_verifications 
ADD CONSTRAINT kyc_verifications_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Add FK for support_tickets
ALTER TABLE support_tickets 
DROP CONSTRAINT IF EXISTS support_tickets_user_id_profiles_fkey;

ALTER TABLE support_tickets 
ADD CONSTRAINT support_tickets_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Add FK for notifications
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_user_id_profiles_fkey;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add FK for wallets
ALTER TABLE wallets 
DROP CONSTRAINT IF EXISTS wallets_user_id_profiles_fkey;

ALTER TABLE wallets 
ADD CONSTRAINT wallets_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Add FK for escrow_holds
ALTER TABLE escrow_holds 
DROP CONSTRAINT IF EXISTS escrow_holds_buyer_id_profiles_fkey;

ALTER TABLE escrow_holds 
ADD CONSTRAINT escrow_holds_buyer_id_profiles_fkey 
FOREIGN KEY (buyer_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE escrow_holds 
DROP CONSTRAINT IF EXISTS escrow_holds_seller_id_profiles_fkey;

ALTER TABLE escrow_holds 
ADD CONSTRAINT escrow_holds_seller_id_profiles_fkey 
FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Add FK for chat_conversations
ALTER TABLE chat_conversations 
DROP CONSTRAINT IF EXISTS chat_conversations_buyer_id_profiles_fkey;

ALTER TABLE chat_conversations 
ADD CONSTRAINT chat_conversations_buyer_id_profiles_fkey 
FOREIGN KEY (buyer_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE chat_conversations 
DROP CONSTRAINT IF EXISTS chat_conversations_seller_id_profiles_fkey;

ALTER TABLE chat_conversations 
ADD CONSTRAINT chat_conversations_seller_id_profiles_fkey 
FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Add FK for chat_messages
ALTER TABLE chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_sender_id_profiles_fkey;

ALTER TABLE chat_messages 
ADD CONSTRAINT chat_messages_sender_id_profiles_fkey 
FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Add FK for auth_sessions
ALTER TABLE auth_sessions 
DROP CONSTRAINT IF EXISTS auth_sessions_user_id_profiles_fkey;

ALTER TABLE auth_sessions 
ADD CONSTRAINT auth_sessions_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;