import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

import { getDatabase } from '../db/mongo';
import { cacheSet, cacheGet, redisKeys, cacheDel } from '../db/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { JwtPayload, SessionDoc } from '../types';
import type { RequestWithId } from '../middleware/requestIdMiddleware';

const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24h
const REFRESH_GRACE_MS = 5 * 60 * 1000; // 5 minutes

function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>) {
  return (jwt.sign as any)(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiry,
  });
}

// ─── JWT Refresh (keep existing JWT token refresh logic) ────────────
export async function refreshHandler(req: RequestWithId, res: Response, next: NextFunction) {
  try {
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Token is required and must be a string',
          requestId: req.requestId,
        },
      });
    }

    const blacklisted = await cacheGet(redisKeys.tokenBlacklist(token));
    if (blacklisted) {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token is no longer valid',
          requestId: req.requestId,
        },
      });
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
        ignoreExpiration: true,
      }) as JwtPayload;
    } catch {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token is invalid',
          requestId: req.requestId,
        },
      });
    }

    if (payload.exp) {
      const expiredAt = payload.exp * 1000;
      const now = Date.now();
      if (now - expiredAt > REFRESH_GRACE_MS) {
        return res.status(401).json({
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Token is too old to refresh',
            requestId: req.requestId,
          },
        });
      }
    }

    const db = await getDatabase();
    const sessions = db.collection<SessionDoc>('sessions');
    const session = await sessions.findOne({ token });
    if (!session) {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Session not found',
          requestId: req.requestId,
        },
      });
    }

    const newToken = signToken({
      sub: payload.sub,
      role: payload.role,
      sid: payload.sid,
      email: payload.email,
      googleId: payload.googleId,
    });
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    await sessions.updateOne(
      { _id: session._id },
      { $set: { token: newToken, expiresAt, lastActivity: new Date() } },
    );

    await cacheSet(redisKeys.session(payload.sid), { userId: payload.sub, token: newToken }, SESSION_TTL_SECONDS);

    return res.json({
      newToken,
      expiresIn: SESSION_TTL_SECONDS,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Logout ─────────────────────────────────────────────────────────
export async function logoutHandler(
  req: RequestWithId & { user?: { userId: string; role: string; sessionId: string } },
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token || !req.user) {
      return res.status(200).json({ ok: true });
    }

    const ttlSeconds = SESSION_TTL_SECONDS;
    await cacheSet(redisKeys.tokenBlacklist(token), { revoked: true }, ttlSeconds);

    const db = await getDatabase();
    const sessions = db.collection<SessionDoc>('sessions');
    await sessions.deleteOne({ _id: req.user.sessionId });

    await cacheDel(redisKeys.session(req.user.sessionId));

    logger.info('user_logout', { userId: req.user.userId, requestId: req.requestId });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── Verify Token Middleware ────────────────────────────────────────
export async function verifyTokenMiddleware(
  req: RequestWithId & { user?: { userId: string; role: 'user' | 'admin'; sessionId: string } },
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing Authorization header',
          requestId: req.requestId,
        },
      });
    }

    const token = authHeader.slice(7);

    const blacklisted = await cacheGet(redisKeys.tokenBlacklist(token));
    if (blacklisted) {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has been revoked',
          requestId: req.requestId,
        },
      });
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
    } catch {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token is invalid or expired',
          requestId: req.requestId,
        },
      });
    }

    const db = await getDatabase();
    const sessions = db.collection<SessionDoc>('sessions');
    const session = await sessions.findOne({ _id: payload.sid, token });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Session expired',
          requestId: req.requestId,
        },
      });
    }

    await sessions.updateOne(
      { _id: session._id },
      { $set: { lastActivity: new Date() } },
    );

    req.user = {
      userId: payload.sub,
      role: payload.role,
      sessionId: payload.sid,
    };

    next();
  } catch (err) {
    next(err);
  }
}
