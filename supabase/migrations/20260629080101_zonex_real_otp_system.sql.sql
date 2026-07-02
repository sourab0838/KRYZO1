/*
# Zonex Real OTP System

## Overview
Implements a real 6-digit OTP email verification system using Resend API.
- Registration data is stored temporarily before verification
- OTP is generated, stored securely with 5-minute expiry
- Only after successful OTP verification is the Supabase Auth user created

## New Tables
1. `pending_registrations` — Stores registration data before email verification
*/

-- ============================================================
-- PENDING REGISTRATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  username text NOT NULL,
  full_name text NOT NULL,
  phone_country_code text NOT NULL DEFAULT '+91',
  phone_number text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires ON pending_registrations(expires_at);

ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;

-- Clean up expired pending registrations periodically
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_registrations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM pending_registrations WHERE expires_at < now();
  DELETE FROM otp_codes WHERE expires_at < now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_pending_registrations TO postgres;
