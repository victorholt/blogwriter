import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { mergeVoices } from '../mastra/agents/voice-merger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

const mergeSchema = z.object({
  userVoice: z.record(z.string(), z.unknown()),
  presetVoice: z.record(z.string(), z.unknown()),
});

// POST /api/voice-merge — merge two brand voices using AI
router.post('/', async (req, res) => {
  const parsed = mergeSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid request';
    return res.status(400).json({ success: false, error: message });
  }

  try {
    const merged = await mergeVoices(parsed.data.userVoice, parsed.data.presetVoice);
    return res.json({ success: true, data: { mergedVoice: merged } });
  } catch (err) {
    console.error('[VoiceMerge] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to merge voices. Please try again.',
    });
  }
});

export default router;
