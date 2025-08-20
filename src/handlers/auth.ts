// handlers/auth.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  addToBlacklist,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  tryDecode,
  generateJti,
  TokenPayload,
  setRefreshCookie,
  clearRefreshCookie
} from '../utils/token';
import { refreshStore } from '../utils/refreshStore';

import {
  runLoginErrorHook,
  runLoginSuccessHook,
  runLogoutHook,
  runTokenBlacklistedHook,
  runTokenIssuedHook,
  runTokenRefreshHook
} from '../hooks';

// import { I_UserObject } from '../types/auth';


export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  console.log('Inertiapixel nodejs-auth package login');

  if (!email || !password) {
    await runLoginErrorHook({ provider: 'credentials', error: 'Missing email or password', requestBody: req.body });
    res.status(400).json({ isAuthenticated: false, message: 'Email and password are required' });
    return;
  }

  try {
    const user = await req.app.locals.User.findOne({ email });
    if (!user) {
      await runLoginErrorHook({ provider: 'credentials', error: 'User not found', requestBody: req.body });
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await runLoginErrorHook({ provider: 'credentials', error: 'Incorrect password', requestBody: req.body });
      res.status(400).json({ isAuthenticated: false, message: 'Invalid credentials' });
      return;
    }

    const basePayload: TokenPayload = {
      sub: String(user._id),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    };

    const accessToken = generateAccessToken(basePayload);

    // Create a refresh token with jti and store it for rotation
    const jti = generateJti();
    const refreshToken = generateRefreshToken({ ...basePayload, jti });

    // Persist refresh reference
    const decoded = JSON.parse(Buffer.from(refreshToken.split('.')[1], 'base64').toString()) as TokenPayload;
    const exp = typeof decoded.exp === 'number' ? decoded.exp : Math.floor(Date.now() / 1000) + 7 * 24 * 3600;

    await refreshStore().add({
      jti,
      userId: basePayload.sub,
      expiresAt: exp,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // HttpOnly cookie for refresh
    setRefreshCookie(res, refreshToken);

    await runTokenIssuedHook({
      provider: 'credentials',
      accessToken,
      user: { name: user.name, email: user.email, avatar: user.avatar }
    });

    await runLoginSuccessHook({ user, provider: 'credentials', accessToken });

    res.status(200).json({
      provider: 'credentials',
      isAuthenticated: true,
      accessToken,
      message: 'Login successful.',
    });
  } catch (error) {
    await runLoginErrorHook({ provider: 'credentials', error, requestBody: req.body });
    res.status(500).json({
      provider: 'credentials',
      isAuthenticated: false,
      message: 'Failed to login',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(400).json({ message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  // Add access token to blacklist
  addToBlacklist(token);

  // Best effort: revoke refresh via cookie if present
  const refreshTokenCookie = req.cookies?.refreshToken as string | undefined;
  if (refreshTokenCookie) {
    const rDecoded = tryDecode(refreshTokenCookie);
    if (rDecoded?.jti) {
      await refreshStore().revoke(rDecoded.jti);
    }
    clearRefreshCookie(res);
  }

  // Hook context (don’t trust token fully if invalid, but try)
  const user = tryDecode(token);
  if (user) {
    runLogoutHook({ user, token });
    runTokenBlacklistedHook({ user, token, reason: 'Logout' });
  }

  res.status(200).json({ message: 'Logout successful' });
};

export const refreshToken = async (req: Request, res: Response) => {
  console.log('req.cookies', req.cookies);
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (!refreshToken) {
    res.status(400).json({ message: 'Refresh token is missing' });
    return;
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    // Check store (token must be active)
    if (!decoded.jti || !(await refreshStore().isActive(decoded.jti))) {
      res.status(401).json({ message: 'Refresh token is revoked or invalid' });
      return;
    }

    const basePayload: TokenPayload = {
      sub: decoded.sub,
      name: decoded.name,
      email: decoded.email,
      avatar: decoded.avatar,
    };

    // Rotate: revoke old jti, issue new jti and refresh token
    const newJti = generateJti();
    const newRefreshToken = generateRefreshToken({ ...basePayload, jti: newJti });

    const newDecoded = JSON.parse(Buffer.from(newRefreshToken.split('.')[1], 'base64').toString()) as TokenPayload;
    const newExp = typeof newDecoded.exp === 'number' ? newDecoded.exp : Math.floor(Date.now() / 1000) + 7 * 24 * 3600;

    await refreshStore().rotate(decoded.jti!, {
      jti: newJti,
      userId: basePayload.sub,
      expiresAt: newExp,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    //Set rotated refresh cookie via util
    setRefreshCookie(res, newRefreshToken);

    // Issue new access
    const newAccessToken = generateAccessToken(basePayload);

    await runTokenRefreshHook({
      user: { name: basePayload.name, email: basePayload.email, avatar: basePayload.avatar },
      oldToken: refreshToken,
      newToken: newAccessToken,
    });

    res.status(200).json({
      accessToken: newAccessToken,
      message: 'Token refreshed successfully',
    });
  } catch (error) {
    res.status(401).json({
      message: 'Invalid or expired refresh token',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
