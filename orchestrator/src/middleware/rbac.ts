import type { Request, Response, NextFunction } from 'express';

type Role = 'user' | 'admin';

export function authorize(...roles: Role[]) {
  return (req: Request & { user?: { userId: string; role: Role } }, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action',
        },
      });
    }

    return next();
  };
}

