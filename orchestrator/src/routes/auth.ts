import { Router } from 'express';
import { refreshHandler, logoutHandler } from '../services/authService';
import { verifyToken } from '../middleware/auth';
import { getBaseAuthUrl, getIncrementalAuthUrl, handleOAuthCallback } from '../services/googleAuthService';
import { getUser } from '../services/tokenManager';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

// ─── Google OAuth: Redirect to Google Consent ───────────────────────
router.get('/google', (_req, res) => {
  const url = getBaseAuthUrl();
  return res.redirect(url);
});

// ─── Google OAuth: Callback (exchanges code, creates/updates user) ──
router.get('/google/callback', async (req, res, next) => {
  try {
    const { code, error: oauthError, state } = req.query as { code?: string; error?: string; state?: string };

    if (oauthError) {
      logger.warn('google_oauth_error', { error: oauthError });
      return res.redirect(`${config.frontendUrl}/login?error=oauth_denied`);
    }

    if (!code) {
      return res.redirect(`${config.frontendUrl}/login?error=missing_code`);
    }

    const result = await handleOAuthCallback(code);

    // Encode user info and token into redirect URL
    const userPayload = encodeURIComponent(JSON.stringify({
      id: result.user._id,
      email: result.user.email,
      displayName: result.user.displayName,
      avatarUrl: result.user.avatarUrl,
      grantedScopes: result.user.grantedScopes,
    }));

    let scopeGrantedStr = '';
    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        if (decodedState.pendingMessage) {
          scopeGrantedStr = '&scope_granted=true';
        }
      } catch (e) {
        // Ignore parsing errors for state
      }
    }

    const redirectUrl = `${config.frontendUrl}/auth/callback?token=${result.token}&user=${userPayload}${scopeGrantedStr}`;
    return res.redirect(redirectUrl);
  } catch (err) {
    logger.error('google_callback_error', { error: (err as Error).message });
    return res.redirect(`${config.frontendUrl}/login?error=oauth_failed`);
  }
});

// ─── Incremental Authorization: Request Additional Scope ────────────
// Note: This is a browser redirect, so we can't use verifyToken middleware.
// The frontend passes the JWT as a query param for verification.
router.get('/google/incremental', async (req, res, next) => {
  try {
    const { scope, pendingMessage, token: jwtToken } = req.query as {
      scope?: string;
      pendingMessage?: string;
      token?: string;
    };

    if (!scope) {
      return res.status(400).json({ error: { code: 'INVALID_PAYLOAD', message: 'scope query param required' } });
    }

    // Try to get userId from JWT token passed as query param
    let userId: string | null = null;
    if (jwtToken) {
      try {
        const jwt = await import('jsonwebtoken');
        const payload = jwt.default.verify(jwtToken, config.jwtSecret, { algorithms: ['HS256'] }) as any;
        userId = payload.sub;
      } catch {
        // Token invalid — try from localStorage token param
      }
    }

    if (!userId) {
      return res.redirect(`${config.frontendUrl}/login?error=auth_required`);
    }

    const userDoc = await getUser(userId);
    if (!userDoc) {
      return res.redirect(`${config.frontendUrl}/login?error=user_not_found`);
    }

    // Create state payload with userId and pending message
    const state = JSON.stringify({
      userId,
      pendingMessage: pendingMessage ?? '',
    });

    const url = getIncrementalAuthUrl(
      userDoc.grantedScopes,
      scope,
      Buffer.from(state).toString('base64'),
    );

    return res.redirect(url);
  } catch (err) {
    next(err);
  }
});

// ─── JWT Refresh ────────────────────────────────────────────────────
router.post('/refresh', refreshHandler);

// ─── Logout ─────────────────────────────────────────────────────────
router.post('/logout', verifyToken, logoutHandler);

// ─── Profile (returns user info + granted scopes) ───────────────────
router.get('/profile', verifyToken, async (req, res) => {
  const reqUser = (req as typeof req & { user?: { userId: string; role: string; sessionId: string } }).user;
  if (!reqUser) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      },
    });
  }

  const user = await getUser(reqUser.userId);
  if (!user) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
  }

  return res.json({
    user: {
      id: user._id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      grantedScopes: user.grantedScopes,
    },
  });
});

// Keep /me as alias for /profile (frontend compatibility)
router.get('/me', verifyToken, async (req, res) => {
  const reqUser = (req as typeof req & { user?: { userId: string; role: string; sessionId: string } }).user;
  if (!reqUser) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    });
  }

  const user = await getUser(reqUser.userId);
  if (!user) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
  }

  return res.json({
    user: {
      id: user._id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      grantedScopes: user.grantedScopes,
    },
  });
});

export default router;
