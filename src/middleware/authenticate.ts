import { Request, Response, NextFunction } from 'express';
import { isTokenBlacklisted, verifyToken } from '../utils/token';
import { runSessionTimeoutHook } from '../hooks';
import jwt from 'jsonwebtoken';

export interface CustomJwtPayload {
  name: string;
  email: string;
  avatar: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: CustomJwtPayload;
}

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    runSessionTimeoutHook({
      reason: 'missing',
      user: undefined,
      token: '',
    });
    res.status(401).json({ message: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (isTokenBlacklisted(token)) {
    
    runSessionTimeoutHook({
      reason: 'blacklisted',
      user: undefined,
      token,
    });
    res.status(401).json({ message: 'Token is blacklisted. Please login again.' });
    return;
  }

  try {
    const decoded = verifyToken(token);

    if (typeof decoded !== 'object' || decoded === null) {
      res.status(401).json({ message: 'Invalid token payload' });
      return;
    }

    req.user = decoded as CustomJwtPayload;
    next();
  } catch (err: unknown) {
    const reason =
      err instanceof jwt.TokenExpiredError ? 'expired' :
      err instanceof jwt.JsonWebTokenError ? 'invalid' :
      'invalid';

    runSessionTimeoutHook({
      reason,
      token,
      user: undefined, // can't trust decoding if it threw error
    });

    const message =
      err instanceof Error ? err.message : 'Invalid or expired token';
    res.status(401).json({ message });
  }
};
