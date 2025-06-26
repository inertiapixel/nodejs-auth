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

export const facebookAuth: RequestHandler = async (req, res) => {
  const { code } = req.body;

  const config = getSocialConfig().facebook;
  const clientBaseUrl = getClientBaseUrl();
  const redirectUrl = cleanUrl(`${clientBaseUrl}/api/auth/facebook`);

  if (!config?.clientId || !config?.clientSecret || !config?.redirectUri) {
    return res.status(400).json({
      provider: 'facebook',
      isAuthenticated: false,
      message: 'Facebook OAuth configuration missing',
    });
  }

  try {
    // Step 1: Exchange code for access token
    const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUrl,
        code,
      },
    });

    const { access_token } = tokenRes.data;

    if (!access_token) {
      return res.status(400).json({
        provider: 'facebook',
        isAuthenticated: false,
        message: 'Failed to obtain access token',
      });
    }

    // Step 2: Fetch user info from Facebook
    const userRes = await axios.get<FacebookUser>('https://graph.facebook.com/me', {
      params: {
        fields: 'id,name,email,picture',
        access_token,
      },
    });

    const fbProfile = userRes.data;

    if (!fbProfile.email) {
      return res.status(400).json({
        provider: 'facebook',
        isAuthenticated: false,
        message: 'Email is required but missing from Facebook response',
      });
    }

    // Step 3: Normalize profile via hook
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

    // Step 4: Fetch/create user
    const getUser = getUserHandler();
    let user = await getUser(userData);

    if (!user || typeof user !== 'object') {
      return res.status(500).json({
        provider: 'facebook',
        isAuthenticated: false,
        message: 'User creation or fetch failed',
      });
    }

    // Step 5: Optional transform
    user = await runTransformUserHook(user);

    // Step 6: Issue JWT token
    const appToken = generateToken({
      name: user.name || userData.name,
      email: user.email || userData.email,
      avatar: user.avatar || userData.avatar,
    });

    // Step 7: Call hooks
    await runOAuthSuccessHook({
      user,
      provider: 'facebook',
      accessToken: appToken,
      rawProfile: decodedProfile,
    });

    await runTokenIssuedHook({
      user,
      provider: 'facebook',
      accessToken: appToken,
      rawProfile: decodedProfile,
    });

    await runLoginSuccessHook({
      user,
      provider: 'facebook',
      accessToken: appToken,
    });

    // Step 8: Final response
    return res.status(200).json({
      isAuthenticated: true,
      provider: 'facebook',
      accessToken: appToken,
      user,
      provoider_log: decodedProfile,
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

    return res.status(500).json({
      provider: 'facebook',
      isAuthenticated: false,
      message: 'Failed to login using Facebook',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
