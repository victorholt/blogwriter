import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { docsPages } from '../db/schema';
import { isDocsEnabled } from '../services/site-settings';

const router = Router();

// GET /api/docs — published nav tree
router.get('/', async (_req, res) => {
  if (!await isDocsEnabled()) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  try {
    const rows = await db
      .select({ id: docsPages.id, slug: docsPages.slug, title: docsPages.title, parentId: docsPages.parentId, sortOrder: docsPages.sortOrder, isDefault: docsPages.isDefault })
      .from(docsPages)
      .where(eq(docsPages.isPublished, true))
      .orderBy(asc(docsPages.sortOrder), asc(docsPages.createdAt));
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Docs] Error fetching nav:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch docs' });
  }
});

// GET /api/docs/:slug — single published page
router.get('/:slug', async (req, res) => {
  if (!await isDocsEnabled()) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  try {
    const [row] = await db
      .select()
      .from(docsPages)
      .where(eq(docsPages.slug, req.params.slug))
      .limit(1);
    if (!row || !row.isPublished) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    const { isPublished: _p, ...data } = row;
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Docs] Error fetching page:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch page' });
  }
});

export default router;
