-- Drop and recreate admin_get_kyc_submissions function with correct return type
DROP FUNCTION IF EXISTS admin_get_kyc_submissions();

CREATE OR REPLACE FUNCTION admin_get_kyc_submissions()
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
  user_email text,
  user_username text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kv.id,
    kv.user_id,
    kv.full_name,
    kv.date_of_birth,
    kv.country,
    kv.id_type,
    kv.id_number,
    kv.front_image,
    kv.back_image,
    kv.selfie_image,
    kv.status,
    kv.rejection_reason,
    kv.submitted_at,
    kv.reviewed_at,
    p.email as user_email,
    p.username as user_username
  FROM kyc_verifications kv
  LEFT JOIN profiles p ON p.id = kv.user_id
  ORDER BY kv.submitted_at DESC NULLS LAST;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_get_kyc_submissions TO authenticated;