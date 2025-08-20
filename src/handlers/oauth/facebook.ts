// src/handlers/oauth/facebook.ts
import { RequestHandler } from 'express';
import {
  generateAccessToken,
  generateRefreshToken,
  generateJti,
  tryDecode,
} from '../../utils/token';
import { getSocialConfig } from '../../config/social';
import { getClientBaseUrl } from '../../config/client';
import { getUserHandler } from '../../config/user';
import { cleanUrl } from '../../utils/common';
import { I_Profile } from '../../types/auth';
import { refreshStore } from '../../utils/refreshStore';

import {
  runLoginSuccessHook,
  runOAuthSuccessHook,
  runOAuthErrorHook,
  runTokenIssuedHook,
  runLoginErrorHook,
  runMapProfileToUserHook,
  runTransformUserHook,
} from '../../hooks';

interface FacebookUser {
  id: string;
  email: string;
  name: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export const facebookAuth: RequestHandler = async (req, res) => {
  const { code } = req.body;

  const config = getSocialConfig().facebook;
  const clientBaseUrl = getClientBaseUrl();
  const redirectUrl = cleanUrl(`${clientBaseUrl}/api/auth/facebook`);

  if (!config?.clientId || !config?.clientSecret || !config?.redirectUri) {
    res.status(400).json({
      provider: 'facebook',
      isAuthenticated: false,
      message: 'Facebook OAuth configuration missing',
    });
    return;
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
        new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: redirectUrl,
          code,
        }),
    );

    if (!tokenRes.ok) throw new Error('Failed to obtain Facebook access token');
    const tokenJson = (await tokenRes.json()) as FacebookTokenResponse;
    const access_token = tokenJson.access_token;

    if (!access_token) {
      res.status(400).json({
        provider: 'facebook',
        isAuthenticated: false,
        message: 'No access token received from Facebook',
      });
      return;
    }

    // 2. Fetch user profile
    const userRes = await fetch(
      `https://graph.facebook.com/me?` +
        new URLSearchParams({
          fields: 'id,name,email,picture',
          access_token,
        }),
    );

    if (!userRes.ok) throw new Error('Failed to fetch Facebook user profile');
    const fbProfile = (await userRes.json()) as FacebookUser;

    if (!fbProfile.email) {
      res.status(400).json({
        provider: 'facebook',
        isAuthenticated: false,
        message: 'Email is required but missing from Facebook response',
      });
      return;
    }

    // 3. Normalize profile via hook
    const decodedProfile: I_Profile = {
      id: fbProfile.id,
      name: fbProfile.name,
      email: fbProfile.email,
      picture: fbProfile.picture?.data?.url,
    };

    let userData = await runMapProfileToUserHook({
      profile: decodedProfile,
      provider: 'facebook',
    });

    if (!userData) {
      userData = {
        name: fbProfile.name,
        email: fbProfile.email,
        avatar: fbProfile.picture?.data?.url || '',
        provider: 'facebook',
      };
    }

    // 4. Get or create user
    const getUser = getUserHandler();
    let user = await getUser(userData);

    if (!user || typeof user !== 'object') {
      res.status(500).json({
        provider: 'facebook',
        isAuthenticated: false,
        message: 'User creation or fetch failed',
      });
      return;
    }

    // 5. Optional transform
    user = await runTransformUserHook(user);

    // 6. Generate tokens (access + refresh)
    const basePayload = {
      sub: String(user._id || user.id),
      name: user.name || userData.name,
      email: user.email || userData.email,
      avatar: user.avatar || userData.avatar,
    };

    const accessToken = generateAccessToken(basePayload);

    const jti = generateJti();
    const refreshToken = generateRefreshToken({ ...basePayload, jti });

    // decode refresh for expiry
    const decoded = tryDecode(refreshToken);
    const exp =
      decoded?.exp ?? Math.floor(Date.now() / 1000) + 7 * 24 * 3600; // 7 days fallback

    // persist refresh
    await refreshStore().add({
      jti,
      userId: basePayload.sub,
      expiresAt: exp,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // set cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    // 7. Run hooks
    await runOAuthSuccessHook({
      user,
      provider: 'facebook',
      accessToken,
      rawProfile: decodedProfile,
    });
    await runTokenIssuedHook({
      user,
      provider: 'facebook',
      accessToken,
      rawProfile: decodedProfile,
    });
    await runLoginSuccessHook({
      user,
      provider: 'facebook',
      accessToken,
    });

    // 8. Final response
    res.status(200).json({
      isAuthenticated: true,
      provider: 'facebook',
      accessToken, // frontend gets access token
      user,
      provider_log: decodedProfile,
      message: 'Login successful. Happy shopping!',
    });
  } catch (error) {
    await runOAuthErrorHook({
      provider: 'facebook',
      error,
      code,
      requestBody: req.body,
    });
    await runLoginErrorHook({
      provider: 'facebook',
      error,
      requestBody: req.body,
    });

    res.status(500).json({
      provider: 'facebook',
      isAuthenticated: false,
      message: 'Failed to login using Facebook',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
