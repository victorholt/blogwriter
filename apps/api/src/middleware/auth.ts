import type { Request, Response, NextFunction } from 'express';
import { verifyToken, generateAccessToken, type TokenPayload } from '../services/auth';
import { isGuestModeEnabled } from '../services/guest-mode';
import { db } from '../db';
import { spaceMembers } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  spaceId: string | null;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

async function resolveSpaceId(userId: string): Promise<string | null> {
  try {
    const row = await db
      .select({ spaceId: spaceMembers.spaceId })
      .from(spaceMembers)
      .where(eq(spaceMembers.userId, userId))
      .limit(1);
    return row[0]?.spaceId ?? null;
  } catch {
    return null;
  }
}

function extractToken(req: Request): TokenPayload | null {
  // Try access token cookie first
  const accessToken = req.cookies?.blogwriter_access;
  if (accessToken) {
    try {
      return verifyToken(accessToken);
    } catch {
      // Access token expired — try refresh
    }
  }

  // Try refresh token cookie
  const refreshToken = req.cookies?.blogwriter_refresh;
  if (refreshToken) {
    try {
      const payload = verifyToken(refreshToken);
      // Issue a new access token via cookie
      const newAccess = generateAccessToken({ userId: payload.userId, email: payload.email, role: payload.role });
      (req.res as Response)?.cookie('blogwriter_access', newAccess, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api',
        maxAge: 24 * 60 * 60 * 1000,
      });
      return payload;
    } catch {
      // Refresh token also invalid
    }
  }

  return null;
}

/**
 * Extracts user if present. If no valid token and guest mode is OFF → 401.
 * If guest mode is ON and no token → req.user remains undefined (guest).
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const payload = extractToken(req);

  if (payload) {
    const spaceId = await resolveSpaceId(payload.userId);
    req.user = { id: payload.userId, email: payload.email, role: payload.role, spaceId };
    return next();
  }

  // No valid token — check guest mode
  const guestEnabled = await isGuestModeEnabled();
  if (!guestEnabled) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Guest mode ON — allow through without user
  next();
}

/**
 * Always requires a valid token. 401 if missing/invalid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const payload = extractToken(req);

  if (!payload) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const spaceId = await resolveSpaceId(payload.userId);
  req.user = { id: payload.userId, email: payload.email, role: payload.role, spaceId };
  next();
}

/**
 * Requires valid token + admin role.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const payload = extractToken(req);

  if (!payload) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (payload.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const spaceId = await resolveSpaceId(payload.userId);
  req.user = { id: payload.userId, email: payload.email, role: payload.role, spaceId };
  next();
}
