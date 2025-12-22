import { OAuth2Client, TokenPayload } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { getOrCreateUser, type User } from './database.js';

// Google OAuth client - will use GOOGLE_CLIENT_ID from environment
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// JWT secret - should be set in environment for production
const JWT_SECRET = process.env.JWT_SECRET || 'sibo-assistant-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

export interface JWTPayload {
  userId: number;
  googleId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Verify Google ID token and extract user info
 */
export async function verifyGoogleToken(idToken: string): Promise<TokenPayload | null> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload() || null;
  } catch (error) {
    console.error('Google token verification failed:', error);
    return null;
  }
}

/**
 * Create a JWT for the authenticated user
 */
export function createJWT(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    googleId: user.google_id,
    email: user.email,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT and extract payload
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Express middleware to authenticate requests
 * Extracts user from JWT in Authorization header
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const payload = verifyJWT(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Attach user info to request - we'll use this to look up full user
  req.user = {
    id: payload.userId,
    google_id: payload.googleId,
    email: payload.email,
    name: null,
    picture: null,
    created_at: '',
    updated_at: '',
  };

  next();
}

/**
 * Optional auth middleware - doesn't fail if no token, just doesn't set user
 */
export function optionalAuthMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyJWT(token);

    if (payload) {
      req.user = {
        id: payload.userId,
        google_id: payload.googleId,
        email: payload.email,
        name: null,
        picture: null,
        created_at: '',
        updated_at: '',
      };
    }
  }

  next();
}

/**
 * Handle Google Sign-In callback
 * Expects: { credential: string } - the Google ID token
 * Returns: { token: string, user: User }
 */
export async function handleGoogleSignIn(
  credential: string
): Promise<{ token: string; user: User } | { error: string }> {
  const payload = await verifyGoogleToken(credential);

  if (!payload || !payload.sub || !payload.email) {
    return { error: 'Invalid Google token' };
  }

  // Create or update user in database
  const user = getOrCreateUser(
    payload.sub, // Google ID
    payload.email,
    payload.name || null,
    payload.picture || null
  );

  // Create JWT for the user
  const token = createJWT(user);

  return { token, user };
}
