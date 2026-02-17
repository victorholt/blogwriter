import { Router } from 'express';
import { db } from '../db';
import { blogSessions, agentLogs, cachedDresses, brandLabels } from '../db/schema';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';

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
        generatedBlog: blogSessions.generatedBlog,
        seoMetadata: blogSessions.seoMetadata,
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

    // Lazy backfill old auto-generated titles
    const mapped = blogs.map((b) => {
      let title = b.title;
      if (b.status === 'completed' && b.generatedBlog && title && /\s—\s\w{3}\s\d{4}$/.test(title)) {
        let betterTitle: string | undefined;
        if (b.seoMetadata) {
          try {
            const seo = JSON.parse(b.seoMetadata);
            if (seo.title) betterTitle = seo.title;
          } catch { /* ignore */ }
        }
        if (!betterTitle) {
          const h1Match = b.generatedBlog.match(/^#\s+(.+)$/m);
          if (h1Match) betterTitle = h1Match[1].trim();
        }
        if (betterTitle) {
          title = betterTitle;
          db.update(blogSessions)
            .set({ title: betterTitle })
            .where(eq(blogSessions.id, b.id))
            .then(() => {})
            .catch(() => {});
        }
      }
      return {
        id: b.id,
        title,
        status: b.status,
        brandLabelSlug: b.brandLabelSlug,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      };
    });

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      data: { blogs: mapped, total, page, totalPages },
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

    // Lazy backfill: if title looks like old auto-generated format, extract from content
    let title = session.title;
    if (session.status === 'completed' && session.generatedBlog && title && /\s—\s\w{3}\s\d{4}$/.test(title)) {
      let betterTitle: string | undefined;
      if (session.seoMetadata) {
        try {
          const seo = JSON.parse(session.seoMetadata);
          if (seo.title) betterTitle = seo.title;
        } catch { /* ignore */ }
      }
      if (!betterTitle) {
        const h1Match = session.generatedBlog.match(/^#\s+(.+)$/m);
        if (h1Match) betterTitle = h1Match[1].trim();
      }
      if (betterTitle) {
        title = betterTitle;
        db.update(blogSessions)
          .set({ title: betterTitle })
          .where(eq(blogSessions.id, session.id))
          .then(() => {})
          .catch(() => {});
      }
    }

    // Resolve dress metadata from selectedDressIds so the detail page
    // can show brand/style labels under images (same as the wizard ResultView).
    let dresses: { imageUrl: string; designer: string; styleId: string }[] = [];
    if (session.selectedDressIds) {
      try {
        const dressIds: string[] = JSON.parse(session.selectedDressIds);
        if (dressIds.length > 0) {
          const rows = await db
            .select({
              imageUrl: cachedDresses.imageUrl,
              designer: cachedDresses.designer,
              styleId: cachedDresses.styleId,
            })
            .from(cachedDresses)
            .where(inArray(cachedDresses.externalId, dressIds));

          // Also fetch brand label display names for any designers found
          const designerSlugs = [...new Set(rows.map((r) => r.designer).filter(Boolean))] as string[];
          let brandMap: Record<string, string> = {};
          if (designerSlugs.length > 0) {
            const labels = await db
              .select({ slug: brandLabels.slug, displayName: brandLabels.displayName })
              .from(brandLabels)
              .where(inArray(brandLabels.slug, designerSlugs));
            brandMap = Object.fromEntries(labels.map((l) => [l.slug, l.displayName]));
          }

          dresses = rows
            .filter((r) => r.imageUrl)
            .map((r) => ({
              imageUrl: r.imageUrl!,
              designer: r.designer ? (brandMap[r.designer] || r.designer) : '',
              styleId: r.styleId || '',
            }));
        }
      } catch { /* ignore malformed selectedDressIds */ }
    }

    return res.json({
      success: true,
      data: {
        id: session.id,
        title,
        status: session.status,
        brandLabelSlug: session.brandLabelSlug,
        generatedBlog: session.generatedBlog,
        seoMetadata: session.seoMetadata ? JSON.parse(session.seoMetadata) : null,
        review: session.agentLog ? JSON.parse(session.agentLog) : null,
        dresses,
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

// GET /api/blogs/:id/debug - Get agent outputs & trace IDs (admin only)
router.get('/:id/debug', requireAdmin, async (req, res) => {
  try {
    const [session] = await db
      .select({ id: blogSessions.id })
      .from(blogSessions)
      .where(eq(blogSessions.id, req.params.id))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    // Query agent logs for this session — only agent-output events
    const logs = await db
      .select({
        agentId: agentLogs.agentId,
        traceId: agentLogs.traceId,
        eventType: agentLogs.eventType,
        data: agentLogs.data,
        createdAt: agentLogs.createdAt,
      })
      .from(agentLogs)
      .where(eq(agentLogs.sessionId, req.params.id))
      .orderBy(agentLogs.createdAt);

    // Reconstruct agent outputs, trace IDs, and pipeline order
    const agentOutputs: Record<string, string> = {};
    const blogTraceIds: Record<string, string> = {};
    const pipelineOrder: string[] = [];
    const agentLabels: Record<string, string> = {
      'blog-writer': 'Blog Writer',
      'blog-editor': 'Blog Editor',
      'seo-specialist': 'SEO Specialist',
      'senior-editor': 'Senior Editor',
      'blog-reviewer': 'Blog Reviewer',
    };

    for (const log of logs) {
      // Track pipeline order by first appearance
      if (!pipelineOrder.includes(log.agentId)) {
        pipelineOrder.push(log.agentId);
      }

      // Record trace ID (first one per agent)
      if (!blogTraceIds[log.agentId]) {
        blogTraceIds[log.agentId] = log.traceId;
      }

      // Extract output text from agent-output events
      if (log.eventType === 'agent-output') {
        try {
          const data = JSON.parse(log.data);
          if (data.text) {
            agentOutputs[log.agentId] = data.text;
          }
        } catch { /* skip malformed data */ }
      }
    }

    const pipeline = pipelineOrder.map((id) => ({
      id,
      label: agentLabels[id] || id,
    }));

    return res.json({
      success: true,
      data: { agentOutputs, blogTraceIds, pipeline },
    });
  } catch (err) {
    console.error('[UserBlogs] Debug error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch debug data' });
  }
});

export default router;
