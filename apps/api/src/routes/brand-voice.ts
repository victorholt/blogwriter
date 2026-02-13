import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { appSettings, brandVoiceCache } from '../db/schema';
import { eq } from 'drizzle-orm';
import { analyzeBrandVoice, streamBrandVoiceAnalysis } from '../mastra/agents/brand-voice-analyzer';
import { streamBrandVoiceFastAnalysis } from '../mastra/agents/brand-voice-fast';
import { isAgentEnabled } from '../mastra/lib/model-resolver';
import { isInsightsEnabled, startTrace, log as traceLog, getTrace } from '../services/agent-trace';

const router = Router();

const analyzeSchema = z.object({
  url: z.string().url('Invalid URL format'),
  previousAttempt: z.record(z.string(), z.unknown()).optional(),
});

router.post('/analyze', async (req, res) => {
  // Validate request
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid request';
    return res.status(400).json({ success: false, error: message });
  }

  const { url, previousAttempt } = parsed.data;

  try {
    // Check cache first (skip if retrying after rejection)
    const cached = await db
      .select()
      .from(brandVoiceCache)
      .where(eq(brandVoiceCache.url, url))
      .limit(1);

    if (!previousAttempt && cached[0] && cached[0].expiresAt > new Date()) {
      console.log(`[BrandVoice] Cache hit for ${url}`);
      return res.json({
        success: true,
        data: JSON.parse(cached[0].analysisResult),
        cached: true,
      });
    }

    // Run brand voice analysis
    console.log(`[BrandVoice] Analyzing ${url}...`);
    const analysis = await analyzeBrandVoice(url, previousAttempt);

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
    const errDetail = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error(`[BrandVoice] Error analyzing ${url}:\n${errDetail}`);
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

  const { url, previousAttempt } = parsed.data;

  // Set up SSE headers (X-Accel-Buffering tells proxies not to buffer)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (type: string, data: unknown) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  // Send SSE heartbeat every 15s to prevent proxy timeouts during long operations
  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch { /* connection closed */ }
  }, 15_000);

  try {
    // Check cache first (skip if retrying after rejection)
    const cached = await db
      .select()
      .from(brandVoiceCache)
      .where(eq(brandVoiceCache.url, url))
      .limit(1);

    if (!previousAttempt && cached[0] && cached[0].expiresAt > new Date()) {
      sendEvent('status', 'Found cached analysis...');
      sendEvent('result', { data: JSON.parse(cached[0].analysisResult), cached: true });
      res.end();
      return;
    }

    // Check if debug mode is enabled
    const debugSetting = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'debug_mode'))
      .limit(1);
    const debugMode = debugSetting[0]?.value === 'true';

    // Set up tracing
    const insightsOn = await isInsightsEnabled();
    let traceId: string | null = null;
    // Determine which analyzer to use
    const useFast = await isAgentEnabled('brand-voice-fast');
    const analyzerLabel = useFast ? 'brand-voice-fast' : 'brand-voice-analyzer';

    if (insightsOn) {
      traceId = await startTrace(analyzerLabel);
      traceLog(traceId, null, analyzerLabel, 'agent-input', { url });
    }

    // Stream the analysis
    console.log(`[BrandVoice] Streaming analysis for ${url} (${analyzerLabel})...`);

    const eventHandler = (event: { type: string; data?: unknown }) => {
      sendEvent(event.type, event.data);
      if (insightsOn && traceId && event.type === 'debug') {
        traceLog(traceId, null, analyzerLabel, (event.data as any)?.kind ?? 'debug', event.data);
      }
    };

    const analysis = useFast
      ? await streamBrandVoiceFastAnalysis(url, eventHandler, { debugMode, previousAttempt })
      : await streamBrandVoiceAnalysis(url, eventHandler, { debugMode, previousAttempt });

    // Log final output to trace
    if (insightsOn && traceId) {
      traceLog(traceId, null, analyzerLabel, 'agent-output', analysis);
    }

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

    sendEvent('result', { data: analysis, cached: false, traceId });
    res.end();
  } catch (err) {
    const errDetail = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error(`[BrandVoice] Stream error for ${url}:\n${errDetail}`);
    const errMsg = err instanceof Error ? err.message : '';

    let message: string;
    if (errMsg === 'AI_SERVICE_UNAVAILABLE') {
      message = 'Our analysis service is temporarily unavailable. Please try again in a few minutes.';
    } else if (errMsg.includes('No response from model') || errMsg.includes('Empty response')) {
      message = 'The AI model didn\u2019t return a response after retrying. This is usually temporary \u2014 please try again.';
    } else if (errMsg.includes('Failed to parse')) {
      message = 'The analysis completed but produced an unreadable result. Please try again.';
    } else {
      message = 'Something went wrong while analyzing the website. Please try again.';
    }
    try { sendEvent('error', message); } catch { /* connection already closed */ }
    try { res.end(); } catch { /* connection already closed */ }
  } finally {
    clearInterval(heartbeat);
  }
});

// Fetch trace logs for a brand voice analysis
router.get('/trace/:traceId', async (req, res) => {
  try {
    const logs = await getTrace(req.params.traceId);
    return res.json({ success: true, data: logs });
  } catch (err) {
    console.error(`[BrandVoice] Error fetching trace ${req.params.traceId}:`, err);
    return res.status(500).json({ success: false, error: 'Failed to fetch trace' });
  }
});

export default router;
