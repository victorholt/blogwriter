import { Router } from 'express';
import { db } from '../db';
import { blogSessions, sharedBlogs, users, spaceMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { sendBlogSharedNotification } from '../services/email';

const router = Router();

// POST /api/blogs/:id/send-copy - Send copy to another user
router.post('/:id/send-copy', requireAuth, async (req, res) => {
  try {
    const { targetEmail } = req.body;
    if (!targetEmail) {
      return res.status(400).json({ success: false, error: 'Target email is required' });
    }

    const spaceId = req.user!.spaceId;
    if (!spaceId) {
      return res.status(403).json({ success: false, error: 'No workspace' });
    }

    // Verify ownership of source blog
    const [sourceBlog] = await db
      .select()
      .from(blogSessions)
      .where(and(eq(blogSessions.id, req.params.id), eq(blogSessions.spaceId, spaceId)))
      .limit(1);

    if (!sourceBlog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    if (sourceBlog.status !== 'completed' || !sourceBlog.generatedBlog) {
      return res.status(400).json({ success: false, error: 'Blog must be completed before sharing' });
    }

    // Find target user
    const emailLower = targetEmail.toLowerCase().trim();
    const [targetUser] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'No user found with that email' });
    }

    if (targetUser.id === req.user!.id) {
      return res.status(400).json({ success: false, error: 'Cannot share with yourself' });
    }

    // Get target user's space
    const [targetMembership] = await db
      .select({ spaceId: spaceMembers.spaceId })
      .from(spaceMembers)
      .where(eq(spaceMembers.userId, targetUser.id))
      .limit(1);

    if (!targetMembership) {
      return res.status(400).json({ success: false, error: 'Target user has no workspace' });
    }

    // Create a copy of the blog in target user's space
    const [newSession] = await db.insert(blogSessions).values({
      spaceId: targetMembership.spaceId,
      title: `${sourceBlog.title || 'Shared Blog'} (copy)`,
      storeUrl: sourceBlog.storeUrl,
      brandVoice: sourceBlog.brandVoice,
      selectedDressIds: sourceBlog.selectedDressIds,
      additionalInstructions: sourceBlog.additionalInstructions,
      themeId: sourceBlog.themeId,
      brandLabelSlug: sourceBlog.brandLabelSlug,
      status: 'completed',
      generatedBlog: sourceBlog.generatedBlog,
      seoMetadata: sourceBlog.seoMetadata,
      agentLog: sourceBlog.agentLog,
    }).returning();

    // Record sharing in shared_blogs for tracking
    const hash = crypto.randomUUID();
    await db.insert(sharedBlogs).values({
      hash,
      blogContent: sourceBlog.generatedBlog,
      brandName: sourceBlog.brandLabelSlug,
      sourceSessionId: sourceBlog.id,
      sourceSpaceId: spaceId,
      targetSpaceId: targetMembership.spaceId,
      sharedByUserId: req.user!.id,
    });

    // Log audit
    logAudit({
      userId: req.user!.id,
      spaceId,
      action: 'blog.share',
      resourceType: 'blog',
      resourceId: newSession.id,
      metadata: { targetUserId: targetUser.id, targetEmail: emailLower },
      req,
    });

    // Send email notification (fire and forget)
    const senderName = req.user!.email;
    sendBlogSharedNotification(emailLower, senderName, sourceBlog.title || 'Blog').catch(() => {});

    return res.json({ success: true, data: { sharedSessionId: newSession.id } });
  } catch (err) {
    console.error('[BlogSharing] Send copy error:', err);
    return res.status(500).json({ success: false, error: 'Failed to share blog' });
  }
});

export default router;
