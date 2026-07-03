-- ============================================================
-- ADMIN FUNCTIONS (continued)
-- ============================================================

-- Update legal document
CREATE OR REPLACE FUNCTION admin_update_legal_doc(
  p_doc_type text,
  p_title text,
  p_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO legal_documents (doc_type, title, content, updated_at)
  VALUES (p_doc_type, p_title, p_content, now())
  ON CONFLICT (doc_type) DO UPDATE SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    updated_at = now();
END;
$$;

-- Update support settings
CREATE OR REPLACE FUNCTION admin_update_support_settings(
  p_whatsapp_number text,
  p_telegram_username text,
  p_support_email text,
  p_business_hours text,
  p_auto_reply text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO support_settings (whatsapp_number, telegram_username, support_email, business_hours, auto_reply)
  VALUES (p_whatsapp_number, p_telegram_username, p_support_email, p_business_hours, p_auto_reply)
  ON CONFLICT ON CONSTRAINT support_settings_pkey DO UPDATE SET
    whatsapp_number = EXCLUDED.whatsapp_number,
    telegram_username = EXCLUDED.telegram_username,
    support_email = EXCLUDED.support_email,
    business_hours = EXCLUDED.business_hours,
    auto_reply = EXCLUDED.auto_reply;
END;
$$;

-- Upsert FAQ
CREATE OR REPLACE FUNCTION admin_upsert_faq(
  p_question text,
  p_answer text,
  p_category text DEFAULT 'general',
  p_sort_order integer DEFAULT 0,
  p_is_published boolean DEFAULT true,
  p_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE faq_entries SET
      question = p_question,
      answer = p_answer,
      category = p_category,
      sort_order = p_sort_order,
      is_published = p_is_published,
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO faq_entries (question, answer, category, sort_order, is_published)
    VALUES (p_question, p_answer, p_category, p_sort_order, p_is_published)
    RETURNING id INTO v_id;
  END IF;
  
  RETURN v_id;
END;
$$;

-- Delete FAQ
CREATE OR REPLACE FUNCTION admin_delete_faq(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM faq_entries WHERE id = p_id;
END;
$$;

-- Update site setting
CREATE OR REPLACE FUNCTION admin_update_site_setting(
  p_key text,
  p_value text,
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO website_settings (key, value, description)
  VALUES (p_key, p_value, p_description)
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = COALESCE(EXCLUDED.description, website_settings.description),
    updated_at = now();
END;
$$;

-- Assign role
CREATE OR REPLACE FUNCTION admin_assign_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin_roles (user_id, role) VALUES (p_user_id, p_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

-- Revoke role
CREATE OR REPLACE FUNCTION admin_revoke_role(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM admin_roles WHERE user_id = p_user_id;
END;
$$;

-- Get site control
CREATE OR REPLACE FUNCTION get_site_control()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'general', COALESCE((SELECT json_object_agg(key, value) FROM website_settings WHERE key LIKE 'general_%'), '{}'::json),
    'homepage', COALESCE((SELECT json_object_agg(key, value) FROM website_settings WHERE key LIKE 'homepage_%'), '{}'::json),
    'payment', COALESCE((SELECT json_object_agg(key, value) FROM website_settings WHERE key LIKE 'payment_%'), '{}'::json),
    'commission', COALESCE((SELECT json_object_agg(key, value) FROM website_settings WHERE key LIKE 'commission_%'), '{}'::json),
    'support', COALESCE((SELECT json_object_agg(key, value) FROM website_settings WHERE key LIKE 'support_%'), '{}'::json),
    'security', COALESCE((SELECT json_object_agg(key, value) FROM website_settings WHERE key LIKE 'security_%'), '{}'::json),
    'notifications', COALESCE((SELECT json_object_agg(key, value) FROM website_settings WHERE key LIKE 'notifications_%'), '{}'::json),
    'marketplace', COALESCE((SELECT json_object_agg(key, value) FROM website_settings WHERE key LIKE 'marketplace_%'), '{}'::json)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Update site control
CREATE OR REPLACE FUNCTION admin_update_site_control(
  p_category text,
  p_values jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  key text;
  value text;
BEGIN
  FOR key, value IN SELECT * FROM jsonb_each_text(p_values)
  LOOP
    PERFORM admin_update_site_setting(p_category || '_' || key, value, NULL);
  END LOOP;
END;
$$;

-- Force logout all
CREATE OR REPLACE FUNCTION admin_force_logout_all()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count integer;
BEGIN
  DELETE FROM auth_sessions;
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN count;
END;
$$;

-- Clear cache (placeholder)
CREATE OR REPLACE FUNCTION admin_clear_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NULL;
END;
$$;

-- Optimize database
CREATE OR REPLACE FUNCTION admin_optimize_database()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  VACUUM ANALYZE account_listings;
  VACUUM ANALYZE orders;
  VACUUM ANALYZE profiles;
  VACUUM ANALYZE wallets;
  VACUUM ANALYZE wallet_transactions;
END;
$$;

-- Log backup
CREATE OR REPLACE FUNCTION admin_log_backup(
  p_type text,
  p_status text,
  p_file_name text DEFAULT NULL,
  p_file_size_bytes integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO backup_logs (type, status, file_name, file_size_bytes)
  VALUES (p_type, p_status, p_file_name, p_file_size_bytes);
END;
$$;

-- Update user
CREATE OR REPLACE FUNCTION admin_update_user(
  p_user_id uuid,
  p_full_name text DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_phone_country_code text DEFAULT NULL,
  p_phone_number text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET
    full_name = COALESCE(p_full_name, full_name),
    username = COALESCE(p_username, username),
    phone_country_code = COALESCE(p_phone_country_code, phone_country_code),
    phone_number = COALESCE(p_phone_number, phone_number),
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Delete user (soft delete)
CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET 
    deleted_at = now(),
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Update order status
CREATE OR REPLACE FUNCTION admin_update_order_status(
  p_order_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE orders SET 
    status = p_status,
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;

-- Grant verified seller
CREATE OR REPLACE FUNCTION admin_grant_verified_seller(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET 
    verified_seller = true,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Revoke verified seller
CREATE OR REPLACE FUNCTION admin_revoke_verified_seller(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET 
    verified_seller = false,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;