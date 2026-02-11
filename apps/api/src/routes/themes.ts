import { Router } from 'express';
import { db } from '../db';
import { themes } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/themes — public, returns active themes (name only, no description)
router.get('/', async (_req, res) => {
  try {
    const rows = await db
      .select({ id: themes.id, name: themes.name })
      .from(themes)
      .where(eq(themes.isActive, true))
      .orderBy(themes.sortOrder);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Themes] Error fetching themes:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch themes' });
  }
});

export default router;
