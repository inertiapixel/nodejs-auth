// src/utils/token.ts
import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { Response } from 'express';

export interface TokenPayload extends JwtPayload {
  sub: string;       // user id
  name: string;
  email: string;
  avatar?: string;
  jti?: string;      // token id (used for refresh rotation)
}

let accessSecret = '';
let refreshSecret = '';

export const setJwtSecrets = (config: { access: string; refresh: string }) => {
  accessSecret = config.access;
  refreshSecret = config.refresh;
  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT secrets must be set');
  }
};

export const generateJti = () => crypto.randomUUID();

/** Access token = short lived */
export const generateAccessToken = (payload: TokenPayload): string => {
  if (!accessSecret) throw new Error('Access secret not set');
  const { sub, name, email, avatar } = payload;
  return jwt.sign({ sub, name, email, avatar }, accessSecret, { expiresIn: '15m' });
};

/** Refresh token = long lived + has jti for rotation */
export const generateRefreshToken = (payload: TokenPayload & { jti: string }): string => {
  if (!refreshSecret) throw new Error('Refresh secret not set');
  const { sub, name, email, avatar, jti } = payload;
  return jwt.sign({ sub, name, email, avatar, jti }, refreshSecret, { expiresIn: '7d' });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  if (!accessSecret) throw new Error('Access secret not set');
  const decoded = jwt.verify(token, accessSecret);
  if (typeof decoded !== 'object' || decoded === null || !('sub' in decoded)) {
    throw new Error('Invalid access token payload');
  }
  return decoded as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  if (!refreshSecret) throw new Error('Refresh secret not set');
  const decoded = jwt.verify(token, refreshSecret);
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    !('sub' in decoded) ||
    !('jti' in decoded)
  ) {
    throw new Error('Invalid refresh token payload');
  }
  return decoded as TokenPayload;
};

/** Blacklist only for access tokens */
const blacklistedAccessTokens = new Set<string>();
export const addToBlacklist = (token: string) => blacklistedAccessTokens.add(token);
export const isTokenBlacklisted = (token: string) => blacklistedAccessTokens.has(token);

/** Safe decode (non-verifying) for hook context */
export const tryDecode = (token: string): TokenPayload | undefined => {
  try {
    const d = jwt.decode(token);
    if (d && typeof d === 'object') return d as TokenPayload;
  } catch (err) {
    console.warn('[tryDecode] Failed to decode token:', err);
    return undefined;
  }
  return undefined;
};

/** 
 * Default cookie options 
 */
const defaultCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // in dev = false
  // sameSite: process.env.NODE_ENV === 'production' ? 'strict' as const : 'lax' as const,
  sameSite: 'lax' as const,
  path: '/', // cookie available everywhere
};

/**
 * Helper to set refresh cookie consistently
 */
export const setRefreshCookie = (res: Response, token: string) => {
  res.cookie('refreshToken', token, {
    ...defaultCookieOpts,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
};

/**
 * Helper to clear refresh cookie
 */
export const clearRefreshCookie = (res: Response) => {
  res.clearCookie('refreshToken', defaultCookieOpts);
};
