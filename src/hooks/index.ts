import type {
  I_AuthHooks,

  I_LoginSuccess,
  I_LoginError,
  I_OAuthError,
  I_OAuthSuccess,
  I_TokenError,
  I_TokenIssued,

  I_Logout,
  I_TokenBlacklisted,
  I_TokenRefresh,
  I_SessionTimeout,
  I_SocialUser,
  I_UserObject,
  I_MapProfileToUser

} from '../types/auth';

let registeredHooks: I_AuthHooks = {};

export const setHooks = (hooks: I_AuthHooks) => {
  registeredHooks = hooks;
};

export const getHooks = (): I_AuthHooks => {
  return registeredHooks;
};

// ─────────────────────────────────────────────
// HOOK RUNNERS
// ─────────────────────────────────────────────

// On Success Events

export const runLoginSuccessHook = async (context: I_LoginSuccess): Promise<void> => {
  try {
    const hooks = getHooks();
    if (typeof hooks?.onLoginSuccess === 'function') {
      await hooks.onLoginSuccess(context);
    }
  } catch (error) {
    console.error('[nodejs-auth] Error in onLoginSuccess hook:', error);
  }
};

// Run onOAuthSuccess hook safely
export const runOAuthSuccessHook = async (context: I_OAuthSuccess): Promise<void> => {
  try {
    const hooks = getHooks();
    if (typeof hooks?.onOAuthSuccess === 'function') {
      await hooks.onOAuthSuccess(context);
    }
  } catch (error) {
    console.error(`[nodejs-auth] Error in onOAuthSuccess hook:`, error);
  }
};

export async function runTokenIssuedHook(context: I_TokenIssued) {
  try {
    const hooks = getHooks();
    if (typeof hooks?.onTokenIssued === 'function') {
      await hooks.onTokenIssued(context);
    }
  } catch (error) {
    console.error('[nodejs-auth] Error in onTokenIssued hook:', error);
  }
}

// On Error Events
// Run onOAuthError hook safely
export const runOAuthErrorHook = async (context: I_OAuthError): Promise<void> => {
  try {
    const hooks = getHooks();
    if (typeof hooks?.onOAuthError === 'function') {
      await hooks.onOAuthError(context);
    }
  } catch (error) {
    console.error(`[nodejs-auth] Error in onOAuthError hook:`, error);
  }
};

export async function runLoginErrorHook(context: I_LoginError) {
  try {
    const hooks = getHooks();
    if (typeof hooks?.onLoginError === 'function') {
      await hooks.onLoginError(context);
    }
  } catch (error) {
    console.error('[nodejs-auth] Error in onLoginError hook:', error);
  }
}

export async function runTokenErrorHook(context: I_TokenError) {
  try {
    const hooks = getHooks();
    if (typeof hooks?.onTokenError === 'function') {
      await hooks.onTokenError(context);
    }
  } catch (error) {
    console.error('[nodejs-auth] Error in onTokenError hook:', error);
  }
}

// OnLogout
export const runLogoutHook = async (context: I_Logout): Promise<void> => {
  try {
    const hooks = getHooks();
    if (typeof hooks?.onLogout === 'function') {
      await hooks.onLogout(context);
    }
  } catch (error) {
    console.error('[nodejs-auth] Error in onLogout hook:', error);
  }
};

export const runTokenBlacklistedHook = async (context: I_TokenBlacklisted): Promise<void> => {
  try {
    const hooks = getHooks();
    if (typeof hooks?.onTokenBlacklisted === 'function') {
      await hooks.onTokenBlacklisted(context);
    }
  } catch (error) {
    console.error('[nodejs-auth] Error in onTokenBlacklisted hook:', error);
  }
};

export const runTokenRefreshHook = async (context: I_TokenRefresh): Promise<void> => {
  try {
    const hooks = getHooks();
    if (typeof hooks?.onTokenRefresh === 'function') {
      await hooks.onTokenRefresh(context);
    }
  } catch (error) {
    console.error('[nodejs-auth] Error in onTokenRefresh hook:', error);
  }
};

export const runSessionTimeoutHook = async (context: I_SessionTimeout): Promise<void> => {
  try {
    const hooks = getHooks();
    if (typeof hooks?.onSessionTimeout === 'function') {
      await hooks.onSessionTimeout(context);
    }
  } catch (error) {
    console.error('[nodejs-auth] Error in onSessionTimeout hook:', error);
  }
};

//Developer-Oriented


export const runTransformUserHook = async (
  user: I_UserObject
): Promise<I_UserObject> => {
  try {
    if (typeof registeredHooks.transformUser === 'function') {
      return await registeredHooks.transformUser(user);
    }
    return user;
  } catch (error) {
    console.error('[nodejs-auth] Error in transformUser hook:', error);
    return user;
  }
};

export const runMapProfileToUserHook = async (context: I_MapProfileToUser): Promise<I_SocialUser | null> => {
  try {
    if (typeof registeredHooks?.mapProfileToUser === 'function') {
      return await registeredHooks.mapProfileToUser(context);
    }
    return null;
  } catch (error) {
    console.error('[nodejs-auth] Error in mapProfileToUser hook:', error);
    return null;
  }
};
