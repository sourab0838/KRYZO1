-- Add new notification types to the enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_order';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_received';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_released';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'refund';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'kyc_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'kyc_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_message';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'seller_verification';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdraw_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdraw_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_sold';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_purchased';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_announcement';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'security_alert';