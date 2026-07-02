-- Fix foreign key constraints on profiles and wallets that still
-- reference the old app_users table (which no longer exists). The
-- Supabase auth migration was supposed to repoint these to auth.users
-- but the constraint changes were never applied, so the
-- handle_new_user trigger fails when creating a new auth user.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_app_users_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_auth_users_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_app_users_fkey;
ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_auth_users_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
