-- Create KYC documents storage bucket for videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own KYC videos
CREATE POLICY "users_upload_own_kyc" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to read their own KYC files
CREATE POLICY "users_read_own_kyc" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow service role full access (for admin review)
CREATE POLICY "service_role_kyc_full" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'kyc-documents')
  WITH CHECK (bucket_id = 'kyc-documents');