import { RequestHandler } from 'express';
import { getSocialConfig } from '../../config/social';
import { getClientBaseUrl } from '../../config/client';
import { getUserHandler } from '../../config/user';
import { cleanUrl } from '../../utils/common';
import { I_Profile } from '../../types/auth';

import {
  runLoginSuccessHook,
  runOAuthSuccessHook,
  runOAuthErrorHook,
  runTokenIssuedHook,
  runLoginErrorHook,
  runMapProfileToUserHook,
  runTransformUserHook
} from '../../hooks';

import {
  generateAccessToken,
  generateRefreshToken,
  generateJti,
  TokenPayload,
} from '../../utils/token';
import { refreshStore } from '../../utils/refreshStore';

export const linkedinAuth: RequestHandler = async (req, res) => {
  const { code } = req.body;

  const config = getSocialConfig().linkedin;
  const clientBaseUrl = getClientBaseUrl();
  const redirectUrl = cleanUrl(`${clientBaseUrl}/api/auth/linkedin`);

  if (!config?.clientId || !config?.clientSecret || !config?.redirectUri) {
    res.status(400).json({
      provider: 'linkedin',
      isAuthenticated: false,
      message: 'LinkedIn OAuth configuration missing',
    });
    return;
  }

  try {
    // 1. Exchange code for LinkedIn access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUrl,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!tokenResponse.ok) throw new Error('Failed to obtain LinkedIn access token');
    const tokenJson = await tokenResponse.json();

    if (!tokenJson || typeof tokenJson !== 'object' || !('access_token' in tokenJson)) {
      res.status(400).json({
        provider: 'linkedin',
        isAuthenticated: false,
        message: 'Access token not found in LinkedIn response',
      });
      return;
    }

    const { access_token } = tokenJson as { access_token: string };

    if (!access_token) {
      res.status(400).json({
        provider: 'linkedin',
        isAuthenticated: false,
        message: 'No access token received from LinkedIn',
      });
      return;
    }

    // 2. Fetch user profile
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!profileRes.ok) throw new Error('Failed to fetch LinkedIn user profile');

    const profile = await profileRes.json() as {
      sub: string;
      name: string;
      email: string;
      picture?: string;
    };

    if (!profile.email) {
      res.status(400).json({
        provider: 'linkedin',
        isAuthenticated: false,
        message: 'Email is required but missing from LinkedIn response',
      });
      return;
    }

    // 3. Normalize profile
    const mappedProfile: I_Profile = {
      sub: profile.sub,
      name: profile.name,
      email: profile.email,
      picture: profile.picture || '',
    };

    let userData = await runMapProfileToUserHook({
      profile: mappedProfile,
      provider: 'linkedin',
    });

    if (!userData) {
      userData = {
        name: profile.name || '',
        email: profile.email,
        avatar: profile.picture || '',
        provider: 'linkedin',
      };
    }

    // 4. Get or create user
    const getUser = getUserHandler();
    let user = await getUser(userData);

    if (!user || typeof user !== 'object') {
      res.status(500).json({
        provider: 'linkedin',
        isAuthenticated: false,
        message: 'User creation or fetch failed',
      });
      return;
    }

    // 5. Optional transform
    user = await runTransformUserHook(user);

    // 6. Issue secure tokens
    const jti = generateJti();

    const basePayload = {
      sub: user._id ? String(user._id) : userData.email,
      name: user.name || userData.name,
      email: user.email || userData.email,
      avatar: user.avatar || userData.avatar,
      provider: 'linkedin',
    };

    const accessToken = generateAccessToken({ ...basePayload, jti });
    const refreshToken = generateRefreshToken({ ...basePayload, jti });

    // Decode refresh token to extract exp
    const decoded = JSON.parse(
      Buffer.from(refreshToken.split('.')[1], 'base64').toString()
    ) as TokenPayload;

    const exp =
      typeof decoded.exp === 'number'
        ? decoded.exp
        : Math.floor(Date.now() / 1000) + 7 * 24 * 3600;

    // Save refresh token reference in store
    await refreshStore().add({
      jti,
      userId: basePayload.sub,
      expiresAt: exp,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // 7. Run hooks
    await runOAuthSuccessHook({
      user,
      provider: 'linkedin',
      accessToken,
      rawProfile: mappedProfile,
    });

    await runTokenIssuedHook({
      user,
      provider: 'linkedin',
      accessToken,
      rawProfile: mappedProfile,
    });

    await runLoginSuccessHook({
      user,
      provider: 'linkedin',
      accessToken,
    });

    // 8. Final response
    res.status(200).json({
      isAuthenticated: true,
      provider: 'linkedin',
      accessToken,
      refreshToken,
      user,
      provider_log: mappedProfile,
      message: 'Login successful via LinkedIn!',
    });
    return;
  } catch (err) {
    await runOAuthErrorHook({
      provider: 'linkedin',
      error: err,
      code,
      requestBody: req.body,
    });

    await runLoginErrorHook({
      provider: 'linkedin',
      error: err,
      requestBody: req.body,
    });

    res.status(500).json({
      provider: 'linkedin',
      isAuthenticated: false,
      message: 'Failed to login using LinkedIn',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return;
  }
};
