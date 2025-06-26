import { RequestHandler } from 'express';
import axios from 'axios';

import { generateToken } from '../../utils/token';
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

export const linkedinAuth: RequestHandler = async (req, res) => {
  const { code } = req.body;

  const config = getSocialConfig().linkedin;
  const clientBaseUrl = getClientBaseUrl();
  const redirectUrl = cleanUrl(`${clientBaseUrl}/api/auth/linkedin`);

  if (!config?.clientId || !config?.clientSecret || !config?.redirectUri) {
    return res.status(400).json({
      provider: 'linkedin',
      isAuthenticated: false,
      message: 'LinkedIn OAuth configuration missing',
    });
  }

  try {
    // Step 1: Exchange code for access token
    const tokenRes = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUrl,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const access_token = tokenRes.data.access_token;

    if (!access_token) {
      return res.status(400).json({
        provider: 'linkedin',
        isAuthenticated: false,
        message: 'No access token received from LinkedIn',
      });
    }

    // Step 2: Fetch user profile from LinkedIn
    const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profile = profileRes.data;

    if (!profile.email) {
      return res.status(400).json({
        provider: 'linkedin',
        isAuthenticated: false,
        message: 'Email is required but missing from LinkedIn response',
      });
    }

    // Step 3: Normalize profile using mapProfileToUser hook
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

    // Step 4: Create or fetch user
    const getUser = getUserHandler();
    let user = await getUser(userData);

    if (!user || typeof user !== 'object') {
      return res.status(500).json({
        provider: 'linkedin',
        isAuthenticated: false,
        message: 'User creation or fetch failed',
      });
    }

    // Step 5: Optionally transform user
    user = await runTransformUserHook(user);

    // Step 6: Generate app JWT token
    const appToken = generateToken({
      name: user.name || userData.name,
      email: user.email || userData.email,
      avatar: user.avatar || userData.avatar,
    });

    // Step 7: Run hooks
    await runOAuthSuccessHook({
      user,
      provider: 'linkedin',
      accessToken: appToken,
      rawProfile: mappedProfile,
    });

    await runTokenIssuedHook({
      user,
      provider: 'linkedin',
      accessToken: appToken,
      rawProfile: mappedProfile,
    });

    await runLoginSuccessHook({
      user,
      provider: 'linkedin',
      accessToken: appToken,
    });

    // Step 8: Return response
    return res.status(200).json({
      isAuthenticated: true,
      provider: 'linkedin',
      accessToken: appToken,
      user,
      provoider_log: mappedProfile,
      message: 'Login successful via LinkedIn!',
    });
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

    return res.status(500).json({
      provider: 'linkedin',
      isAuthenticated: false,
      message: 'Failed to login using LinkedIn',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
};
