import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, type Profile } from './supabase';
import { authApi, getAccessToken, clearTokens, type AuthUser } from './authApi';

interface AuthContextValue {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  refreshUser: async () => null,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    setProfile(data as Profile | null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await loadProfile(user.id);
  }, [user?.id, loadProfile]);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    try {
      const sessionUser = await authApi.getSession();
      if (!sessionUser) {
        clearTokens();
      }
      setUser(sessionUser);
      if (sessionUser) {
        await loadProfile(sessionUser.id);
      } else {
        setProfile(null);
      }
      return sessionUser;
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = getAccessToken();
        if (!token) {
          setLoading(false);
          return;
        }
        const sessionUser = await authApi.getSession();
        if (!mounted) return;
        setUser(sessionUser);
        if (sessionUser) {
          await loadProfile(sessionUser.id);
        } else {
          clearTokens();
        }
      } catch {
        /* loading completes regardless of session fetch success */
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { authApi, clearTokens };
