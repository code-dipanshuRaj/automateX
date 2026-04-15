// ─── User (Google OAuth) ────────────────────────────────────────────
export interface UserDoc {
  _id: string; // UUID
  googleId: string; // Google sub claim
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role: 'user' | 'admin';

  // OAuth tokens (single set for all Google APIs)
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date; // when the access_token expires
  grantedScopes: string[]; // scopes the user has consented to

  createdAt: Date;
  updatedAt: Date;
}

// ─── Google Tokens (from OAuth exchange) ────────────────────────────
export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number; // epoch ms
  scope?: string; // space-separated scopes
  id_token?: string;
}

// ─── Conversation ───────────────────────────────────────────────────
export type ConversationState = 'idle' | 'processing' | 'approval_needed' | 'executing' | 'completed';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO string
  authRequired?: AuthRequiredPayload | null;
  plan?: {
    id: string;
    steps: PlanStep[];
    summary: string;
    status: string;
  } | null;
}

export interface ConversationContext {
  userId: string;
  sessionId: string;
  state: ConversationState;
  messages: ConversationMessage[];
  plan?: unknown;
  metadata?: Record<string, unknown>;
}

export interface ChatSessionDoc {
  _id: string; // sessionId
  userId: string;
  messages: ConversationMessage[];
  lastActivityAt: Date;
  createdAt: Date;
}

// ─── Session ────────────────────────────────────────────────────────
export interface SessionDoc {
  _id: string; // sessionId
  userId: string;
  token: string;
  expiresAt: Date;
  context: ConversationContext | null;
  lastActivity: Date;
  createdAt: Date;
}

export type PlanStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'completed';

export interface PlanStep {
  action: string;
  args: Record<string, unknown>;
  description?: string;
}

export interface PlanDoc {
  id: string;
  userId: string;
  sessionId: string;
  steps: PlanStep[];
  summary: string;
  status: PlanStatus;
  /** The raw Gemini function-call parts, needed to resume the chat after approval */
  rawFunctionCalls: Array<{ name: string; args: Record<string, unknown> }>;
  /** The Gemini conversation history snapshot so we can continue the chat */
  chatHistorySnapshot: unknown[];
  createdAt: Date;
}

// ─── JWT ────────────────────────────────────────────────────────────
export interface JwtPayload {
  sub: string; // userId
  role: 'user' | 'admin';
  sid: string; // sessionId
  email?: string;
  googleId?: string;
  iat?: number;
  exp?: number;
}

// ─── Connectors ─────────────────────────────────────────────────────
export type ConnectorType = 'google_calendar' | 'gmail' | 'google_tasks' | 'todo';
export type TaskType = 'calendar' | 'email' | 'google_tasks' | 'todo';

export interface TaskDoc {
  _id: string;
  planId: string;
  type: TaskType;
  payload: unknown;
  result?: unknown;
  connectorResponse?: unknown;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  createdAt: Date;
}

// ─── Tool Calling ───────────────────────────────────────────────────
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AuthRequiredPayload {
  status: 'auth_required';
  requiredScope: string;
  scopeLabel: string; // e.g. "Google Calendar"
  originalMessage?: string;
}

// ─── Scope Metadata ─────────────────────────────────────────────────
export const SCOPE_MAP: Record<string, { label: string; description: string }> = {
  'https://www.googleapis.com/auth/calendar': {
    label: 'Google Calendar',
    description: 'Create, view, and manage your calendar events',
  },
  'https://www.googleapis.com/auth/gmail.send': {
    label: 'Gmail',
    description: 'Send emails on your behalf',
  },
  'https://www.googleapis.com/auth/tasks': {
    label: 'Google Tasks',
    description: 'Create and manage your tasks',
  },
};
