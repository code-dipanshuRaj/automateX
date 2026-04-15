import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { getUser } from '../services/tokenManager';

const router = Router();

// ─── Connector Status (reads from user's grantedScopes) ─────────────
router.get('/status', verifyToken, async (req, res, next) => {
  try {
    const reqUser = (req as typeof req & { user?: { userId: string } }).user;
    if (!reqUser) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    const user = await getUser(reqUser.userId);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    const scopes = user.grantedScopes;

    return res.json({
      google_calendar: scopes.includes('https://www.googleapis.com/auth/calendar'),
      gmail: scopes.includes('https://www.googleapis.com/auth/gmail.send'),
      google_tasks: scopes.includes('https://www.googleapis.com/auth/tasks'),
      grantedScopes: scopes,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
