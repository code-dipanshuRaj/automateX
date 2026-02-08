// Auth (backend to design: JWT or session)
export interface User {
  id: string;
  email: string;
  displayName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName?: string;
}

export interface AuthResponse {
  user: User;
  token?: string;
  expiresAt?: string;
}

// Chat & plan (backend: /api/chat/*, /api/plan/*)
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  plan?: PlanPayload | null;
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
}

// Session (backend: /api/session/*)
export interface SessionInfo {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  messageCount?: number;
}
