// Configuration for a single social provider
import type { Request, Response } from "express";
export interface SocialProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// Overall configuration object for social providers
export interface SocialConfig {
  google?: SocialProviderConfig;
  facebook?: SocialProviderConfig;
  linkedin?: SocialProviderConfig;
}

// Core user data we expect from any social login
export interface I_SocialUser {
  name: string;
  email: string;
  avatar?: string;
  provider: string;
  provider_id?: string;
}

export interface I_UserObject {
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  [key: string]: unknown;
}

// Developer hook context for a successful OAuth login

export interface I_LoginSuccess {
  user: I_UserObject;
  provider: string;
  accessToken: string;
  req?: Request;
  res?: Response;
}

export interface I_OAuthSuccess {
  user: I_UserObject; // the returned user from consuming app's getUserHandler
  provider: string;
  accessToken: string;
  rawProfile: unknown;
}

export interface I_OAuthError {
  provider: string;             // e.g. 'google', 'facebook'
  error: unknown;               // actual error object
  code?: string;                // optional OAuth code if available
  requestBody: unknown;         // full request body for debugging
}

export interface I_TokenIssued {
  user: I_UserObject;
  provider: string;
  accessToken: string;
  rawProfile?: unknown;
}

export interface I_LoginError {
  provider: string;   // or any other future methods
  error: unknown;
  requestBody: unknown;
}

export interface I_TokenError {
  error: unknown;
  token?: string;
  context?: string; // e.g., 'verify', 'decode', 'refresh'
}

export interface I_Logout {
  user: I_UserObject;
  token: string;
}

export interface I_TokenBlacklisted {
  token: string;
  user?: I_UserObject;
  reason?: string; // e.g., 'logout', 'security'
}

export interface I_TokenRefresh {
  oldToken: string;
  newToken: string;
  user: I_UserObject;
}

export interface I_SessionTimeout {
  user?: I_UserObject;       // optional in case token couldn't be decoded
  token: string;             // raw JWT token
  reason: 'expired' | 'invalid' | 'blacklisted' | 'missing'; // reason code
  occurredAt?: Date;         // optional timestamp
}

export interface I_Profile {
  id?: string;              // Common fallback for most providers (e.g., Facebook)
  sub?: string;             // Google-specific unique user ID
  name?: string;
  given_name?: string;      // Google
  family_name?: string;     // Google
  email?: string;
  picture?: string;         // Google, Facebook
  avatar_url?: string;      // GitHub-style
  [key: string]: unknown;   // To support additional fields from any provider
}

export interface I_MapProfileToUser {
  profile: I_Profile;
  provider: string;
}

// Hook definition for the consuming app
export interface I_AuthHooks {
  onLoginSuccess?: (context: I_LoginSuccess) => Promise<void>;
  onOAuthSuccess?: (context: I_OAuthSuccess) => Promise<void>;
  onOAuthError?: (context: I_OAuthError) => Promise<void>;
  onTokenIssued?: (context: I_TokenIssued) => Promise<void>;
  onLoginError?: (context: I_LoginError) => Promise<void>;
  onTokenError?: (context: I_TokenError) => Promise<void>;

  onLogout?: (context: I_Logout) => Promise<void>;
  onTokenBlacklisted?: (context: I_TokenBlacklisted) => Promise<void>;
  onTokenRefresh?: (context: I_TokenRefresh) => Promise<void>;
  onSessionTimeout?: (context: I_SessionTimeout) => Promise<void>;

  mapProfileToUser?: (context: I_MapProfileToUser) => Promise<I_SocialUser>;
  transformUser?: (user: I_UserObject) => Promise<I_UserObject>;
}
