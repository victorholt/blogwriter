import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { sharedBlogs, appSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

function generateHash(): string {
  return crypto.randomBytes(9).toString('base64url'); // 12 URL-safe chars
}

const createSchema = z.object({
  blogContent: z.string().min(1),
  brandName: z.string().optional(),
});

// POST /api/share - Create a shared blog link
router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Blog content is required' });
  }

  try {
    // Check if sharing is enabled
    const setting = await db.select().from(appSettings).where(eq(appSettings.key, 'blog_sharing_enabled')).limit(1);
    if (setting.length === 0 || setting[0].value !== 'true') {
      return res.status(403).json({ success: false, error: 'Sharing is currently disabled' });
    }
    let hash = generateHash();

    // Ensure uniqueness (extremely unlikely collision, but be safe)
    for (let i = 0; i < 3; i++) {
      const existing = await db.select({ id: sharedBlogs.id })
        .from(sharedBlogs)
        .where(eq(sharedBlogs.hash, hash))
        .limit(1);
      if (existing.length === 0) break;
      hash = generateHash();
    }

    const [row] = await db.insert(sharedBlogs).values({
      hash,
      blogContent: parsed.data.blogContent,
      brandName: parsed.data.brandName || null,
    }).returning();

    return res.json({ success: true, data: { hash: row.hash } });
  } catch (err) {
    console.error('[Share] Error creating share:', err);
    return res.status(500).json({ success: false, error: 'Failed to create share link' });
  }
});

// GET /api/share/:hash - Get a shared blog (public, no auth)
router.get('/:hash', async (req, res) => {
  try {
    const rows = await db.select()
      .from(sharedBlogs)
      .where(eq(sharedBlogs.hash, req.params.hash))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shared blog not found' });
    }

    const row = rows[0];
    return res.json({
      success: true,
      data: {
        hash: row.hash,
        blogContent: row.blogContent,
        brandName: row.brandName,
        createdAt: row.createdAt,
      },
    });
  } catch (err) {
    console.error('[Share] Error fetching share:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch shared blog' });
  }
});

// DELETE /api/share/:hash - Delete a shared blog (requires admin token)
router.delete('/:hash', async (req, res) => {
  const token = req.headers['x-admin-token'] as string;
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const deleted = await db.delete(sharedBlogs)
      .where(eq(sharedBlogs.hash, req.params.hash))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ success: false, error: 'Shared blog not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[Share] Error deleting share:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete shared blog' });
  }
});

export default router;
