import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { brandVoiceCache } from '../db/schema';
import { eq } from 'drizzle-orm';
import { analyzeBrandVoice, streamBrandVoiceAnalysis } from '../mastra/agents/brand-voice-analyzer';

const router = Router();

const analyzeSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

router.post('/analyze', async (req, res) => {
  // Validate request
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid request';
    return res.status(400).json({ success: false, error: message });
  }

  const { url } = parsed.data;

  try {
    // Check cache first
    const cached = await db
      .select()
      .from(brandVoiceCache)
      .where(eq(brandVoiceCache.url, url))
      .limit(1);

    if (cached[0] && cached[0].expiresAt > new Date()) {
      console.log(`[BrandVoice] Cache hit for ${url}`);
      return res.json({
        success: true,
        data: JSON.parse(cached[0].analysisResult),
        cached: true,
      });
    }

    // Run brand voice analysis
    console.log(`[BrandVoice] Analyzing ${url}...`);
    const analysis = await analyzeBrandVoice(url);

    // Cache result (7-day TTL)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const analysisJson = JSON.stringify(analysis);

    if (cached[0]) {
      // Update existing cache entry
      await db
        .update(brandVoiceCache)
        .set({
          analysisResult: analysisJson,
          cachedAt: new Date(),
          expiresAt,
        })
        .where(eq(brandVoiceCache.url, url));
    } else {
      // Insert new cache entry
      await db.insert(brandVoiceCache).values({
        url,
        analysisResult: analysisJson,
        expiresAt,
      });
    }

    console.log(`[BrandVoice] Analysis cached for ${url}`);
    return res.json({
      success: true,
      data: analysis,
      cached: false,
    });
  } catch (err) {
    console.error(`[BrandVoice] Error analyzing ${url}:`, err);
    const message =
      err instanceof Error && err.message === 'AI_SERVICE_UNAVAILABLE'
        ? 'Our analysis service is temporarily unavailable. Please try again later.'
        : 'Something went wrong while analyzing the website. Please try again.';
    return res.status(500).json({ success: false, error: message });
  }
});

// SSE streaming endpoint — sends progress events as the agent works
router.post('/analyze-stream', async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid request';
    return res.status(400).json({ success: false, error: message });
  }

  const { url } = parsed.data;

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (type: string, data: unknown) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  try {
    // Check cache first
    const cached = await db
      .select()
      .from(brandVoiceCache)
      .where(eq(brandVoiceCache.url, url))
      .limit(1);

    if (cached[0] && cached[0].expiresAt > new Date()) {
      sendEvent('status', 'Found cached analysis...');
      sendEvent('result', { data: JSON.parse(cached[0].analysisResult), cached: true });
      res.end();
      return;
    }

    // Stream the analysis
    console.log(`[BrandVoice] Streaming analysis for ${url}...`);
    const analysis = await streamBrandVoiceAnalysis(url, (event) => {
      sendEvent(event.type, event.data);
    });

    // Cache result (7-day TTL)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const analysisJson = JSON.stringify(analysis);

    if (cached[0]) {
      await db
        .update(brandVoiceCache)
        .set({ analysisResult: analysisJson, cachedAt: new Date(), expiresAt })
        .where(eq(brandVoiceCache.url, url));
    } else {
      await db.insert(brandVoiceCache).values({ url, analysisResult: analysisJson, expiresAt });
    }

    sendEvent('result', { data: analysis, cached: false });
    res.end();
  } catch (err) {
    console.error(`[BrandVoice] Stream error for ${url}:`, err);
    const message =
      err instanceof Error && err.message === 'AI_SERVICE_UNAVAILABLE'
        ? 'Our analysis service is temporarily unavailable. Please try again later.'
        : 'Something went wrong while analyzing the website. Please try again.';
    sendEvent('error', message);
    res.end();
  }
});

export default router;
