const ACCESS_TOKEN_KEY = 'kryzo_access_token';
const REFRESH_TOKEN_KEY = 'kryzo_refresh_token';

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) ?? sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY) ?? sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTokens(accessToken: string, refreshToken: string, remember = true): void {
  try {
    const storage = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    other.removeItem(ACCESS_TOKEN_KEY);
    other.removeItem(REFRESH_TOKEN_KEY);
  } catch { /* ignore */ }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch { /* ignore */ }
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const authFunctionUrl = `${supabaseUrl}/functions/v1/zonex-auth`;

async function authFetch(path: string, body?: Record<string, unknown>): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  };

  // For session endpoint, use user's access token
  const authToken = getAccessToken();
  if (authToken && path === 'session') {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${authFunctionUrl}/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });

  let data;
  try { data = await res.json(); } catch { throw new Error('Server error. Please try again.'); }

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

export const authApi = {
  // Send OTP for registration or password reset
  sendOtp: async (email: string, purpose: 'registration' | 'password_reset' = 'registration') => {
    return authFetch('send-otp', { email, purpose });
  },

  // Verify OTP (standalone)
  verifyOtp: async (email: string, otp: string, purpose: 'registration' | 'password_reset' = 'registration') => {
    return authFetch('verify-otp', { email, otp, purpose });
  },

  // Register step 1: store data + send OTP
  register: async (params: {
    fullName: string;
    username: string;
    email: string;
    phoneCountryCode: string;
    phoneNumber: string;
    password: string;
  }) => {
    return authFetch('register', params);
  },

  // Register step 2: verify OTP + create account
  completeRegistration: async (email: string, otp: string) => {
    return authFetch('complete-registration', { email, otp });
  },

  // Login
  login: async (identifier: string, password: string, remember = true) => {
    const data = await authFetch('login', { identifier, password });
    if (data.session) {
      setTokens(data.session.access_token, data.session.refresh_token, remember);
    }
    return data;
  },

  // Forgot password (sends OTP)
  forgotPassword: async (email: string) => {
    return authFetch('forgot-password', { email });
  },

  // Reset password with OTP
  resetPassword: async (email: string, otp: string, newPassword: string) => {
    return authFetch('reset-password', { email, otp, newPassword });
  },

  // Get current session
  getSession: async (): Promise<AuthUser | null> => {
    const token = getAccessToken();
    if (!token) return null;
    try {
      const res = await fetch(`${authFunctionUrl}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (res.status === 401) {
        clearTokens();
        return null;
      }

      if (!res.ok) return null;

      const data = await res.json();
      return data.success ? data.user : null;
    } catch {
      return null;
    }
  },

  // Refresh session
  refreshSession: async (): Promise<AuthUser | null> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const data = await authFetch('refresh-session', { refreshToken });
      if (data.session) {
        setTokens(data.session.access_token, data.session.refresh_token, true);
        return data.user;
      }
      return null;
    } catch {
      clearTokens();
      return null;
    }
  },

  // Logout
  logout: async () => {
    try {
      const token = getAccessToken();
      if (token) {
        await authFetch('logout', {});
      }
    } catch { /* ignore */ }
    clearTokens();
  },
};

// Legacy aliases for backward compatibility
export const getToken = getAccessToken;
