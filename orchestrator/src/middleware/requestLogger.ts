import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import type { RequestWithId } from './requestIdMiddleware';

export function requestLogger(req: RequestWithId, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = req.requestId;
  const ip = (req.headers['x-forwarded-for'] as string) ?? req.socket.remoteAddress;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      ip,
    });
  });

  next();
}

