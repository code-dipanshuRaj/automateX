import type { Request, Response, NextFunction } from 'express';
import { verifyTokenMiddleware } from '../services/authService';

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  // delegate to authService implementation to keep logic in one place
  // casting is safe because verifyTokenMiddleware extends Request with optional user
  // which does not break Express' Request contract.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return verifyTokenMiddleware(req as any, res, next);
}

