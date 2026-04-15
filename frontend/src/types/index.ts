// ─── Auth ────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  grantedScopes?: string[];
}

export interface AuthResponse {
  user: User;
  token?: string;
  expiresAt?: string;
}

// ─── Chat & Plan ────────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant' | 'system';

export interface AuthRequiredPayload {
  status: 'auth_required';
  requiredScope: string;
  scopeLabel: string;
  originalMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  plan?: PlanPayload | null;
  authRequired?: AuthRequiredPayload | null;
}

export interface PlanStep {
  action: string;
  params?: Record<string, unknown>;
  description?: string;
}

export interface PlanPayload {
  id: string;
  steps: PlanStep[];
  summary?: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
}

export interface SendMessagePayload {
  text: string;
  sessionId?: string;
}

export interface SendMessageResponse {
  message: ChatMessage;
  plan?: PlanPayload | null;
  sessionId: string;
  authRequired?: AuthRequiredPayload | null;
}

// ─── Session ────────────────────────────────────────────────────────
export interface SessionInfo {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  messageCount?: number;
}

// ─── Scope Metadata ─────────────────────────────────────────────────
export const SCOPE_META: Record<string, { label: string; icon: string; description: string }> = {
  'https://www.googleapis.com/auth/calendar': {
    label: 'Google Calendar',
    icon: '📅',
    description: 'Create, view, and manage your calendar events',
  },
  'https://www.googleapis.com/auth/gmail.send': {
    label: 'Gmail',
    icon: '✉️',
    description: 'Send emails on your behalf',
  },
  'https://www.googleapis.com/auth/tasks': {
    label: 'Google Tasks',
    icon: '📋',
    description: 'Create and manage your tasks',
  },
};
