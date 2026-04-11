import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '@/api/client';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  loginWithGoogle: () => void;
  requestScope: (scope: string, pendingMessage?: string) => void;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = 'user';
const TOKEN_KEY = 'token';

function loadStored(): { user: User | null; token: string | null } {
  try {
    const userJson = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    const user = userJson ? (JSON.parse(userJson) as User) : null;
    return { user, token };
  } catch {
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: loadStored().user,
    loading: true,
    error: null,
  });

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  // ─── Google OAuth Login ─────────────────────────────────────────
  const loginWithGoogle = useCallback(() => {
    // Redirect to backend which will redirect to Google consent screen
    window.location.href = '/api/auth/google';
  }, []);

  // ─── Request Additional Scope (Incremental Auth) ────────────────
  const requestScope = useCallback((scope: string, pendingMessage?: string) => {
    // Store pending message so we can re-send after auth
    if (pendingMessage) {
      sessionStorage.setItem('pendingChatMessage', pendingMessage);
    }
    const token = localStorage.getItem(TOKEN_KEY);
    const params = new URLSearchParams({ scope });
    if (token) params.set('token', token);
    if (pendingMessage) params.set('pendingMessage', pendingMessage);

    window.location.href = `/api/auth/google/incremental?${params.toString()}`;
  }, []);

  // ─── Logout ─────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem('pendingChatMessage');
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  // ─── Refresh Profile (after incremental scope grant) ────────────
  const refreshProfile = useCallback(async () => {
    try {
      const res = await authApi.me();
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setState((s) => ({ ...s, user: res.user }));
    } catch {
      // ignore
    }
  }, []);

  // ─── On Mount: Check for OAuth callback params or verify session ─
  useEffect(() => {
    // Check if we're being redirected from OAuth callback page
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const userFromUrl = urlParams.get('user');
    const errorFromUrl = urlParams.get('error');

    if (errorFromUrl) {
      setState({ user: null, loading: false, error: `Authentication failed: ${errorFromUrl}` });
      return;
    }

    if (tokenFromUrl) {
      // Coming from OAuth callback — store token and user
      localStorage.setItem(TOKEN_KEY, tokenFromUrl);
      if (userFromUrl) {
        try {
          const parsedUser = JSON.parse(decodeURIComponent(userFromUrl)) as User;
          localStorage.setItem(USER_KEY, JSON.stringify(parsedUser));
          setState({ user: parsedUser, loading: false, error: null });
        } catch {
          setState((s) => ({ ...s, loading: false }));
        }
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // Normal mount — verify existing session
    const { token } = loadStored();
    if (!token) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    authApi
      .me()
      .then((res) => {
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        setState((s) => ({ ...s, user: res.user, loading: false }));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setState({ user: null, loading: false, error: null });
      });
  }, []);

  // ─── Listen for auth:logout events ──────────────────────────────
  useEffect(() => {
    const onLogout = () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setState({ user: null, loading: false, error: null });
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const value: AuthContextValue = {
    ...state,
    loginWithGoogle,
    requestScope,
    logout,
    clearError,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
