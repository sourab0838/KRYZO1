import { createClient } from '@supabase/supabase-js';
import { getAccessToken } from './authApi';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars missing. Check .env for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Custom fetch that injects the Supabase access token for RLS
const supabaseFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const token = getAccessToken();
  const headers = new Headers(init?.headers || {});

  // Add Authorization header with Bearer token for Supabase RLS
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: supabaseFetch as any,
  },
});

export type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type NotificationType =
  | 'registration' | 'login' | 'email_otp' | 'password_reset'
  | 'kyc' | 'wallet' | 'orders' | 'support'
  | 'listing_submitted' | 'listing_approved' | 'listing_rejected'
  | 'new_chat' | 'new_offer' | 'counter_offer'
  | 'payment_success' | 'payment_failed' | 'wallet_credited'
  | 'withdrawal_requested' | 'withdrawal_approved' | 'withdrawal_rejected'
  | 'order_created' | 'seller_delivered' | 'buyer_confirmed'
  | 'funds_released' | 'refund_completed'
  // New notification types for enhanced features
  | 'new_order' | 'payment_received' | 'payment_released' | 'refund'
  | 'kyc_approved' | 'kyc_rejected' | 'new_message' | 'seller_verification'
  | 'withdraw_approved' | 'withdraw_rejected' | 'account_sold' | 'account_purchased'
  | 'admin_announcement' | 'security_alert';

export interface Profile {
  id: string;
  full_name: string;
  username: string;
  phone_country_code: string;
  phone_number: string;
  email: string;
  avatar_url: string | null;
  kyc_status: KycStatus;
  verified_seller: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  sender: string;
  message: string;
  created_at: string;
}

export interface KycRequest {
  id: string;
  user_id: string;
  full_name: string;
  document_type: string;
  document_number: string;
  document_image_url: string | null;
  status: KycStatus;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  face_image_url?: string | null;
}

// ============================================================
// Marketplace types
// ============================================================

export type ListingStatus = 'pending' | 'approved' | 'rejected' | 'sold' | 'draft';

export interface AccountListingRow {
  id: string;
  seller_id: string;
  title: string;
  game: 'free-fire' | 'bgmi';
  uid: string;
  account_level: number;
  br_rank: string;
  cs_rank: string;
  evo_gun_level: number;
  prime_level: number;
  diamonds: number;
  price: number;
  original_price: number | null;
  description: string | null;
  seller_whatsapp: string;
  profile_image: string;
  status: ListingStatus;
  featured: boolean;
  trending: boolean;
  rejection_reason: string | null;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface AccountListingWithSeller extends AccountListingRow {
  seller?: Pick<Profile, 'id' | 'verified_seller' | 'username' | 'full_name' | 'avatar_url'> | null;
}

export interface ListingGalleryRow {
  id: string;
  listing_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

export interface WishlistRow {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
}

export interface CompareRow {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
}

export interface ListingReviewRow {
  id: string;
  reviewer_id: string;
  seller_id: string;
  listing_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ChatConversationRow {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_message: string | null;
  last_message_at: string | null;
  buyer_unread: number;
  seller_unread: number;
  created_at: string;
}

export type ChatMessageType = 'text' | 'image' | 'offer' | 'counter_offer' | 'system';
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: ChatMessageType;
  content: string;
  offer_amount: number | null;
  offer_status: OfferStatus | null;
  is_read: boolean;
  created_at: string;
}

export type OrderStatus = 'pending' | 'payment_successful' | 'awaiting_delivery' | 'buyer_reviewing' | 'completed' | 'cancelled' | 'disputed';

export interface KycFaceVerificationRow {
  id: string;
  user_id: string;
  kyc_request_id: string | null;
  face_image_url: string;
  verification_steps: Record<string, boolean> | null;
  created_at: string;
}

// ============================================================
// Payment & Escrow types (Step 3)
// ============================================================

export type TransactionType = 'deposit' | 'withdrawal' | 'escrow_hold' | 'escrow_release' | 'commission' | 'refund' | 'purchase' | 'sale';
export type TransactionDirection = 'credit' | 'debit';
export type TransactionStatus = 'success' | 'pending' | 'failed' | 'cancelled';

export interface WalletTransactionRow {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  direction: TransactionDirection;
  status: TransactionStatus;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  description: string | null;
  related_order_id: string | null;
  created_at: string;
}

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'rejected';

export interface WithdrawalRow {
  id: string;
  user_id: string;
  upi_id: string;
  amount: number;
  status: WithdrawalStatus;
  reason: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentConfig {
  key_id: string;
  payment_mode: 'test' | 'live';
  currency: string;
  company_name: string;
  is_configured: boolean;
}

export type EscrowStatus = 'none' | 'held' | 'released' | 'refunded' | 'disputed';
export type DeliveryStatus = 'pending' | 'delivered' | 'confirmed' | 'disputed';

export interface EscrowHoldRow {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  total_amount: number;
  platform_fee: number;
  seller_commission: number;
  seller_payout: number;
  status: 'held' | 'released' | 'refunded' | 'disputed';
  released_at: string | null;
  created_at: string;
}

// Extended OrderRow with Step 3 columns
export interface OrderRow {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: 'pending' | 'payment_successful' | 'awaiting_delivery' | 'buyer_reviewing' | 'completed' | 'cancelled' | 'disputed';
  seller_whatsapp_revealed: string | null;
  created_at: string;
  updated_at: string;
  buyer_payment_id?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  platform_fee?: number;
  seller_commission?: number;
  seller_payout?: number;
  escrow_status?: EscrowStatus;
  delivery_status?: DeliveryStatus;
}

// Extended Wallet with Step 3 columns
export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
  pending_balance?: number;
  total_earnings?: number;
  total_deposits?: number;
  total_withdrawals?: number;
}

// ============================================================
// Admin types (Step 4)
// ============================================================

export type AdminRole = 'super_admin' | 'moderator' | 'support_staff';

export interface AdminRoleRow {
  id: string;
  user_id: string;
  role: AdminRole;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: string;
  admin_id: string;
  admin_name: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  created_at: string;
}

export interface LoginHistoryRow {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  login_at: string;
}

export interface SupportSettingsRow {
  id: string;
  whatsapp_number: string;
  telegram_username: string;
  support_email: string;
  business_hours: string;
  auto_reply: string;
  is_configured: boolean;
  updated_at: string;
}

export interface LegalDocumentRow {
  id: string;
  doc_type: 'terms' | 'privacy' | 'refund' | 'seller_policy' | 'buyer_policy';
  title: string;
  content: string;
  updated_by: string | null;
  updated_at: string;
}

export interface FaqEntryRow {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminNotificationRow {
  id: string;
  admin_id: string | null;
  type: 'broadcast' | 'maintenance' | 'security' | 'push' | 'email';
  title: string;
  message: string;
  target_audience: 'all' | 'buyers' | 'sellers' | 'admins';
  is_active: boolean;
  created_at: string;
}

export interface DashboardStats {
  total_users: number;
  total_sellers: number;
  total_buyers: number;
  verified_sellers: number;
  pending_kyc: number;
  approved_kyc: number;
  rejected_kyc: number;
  active_listings: number;
  pending_listings: number;
  sold_listings: number;
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  disputed_orders: number;
  wallet_deposits: number;
  wallet_withdrawals: number;
  escrow_balance: number;
  buyer_fee_revenue: number;
  seller_commission_revenue: number;
  total_platform_revenue: number;
  daily_revenue: number;
  weekly_revenue: number;
  monthly_revenue: number;
  yearly_revenue: number;
}

// ============================================================
// Site Control Center types
// ============================================================

export interface SiteControlGeneral {
  website_name: string;
  logo_url: string;
  favicon_url: string;
  description: string;
  keywords: string;
  contact_email: string;
  contact_phone: string;
  language: string;
  currency: string;
  timezone: string;
}

export interface SiteControlHomepage {
  banner_image_url: string;
  hero_title: string;
  hero_subtitle: string;
  hero_button1_text: string;
  hero_button1_link: string;
  hero_button2_text: string;
  hero_button2_link: string;
  announcement_text: string;
  announcement_enabled: boolean;
  show_featured: boolean;
  show_trending: boolean;
  show_reviews: boolean;
  show_faq: boolean;
  show_stats: boolean;
}

export interface SiteControlPayment {
  min_topup: number;
  max_topup: number;
  min_withdrawal: number;
  max_withdrawal: number;
}

export interface SiteControlCommission {
  buyer_fee_percent: number;
  seller_commission_percent: number;
  referral_bonus_percent: number;
  coupon_discount_percent: number;
}

export interface SiteControlSupport {
  whatsapp_number: string;
  telegram_username: string;
  support_email: string;
  business_hours: string;
  auto_reply: string;
  live_chat_enabled: boolean;
}

export interface SiteControlSecurity {
  registration_enabled: boolean;
  email_otp_enabled: boolean;
  login_enabled: boolean;
  kyc_required: boolean;
  selling_enabled: boolean;
  buying_enabled: boolean;
  wallet_enabled: boolean;
  withdrawals_enabled: boolean;
  escrow_enabled: boolean;
  chat_enabled: boolean;
  maintenance_mode: boolean;
  force_logout: boolean;
}

export interface SiteControlNotifications {
  push_enabled: boolean;
  email_enabled: boolean;
  maintenance_notification: boolean;
  broadcast_enabled: boolean;
  promotional_enabled: boolean;
}

export interface SiteControlMarketplace {
  featured_count: number;
  trending_count: number;
  auto_listing_approval: boolean;
  auto_kyc_approval: boolean;
  max_gallery_images: number;
  min_gallery_images: number;
  listing_expiry_days: number;
}

export interface SiteControl {
  general: SiteControlGeneral;
  homepage: SiteControlHomepage;
  payment: SiteControlPayment;
  commission: SiteControlCommission;
  support: SiteControlSupport;
  security: SiteControlSecurity;
  notifications: SiteControlNotifications;
  marketplace: SiteControlMarketplace;
}

export interface BackupLogRow {
  id: string;
  type: 'manual' | 'scheduled' | 'restore';
  status: 'completed' | 'failed' | 'in_progress';
  file_name: string | null;
  file_size_bytes: number | null;
  triggered_by: string | null;
  triggered_by_name: string | null;
  created_at: string;
}

export type FraudType = 'spam_account' | 'fake_listing' | 'repeated_failed_payments' | 'suspicious_login' | 'fake_kyc' | 'multiple_accounts';
export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FraudFlagRow {
  id: string;
  user_id: string | null;
  type: FraudType;
  severity: FraudSeverity;
  description: string | null;
  auto_detected: boolean;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================
// Bank Details types
// ============================================================

export interface BankDetailsRow {
  id: string;
  user_id: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id: string | null;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Extended KYC Request with reupload
// ============================================================

export interface KycRequestExtended extends KycRequest {
  reupload_requested: boolean;
  reupload_reason: string | null;
  verification_video_url: string | null;
}

// ============================================================
// KYC Verification (new system)
// ============================================================

export type KycIdType = 'aadhaar' | 'pan' | 'passport' | 'voter_id' | 'driving_license';
export type KycVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface KycVerificationRow {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  country: string;
  id_type: KycIdType;
  id_number: string;
  front_image: string;
  back_image: string | null;
  selfie_image: string;
  status: KycVerificationStatus;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KycSubmissionWithUser extends KycVerificationRow {
  user_email: string | null;
  user_username: string | null;
  user_avatar_url: string | null;
}

// ============================================================
// Payment Gateway types
// ============================================================

export interface PaymentGatewayRow {
  id: string;
  gateway_name: string;
  display_name: string;
  api_key: string | null;
  api_secret: string | null;
  webhook_secret: string | null;
  is_enabled: boolean;
  sandbox_mode: boolean;
  currency: string;
  supports_refund: boolean;
  supports_partial_refund: boolean;
  min_amount: number;
  max_amount: number;
  sort_order: number;
  last_test_at: string | null;
  last_test_status: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Email Settings types
// ============================================================

export interface EmailSettingsRow {
  id: string;
  resend_api_key: string | null;
  sender_email: string | null;
  sender_name: string;
  otp_subject: string;
  otp_template: string;
  otp_expiry_minutes: number;
  welcome_email_enabled: boolean;
  welcome_subject: string;
  welcome_template: string | null;
  password_reset_template: string | null;
  is_configured: boolean;
}

// ============================================================
// GST Settings types
// ============================================================

export interface GstSettingsRow {
  id: string;
  gst_enabled: boolean;
  gst_percentage: number;
  gst_number: string | null;
  company_name: string | null;
  company_address: string | null;
  company_city: string | null;
  company_state: string | null;
  company_pincode: string | null;
  company_pan: string | null;
  invoice_prefix: string;
  invoice_starting_number: number;
  invoice_logo_url: string | null;
  invoice_footer_text: string;
  hsn_sac_code: string;
}

// ============================================================
// Payment Logs types
// ============================================================

export type PaymentEventType = 'payment_initiated' | 'payment_success' | 'payment_failed' | 'refund_initiated' | 'refund_success' | 'refund_failed' | 'webhook_received';
export type PaymentLogStatus = 'pending' | 'success' | 'failed' | 'cancelled';

export interface PaymentLogRow {
  id: string;
  gateway_name: string;
  gateway_transaction_id: string | null;
  order_id: string | null;
  user_id: string | null;
  amount: number;
  currency: string;
  event_type: PaymentEventType;
  status: PaymentLogStatus;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  processed_at: string | null;
  created_at: string;
}

// ============================================================
// User Activity Logs types
// ============================================================

export interface UserActivityLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  created_at: string;
}
