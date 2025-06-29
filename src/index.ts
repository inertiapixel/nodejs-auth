import { login, logout, refreshToken } from './handlers/auth';
import { authenticate } from './middleware/authenticate';
import { getSocialAuthHandlers } from './handlers/oauth';

import { setJwtSecret } from './utils/token';
import { setClientBaseUrl } from './config/client';
import { setSocialConfig } from './config/social';
import { setUserHandler } from './config/user';
import { setHooks } from './hooks';

import type {
  I_LoginSuccess,
  I_AuthHooks,
  SocialConfig,
  I_SocialUser,
  I_UserObject,
  I_LoginError,
  I_OAuthError,
  I_OAuthSuccess,
  I_TokenError,
  I_TokenIssued,
  I_Logout,
  I_TokenBlacklisted,
  I_TokenRefresh,
  I_SessionTimeout,
  I_Profile,
  I_MapProfileToUser
} from './types/auth';

// Correct import for Express 5–safe handler type
import type { RequestHandler } from 'express';

type Handler = RequestHandler;

interface AuthConfig extends SocialConfig {
  jwtSecret: string;
  clientBaseUrl: string;
  getUserHandler: (user: I_SocialUser) => Promise<I_UserObject>;
  hooks?: I_AuthHooks;
}

interface InertiaAuthReturn {
  auth: {
    login: Handler;
    logout: Handler;
    refreshToken?: Handler;
    google?: Handler;
    facebook?: Handler;
    linkedin?: Handler;
  };
  middleware: {
    authenticate: Handler;
  };
}

const inertiaAuth = (config: AuthConfig): InertiaAuthReturn => {
  const {
    jwtSecret,
    clientBaseUrl,
    getUserHandler: userHandler,
    hooks,
    google,
    facebook,
    linkedin
  } = config;

  if (!jwtSecret) throw new Error('jwtSecret is required');
  if (!clientBaseUrl) throw new Error('clientBaseUrl is required');
  if (typeof userHandler !== 'function') throw new Error('getUserHandler function is required');

  setJwtSecret(jwtSecret);
  setClientBaseUrl(clientBaseUrl);
  setUserHandler(userHandler);
  setSocialConfig({ google, facebook, linkedin });

  if (hooks) setHooks(hooks);

  const {
    google: googleHandler,
    facebook: facebookHandler,
    linkedin: linkedinHandler
  } = getSocialAuthHandlers();

  return {
    auth: {
      login,
      logout,
      refreshToken,
      google: googleHandler,
      facebook: facebookHandler,
      linkedin: linkedinHandler
    },
    middleware: {
      authenticate
    }
  };
};

export default inertiaAuth;

// Re-export types
export type {
  I_SocialUser,
  I_UserObject,
  I_LoginSuccess,
  I_AuthHooks,
  I_LoginError,
  I_OAuthError,
  I_OAuthSuccess,
  I_TokenError,
  I_TokenIssued,
  I_Logout,
  I_TokenBlacklisted,
  I_TokenRefresh,
  I_SessionTimeout,
  I_Profile,
  I_MapProfileToUser
};
