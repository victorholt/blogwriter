import { Router } from 'express';
import { db } from '../db';
import { users, spaces, spaceMembers } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { hashPassword } from '../services/auth';
import { logAudit } from '../services/audit';

const router = Router();

// GET /api/admin/:token/users - List users
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db.select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(users),
    ]);

    const total = Number(countResult[0]?.count || 0);

    return res.json({ success: true, data: { users: rows, total, page, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[AdminUsers] List error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list users' });
  }
});

// POST /api/admin/:token/users - Create user
router.post('/', async (req, res) => {
  try {
    const { email, displayName, password, role } = req.body;

    if (!email || !displayName || !password) {
      return res.status(400).json({ success: false, error: 'Email, display name, and password are required' });
    }

    const emailLower = email.toLowerCase().trim();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, emailLower)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(users).values({
      email: emailLower,
      passwordHash,
      displayName: displayName.trim(),
      role: role === 'admin' ? 'admin' : 'user',
    }).returning();

    const [space] = await db.insert(spaces).values({
      name: `${displayName.trim()}'s workspace`,
      ownerId: user.id,
    }).returning();

    await db.insert(spaceMembers).values({
      spaceId: space.id,
      userId: user.id,
      role: 'owner',
    });

    logAudit({ action: 'admin.user.create', resourceType: 'user', resourceId: user.id, req });

    return res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('[AdminUsers] Create error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// PUT /api/admin/:token/users/:id - Update user
router.put('/:id', async (req, res) => {
  try {
    const { displayName, role, isActive } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (displayName !== undefined) updates.displayName = displayName.trim();
    if (role !== undefined) updates.role = role === 'admin' ? 'admin' : 'user';
    if (isActive !== undefined) updates.isActive = isActive;

    await db.update(users).set(updates).where(eq(users.id, req.params.id));

    logAudit({ action: 'admin.user.update', resourceType: 'user', resourceId: req.params.id, metadata: updates, req });

    return res.json({ success: true });
  } catch (err) {
    console.error('[AdminUsers] Update error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// POST /api/admin/:token/users/:id/reset-password - Admin reset user password
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      updatedAt: new Date(),
    }).where(eq(users.id, req.params.id));

    logAudit({ action: 'admin.user.reset-password', resourceType: 'user', resourceId: req.params.id, req });

    return res.json({ success: true });
  } catch (err) {
    console.error('[AdminUsers] Reset password error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// DELETE /api/admin/:token/users/:id - Disable user (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, req.params.id));

    logAudit({ action: 'admin.user.disable', resourceType: 'user', resourceId: req.params.id, req });

    return res.json({ success: true });
  } catch (err) {
    console.error('[AdminUsers] Disable error:', err);
    return res.status(500).json({ success: false, error: 'Failed to disable user' });
  }
});

export default router;
