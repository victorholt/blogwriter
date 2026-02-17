import type { Request, Response, NextFunction } from 'express';
import { verifyToken, generateAccessToken, type TokenPayload } from '../services/auth';
import { isGuestModeEnabled } from '../services/site-settings';
import { db } from '../db';
import { users, spaceMembers } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
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

/**
 * Resolve the user's current role and spaceId from the DB.
 * This ensures role changes (via CLI or admin panel) take effect
 * immediately without requiring re-login.
 */
async function resolveUserContext(userId: string): Promise<{ displayName: string; role: string; spaceId: string | null } | null> {
  try {
    const rows = await db
      .select({
        displayName: users.displayName,
        role: users.role,
        spaceId: spaceMembers.spaceId,
      })
      .from(users)
      .leftJoin(spaceMembers, eq(spaceMembers.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!rows.length) return null;

    return { displayName: rows[0].displayName, role: rows[0].role, spaceId: rows[0].spaceId ?? null };
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
      // Issue a new access token via cookie (role will be corrected by middleware from DB)
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
    const ctx = await resolveUserContext(payload.userId);
    if (!ctx) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    req.user = { id: payload.userId, email: payload.email, displayName: ctx.displayName, role: ctx.role, spaceId: ctx.spaceId };
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

  const ctx = await resolveUserContext(payload.userId);
  if (!ctx) {
    res.status(401).json({ error: 'User not found' });
    return;
  }
  req.user = { id: payload.userId, email: payload.email, displayName: ctx.displayName, role: ctx.role, spaceId: ctx.spaceId };
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

  const ctx = await resolveUserContext(payload.userId);
  if (!ctx) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  if (ctx.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  req.user = { id: payload.userId, email: payload.email, displayName: ctx.displayName, role: ctx.role, spaceId: ctx.spaceId };
  next();
}
