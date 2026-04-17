import { ConversationContext, ConversationMessage, ConversationState } from '../types';
import { getSession, updateContext } from './sessionService';

export async function addMessage(
  sessionId: string,
  message: ConversationMessage,
): Promise<ConversationContext> {
  const existing = await getSession(sessionId);
  if (!existing) {
    throw new Error('Session not found');
  }
  const current = existing.context ?? {
    userId: existing.session.userId,
    sessionId,
    state: 'idle' as ConversationState,
    messages: [],
    metadata: {},
  };
  const messages = [...current.messages, message];
  return updateContext(sessionId, { ...current, messages });
}

export async function updateState(sessionId: string, state: ConversationState): Promise<ConversationContext> {
  const existing = await getSession(sessionId);
  if (!existing) {
    throw new Error('Session not found');
  }
  const current = existing.context ?? {
    userId: existing.session.userId,
    sessionId,
    state: 'idle' as ConversationState,
    messages: [],
    metadata: {},
  };
  return updateContext(sessionId, { ...current, state });
}

export async function getPlanState(sessionId: string): Promise<{
  state: ConversationState;
  plan: unknown;
}> {
  const existing = await getSession(sessionId);
  if (!existing || !existing.context) {
    return { state: 'idle', plan: null };
  }
  const { state, plan } = existing.context;
  return { state, plan };
}

export async function clearContext(sessionId: string): Promise<ConversationContext> {
  const existing = await getSession(sessionId);
  if (!existing) {
    throw new Error('Session not found');
  }
  const cleared: ConversationContext = {
    userId: existing.session.userId,
    sessionId,
    state: 'idle',
    messages: [],
    metadata: {},
  };
  return updateContext(sessionId, cleared);
}

