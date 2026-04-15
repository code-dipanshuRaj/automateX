import { createClient, RedisClientType } from 'redis';
import { config } from '../config';

let clientPromise: Promise<RedisClientType> | null = null;
let client: RedisClientType | null = null;

/**
 * Simple Redis client using REDIS_URL from env.
 * Connects once and reuses the same client.
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (client) {
    return client;
  }

  if (!clientPromise) {
    const url = config.redisUrl;
    // eslint-disable-next-line no-console
    console.log('[redis] Connecting to', url);

    const redisClient: RedisClientType = createClient({
      url
    });

    redisClient.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[redis] Error', (err as Error).message);
    });

    clientPromise = redisClient.connect().then(() => {
      // eslint-disable-next-line no-console
      console.log('[redis] Connected');
      client = redisClient;
      return redisClient;
    });
  }

  return clientPromise;
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const c = await getRedisClient();
  const val = await c.get(key);
  if (!val) return null;
  try {
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const c = await getRedisClient();
  const serialized = JSON.stringify(value);
  if (ttlSeconds && ttlSeconds > 0) {
    await c.set(key, serialized, { EX: ttlSeconds });
  } else {
    await c.set(key, serialized);
  }
}

export async function cacheDel(key: string): Promise<void> {
  const c = await getRedisClient();
  await c.del(key);
}

export async function incr(key: string, ttlSeconds?: number): Promise<number> {
  const c = await getRedisClient();
  const value = await c.incr(key);
  if (ttlSeconds && ttlSeconds > 0) {
    await c.expire(key, ttlSeconds);
  }
  return value;
}

export const redisKeys = {
  session: (sessionId: string) => `session:${sessionId}`,
  userContext: (userId: string) => `user:${userId}:context`,
  rateLimit: (userIdOrIp: string) => `rate_limit:${userIdOrIp}`,
  tokenBlacklist: (token: string) => `token_blacklist:${token}`,
  lock: (resource: string) => `lock:${resource}`,
};

