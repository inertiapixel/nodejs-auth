// middleware/authenticate.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  isTokenBlacklisted,
  verifyAccessToken,
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  tryDecode,
  generateJti,
  TokenPayload
} from '../utils/token';
import { refreshStore } from '../utils/refreshStore';
import { runSessionTimeoutHook } from '../hooks';

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const authenticate = (options?: { autoRefresh?: boolean }) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      runSessionTimeoutHook({ reason: 'missing', user: undefined, token: '' });
      res.status(401).json({ message: 'Unauthorized: No token provided' });
      return; // end with void
    }

    const accessToken = authHeader.split(' ')[1];

    if (isTokenBlacklisted(accessToken)) {
      runSessionTimeoutHook({ reason: 'blacklisted', user: undefined, token: accessToken });
      res.status(401).json({ message: 'Token is blacklisted. Please login again.' });
      return; // ✅
    }

    try {
      const decoded = verifyAccessToken(accessToken);
      req.user = decoded;
      next(); // do not return
    } catch (err) {
      const isExpired = err instanceof jwt.TokenExpiredError;

      if (!isExpired || !options?.autoRefresh) {
        runSessionTimeoutHook({ reason: isExpired ? 'expired' : 'invalid', token: accessToken, user: undefined });
        const msg = isExpired ? 'Token expired. Please refresh or login again.' : 'Invalid token. Please login again.';
        res.status(401).json({ message: msg });
        return; // ✅
      }

      const rCookie = req.cookies?.refreshToken as string | undefined;
      if (!rCookie) {
        runSessionTimeoutHook({ reason: 'expired', token: accessToken, user: undefined });
        res.status(401).json({ message: 'Session expired. Please login again.' });
        return; // ✅
      }

      try {
        const rDecoded = verifyRefreshToken(rCookie);
        if (!rDecoded.jti || !(await refreshStore().isActive(rDecoded.jti))) {
          runSessionTimeoutHook({ reason: 'invalid', token: rCookie, user: undefined });
          res.status(401).json({ message: 'Refresh token revoked. Please login again.' });
          return; // ✅
        }

        const basePayload: TokenPayload = {
          sub: rDecoded.sub,
          name: rDecoded.name,
          email: rDecoded.email,
          avatar: rDecoded.avatar,
        };

        // rotate refresh
        const newJti = generateJti();
        const newRefresh = generateRefreshToken({ ...basePayload, jti: newJti });
        const newDecoded = JSON.parse(Buffer.from(newRefresh.split('.')[1], 'base64').toString()) as TokenPayload;
        const newExp = typeof newDecoded.exp === 'number' ? newDecoded.exp : Math.floor(Date.now() / 1000) + 7 * 24 * 3600;

        await refreshStore().rotate(rDecoded.jti!, {
          jti: newJti,
          userId: basePayload.sub,
          expiresAt: newExp,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
        });

        res.cookie('refreshToken', newRefresh, cookieOpts);

        const newAccess = generateAccessToken(basePayload);
        res.setHeader('x-access-token', newAccess);
        req.user = basePayload;

        next(); // just call next
      } catch (e) {
        console.error('Refresh token validation failed:', e);
        runSessionTimeoutHook({ reason: 'invalid', token: rCookie!, user: tryDecode(rCookie!) });
        res.status(401).json({ message: 'Session expired. Please login again.' });
        return;
      }
    }
  };