import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { processMessage } from '../services/llmService';
import { getDatabase } from '../db/mongo';
import type { ConversationMessage, ChatSessionDoc } from '../types';

const router = Router();

// POST /chat/send
router.post('/send', verifyToken, async (req, res, next) => {
  try {
    const user = (req as typeof req & { user?: { userId: string } }).user;
    if (!user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    const { text, sessionId: clientSessionId } = req.body as { text?: string; sessionId?: string };
    if (!text) {
      return res.status(400).json({ error: { message: 'Text is required' } });
    }

    const db = await getDatabase();
    const chatSessions = db.collection<ChatSessionDoc>('chat_sessions');
    
    let sessionId = clientSessionId;

    // If client provided an ID, verify it actually exists and belongs to them
    if (clientSessionId) {
      const existing = await chatSessions.findOne({ _id: clientSessionId, userId: user.userId });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Chat session not found or deleted' } });
      }
    } else {
      sessionId = uuidv4();
    }

    // Add user message to history
    const userMsg: ConversationMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    // Upsert the session doc with the new user message
    await chatSessions.updateOne(
      { _id: sessionId },
      {
        $setOnInsert: { userId: user.userId, createdAt: new Date() },
        $set: { lastActivityAt: new Date() },
        $push: { messages: userMsg }
      },
      { upsert: true }
    );

    // Fetch the updated history to pass to LLM (excluding the just-added user message)
    const sessionDoc = await chatSessions.findOne({ _id: sessionId });
    const fullHistory = sessionDoc?.messages ?? [userMsg];
    const previousHistory = fullHistory.slice(0, -1);

    // Process through LLM
    const result = await processMessage(user.userId, text, previousHistory, sessionId!);

    // If auth is required, return the auth_required payload
    if (result.authRequired) {
      const systemMsg: ConversationMessage = {
        role: 'system',
        content: result.reply,
        timestamp: new Date().toISOString(),
        authRequired: result.authRequired,
      };
      
      await chatSessions.updateOne(
        { _id: sessionId },
        { 
          $set: { lastActivityAt: new Date() },
          $push: { messages: systemMsg }
        }
      );

      return res.json({
        message: {
          id: uuidv4(),
          role: 'system',
          content: result.reply,
          timestamp: systemMsg.timestamp,
        },
        sessionId,
        authRequired: {
          ...result.authRequired,
          originalMessage: text,
        },
        plan: null,
      });
    }

    // Normal response (may include a plan for approval)
    const assistantMsg: ConversationMessage = {
      role: 'assistant',
      content: result.reply,
      timestamp: new Date().toISOString(),
      plan: result.plan ?? null,
    };
    
    await chatSessions.updateOne(
      { _id: sessionId },
      { 
        $set: { lastActivityAt: new Date() },
        $push: { messages: assistantMsg }
      }
    );

    return res.json({
      message: {
        id: uuidv4(),
        role: 'assistant',
        content: result.reply,
        timestamp: assistantMsg.timestamp,
      },
      sessionId,
      plan: result.plan ?? null,
    });
  } catch (error) {
    logger.error('Chat error:', { error: (error as Error).message });
    next(error);
  }
});

// GET /chat/history
router.get('/history', verifyToken, async (req, res, next) => {
  try {
    const user = (req as typeof req & { user?: { userId: string } }).user;
    if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } });

    const { sessionId } = req.query as { sessionId?: string };
    if (!sessionId) {
       return res.status(400).json({ error: { message: 'Session ID is required' }});
    }

    const db = await getDatabase();
    const chatSessions = db.collection<ChatSessionDoc>('chat_sessions');
    const sessionDoc = await chatSessions.findOne({ _id: sessionId, userId: user.userId });

    if (!sessionDoc) {
      return res.status(404).json({ error: { message: 'Chat session not found or deleted' } });
    }

    const messages = sessionDoc.messages.map((m, i) => ({
      id: `h-${i}`,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      authRequired: m.authRequired ?? null,
      plan: m.plan ?? null,
    }));
    return res.json({ messages });
  } catch (err) {
    next(err);
  }
});

// GET /chat/sessions
router.get('/sessions', verifyToken, async (req, res, next) => {
  try {
    const user = (req as typeof req & { user?: { userId: string } }).user;
    if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } });

    const db = await getDatabase();
    const chatSessions = db.collection<ChatSessionDoc>('chat_sessions');

    const sessions = await chatSessions
      .find({ userId: user.userId })
      .sort({ lastActivityAt: -1 })
      .toArray();

    const mappedSessions = sessions.map(s => ({
      id: s._id,
      createdAt: s.createdAt.toISOString(),
      lastActivityAt: s.lastActivityAt.toISOString(),
      messageCount: s.messages?.length ?? 0,
    }));

    return res.json({ sessions: mappedSessions });
  } catch (err) {
    next(err);
  }
});

export default router;
