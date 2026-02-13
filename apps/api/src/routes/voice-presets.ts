import { Router } from 'express';
import { db } from '../db';
import { voicePresets } from '../db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

const router = Router();

// GET /api/voice-presets — public, returns active presets with formatted voice data
router.get('/', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: voicePresets.id,
        name: voicePresets.name,
        formattedVoice: voicePresets.formattedVoice,
      })
      .from(voicePresets)
      .where(
        and(
          eq(voicePresets.isActive, true),
          isNotNull(voicePresets.formattedVoice),
        ),
      )
      .orderBy(voicePresets.sortOrder);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[VoicePresets] Error fetching presets:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch voice presets' });
  }
});

export default router;
