import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';
import type { RequestWithId } from './requestIdMiddleware';

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(err: ApiError, req: RequestWithId, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';

  logger.error('request_error', {
    requestId: req.requestId,
    message: err.message,
    code,
    statusCode,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  res.status(statusCode).json({
    error: {
      code,
      message: statusCode === 500 ? 'Something went wrong' : err.message,
      details: err.details,
      requestId: req.requestId,
    },
  });
}

