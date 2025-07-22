import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { addToBlacklist, generateToken, verifyToken } from '../utils/token';

import {
  runLoginErrorHook,
  runLoginSuccessHook,
  runLogoutHook,
  runTokenBlacklistedHook,
  runTokenIssuedHook,
  runTokenRefreshHook
} from '../hooks';
import { getUserFromToken } from '../utils/token';
import { I_UserObject } from '../types/auth';

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    const errorContext = {
      provider: 'credentials',
      error: 'Missing email or password',
      requestBody: req.body,
    };
    await runLoginErrorHook(errorContext);

    res.status(400).json({
      isAuthenticated: false,
      message: 'Email and password are required',
    });
    return;
  }

  try {
    const user = await req.app.locals.User.findOne({ email });
    if (!user) {
      await runLoginErrorHook({
        provider: 'credentials',
        error: 'User not found',
        requestBody: req.body,
      });

      res.status(400).json({ message: "Invalid credentials" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await runLoginErrorHook({
        provider: 'credentials',
        error: 'Incorrect password',
        requestBody: req.body,
      });

      res.status(400).json({
        isAuthenticated: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const accessToken = generateToken({
      name: user.name,
      email: user.email,
      avatar: user.avatar
    });

    await runTokenIssuedHook({
      provider: 'credentials',
      accessToken,
      user: {
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });

    await runLoginSuccessHook({
      user,
      provider: 'credentials',
      accessToken
    });

    res.status(200).json({
      provider: 'credentials',
      isAuthenticated: true,
      accessToken,
      message: 'Login successful. Happy shopping!',
    });
  } catch (error) {
    await runLoginErrorHook({
      provider: 'credentials',
      error,
      requestBody: req.body,
    });

    res.status(500).json({
      provider: 'credentials',
      isAuthenticated: false,
      message: 'Failed to login',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const logout = (req: Request, res: Response): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(400).json({ message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  // Try to extract user before blacklisting for the hook
  let user;
  try {
    user = getUserFromToken(token);
  } catch {
    console.warn('[Logout] Failed to decode token for user context');
  }

  addToBlacklist(token);

  if (user) {
    runLogoutHook({ user, token });
    runTokenBlacklistedHook({ user, token, reason: 'Logout' });
  }

  res.status(200).json({ message: 'Logout successful' });
};

export const refreshToken = async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
     res.status(400).json({ message: 'Refresh token is missing' });
     return;
  }

  try {
    const decoded = verifyToken(token);
    const user: I_UserObject = {
      name: decoded.name,
      email: decoded.email,
      avatar: decoded.avatar,
    };

    const newAccessToken = generateToken(user);

    // Run hook after refresh
    await runTokenRefreshHook({
      user,
      oldToken: token,
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