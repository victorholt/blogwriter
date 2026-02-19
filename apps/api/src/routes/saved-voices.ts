import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { savedBrandVoices } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(requireAuth);

const MAX_SAVED_VOICES = 20;

const saveVoiceSchema = z.object({
  name: z.string().min(1).max(200),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  voiceData: z.record(z.string(), z.unknown()),
});

const updateVoiceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sourceUrl: z.string().url().optional().or(z.literal('')).optional(),
  voiceData: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/saved-voices - List saved voices (lightweight, no voiceData)
router.get('/', async (req, res) => {
  try {
    const spaceId = req.user!.spaceId;
    if (!spaceId) {
      return res.json({ success: true, data: [] });
    }

    const voices = await db
      .select({
        id: savedBrandVoices.id,
        name: savedBrandVoices.name,
        sourceUrl: savedBrandVoices.sourceUrl,
        isDefault: savedBrandVoices.isDefault,
        createdAt: savedBrandVoices.createdAt,
        updatedAt: savedBrandVoices.updatedAt,
      })
      .from(savedBrandVoices)
      .where(eq(savedBrandVoices.spaceId, spaceId))
      .orderBy(desc(savedBrandVoices.updatedAt));

    return res.json({ success: true, data: voices });
  } catch (err) {
    console.error('[SavedVoices] List error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch saved voices' });
  }
});

// GET /api/saved-voices/default - Get the default saved voice (with full voiceData)
router.get('/default', async (req, res) => {
  try {
    const spaceId = req.user!.spaceId;
    if (!spaceId) {
      return res.json({ success: true, data: null });
    }

    const [voice] = await db
      .select()
      .from(savedBrandVoices)
      .where(and(eq(savedBrandVoices.spaceId, spaceId), eq(savedBrandVoices.isDefault, true)))
      .limit(1);

    if (!voice) {
      return res.json({ success: true, data: null });
    }

    return res.json({
      success: true,
      data: {
        id: voice.id,
        name: voice.name,
        sourceUrl: voice.sourceUrl,
        isDefault: voice.isDefault,
        voiceData: JSON.parse(voice.voiceData),
        createdAt: voice.createdAt,
        updatedAt: voice.updatedAt,
      },
    });
  } catch (err) {
    console.error('[SavedVoices] Default error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch default voice' });
  }
});

// GET /api/saved-voices/:id - Get single saved voice (with full voiceData)
router.get('/:id', async (req, res) => {
  try {
    const spaceId = req.user!.spaceId;
    if (!spaceId) {
      return res.status(403).json({ success: false, error: 'No workspace' });
    }

    const [voice] = await db
      .select()
      .from(savedBrandVoices)
      .where(and(eq(savedBrandVoices.id, req.params.id), eq(savedBrandVoices.spaceId, spaceId)))
      .limit(1);

    if (!voice) {
      return res.status(404).json({ success: false, error: 'Saved voice not found' });
    }

    return res.json({
      success: true,
      data: {
        id: voice.id,
        name: voice.name,
        sourceUrl: voice.sourceUrl,
        isDefault: voice.isDefault,
        voiceData: JSON.parse(voice.voiceData),
        createdAt: voice.createdAt,
        updatedAt: voice.updatedAt,
      },
    });
  } catch (err) {
    console.error('[SavedVoices] Get error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch saved voice' });
  }
});

// PUT /api/saved-voices/:id - Update a saved voice
router.put('/:id', async (req, res) => {
  try {
    const spaceId = req.user!.spaceId;
    if (!spaceId) {
      return res.status(403).json({ success: false, error: 'No workspace' });
    }

    const [existing] = await db
      .select({ id: savedBrandVoices.id })
      .from(savedBrandVoices)
      .where(and(eq(savedBrandVoices.id, req.params.id), eq(savedBrandVoices.spaceId, spaceId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Saved voice not found' });
    }

    const parsed = updateVoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid request';
      return res.status(400).json({ success: false, error: message });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.sourceUrl !== undefined) updates.sourceUrl = parsed.data.sourceUrl || null;
    if (parsed.data.voiceData !== undefined) updates.voiceData = JSON.stringify(parsed.data.voiceData);

    const [updated] = await db
      .update(savedBrandVoices)
      .set(updates)
      .where(eq(savedBrandVoices.id, req.params.id))
      .returning();

    return res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        sourceUrl: updated.sourceUrl,
        isDefault: updated.isDefault,
        voiceData: JSON.parse(updated.voiceData),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err) {
    console.error('[SavedVoices] Update error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update saved voice' });
  }
});

// POST /api/saved-voices/:id/default - Toggle default status
router.post('/:id/default', async (req, res) => {
  try {
    const spaceId = req.user!.spaceId;
    if (!spaceId) {
      return res.status(403).json({ success: false, error: 'No workspace' });
    }

    // Verify ownership and get current default status
    const [existing] = await db
      .select({ id: savedBrandVoices.id, isDefault: savedBrandVoices.isDefault })
      .from(savedBrandVoices)
      .where(and(eq(savedBrandVoices.id, req.params.id), eq(savedBrandVoices.spaceId, spaceId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Saved voice not found' });
    }

    if (existing.isDefault) {
      // Toggle OFF: clear default on this voice
      await db
        .update(savedBrandVoices)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(savedBrandVoices.id, req.params.id));

      return res.json({ success: true, data: { isDefault: false } });
    }

    // Toggle ON: clear all defaults for space, then set this one
    await db
      .update(savedBrandVoices)
      .set({ isDefault: false })
      .where(eq(savedBrandVoices.spaceId, spaceId));

    await db
      .update(savedBrandVoices)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(savedBrandVoices.id, req.params.id));

    return res.json({ success: true, data: { isDefault: true } });
  } catch (err) {
    console.error('[SavedVoices] Toggle default error:', err);
    return res.status(500).json({ success: false, error: 'Failed to toggle default voice' });
  }
});

// POST /api/saved-voices - Save a new brand voice
router.post('/', async (req, res) => {
  try {
    const spaceId = req.user!.spaceId;
    if (!spaceId) {
      return res.status(403).json({ success: false, error: 'No workspace' });
    }

    const parsed = saveVoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid request';
      return res.status(400).json({ success: false, error: message });
    }

    const { name, sourceUrl, voiceData } = parsed.data;

    // Check limit
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedBrandVoices)
      .where(eq(savedBrandVoices.spaceId, spaceId));

    if (Number(countResult.count) >= MAX_SAVED_VOICES) {
      return res.status(409).json({
        success: false,
        error: `Saved voice limit reached (${MAX_SAVED_VOICES}). Please delete some voices first.`,
      });
    }

    // Clear isDefault on all existing voices for this space
    await db
      .update(savedBrandVoices)
      .set({ isDefault: false })
      .where(eq(savedBrandVoices.spaceId, spaceId));

    // Insert the new voice as default
    const [voice] = await db
      .insert(savedBrandVoices)
      .values({
        spaceId,
        name,
        sourceUrl: sourceUrl || null,
        voiceData: JSON.stringify(voiceData),
        isDefault: true,
      })
      .returning();

    return res.json({
      success: true,
      data: {
        id: voice.id,
        name: voice.name,
        sourceUrl: voice.sourceUrl,
        isDefault: voice.isDefault,
        createdAt: voice.createdAt,
        updatedAt: voice.updatedAt,
      },
    });
  } catch (err) {
    console.error('[SavedVoices] Create error:', err);
    return res.status(500).json({ success: false, error: 'Failed to save voice' });
  }
});

// DELETE /api/saved-voices/:id - Delete a saved voice
router.delete('/:id', async (req, res) => {
  try {
    const spaceId = req.user!.spaceId;
    if (!spaceId) {
      return res.status(403).json({ success: false, error: 'No workspace' });
    }

    const [voice] = await db
      .select({ id: savedBrandVoices.id })
      .from(savedBrandVoices)
      .where(and(eq(savedBrandVoices.id, req.params.id), eq(savedBrandVoices.spaceId, spaceId)))
      .limit(1);

    if (!voice) {
      return res.status(404).json({ success: false, error: 'Saved voice not found' });
    }

    await db.delete(savedBrandVoices).where(eq(savedBrandVoices.id, req.params.id));

    return res.json({ success: true });
  } catch (err) {
    console.error('[SavedVoices] Delete error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete saved voice' });
  }
});

export default router;
