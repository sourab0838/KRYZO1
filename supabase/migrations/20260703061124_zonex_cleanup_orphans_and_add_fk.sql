-- First, find and clean up orphaned records before adding FK constraints

-- Check for orphaned kyc_verifications
DELETE FROM kyc_verifications 
WHERE user_id NOT IN (SELECT id FROM profiles);

-- Check for orphaned orders
UPDATE orders SET buyer_id = NULL WHERE buyer_id NOT IN (SELECT id FROM profiles);
UPDATE orders SET seller_id = NULL WHERE seller_id NOT IN (SELECT id FROM profiles);

-- Check for orphaned withdrawals
DELETE FROM withdrawals WHERE user_id NOT IN (SELECT id FROM profiles);

-- Check for orphaned notifications
DELETE FROM notifications WHERE user_id NOT IN (SELECT id FROM profiles);

-- Check for orphaned support_tickets
DELETE FROM support_tickets WHERE user_id NOT IN (SELECT id FROM profiles);

-- Check for orphaned wallets
DELETE FROM wallets WHERE user_id NOT IN (SELECT id FROM profiles);

-- Now add foreign key from account_listings.seller_id to profiles.id
ALTER TABLE account_listings 
DROP CONSTRAINT IF EXISTS account_listings_seller_id_profiles_fkey;

ALTER TABLE account_listings 
ADD CONSTRAINT account_listings_seller_id_profiles_fkey 
FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE;