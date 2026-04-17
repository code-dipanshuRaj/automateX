import { google } from 'googleapis';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

import { getDatabase } from '../db/mongo';
import { cacheSet, redisKeys } from '../db/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { UserDoc, JwtPayload, SessionDoc, ConversationContext, GoogleTokens } from '../types';

const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24h

const BASE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

// ─── OAuth2 Client Factory ──────────────────────────────────────────
function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
}

// ─── Sign JWT ───────────────────────────────────────────────────────
function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>) {
  return (jwt.sign as any)(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiry,
  });
}

// ─── Generate Auth URL (base login) ────────────────────────────────
export function getBaseAuthUrl(): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: BASE_SCOPES,
    prompt: 'consent', // always get refresh_token
    include_granted_scopes: true,
  });
}

// ─── Generate Incremental Auth URL ──────────────────────────────────
export function getIncrementalAuthUrl(
  existingScopes: string[],
  requiredScope: string,
  state?: string,
): string {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [...existingScopes, requiredScope],
    include_granted_scopes: true,
    state: state ?? '', // pass userId or pendingMessage identifier
    prompt: 'consent',
  });
}

// ─── Handle OAuth Callback ─────────────────────────────────────────
export async function handleOAuthCallback(code: string): Promise<{
  user: UserDoc;
  token: string; // JWT
  sessionId: string;
  isNewUser: boolean;
}> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get user info from Google
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: profile } = await oauth2.userinfo.get();

  if (!profile.id || !profile.email) {
    throw new Error('Could not retrieve Google profile');
  }

  const db = await getDatabase();
  const users = db.collection<UserDoc>('users');

  // Determine scopes that were granted
  const grantedScopes = tokens.scope ? tokens.scope.split(' ') : BASE_SCOPES;

  const now = new Date();
  let existingUser = await users.findOne({ googleId: profile.id });
  let isNewUser = false;

  if (existingUser) {
    // Existing user — update tokens and overwrite scopes with truth from Google
    // Since we use include_granted_scopes: true, tokens.scope is the exact list of ALL currently valid scopes
    const updateFields: Partial<UserDoc> = {
      accessToken: tokens.access_token ?? existingUser.accessToken,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : existingUser.tokenExpiry,
      grantedScopes: grantedScopes,
      displayName: profile.name ?? existingUser.displayName,
      avatarUrl: profile.picture ?? existingUser.avatarUrl,
      updatedAt: now,
    };

    // Only update refresh_token if a new one was issued
    if (tokens.refresh_token) {
      updateFields.refreshToken = tokens.refresh_token;
    }

    await users.updateOne({ _id: existingUser._id }, { $set: updateFields });
    existingUser = { ...existingUser, ...updateFields };
  } else {
    // New user
    isNewUser = true;
    const userId = randomUUID();
    const newUser: UserDoc = {
      _id: userId,
      googleId: profile.id,
      email: profile.email,
      displayName: profile.name ?? undefined,
      avatarUrl: profile.picture ?? undefined,
      role: 'user',
      accessToken: tokens.access_token ?? '',
      refreshToken: tokens.refresh_token ?? undefined,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      grantedScopes: grantedScopes,
      createdAt: now,
      updatedAt: now,
    };
    await users.insertOne(newUser as any);
    existingUser = newUser;
  }

  // Create a session
  const sessionId = randomUUID();
  const jwtToken = signToken({
    sub: existingUser._id,
    role: existingUser.role,
    sid: sessionId,
    email: existingUser.email,
    googleId: existingUser.googleId,
  });

  const sessions = db.collection<SessionDoc>('sessions');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const defaultContext: ConversationContext = {
    userId: existingUser._id,
    sessionId,
    state: 'idle',
    messages: [],
    metadata: {},
  };

  await sessions.insertOne({
    _id: sessionId,
    userId: existingUser._id,
    token: jwtToken,
    expiresAt,
    context: defaultContext,
    lastActivity: now,
    createdAt: now,
  } as SessionDoc);

  await cacheSet(
    redisKeys.session(sessionId),
    { userId: existingUser._id, token: jwtToken },
    SESSION_TTL_SECONDS,
  );

  logger.info(isNewUser ? 'user_registered_google' : 'user_login_google', {
    userId: existingUser._id,
    email: existingUser.email,
    scopes: existingUser.grantedScopes,
  });

  return {
    user: existingUser,
    token: jwtToken,
    sessionId,
    isNewUser,
  };
}

export async function mergeIncrementalScopes(
  userId: string,
  tokens: GoogleTokens,
): Promise<UserDoc> {
  const db = await getDatabase();
  const users = db.collection<UserDoc>('users');
  const user = await users.findOne({ _id: userId });

  if (!user) {
    throw new Error('User not found');
  }

  // Google's OAuth response payload includes all currently active scopes when 'include_granted_scopes: true' is used.
  // We overwrite our database records with the exact truth returned by Google.
  const activeScopes = tokens.scope ? tokens.scope.split(' ') : user.grantedScopes;

  const updateFields: Partial<UserDoc> = {
    accessToken: tokens.access_token ?? user.accessToken,
    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : user.tokenExpiry,
    grantedScopes: activeScopes,
    updatedAt: new Date(),
  };

  if (tokens.refresh_token) {
    updateFields.refreshToken = tokens.refresh_token;
  }

  await users.updateOne({ _id: userId }, { $set: updateFields });

  return { ...user, ...updateFields };
}
