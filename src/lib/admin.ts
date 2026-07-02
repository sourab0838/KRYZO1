import { supabase, type AdminRole, type DashboardStats, type SiteControl } from './supabase';

export async function checkAdminRole(): Promise<AdminRole | null> {
  try {
    const { data } = await supabase.rpc('get_admin_role');
    return (data as AdminRole) ?? null;
  } catch {
    return null;
  }
}

export async function isAdmin(): Promise<boolean> {
  try {
    const { data } = await supabase.rpc('is_admin');
    return data === true;
  } catch {
    return false;
  }
}

export async function isSuperAdmin(): Promise<boolean> {
  try {
    const { data } = await supabase.rpc('is_super_admin');
    return data === true;
  } catch {
    return false;
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('admin_get_dashboard_stats');
  if (error) throw error;
  return data as DashboardStats;
}

export const adminApi = {
  updateKycStatus: async (kycId: string, status: string, rejectionReason?: string) => {
    return supabase.rpc('admin_update_kyc_status', {
      p_kyc_id: kycId, p_status: status, p_rejection_reason: rejectionReason ?? null,
    });
  },

  updateListingStatus: async (listingId: string, action: string, reason?: string) => {
    return supabase.rpc('admin_update_listing_status', {
      p_listing_id: listingId, p_action: action, p_reason: reason ?? null,
    });
  },

  updateUserStatus: async (userId: string, action: string, reason?: string) => {
    return supabase.rpc('admin_update_user_status', {
      p_user_id: userId, p_action: action, p_reason: reason ?? null,
    });
  },

  updateWithdrawalStatus: async (withdrawalId: string, status: string, reason?: string) => {
    return supabase.rpc('admin_update_withdrawal_status', {
      p_withdrawal_id: withdrawalId, p_status: status, p_reason: reason ?? null,
    });
  },

  releaseEscrow: async (orderId: string, reason?: string) => {
    return supabase.rpc('admin_release_escrow', { p_order_id: orderId, p_reason: reason ?? null });
  },

  refundEscrow: async (orderId: string, reason?: string) => {
    return supabase.rpc('admin_refund_escrow', { p_order_id: orderId, p_reason: reason ?? null });
  },

  broadcastNotification: async (type: string, title: string, message: string, targetAudience: string = 'all') => {
    return supabase.rpc('admin_broadcast_notification', {
      p_type: type, p_title: title, p_message: message, p_target_audience: targetAudience,
    });
  },

  updateLegalDoc: async (docType: string, title: string, content: string) => {
    return supabase.rpc('admin_update_legal_doc', { p_doc_type: docType, p_title: title, p_content: content });
  },

  updateSupportSettings: async (params: {
    whatsapp_number: string; telegram_username: string; support_email: string;
    business_hours: string; auto_reply: string;
  }) => {
    return supabase.rpc('admin_update_support_settings', params);
  },

  upsertFaq: async (params: {
    p_question: string; p_answer: string; p_category?: string;
    p_sort_order?: number; p_is_published?: boolean; p_id?: string | null;
  }) => {
    return supabase.rpc('admin_upsert_faq', {
      p_question: params.p_question, p_answer: params.p_answer,
      p_category: params.p_category ?? 'general', p_sort_order: params.p_sort_order ?? 0,
      p_is_published: params.p_is_published ?? true, p_id: params.p_id ?? null,
    });
  },

  deleteFaq: async (id: string) => {
    return supabase.rpc('admin_delete_faq', { p_id: id });
  },

  updateSiteSetting: async (key: string, value: string, description?: string) => {
    return supabase.rpc('admin_update_site_setting', { p_key: key, p_value: value, p_description: description ?? null });
  },

  assignRole: async (userId: string, role: string) => {
    return supabase.rpc('admin_assign_role', { p_user_id: userId, p_role: role });
  },

  revokeRole: async (userId: string) => {
    return supabase.rpc('admin_revoke_role', { p_user_id: userId });
  },

  getSiteControl: async (): Promise<SiteControl> => {
    const { data, error } = await supabase.rpc('get_site_control');
    if (error) throw error;
    return data as SiteControl;
  },

  updateSiteControl: async (category: string, values: Record<string, unknown>) => {
    return supabase.rpc('admin_update_site_control', {
      p_category: category,
      p_values: values,
    });
  },

  forceLogoutAll: async (): Promise<number> => {
    const { data, error } = await supabase.rpc('admin_force_logout_all');
    if (error) throw error;
    return data as number;
  },

  clearCache: async () => {
    return supabase.rpc('admin_clear_cache');
  },

  optimizeDatabase: async () => {
    return supabase.rpc('admin_optimize_database');
  },

  logBackup: async (type: string, status: string = 'completed', fileName?: string, fileSize?: number) => {
    return supabase.rpc('admin_log_backup', {
      p_type: type, p_status: status, p_file_name: fileName ?? null, p_file_size_bytes: fileSize ?? null,
    });
  },

  requestKycReupload: async (kycId: string, reason?: string) => {
    return supabase.rpc('admin_request_kyc_reupload', { p_kyc_id: kycId, p_reason: reason ?? null });
  },

  updateUser: async (userId: string, data: { fullName?: string; username?: string; phoneCountryCode?: string; phoneNumber?: string }) => {
    return supabase.rpc('admin_update_user', {
      p_user_id: userId,
      p_full_name: data.fullName ?? null,
      p_username: data.username ?? null,
      p_phone_country_code: data.phoneCountryCode ?? null,
      p_phone_number: data.phoneNumber ?? null,
    });
  },

  deleteUser: async (userId: string, reason?: string) => {
    return supabase.rpc('admin_delete_user', { p_user_id: userId, p_reason: reason ?? null });
  },

  updateOrderStatus: async (orderId: string, status: string, reason?: string) => {
    return supabase.rpc('admin_update_order_status', { p_order_id: orderId, p_status: status, p_reason: reason ?? null });
  },

  grantVerifiedSeller: async (userId: string, reason?: string) => {
    return supabase.rpc('admin_grant_verified_seller', { p_user_id: userId, p_reason: reason ?? null });
  },

  revokeVerifiedSeller: async (userId: string, reason?: string) => {
    return supabase.rpc('admin_revoke_verified_seller', { p_user_id: userId, p_reason: reason ?? null });
  },

  getWalletsOverview: async () => {
    const { data, error } = await supabase.rpc('admin_get_wallets_overview');
    if (error) throw error;
    return data as { user_id: string; balance: number; pending_balance: number; total_earnings: number; total_deposits: number; total_withdrawals: number; updated_at: string; user: { full_name: string; username: string; email: string } }[];
  },

  getOrders: async (status?: string, limit: number = 50, offset: number = 0) => {
    const { data, error } = await supabase.rpc('admin_get_orders', { p_status: status ?? null, p_limit: limit, p_offset: offset });
    if (error) throw error;
    return data;
  },

  getOrderDetails: async (orderId: string) => {
    const { data, error } = await supabase.rpc('admin_get_order_details', { p_order_id: orderId });
    if (error) throw error;
    return data;
  },

  getBankDetails: async (userId: string) => {
    const { data, error } = await supabase.rpc('admin_get_bank_details', { p_user_id: userId });
    if (error) throw error;
    return data;
  },

  verifyBankDetails: async (userId: string, verified: boolean) => {
    return supabase.rpc('admin_verify_bank_details', { p_user_id: userId, p_verified: verified });
  },

  // Payment Gateways
  getPaymentGateways: async () => {
    const { data, error } = await supabase.rpc('admin_get_payment_gateways');
    if (error) throw error;
    return data;
  },

  updatePaymentGateway: async (gatewayId: string, params: {
    display_name?: string;
    api_key?: string;
    api_secret?: string;
    webhook_secret?: string;
    is_enabled?: boolean;
    sandbox_mode?: boolean;
    currency?: string;
    supports_refund?: boolean;
    supports_partial_refund?: boolean;
    min_amount?: number;
    max_amount?: number;
    sort_order?: number;
  }) => {
    return supabase.rpc('admin_update_payment_gateway', {
      p_id: gatewayId,
      p_display_name: params.display_name ?? null,
      p_api_key: params.api_key ?? null,
      p_api_secret: params.api_secret ?? null,
      p_webhook_secret: params.webhook_secret ?? null,
      p_is_enabled: params.is_enabled ?? null,
      p_sandbox_mode: params.sandbox_mode ?? null,
      p_currency: params.currency ?? null,
      p_supports_refund: params.supports_refund ?? null,
      p_supports_partial_refund: params.supports_partial_refund ?? null,
      p_min_amount: params.min_amount ?? null,
      p_max_amount: params.max_amount ?? null,
      p_sort_order: params.sort_order ?? null,
    });
  },

  testPaymentGateway: async (gatewayId: string) => {
    const { data, error } = await supabase.rpc('admin_test_payment_gateway', { p_gateway_id: gatewayId });
    if (error) throw error;
    return data as { success: boolean; message: string; gateway: string; mode: string };
  },

  // Email Settings
  getEmailSettings: async () => {
    const { data, error } = await supabase.rpc('admin_get_email_settings');
    if (error) throw error;
    return data;
  },

  updateEmailSettings: async (params: {
    resend_api_key?: string;
    sender_email?: string;
    sender_name?: string;
    otp_subject?: string;
    otp_template?: string;
    otp_expiry_minutes?: number;
    welcome_email_enabled?: boolean;
    welcome_subject?: string;
    welcome_template?: string;
    password_reset_template?: string;
  }) => {
    return supabase.rpc('admin_update_email_settings', {
      p_resend_api_key: params.resend_api_key ?? null,
      p_sender_email: params.sender_email ?? null,
      p_sender_name: params.sender_name ?? null,
      p_otp_subject: params.otp_subject ?? null,
      p_otp_template: params.otp_template ?? null,
      p_otp_expiry_minutes: params.otp_expiry_minutes ?? null,
      p_welcome_email_enabled: params.welcome_email_enabled ?? null,
      p_welcome_subject: params.welcome_subject ?? null,
      p_welcome_template: params.welcome_template ?? null,
      p_password_reset_template: params.password_reset_template ?? null,
    });
  },

  // GST Settings
  getGstSettings: async () => {
    const { data, error } = await supabase.rpc('admin_get_gst_settings');
    if (error) throw error;
    return data;
  },

  updateGstSettings: async (params: {
    gst_enabled?: boolean;
    gst_percentage?: number;
    gst_number?: string;
    company_name?: string;
    company_address?: string;
    company_city?: string;
    company_state?: string;
    company_pincode?: string;
    company_pan?: string;
    invoice_prefix?: string;
    invoice_starting_number?: number;
    invoice_logo_url?: string;
    invoice_footer_text?: string;
    hsn_sac_code?: string;
  }) => {
    return supabase.rpc('admin_update_gst_settings', {
      p_gst_enabled: params.gst_enabled ?? null,
      p_gst_percentage: params.gst_percentage ?? null,
      p_gst_number: params.gst_number ?? null,
      p_company_name: params.company_name ?? null,
      p_company_address: params.company_address ?? null,
      p_company_city: params.company_city ?? null,
      p_company_state: params.company_state ?? null,
      p_company_pincode: params.company_pincode ?? null,
      p_company_pan: params.company_pan ?? null,
      p_invoice_prefix: params.invoice_prefix ?? null,
      p_invoice_starting_number: params.invoice_starting_number ?? null,
      p_invoice_logo_url: params.invoice_logo_url ?? null,
      p_invoice_footer_text: params.invoice_footer_text ?? null,
      p_hsn_sac_code: params.hsn_sac_code ?? null,
    });
  },

  // Payment Logs
  getPaymentLogs: async (params?: {
    gateway_name?: string;
    event_type?: string;
    status?: string;
    user_id?: string;
    limit?: number;
    offset?: number;
  }) => {
    const { data, error } = await supabase.rpc('admin_get_payment_logs', {
      p_gateway_name: params?.gateway_name ?? null,
      p_event_type: params?.event_type ?? null,
      p_status: params?.status ?? null,
      p_user_id: params?.user_id ?? null,
      p_limit: params?.limit ?? 50,
      p_offset: params?.offset ?? 0,
    });
    if (error) throw error;
    return data;
  },

  getPaymentLogsSummary: async () => {
    const { data, error } = await supabase.rpc('admin_get_payment_logs_summary');
    if (error) throw error;
    return data;
  },

  // User Activity Logs
  getUserActivityLogs: async (params?: {
    user_id?: string;
    action?: string;
    entity_type?: string;
    limit?: number;
    offset?: number;
  }) => {
    const { data, error } = await supabase.rpc('admin_get_user_activity_logs', {
      p_user_id: params?.user_id ?? null,
      p_action: params?.action ?? null,
      p_entity_type: params?.entity_type ?? null,
      p_limit: params?.limit ?? 50,
      p_offset: params?.offset ?? 0,
    });
    if (error) throw error;
    return data;
  },
};
