import { randomUUID } from 'crypto';
import { getDatabase } from '../db/mongo';
import { cacheDel, cacheSet, cacheGet, getRedisClient, redisKeys } from '../db/redis';
import { logger } from '../utils/logger';
import type { ConversationContext, SessionDoc } from '../types';

const SESSION_TTL_SECONDS = 24 * 60 * 60;
const MAX_SESSIONS_PER_USER = 5;
const MAX_MESSAGES_PER_SESSION = 50;

export async function createSession(userId: string, token: string): Promise<{ sessionId: string; createdAt: Date }> {
  const db = await getDatabase();
  const sessions = db.collection<SessionDoc>('sessions');
  const now = new Date();

  // Enforce max sessions per user (evict oldest)
  const existing = await sessions
    .find({ userId })
    .sort({ createdAt: 1 })
    .toArray();
  if (existing.length >= MAX_SESSIONS_PER_USER) {
    const toRemove = existing.slice(0, existing.length - MAX_SESSIONS_PER_USER + 1);
    const ids = toRemove.map((s) => s._id);
    await sessions.deleteMany({ _id: { $in: ids } });
    for (const s of toRemove) {
      await cacheDel(redisKeys.session(s._id));
      await cacheDel(redisKeys.userContext(s.userId));
    }
  }

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const context: ConversationContext = {
    userId,
    sessionId,
    state: 'idle',
    messages: [],
    metadata: {},
  };

  await sessions.insertOne({
    _id: sessionId,
    userId,
    token,
    expiresAt,
    context,
    lastActivity: now,
    createdAt: now,
  } as SessionDoc);

  await cacheSet(redisKeys.session(sessionId), { userId, token }, SESSION_TTL_SECONDS);
  await cacheSet(redisKeys.userContext(userId), context, SESSION_TTL_SECONDS);

  logger.info('session_created', { userId, sessionId });

  return { sessionId, createdAt: now };
}

export async function getSession(
  sessionId: string,
): Promise<{ session: SessionDoc; context: ConversationContext | null } | null> {
  const db = await getDatabase();
  const sessions = db.collection<SessionDoc>('sessions');

  const session = await sessions.findOne({ _id: sessionId });
  if (!session) return null;

  const cachedContext = await cacheGet<ConversationContext>(redisKeys.userContext(session.userId));
  const context = cachedContext ?? session.context;
  return { session, context };
}

export async function updateContext(
  sessionId: string,
  updates: Partial<ConversationContext>,
): Promise<ConversationContext> {
  const db = await getDatabase();
  const sessions = db.collection<SessionDoc>('sessions');
  const session = await sessions.findOne({ _id: sessionId });
  if (!session) {
    throw new Error('Session not found');
  }

  const redis = await getRedisClient();
  const key = redisKeys.userContext(session.userId);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await redis.watch(key);
    const raw = await redis.get(key);
    let current: ConversationContext;
    if (raw) {
      try {
        current = JSON.parse(raw) as ConversationContext;
      } catch {
        current = session.context ?? {
          userId: session.userId,
          sessionId,
          state: 'idle',
          messages: [],
          metadata: {},
        };
      }
    } else {
      current =
        session.context ??
        ({
          userId: session.userId,
          sessionId,
          state: 'idle',
          messages: [],
          metadata: {},
        } as ConversationContext);
    }

    const next: ConversationContext = {
      ...current,
      ...updates,
      messages: updates.messages
        ? updates.messages.slice(-MAX_MESSAGES_PER_SESSION)
        : current.messages.slice(-MAX_MESSAGES_PER_SESSION),
      metadata: {
        ...(current.metadata ?? {}),
        ...(updates.metadata ?? {}),
      },
    };

    const tx = redis.multi();
    tx.set(key, JSON.stringify(next), { EX: SESSION_TTL_SECONDS });
    const result = await tx.exec();
    if (result !== null) {
      await sessions.updateOne(
        { _id: sessionId },
        { $set: { context: next, lastActivity: new Date() } },
      );
      return next;
    }
    // concurrent update; retry
  }

  throw new Error('Failed to update session context due to concurrent modifications');
}

export async function expireSession(sessionId: string): Promise<void> {
  const db = await getDatabase();
  const sessions = db.collection<SessionDoc>('sessions');
  const session = await sessions.findOne({ _id: sessionId });
  if (!session) return;

  await sessions.updateOne(
    { _id: sessionId },
    { $set: { expiresAt: new Date(), lastActivity: new Date() } },
  );

  await cacheDel(redisKeys.session(sessionId));
  await cacheDel(redisKeys.userContext(session.userId));

  logger.info('session_expired', { userId: session.userId, sessionId });
}

export async function validateSession(
  sessionId: string,
): Promise<{ valid: boolean; context: ConversationContext | null }> {
  const db = await getDatabase();
  const sessions = db.collection<SessionDoc>('sessions');
  const session = await sessions.findOne({ _id: sessionId });
  if (!session) {
    return { valid: false, context: null };
  }
  if (session.expiresAt.getTime() < Date.now()) {
    return { valid: false, context: session.context };
  }

  const context = await cacheGet<ConversationContext>(redisKeys.userContext(session.userId));
  await sessions.updateOne(
    { _id: sessionId },
    { $set: { lastActivity: new Date() } },
  );

  if (!context && session.context) {
    await cacheSet(redisKeys.userContext(session.userId), session.context, SESSION_TTL_SECONDS);
  }

  await cacheSet(redisKeys.session(sessionId), { userId: session.userId, token: session.token }, SESSION_TTL_SECONDS);

  return { valid: true, context: context ?? session.context };
}

