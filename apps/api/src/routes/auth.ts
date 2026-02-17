import { Router } from 'express';
import { db } from '../db';
import { users, spaces, spaceMembers } from '../db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, setAuthCookies, clearAuthCookies } from '../services/auth';
import { requireAuth } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/email';
import { logAudit } from '../services/audit';
import { isRegistrationEnabled } from '../services/site-settings';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const registrationEnabled = await isRegistrationEnabled();
    if (!registrationEnabled) {
      return res.status(403).json({ error: 'Registration is currently disabled' });
    }

    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required' });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if email already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await hashPassword(password);

    // Create user
    const [user] = await db.insert(users).values({
      email: emailLower,
      passwordHash,
      displayName: displayName.trim(),
      role: 'user',
    }).returning();

    // Create space
    const [space] = await db.insert(spaces).values({
      name: `${displayName.trim()}'s workspace`,
      ownerId: user.id,
    }).returning();

    // Create space membership
    await db.insert(spaceMembers).values({
      spaceId: space.id,
      userId: user.id,
      role: 'owner',
    });

    // Set cookies
    setAuthCookies(res, { userId: user.id, email: user.email, role: user.role });
    logAudit({ userId: user.id, spaceId: space.id, action: 'user.register', resourceType: 'user', resourceId: user.id, req });

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        spaceId: space.id,
      },
    });
  } catch (err) {
    console.error('[Auth] Registration error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailLower = email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    // Resolve space
    const [membership] = await db
      .select({ spaceId: spaceMembers.spaceId })
      .from(spaceMembers)
      .where(eq(spaceMembers.userId, user.id))
      .limit(1);

    setAuthCookies(res, { userId: user.id, email: user.email, role: user.role });
    logAudit({ userId: user.id, spaceId: membership?.spaceId, action: 'user.login', resourceType: 'user', resourceId: user.id, req });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        spaceId: membership?.spaceId ?? null,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  clearAuthCookies(res);
  return res.json({ success: true });
});

// GET /api/auth/me
// User data is already resolved by requireAuth middleware (single JOIN query),
// so we just return it directly — no extra DB query needed.
router.get('/me', requireAuth, (req, res) => {
  const u = req.user!;
  return res.json({
    user: {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      spaceId: u.spaceId,
    },
  });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, req.user!.id));

    return res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Change password error:', err);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailLower = email.toLowerCase().trim();
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
    }

    // Generate reset token (random, stored hashed)
    const resetToken = crypto.randomUUID();
    const hashedToken = await hashPassword(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.update(users).set({
      passwordResetToken: hashedToken,
      passwordResetExpiresAt: expiresAt,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    // Send email (fire and forget if SMTP not configured)
    await sendPasswordResetEmail(user.email, resetToken);

    return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Find users with non-expired reset tokens
    const allUsersWithResets = await db
      .select({
        id: users.id,
        passwordResetToken: users.passwordResetToken,
        passwordResetExpiresAt: users.passwordResetExpiresAt,
      })
      .from(users)
      .where(eq(users.isActive, true));

    // Check each user's hashed token (there should be very few with active reset tokens)
    let matchedUserId: string | null = null;
    for (const user of allUsersWithResets) {
      if (!user.passwordResetToken || !user.passwordResetExpiresAt) continue;
      if (user.passwordResetExpiresAt < new Date()) continue;

      const valid = await verifyPassword(token, user.passwordResetToken);
      if (valid) {
        matchedUserId = user.id;
        break;
      }
    }

    if (!matchedUserId) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      updatedAt: new Date(),
    }).where(eq(users.id, matchedUserId));

    return res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
