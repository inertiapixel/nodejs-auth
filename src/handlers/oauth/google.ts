import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import { generateToken } from '../../utils/token';
import { getSocialConfig } from '../../config/social';
import { getClientBaseUrl } from '../../config/client';
import { getUserHandler } from '../../config/user';
import { cleanUrl } from '../../utils/common';

import {
  runOAuthSuccessHook,
  runOAuthErrorHook,
  runTokenIssuedHook,
  runLoginErrorHook,
  runMapProfileToUserHook,
  runTransformUserHook
} from '../../hooks';
import { I_Profile } from '../../types/auth';

interface GoogleIdTokenPayload {
  given_name: string;
  family_name: string;
  email: string;
  name: string;
  picture: string;
  sub: string;
}

export const googleAuth: RequestHandler = async (req, res) => {
  const { code } = req.body;

  if (!code) {
    res.status(400).json({
      provider: 'google',
      isAuthenticated: false,
      message: 'Authorization code is missing',
    });
    return;
  }

  const config = getSocialConfig().google;
  const baseUrl = getClientBaseUrl();
  const redirectUrl = cleanUrl(`${baseUrl}/api/auth/google`);

  if (!config?.clientId || !config?.clientSecret || !config?.redirectUri) {
    res.status(400).json({
      provider: 'google',
      isAuthenticated: false,
      message: 'Google OAuth configuration missing',
    });
    return;
  }

  try {
    // 1. Exchange code for token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      throw new Error('Failed to fetch Google token');
    }

    const tokenData = await tokenRes.json();
    if (!tokenData || typeof tokenData !== 'object' || !('id_token' in tokenData)) {
       res.status(400).json({
        provider: 'google',
        isAuthenticated: false,
        message: 'ID token not found in response',
      });
      return;
    }
    
    const { id_token } = tokenData as { id_token: string };

    const decoded = jwt.decode(id_token) as GoogleIdTokenPayload | null;

    if (!decoded?.email) {
      res.status(400).json({
        provider: 'google',
        isAuthenticated: false,
        message: 'Invalid ID token',
      });
      return;
    }

    // 2. Map profile using hook
    let userData = await runMapProfileToUserHook({
      profile: decoded as I_Profile,
      provider: 'google',
    });

    if (!userData) {
      const { name, email, picture: avatar } = decoded;
      userData = { name, email, avatar, provider: 'google' };
    }

    // 3. Get or create user
    const getUser = getUserHandler();
    let user = await getUser(userData);

    if (!user || typeof user !== 'object') {
      res.status(500).json({
        provider: 'google',
        isAuthenticated: false,
        message: 'User creation or fetch failed',
      });
      return;
    }

    // 4. Transform if needed
    user = await runTransformUserHook(user);

    // 5. Issue JWT
    const accessToken = generateToken({
      name: user.name || userData.name,
      email: user.email || userData.email,
      avatar: user.avatar || userData.avatar,
    });

    // 6. Trigger hooks
    await runOAuthSuccessHook({ user, provider: 'google', accessToken, rawProfile: decoded });
    await runTokenIssuedHook({ user, provider: 'google', accessToken, rawProfile: decoded });

    // 7. Return
    res.status(200).json({
      isAuthenticated: true,
      provider: 'google',
      accessToken,
      user,
      provoider_log: decoded,
      message: 'Login successful. Happy shopping!',
    });
    return;
  } catch (error) {
    await runOAuthErrorHook({
      provider: 'google',
      error,
      code,
      requestBody: req.body,
    });

    await runLoginErrorHook({
      provider: 'credentials',
      error,
      requestBody: req.body,
    });

    res.status(500).json({
      provider: 'google',
      isAuthenticated: false,
      message: 'Failed to login using Google',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
};
