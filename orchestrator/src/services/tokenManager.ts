import { google } from 'googleapis';
import { getDatabase } from '../db/mongo';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { UserDoc, AuthRequiredPayload } from '../types';
import { SCOPE_MAP } from '../types';

// ─── OAuth2 Client Factory ──────────────────────────────────────────
function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
}

// ─── Scope Checking ─────────────────────────────────────────────────

/**
 * Check if user has the required scope.
 * Returns null if scope is present, or an AuthRequiredPayload if missing.
 */
export function ensureScope(
  user: UserDoc,
  requiredScope: string,
  originalMessage?: string,
): AuthRequiredPayload | null {
  if (user.grantedScopes.includes(requiredScope)) {
    return null; // scope is granted
  }

  const scopeInfo = SCOPE_MAP[requiredScope] ?? {
    label: requiredScope,
    description: 'Additional Google permission required',
  };

  return {
    status: 'auth_required',
    requiredScope,
    scopeLabel: scopeInfo.label,
    originalMessage,
  };
}

// ─── Token Refresh ──────────────────────────────────────────────────

/**
 * Get a valid access token for the user.
 * If the token is expired, refresh it silently.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const db = await getDatabase();
  const users = db.collection<UserDoc>('users');
  const user = await users.findOne({ _id: userId });

  if (!user) {
    throw new Error('User not found');
  }

  // Check if token is still valid (with 60s buffer)
  const now = Date.now();
  const expiryMs = user.tokenExpiry ? user.tokenExpiry.getTime() : 0;
  const isExpired = now >= expiryMs - 60_000;

  if (!isExpired && user.accessToken) {
    return user.accessToken;
  }

  // Token is expired — refresh it
  if (!user.refreshToken) {
    throw new Error('No refresh token available. User must re-authenticate.');
  }

  logger.info('token_refresh', { userId, reason: 'access_token_expired' });

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: user.refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  const updateFields: Partial<UserDoc> = {
    accessToken: credentials.access_token ?? user.accessToken,
    tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
    updatedAt: new Date(),
  };

  // Google may issue a new refresh token
  if (credentials.refresh_token) {
    updateFields.refreshToken = credentials.refresh_token;
  }

  await users.updateOne({ _id: userId }, { $set: updateFields });

  return updateFields.accessToken!;
}

// ─── Authorized Google Client ───────────────────────────────────────

/**
 * Returns an OAuth2Client with valid credentials for the given user.
 * Handles token refresh transparently.
 */
export async function getAuthorizedClient(userId: string) {
  const accessToken = await getValidAccessToken(userId);

  const db = await getDatabase();
  const users = db.collection<UserDoc>('users');
  const user = await users.findOne({ _id: userId });

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: user?.refreshToken,
  });

  return oauth2Client;
}

// ─── Get User ───────────────────────────────────────────────────────

export async function getUser(userId: string): Promise<UserDoc | null> {
  const db = await getDatabase();
  const users = db.collection<UserDoc>('users');
  return users.findOne({ _id: userId });
}

// ─── Revoke Tokens ──────────────────────────────────────────────────

export async function revokeAllTokens(userId: string): Promise<void> {
  const db = await getDatabase();
  const users = db.collection<UserDoc>('users');
  const user = await users.findOne({ _id: userId });

  if (!user) return;

  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: user.accessToken });
    await oauth2Client.revokeCredentials();
  } catch (err) {
    logger.warn('token_revoke_failed', { userId, error: (err as Error).message });
  }

  await users.updateOne(
    { _id: userId },
    {
      $set: {
        accessToken: '',
        refreshToken: undefined,
        tokenExpiry: undefined,
        grantedScopes: [],
        updatedAt: new Date(),
      },
    },
  );
}
