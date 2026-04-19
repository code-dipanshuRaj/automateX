import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { getPlan, updatePlanStatus } from '../services/planStore';
import { executeApprovedPlan } from '../services/llmService';
import { getDatabase } from '../db/mongo';

const router = Router();

// POST /plan/approve
router.post('/approve', verifyToken, async (req, res, next) => {
  try {
    const user = (req as typeof req & { user?: { userId: string } }).user;
    if (!user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    const { planId } = req.body as { planId?: string };
    if (!planId) {
      return res.status(400).json({ error: { message: 'planId is required' } });
    }

    const plan = getPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: { message: 'Plan not found' } });
    }

    // Verify the plan belongs to this user
    if (plan.userId !== user.userId) {
      return res.status(403).json({ error: { message: 'Not your plan' } });
    }

    if (plan.status !== 'pending') {
      return res.status(400).json({ error: { message: `Plan is already ${plan.status}` } });
    }

    // Mark as approved first
    updatePlanStatus(planId, 'approved');

    logger.info('plan_approved', { userId: user.userId, planId });

    // Execute the plan
    const result = await executeApprovedPlan(planId);

    // Persist to mongo
    try {
      const db = await getDatabase();
      const chatSessions = db.collection('chat_sessions');
      await chatSessions.updateOne(
        { _id: plan.sessionId, 'messages.plan.id': planId },
        { $set: { 'messages.$.plan.status': 'executed' } }
      );
      
      const execMsg = {
        role: 'assistant',
        content: result.reply,
        timestamp: new Date().toISOString()
      };
      await chatSessions.updateOne(
        { _id: plan.sessionId },
        { 
          $push: { messages: execMsg as any },
          $set: { lastActivityAt: new Date() }
        }
      );
    } catch (e) {
      logger.error('Failed to update chat_sessions in mongo', { error: (e as Error).message });
    }

    return res.json({
      plan: {
        id: planId,
        steps: plan.steps,
        summary: plan.summary,
        status: 'completed',
      },
      execution: {
        success: result.success,
        results: result.results,
        reply: result.reply,
      },
    });
  } catch (error) {
    logger.error('Plan approve error:', { error: (error as Error).message });
    next(error);
  }
});

// POST /plan/reject
router.post('/reject', verifyToken, async (req, res, next) => {
  try {
    const user = (req as typeof req & { user?: { userId: string } }).user;
    if (!user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    const { planId } = req.body as { planId?: string };
    if (!planId) {
      return res.status(400).json({ error: { message: 'planId is required' } });
    }

    const plan = getPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: { message: 'Plan not found' } });
    }

    if (plan.userId !== user.userId) {
      return res.status(403).json({ error: { message: 'Not your plan' } });
    }

    if (plan.status !== 'pending') {
      return res.status(400).json({ error: { message: `Plan is already ${plan.status}` } });
    }

    updatePlanStatus(planId, 'rejected');

    logger.info('plan_rejected', { userId: user.userId, planId });

    try {
      const db = await getDatabase();
      const chatSessions = db.collection('chat_sessions');
      await chatSessions.updateOne(
        { _id: plan.sessionId, 'messages.plan.id': planId },
        { $set: { 'messages.$.plan.status': 'rejected' } }
      );
    } catch (e) {
      logger.error('Failed to update chat_sessions in mongo', { error: (e as Error).message });
    }

    return res.json({ ok: true });
  } catch (error) {
    logger.error('Plan reject error:', { error: (error as Error).message });
    next(error);
  }
});

export default router;
