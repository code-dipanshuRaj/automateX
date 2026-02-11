/**
 * API client — assumes backend routes to be implemented.
 * Base URL is proxied via Vite: /api -> orchestrator (e.g. localhost:3000).
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
    throw new Error((err as { message?: string }).message ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

// Auth (backend: POST /api/auth/login, /api/auth/register, GET /api/auth/me, POST /api/auth/logout)
export const authApi = {
  login: (payload: { email: string; password: string }) =>
    request<{ user: import('@/types').User; token?: string; expiresAt?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  register: (payload: { email: string; password: string; displayName?: string }) =>
    request<{ user: import('@/types').User; token?: string; expiresAt?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: () =>
    request<{ user: import('@/types').User }>('/auth/me'),

  logout: () =>
    request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
};

// Chat (backend: POST /api/chat/send, GET /api/chat/history?sessionId=, GET /api/chat/sessions)
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

// Plan (backend: POST /api/plan/approve, POST /api/plan/reject)
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
