import { Router } from 'express';
import { db } from '../db';
import { blogSessions } from '../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/blogs - List my blog sessions
router.get('/', async (req, res) => {
  try {
    const spaceId = req.user!.spaceId;
    if (!spaceId) {
      return res.json({ success: true, data: { blogs: [], total: 0, page: 1, totalPages: 0 } });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const [blogs, countResult] = await Promise.all([
      db.select({
        id: blogSessions.id,
        title: blogSessions.title,
        status: blogSessions.status,
        brandLabelSlug: blogSessions.brandLabelSlug,
        createdAt: blogSessions.createdAt,
        updatedAt: blogSessions.updatedAt,
      })
        .from(blogSessions)
        .where(eq(blogSessions.spaceId, spaceId))
        .orderBy(desc(blogSessions.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(blogSessions)
        .where(eq(blogSessions.spaceId, spaceId)),
    ]);

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      data: { blogs, total, page, totalPages },
    });
  } catch (err) {
    console.error('[UserBlogs] List error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch blogs' });
  }
});

// GET /api/blogs/:id - Get single blog
router.get('/:id', async (req, res) => {
  try {
    const spaceId = req.user!.spaceId;
    const [session] = await db
      .select()
      .from(blogSessions)
      .where(
        spaceId
          ? and(eq(blogSessions.id, req.params.id), eq(blogSessions.spaceId, spaceId))
          : eq(blogSessions.id, req.params.id),
      )
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    return res.json({
      success: true,
      data: {
        id: session.id,
        title: session.title,
        status: session.status,
        brandLabelSlug: session.brandLabelSlug,
        generatedBlog: session.generatedBlog,
        seoMetadata: session.seoMetadata ? JSON.parse(session.seoMetadata) : null,
        review: session.agentLog ? JSON.parse(session.agentLog) : null,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (err) {
    console.error('[UserBlogs] Get error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch blog' });
  }
});

// PUT /api/blogs/:id - Update blog title
router.put('/:id', async (req, res) => {
  try {
    const spaceId = req.user!.spaceId;
    if (!spaceId) {
      return res.status(403).json({ success: false, error: 'No workspace' });
    }

    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const [session] = await db
      .select({ id: blogSessions.id })
      .from(blogSessions)
      .where(and(eq(blogSessions.id, req.params.id), eq(blogSessions.spaceId, spaceId)))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    await db.update(blogSessions)
      .set({ title: title.trim(), updatedAt: new Date() })
      .where(eq(blogSessions.id, req.params.id));

    return res.json({ success: true });
  } catch (err) {
    console.error('[UserBlogs] Update error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update blog' });
  }
});

// DELETE /api/blogs/:id - Delete blog
router.delete('/:id', async (req, res) => {
  try {
    const spaceId = req.user!.spaceId;
    if (!spaceId) {
      return res.status(403).json({ success: false, error: 'No workspace' });
    }

    const [session] = await db
      .select({ id: blogSessions.id })
      .from(blogSessions)
      .where(and(eq(blogSessions.id, req.params.id), eq(blogSessions.spaceId, spaceId)))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    await db.delete(blogSessions).where(eq(blogSessions.id, req.params.id));

    return res.json({ success: true });
  } catch (err) {
    console.error('[UserBlogs] Delete error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete blog' });
  }
});

export default router;
