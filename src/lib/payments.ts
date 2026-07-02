import { getToken } from './authApi';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const paymentsUrl = `${supabaseUrl}/functions/v1/zonex-payments`;

async function payFetch(path: string, body: Record<string, unknown> = {}, method: 'POST' | 'GET' = 'POST') {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  };
  if (token) headers['x-zonex-token'] = token;

  const response = await fetch(`${paymentsUrl}${path}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export interface CreateOrderResult {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  company_name: string;
  payment_mode: string;
}

export interface CreatePurchaseResult {
  order_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  company_name: string;
  payment_mode: string;
  listing_title: string;
  seller_whatsapp: string;
  total_amount: number;
  platform_fee: number;
  seller_payout: number;
}

export interface VerifyResult {
  success: boolean;
  message: string;
  seller_whatsapp?: string;
}

export interface PaymentConfig {
  key_id: string;
  payment_mode: 'test' | 'live';
  currency: string;
  company_name: string;
  is_configured: boolean;
}

export const paymentApi = {
  getConfig: async (): Promise<PaymentConfig> => {
    return payFetch('/config', {}, 'GET');
  },

  createOrder: async (amount: number): Promise<CreateOrderResult> => {
    return payFetch('/create-order', { amount });
  },

  verifyPayment: async (params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    amount: number;
  }): Promise<VerifyResult> => {
    return payFetch('/verify-payment', params);
  },

  createPurchase: async (listing_id: string): Promise<CreatePurchaseResult> => {
    return payFetch('/create-purchase', { listing_id });
  },

  verifyPurchase: async (params: {
    order_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<VerifyResult> => {
    return payFetch('/verify-purchase', params);
  },

  markDelivered: async (order_id: string): Promise<VerifyResult> => {
    return payFetch('/mark-delivered', { order_id });
  },

  confirmDelivery: async (order_id: string): Promise<VerifyResult> => {
    return payFetch('/confirm-delivery', { order_id });
  },

  saveSettings: async (params: {
    razorpay_key_id: string;
    razorpay_key_secret: string;
    razorpay_webhook_secret?: string;
    payment_mode: 'test' | 'live';
    currency?: string;
    company_name?: string;
  }): Promise<{ success: boolean; message: string }> => {
    return payFetch('/save-settings', params);
  },

  // Load Razorpay checkout script
  loadRazorpayScript: (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.getElementById('razorpay-checkout-script')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
      document.body.appendChild(script);
    });
  },

  // Open Razorpay checkout for wallet top-up
  openCheckout: async (amount: number, user: { email: string; username: string }, onSuccess: (paymentId: string, orderId: string, signature: string) => void, onDismiss?: () => void) => {
    const order = await paymentApi.createOrder(amount);

    // Demo Mode: simulate successful payment without Razorpay
    if ((order as any).demo_mode) {
      const mockPaymentId = `demo_pay_${Date.now()}`;
      const mockSignature = 'demo_signature';
      setTimeout(() => onSuccess(mockPaymentId, order.order_id, mockSignature), 800);
      return;
    }

    await paymentApi.loadRazorpayScript();

    const rzp = new (window as any).Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: order.company_name,
      description: 'Wallet Top-up',
      order_id: order.order_id,
      prefill: {
        email: user.email,
        name: user.username,
      },
      theme: {
        color: '#D4AF37',
      },
      handler: (response: any) => {
        onSuccess(response.razorpay_payment_id, response.razorpay_order_id, response.razorpay_signature);
      },
      modal: {
        ondismiss: () => {
          onDismiss?.();
        },
      },
    });
    rzp.open();
  },

  // Open Razorpay checkout for account purchase
  openPurchaseCheckout: async (
    listingId: string,
    user: { email: string; username: string },
    onSuccess: (paymentId: string, orderId: string, signature: string, purchaseData: CreatePurchaseResult) => void,
    onDismiss?: () => void,
  ) => {
    const purchase = await paymentApi.createPurchase(listingId);

    // Demo Mode: simulate successful payment without Razorpay
    if ((purchase as any).demo_mode) {
      const mockPaymentId = `demo_pay_${Date.now()}`;
      const mockSignature = 'demo_signature';
      setTimeout(() => onSuccess(mockPaymentId, purchase.razorpay_order_id, mockSignature, purchase), 800);
      return;
    }

    await paymentApi.loadRazorpayScript();

    const rzp = new (window as any).Razorpay({
      key: purchase.key_id,
      amount: purchase.amount,
      currency: purchase.currency,
      name: purchase.company_name,
      description: `Purchase: ${purchase.listing_title}`,
      order_id: purchase.razorpay_order_id,
      prefill: {
        email: user.email,
        name: user.username,
      },
      theme: {
        color: '#D4AF37',
      },
      handler: (response: any) => {
        onSuccess(response.razorpay_payment_id, response.razorpay_order_id, response.razorpay_signature, purchase);
      },
      modal: {
        ondismiss: () => {
          onDismiss?.();
        },
      },
    });
    rzp.open();
  },
};
