-- ============================================================
-- KYC Verification System - Complete Rebuild
-- ============================================================

-- 1. Create kyc_verifications table
CREATE TABLE IF NOT EXISTS public.kyc_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  date_of_birth date NOT NULL,
  country text NOT NULL DEFAULT 'India',
  id_type text NOT NULL CHECK (id_type IN ('aadhaar', 'pan', 'passport', 'voter_id', 'driving_license')),
  id_number text NOT NULL,
  front_image text NOT NULL,
  back_image text,
  selfie_image text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user_id ON public.kyc_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON public.kyc_verifications(status);

-- Enable RLS
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own KYC
DROP POLICY IF EXISTS "select_own_kyc_verifications" ON public.kyc_verifications;
CREATE POLICY "select_own_kyc_verifications" ON public.kyc_verifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_kyc_verifications" ON public.kyc_verifications;
CREATE POLICY "insert_own_kyc_verifications" ON public.kyc_verifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_kyc_verifications" ON public.kyc_verifications;
CREATE POLICY "update_own_kyc_verifications" ON public.kyc_verifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_kyc_verifications" ON public.kyc_verifications;
CREATE POLICY "delete_own_kyc_verifications" ON public.kyc_verifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 2. Create admin_roles table (needed for admin functions)
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'moderator' CHECK (role IN ('super_admin', 'moderator', 'support_staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Admin roles: users can read their own role, admins can read all
DROP POLICY IF EXISTS "select_own_admin_role" ON public.admin_roles;
CREATE POLICY "select_own_admin_role" ON public.admin_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. Admin RPC functions
CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM admin_roles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM admin_roles WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

-- Admin: get all KYC submissions with user info
CREATE OR REPLACE FUNCTION public.admin_get_kyc_submissions()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  date_of_birth date,
  country text,
  id_type text,
  id_number text,
  front_image text,
  back_image text,
  selfie_image text,
  status text,
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_email text,
  user_username text,
  user_avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    k.id, k.user_id, k.full_name, k.date_of_birth, k.country,
    k.id_type, k.id_number, k.front_image, k.back_image, k.selfie_image,
    k.status, k.rejection_reason, k.submitted_at, k.reviewed_at, k.reviewed_by,
    k.created_at, k.updated_at,
    u.email AS user_email,
    p.username AS user_username,
    p.avatar_url AS user_avatar_url
  FROM kyc_verifications k
  LEFT JOIN auth.users u ON u.id = k.user_id
  LEFT JOIN profiles p ON p.id = k.user_id
  ORDER BY k.created_at DESC;
$$;

-- Admin: update KYC status (approve/reject)
CREATE OR REPLACE FUNCTION public.admin_update_kyc_status(
  p_kyc_id uuid,
  p_status text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS(SELECT 1 FROM admin_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Update KYC record
  UPDATE kyc_verifications
  SET status = p_status,
      rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  WHERE id = p_kyc_id;

  -- Update user profile kyc_status
  UPDATE profiles
  SET kyc_status = CASE 
      WHEN p_status = 'approved' THEN 'approved'::kyc_status
      WHEN p_status = 'rejected' THEN 'rejected'::kyc_status
      ELSE 'pending'::kyc_status
    END,
    verified_seller = CASE WHEN p_status = 'approved' THEN true ELSE false END,
    updated_at = now()
  WHERE id = (SELECT user_id FROM kyc_verifications WHERE id = p_kyc_id);
END;
$$;

-- 4. Create KYC storage bucket (via insert into storage.buckets)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can only access their own KYC folder
DROP POLICY IF EXISTS "kyc_storage_select_own" ON storage.objects;
CREATE POLICY "kyc_storage_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "kyc_storage_insert_own" ON storage.objects;
CREATE POLICY "kyc_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "kyc_storage_update_own" ON storage.objects;
CREATE POLICY "kyc_storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Grant admin access to all KYC storage
DROP POLICY IF EXISTS "kyc_storage_admin_select_all" ON storage.objects;
CREATE POLICY "kyc_storage_admin_select_all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents' 
    AND EXISTS(SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
  );

-- 6. Add updated_at trigger for kyc_verifications
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_kyc_verifications_updated_at ON public.kyc_verifications;
CREATE TRIGGER trigger_kyc_verifications_updated_at
  BEFORE UPDATE ON public.kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
