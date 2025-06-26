// utils/token

import jwt, { JwtPayload } from 'jsonwebtoken';

let jwtSecret: string;

const blacklistedTokens = new Set<string>();

export const addToBlacklist = (token: string) => {
  blacklistedTokens.add(token);
};

export const isTokenBlacklisted = (token: string): boolean => {
  return blacklistedTokens.has(token);
};

export interface TokenPayload extends JwtPayload {
  name: string;
  email: string;
  avatar?: string;
}

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, jwtSecret, { expiresIn: '7d' });
};

export const setJwtSecret = (secret: string) => {
  jwtSecret = secret;
};

export const verifyToken = (token: string): TokenPayload => {
  if (!jwtSecret) {
    throw new Error('JWT secret is not set');
  }

  const decoded = jwt.verify(token, jwtSecret);

  if (typeof decoded !== 'object' || decoded === null || !('email' in decoded)) {
    throw new Error('Invalid token payload');
  }

  return decoded as TokenPayload;
};

export const getUserFromToken = (token: string): TokenPayload => {
  const decoded = verifyToken(token);

  return {
    name: decoded.name,
    email: decoded.email,
    avatar: decoded.avatar,
  };
};