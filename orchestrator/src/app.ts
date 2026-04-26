import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './config';
import { requestIdMiddleware } from './middleware/requestIdMiddleware';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';

import healthRouter from './routes/health';
import authRouter from './routes/auth';
import sessionRouter from './routes/session';
import connectorsRouter from './routes/connectors';
import planRouter from './routes/plan';
import chatRouter from './routes/chat';
import ragRouter from './routes/rag';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use(requestIdMiddleware);
  app.use(requestLogger);

  // Routers
  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/session', sessionRouter);
  app.use('/connectors', connectorsRouter);
  app.use('/plan', planRouter);
  app.use('/chat', chatRouter);

  // Also mount under /api for frontend proxy
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/session', sessionRouter);
  app.use('/api/connectors', connectorsRouter);
  app.use('/api/plan', planRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/rag', ragRouter);

  // Error handler (last)
  app.use(errorHandler);

  return app;
}
