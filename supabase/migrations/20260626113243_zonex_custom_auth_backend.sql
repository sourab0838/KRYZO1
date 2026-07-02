/*
# Zonex Custom Auth Backend

## Overview
Replaces Supabase's built-in auth with a custom authentication system using bcrypt-hashed passwords, email OTP verification, and JWT sessions. This migration creates the core auth tables and re-links existing profile/wallet/notification tables to the new app_users table.

## New Tables
1. `app_users` — Custom user accounts with bcrypt-hashed passwords, unique email/username/phone, email_verified flag.
2. `otp_codes` — Secure OTP storage with 5-minute expiry, purpose tracking, and consumed flag.
3. `auth_sessions` — Session token hashes for maintaining login state.

## Modified Tables
- `profiles`, `wallets`, `notifications`, `support_tickets`, `support_ticket_messages`, `kyc_requests` — FK re-linked from auth.users to app_users.

## Security
- RLS enabled on all new tables. app_users/otp_codes/auth_sessions have no client policies (service role only).
- Existing owner-scoped policies updated to use get_current_user_id() which validates the session token from request headers.

## Important Notes
1. Old handle_new_user trigger dropped — profiles created by edge function during registration.
2. get_current_user_id() reads user ID from x-zonex-token header via SHA-256 hash match against auth_sessions.
3. OTP codes expire after 5 minutes, single-use.
4. Passwords hashed with bcrypt in the edge function.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- APP_USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone_country_code text NOT NULL DEFAULT '+91',
  phone_number text NOT NULL,
  password_hash text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_phone ON app_users(phone_country_code, phone_number);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- OTP_CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'registration',
  expires_at timestamptz NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_codes(email, purpose, consumed, expires_at);

-- ============================================================
-- AUTH_SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sessions_token ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions(user_id);

-- ============================================================
-- Re-link existing tables to app_users
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_auth_users_fkey;
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_id_app_users_fkey
    FOREIGN KEY (id) REFERENCES app_users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_auth_users_fkey;
DO $$ BEGIN
  ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_app_users_fkey
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_auth_users_fkey;
DO $$ BEGIN
  ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_app_users_fkey
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_auth_users_fkey;
DO $$ BEGIN
  ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_user_id_app_users_fkey
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE support_ticket_messages DROP CONSTRAINT IF EXISTS support_ticket_messages_user_id_fkey;
ALTER TABLE support_ticket_messages DROP CONSTRAINT IF EXISTS support_ticket_messages_user_id_auth_users_fkey;
DO $$ BEGIN
  ALTER TABLE support_ticket_messages ADD CONSTRAINT support_ticket_messages_user_id_app_users_fkey
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE kyc_requests DROP CONSTRAINT IF EXISTS kyc_requests_user_id_fkey;
ALTER TABLE kyc_requests DROP CONSTRAINT IF EXISTS kyc_requests_user_id_auth_users_fkey;
DO $$ BEGIN
  ALTER TABLE kyc_requests ADD CONSTRAINT kyc_requests_user_id_app_users_fkey
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Helper: get_current_user_id() — validates session token from request header
-- Uses extensions.digest (pgcrypto installed in extensions schema on Supabase)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT s.user_id
  FROM auth_sessions s
  WHERE s.token_hash = encode(digest(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-zonex-token', ''), 'sha256'), 'hex')
    AND s.expires_at > now()
  LIMIT 1;
$$;

-- ============================================================
-- Update RLS policies to use get_current_user_id()
-- ============================================================

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO anon, authenticated USING (id = public.get_current_user_id());

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO anon, authenticated WITH CHECK (id = public.get_current_user_id());

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO anon, authenticated USING (id = public.get_current_user_id()) WITH CHECK (id = public.get_current_user_id());

DROP POLICY IF EXISTS "select_own_wallet" ON wallets;
CREATE POLICY "select_own_wallet" ON wallets FOR SELECT
  TO anon, authenticated USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "insert_own_wallet" ON wallets;
CREATE POLICY "insert_own_wallet" ON wallets FOR INSERT
  TO anon, authenticated WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "update_own_wallet" ON wallets;
CREATE POLICY "update_own_wallet" ON wallets FOR UPDATE
  TO anon, authenticated USING (user_id = public.get_current_user_id()) WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO anon, authenticated USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO anon, authenticated WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO anon, authenticated USING (user_id = public.get_current_user_id()) WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO anon, authenticated USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "select_own_tickets" ON support_tickets;
CREATE POLICY "select_own_tickets" ON support_tickets FOR SELECT
  TO anon, authenticated USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "insert_own_tickets" ON support_tickets;
CREATE POLICY "insert_own_tickets" ON support_tickets FOR INSERT
  TO anon, authenticated WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "update_own_tickets" ON support_tickets;
CREATE POLICY "update_own_tickets" ON support_tickets FOR UPDATE
  TO anon, authenticated USING (user_id = public.get_current_user_id()) WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "select_own_ticket_messages" ON support_ticket_messages;
CREATE POLICY "select_own_ticket_messages" ON support_ticket_messages FOR SELECT
  TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_ticket_messages.ticket_id
      AND support_tickets.user_id = public.get_current_user_id()
    )
  );

DROP POLICY IF EXISTS "insert_own_ticket_messages" ON support_ticket_messages;
CREATE POLICY "insert_own_ticket_messages" ON support_ticket_messages FOR INSERT
  TO anon, authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_ticket_messages.ticket_id
      AND support_tickets.user_id = public.get_current_user_id()
    )
  );

DROP POLICY IF EXISTS "select_own_kyc" ON kyc_requests;
CREATE POLICY "select_own_kyc" ON kyc_requests FOR SELECT
  TO anon, authenticated USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "insert_own_kyc" ON kyc_requests;
CREATE POLICY "insert_own_kyc" ON kyc_requests FOR INSERT
  TO anon, authenticated WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "update_own_kyc" ON kyc_requests;
CREATE POLICY "update_own_kyc" ON kyc_requests FOR UPDATE
  TO anon, authenticated USING (user_id = public.get_current_user_id()) WITH CHECK (user_id = public.get_current_user_id());

GRANT EXECUTE ON FUNCTION public.create_notification TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_id TO anon, authenticated;
