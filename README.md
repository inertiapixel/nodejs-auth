<p align="center">
  <br/>
  <a href="https://www.inertiapixel.com/" target="_blank"><img width="150px" src="https://www.inertiapixel.com/images/logo-min.svg" /></a>
  <h3 align="center">@inertiapixel/nodejs-auth</h3>
  <p align="center">Node.js + Next.js Auth for MERN</p>
  <p align="center">Open Source. Full Stack</p>
</p>

**InertiaPixel nodejs-auth** is an open-source authentication system for Node.js and Express. Supports credentials and extensible social login, JWT token management, and lifecycle hooks — designed to integrate with nextjs-auth for full-stack MERN apps.


![npm](https://img.shields.io/npm/v/@inertiapixel/nodejs-auth)
![MIT License](https://img.shields.io/npm/l/@inertiapixel/nodejs-auth)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)
![Open Source](https://img.shields.io/badge/Open%20Source-✔️-blue)
![TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178c6?logo=typescript)


---

## Table of Contents

- [Why This Exists](#why-this-exists)
- [Features](#features)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Quick Start](#quick-start)
- [Response](#response)
- [Hooks Supported (Optional)](#hooks-supported-optional)
- [Bring Your Own Database](#bring-your-own-database)
- [Frontend Package Information](#frontend-package-information)
- [License](#license)
- [Related Projects](#related-projects)

---

## Why This Exists
While building a MERN stack project, I couldn't find a well-structured package that handled both frontend and backend authentication together. Most libraries focused on either the client or the server—rarely both.


So I decided to create a pair of authentication packages under the inertiapixel scope—one for the frontend and one for the backend—designed to work seamlessly together. If you're looking for a complete authentication solution for your MERN stack project, these paired packages are for you.

```md
🔗 Use `@inertiapixel/nextjs-auth` on the frontend

🔗 Use `@inertiapixel/nodejs-auth` on the backend
```
---

## Features

- Credential-based login (email & password)
- Plug-and-play support for multiple OAuth providers (Google, Facebook, LinkedIn, etc.)
- JWT-based session handling
- Hook system to extend behavior (logging, analytics, audit, etc.)
- Token blacklisting (secure logout)
- Works perfectly with `@inertiapixel/nextjs-auth` frontend package
- Bring your own database (no DB coupling)

---

## Installation

[![npm version](https://img.shields.io/npm/v/@inertiapixel/nodejs-auth)](https://www.npmjs.com/package/@inertiapixel/nodejs-auth)

```bash
npm install @inertiapixel/nodejs-auth
```

---

## Environment Variables

Make sure to define these in your `.env` file:

```env
JWT_SECRET=your_secret_key
CLIENT_BASE_URL=http://localhost:3000

GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google

FACEBOOK_CLIENT_ID=xxx
FACEBOOK_CLIENT_SECRET=xxx
FACEBOOK_REDIRECT_URI=http://localhost:4000/auth/facebook

LINKEDIN_CLIENT_ID=xxx
LINKEDIN_CLIENT_SECRET=xxx
LINKEDIN_REDIRECT_URI=http://localhost:4000/auth/linkedin
```

---

## Quick Start

⚠️ Assumes you're using Express and Mongoose

```ts
// server.ts or index.ts
import express from 'express';
const app = express();

// Import test function from your auth package
import inertiaAuth, {
  type I_SocialUser,
  type I_AuthHooks,
  type I_UserObject,
  type I_LoginSuccess,
  type I_LoginError,
  type I_OAuthError,
  type I_OAuthSuccess,
  type I_TokenError,
  type I_TokenIssued,

  type I_Logout,
  type I_TokenBlacklisted,
  type I_TokenRefresh,
  type I_SessionTimeout,
  type I_MapProfileToUser,

} from '@inertiapixel/nodejs-auth';

// Inject your Mongoose User model via app.locals
import User from './models/User'; // Your actual Mongoose model (adjust path)
app.locals.User = User;


// Function to find or create user in DB
async function getUserHandler(user: I_SocialUser): Promise<I_UserObject> {
  // Example DB logic (replace with actual DB integration)
  let existingUser = await User.findOne({ email: user.email });

  if (!existingUser) {

    // const randomPassword = Math.random().toString(36).slice(-8); // e.g., "x9ksd8z1"
    const randomPassword = "123456789";
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    existingUser = await User.create({
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      password: hashedPassword
    });
  }

  return {
    name: existingUser.name,
    email: existingUser.email,
    avatar: existingUser.avatar
  };
}

//Hooks are optional
const hooks: I_AuthHooks = {
  onLoginSuccess: async ({ user, provider, accessToken }: I_LoginSuccess) => {
    console.log(`[HOOK onLoginSuccess] ${user.email} logged in via ${provider}`);
    console.log(`[HOOK onLoginSuccess] accessToken:`, accessToken);
    // Optional: Analytics, logging, audit trail
  },
  onOAuthSuccess: async ({ user, provider, accessToken, rawProfile  }: I_OAuthSuccess) => {
    console.log(`[HOOK onOAuthSuccess] ${provider} login success`, user.email);
    console.log(`[HOOK onOAuthSuccess] user:`, user);
    console.log(`[HOOK onOAuthSuccess] ${provider} accessToken:`, accessToken);
    console.log(`[HOOK onOAuthSuccess]${provider} rawProfile:`, rawProfile);

    // optional: save login logs, analytics, etc.
  },
  onOAuthError: async ({ provider, error, code, requestBody }: I_OAuthError) => {
    console.error(`[HOOK onOAuthError] ${provider} login failed:`, error);
    console.log(`[HOOK onOAuthError] OAuth code:`, code);
    console.log(`[HOOK onOAuthError] Request body:`, requestBody);
    // Log to error tracking system, send alerts, etc.
  },
  onTokenIssued: async ({ user, provider, accessToken, rawProfile }: I_TokenIssued) => {
    console.log(`[HOOK onTokenIssued] ${provider} token issued`, user.email);
    console.log(`[HOOK onTokenIssued] user:`, user);
    console.log(`[HOOK onTokenIssued] ${provider} accessToken:`, accessToken);
    console.log(`[HOOK onTokenIssued]${provider} rawProfile:`, rawProfile);

    // Store in DB, audit logs, etc.
  },
  onLoginError: async ({ provider, error, requestBody }: I_LoginError) => {
    console.error(`[HOOK onLoginError] Login failed using ${provider}`, error);
    console.error(`[HOOK onLoginError] Login failed using ${provider}`, requestBody);
    // Send alert, audit, etc.
  },
  onTokenError: async ({ error, token, context }: I_TokenError) => {
    console.error(`[HOOK onTokenError] Token error during ${context}`, token);
    console.error(`[HOOK onTokenError] Token error during ${context}`, error);
    // Log invalid tokens, detect abuse, etc.
  },
  
  onLogout: async ({ user, token }: I_Logout) => {
    console.log(`[HOOK onLogout] ${user.email} logged out. Token: ${token}`);
  },
  onTokenBlacklisted: async ({ token, reason }: I_TokenBlacklisted) => {
    console.warn(`[HOOK onTokenBlacklisted] Token blacklisted due to ${reason}: ${token}`);
  },
  onTokenRefresh: async ({ oldToken, newToken }: I_TokenRefresh) => {
    console.warn(`[HOOK onTokenRefresh] Token rotated  from ${oldToken} to ${newToken}`);
  },
  onSessionTimeout: async ({ reason, user, token }: I_SessionTimeout) => {
    console.log(`[HOOK] Session timeout triggered`);
    console.log(`Reason: ${reason}`);
    console.log(`User: ${user?.email || 'Unknown'}`);
    console.log(`Token: ${token || 'No token'}`);

    // You can optionally:
    // - Save logs to a database
    // - Trigger alert/notification
    // - Audit trails
    // - Block user IP if suspicious
  },
  mapProfileToUser: async ({ profile, provider }: I_MapProfileToUser) => {
    console.log(`[HOOK] Mapping profile for ${provider}`);
  
    if (!profile.email) {
      throw new Error(`Missing email in profile from ${provider}`);
      // OR: return null if your logic tolerates it
    }
  
    return {
      name: profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim(),
      email: profile.email,
      avatar: profile.picture || profile.avatar_url || '',
      provider
    };
  },
  transformUser: async (user) => {
    return {
      ...user,
      role: user.email.endsWith('@admin.com') ? 'admin' : 'user',
    };
  }
};

// Initialize auth package
const auth = inertiaAuth({
  clientBaseUrl: process.env.CLIENT_BASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!
  },
  facebook: {
    clientId: process.env.FACEBOOK_CLIENT_ID!,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    redirectUri: process.env.FACEBOOK_REDIRECT_URI!
  },
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID!,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI!
  },
  getUserHandler,

  // Inject hooks here (optional)
  hooks
});

// routes
app.post('/auth/login', auth.auth.login);
app.post('/auth/logout', auth.auth.logout);

if (auth.auth.refreshToken) {
  app.post('/auth/refresh-token', auth.auth.refreshToken);
}

//social OAuth login handlers
if (auth.auth.google) {
  app.post('/auth/google', auth.auth.google);
}

if (auth.auth.facebook) {
  app.post('/auth/facebook', auth.auth.facebook);
}

if (auth.auth.linkedin) {
  app.post('/auth/linkedin', auth.auth.linkedin);
}

//Protected Routes
app.get('/me', auth.middleware.authenticate, (req, res) => {
  res.json(req.user);
});

```
---

## Response
```

//Success
{
    "provider": "credentials", //or social
    "isAuthenticated": true,
    "accessToken": "JWT_TOKEN",
    "message": "Login successful. Happy shopping!"
}

//Fail
{
    "isAuthenticated": false,
    "message": "Invalid credentials"
}
```
---

## Hooks Supported (Optional)

### 🟢 Before Authentication

| Hook Name          | When it's called                           | Use Case Example                            |
| ------------------ | ------------------------------------------ | ------------------------------------------- |
| `beforeLogin`      | Before local (email/password) login starts | Block user by IP, rate-limit login attempts |
| `beforeOAuthLogin` | Before social OAuth login starts           | Check if user already blocked/suspended     |
| `beforeTokenSign`  | Right before generating the JWT token      | Add custom claims, roles, scopes            |

### 🟡 On Success Events

| Hook Name        | When it's called                          | Use Case Example                              |
| ---------------- | ----------------------------------------- | --------------------------------------------- |
| `onLoginSuccess` | After any login success (local or social) | Logging, audit trail, analytics               |
| `onOAuthSuccess` | Specifically after OAuth login succeeds   | Track source provider or update user metadata |
| `onTokenIssued`  | After token is generated                  | Push token to external service or log         |

### 🔴 On Error Events

| Hook Name      | When it's called                    | Use Case Example                             |
| -------------- | ----------------------------------- | -------------------------------------------- |
| `onLoginError` | When credentials login fails        | Log failed login attempts, alert             |
| `onOAuthError` | When OAuth login fails              | Custom fallback response, log provider error |
| `onTokenError` | If token signing/verification fails | Logging tampered tokens or expired ones      |

### 🔒 Security & Lifecycle Hooks
| Hook Name            | When it's called                                        | Use Case Example           |
| -------------------- | ------------------------------------------------------- | -------------------------- |
| `onLogout`           | When user logs out                                      | Revoke tokens, log logout  |
| `onTokenBlacklisted` | When a blacklisted token is accessed                    | Block request, notify user |
| `onTokenRefresh`     | When token is refreshed (if you support refresh tokens) | Log refresh activity       |
| `onSessionTimeout`   | When session expires (if session-based auth)            | Notify user, audit log     |


All hooks are fully optional.

---

## Bring Your Own Database

This package is database-agnostic. You provide your `getUserHandler()` function to:
- Fetch or create the user
- Return the final user object used for token generation

Example:

```ts
// utils/user.ts
export const getUserHandler = () => async (userData) => {
  // Lookup user in DB, or create if not found
  return existingUser || await createUser(userData);
};
```

---

## Frontend Package Information

After setting up the backend package, you can install the companion frontend package in your Next.js project to complete the full authentication workflow.

[Frontend Auth package](https://github.com/inertiapixel/nextjs-auth)

---

## License

MIT © [inertiapixel](https://github.com/inertiapixel)

---

## Related Projects

- [`@inertiapixel/nextjs-auth`](https://github.com/inertiapixel/nextjs-auth) — Frontend auth package for React/Next.js
- [`@inertiapixel/react-icons`](https://github.com/inertiapixel/react-icons) — React icons set


**Crafted in India by [InertiaPixel](https://www.inertiapixel.com/) 🇮🇳**
