import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(req: RequestWithId, _res: Response, next: NextFunction) {
  req.requestId = req.headers['x-request-id']?.toString() ?? randomUUID();
  next();
}

