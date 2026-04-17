import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { expireSession, validateSession, updateContext } from '../services/sessionService';

const router = Router();

router.get('/', verifyToken, async (req, res, next) => {
  try {
    const user = (req as typeof req & { user?: { sessionId: string } }).user;
    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }
    const result = await validateSession(user.sessionId);
    return res.json({
      sessionId: user.sessionId,
      valid: result.valid,
      context: result.context,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/context', verifyToken, async (req, res, next) => {
  try {
    const user = (req as typeof req & { user?: { sessionId: string } }).user;
    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }
    const { state, messages, metadata } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (state !== undefined) updates.state = state;
    if (messages !== undefined) updates.messages = messages;
    if (metadata !== undefined) updates.metadata = metadata;

    const context = await updateContext(user.sessionId, updates as never);
    return res.json({ sessionId: user.sessionId, context });
  } catch (err) {
    next(err);
  }
});

router.post('/end', verifyToken, async (req, res, next) => {
  try {
    const user = (req as typeof req & { user?: { sessionId: string } }).user;
    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }
    await expireSession(user.sessionId);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

