/**
 * API client — backend routes proxied via Vite: /api -> orchestrator.
 */

const API_BASE = '/api';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth:logout'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const errorBody = err as { error?: { message?: string }, message?: string };
    throw new Error(errorBody.error?.message || errorBody.message || 'Request failed');
  }
  return res.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────
export const authApi = {
  /** GET /api/auth/me — fetch current user profile + granted scopes */
  me: () =>
    request<{ user: import('@/types').User }>('/auth/me'),

  /** GET /api/auth/profile — same as me */
  profile: () =>
    request<{ user: import('@/types').User }>('/auth/profile'),

  /** POST /api/auth/logout */
  logout: () =>
    request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  /** POST /api/auth/refresh */
  refresh: (token: string) =>
    request<{ newToken: string; expiresIn: number }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};

// ─── Chat ────────────────────────────────────────────────────────────
export const chatApi = {
  sendMessage: (payload: { text: string; sessionId?: string }) =>
    request<import('@/types').SendMessageResponse>('/chat/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getHistory: (sessionId: string) =>
    request<{ messages: import('@/types').ChatMessage[] }>(`/chat/history?sessionId=${encodeURIComponent(sessionId)}`),

  getSessions: () =>
    request<{ sessions: import('@/types').SessionInfo[] }>('/chat/sessions'),
};

// ─── Plan ────────────────────────────────────────────────────────────
export const planApi = {
  approve: (planId: string) =>
    request<{ plan: import('@/types').PlanPayload }>('/plan/approve', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    }),

  reject: (planId: string) =>
    request<{ ok: boolean }>('/plan/reject', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    }),
};

// ─── Connectors ──────────────────────────────────────────────────────
export const connectorsApi = {
  status: () =>
    request<{
      google_calendar: boolean;
      gmail: boolean;
      google_tasks: boolean;
      grantedScopes: string[];
    }>('/connectors/status'),
};
