import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { appSettings, blogSessions, themes, brandLabels } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createBlogWriterAgent } from '../mastra/agents/blog-writer';
import { createBlogEditorAgent } from '../mastra/agents/blog-editor';
import { createSeoSpecialistAgent } from '../mastra/agents/seo-specialist';
import { createSeniorEditorAgent } from '../mastra/agents/senior-editor';
import { createBlogReviewerAgent } from '../mastra/agents/blog-reviewer';
import { isInsightsEnabled, startTrace, log as traceLog, getSessionTraces } from '../services/agent-trace';
import { isAgentEnabled } from '../mastra/lib/model-resolver';
import { getMaxRetries, streamAgentWithRetry } from '../mastra/lib/agent-factory';

const router = Router();

async function getSettingBool(key: string, defaultVal: boolean): Promise<boolean> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return rows.length > 0 ? rows[0].value === 'true' : defaultVal;
}

const generateSchema = z.object({
  storeUrl: z.string().min(1),
  brandVoice: z.record(z.string(), z.unknown()),
  selectedDressIds: z.array(z.string()).min(1),
  additionalInstructions: z.string().optional(),
  themeId: z.number().optional(),
  brandLabelSlug: z.string().optional(),
});

// POST /api/blog/generate - Create session
router.post('/generate', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid request';
    return res.status(400).json({ success: false, error: message });
  }

  try {
    const { storeUrl, brandVoice, selectedDressIds, additionalInstructions, themeId, brandLabelSlug } = parsed.data;

    const [session] = await db.insert(blogSessions).values({
      storeUrl,
      brandVoice: JSON.stringify(brandVoice),
      selectedDressIds: JSON.stringify(selectedDressIds),
      additionalInstructions: additionalInstructions || '',
      themeId: themeId ? String(themeId) : null,
      brandLabelSlug: brandLabelSlug || null,
      status: 'generating',
    }).returning();

    return res.json({
      success: true,
      data: { sessionId: session.id },
    });
  } catch (err) {
    console.error('[Blog] Error creating session:', err);
    return res.status(500).json({ success: false, error: 'Failed to create blog session' });
  }
});

// SSE helper
function sendEvent(res: any, type: string, data: any): void {
  res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

// Pipeline agent definitions (blog-writer is always required)
const OPTIONAL_AGENTS = [
  { id: 'blog-editor', label: 'Blog Editor', creator: createBlogEditorAgent },
  { id: 'seo-specialist', label: 'SEO Specialist', creator: createSeoSpecialistAgent },
  { id: 'senior-editor', label: 'Senior Editor', creator: createSeniorEditorAgent },
  { id: 'blog-reviewer', label: 'Blog Reviewer', creator: createBlogReviewerAgent },
];

// GET /api/blog/:sessionId/stream - SSE pipeline stream
router.get('/:sessionId/stream', async (req, res) => {
  const { sessionId } = req.params;

  // Look up session
  const sessions = await db.select().from(blogSessions).where(eq(blogSessions.id, sessionId)).limit(1);
  if (sessions.length === 0) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const session = sessions[0];
  const brandVoice = JSON.parse(session.brandVoice || '{}');
  const selectedDressIds = JSON.parse(session.selectedDressIds || '[]');
  const additionalInstructions = session.additionalInstructions || '';

  // Fetch blog content settings
  const generateImages = await getSettingBool('blog_generate_images', true);
  const generateLinks = await getSettingBool('blog_generate_links', true);

  // Build content directives that all agents must follow
  let contentDirectives = '';
  if (!generateImages) contentDirectives += 'Do NOT include any images or image markdown in the blog post.\n';
  if (!generateLinks) contentDirectives += 'Do NOT include any hyperlinks in the blog post.\n';
  const effectiveInstructions = contentDirectives + additionalInstructions;

  // Load global context for agent brand exclusivity and theme
  const allBrandLabels = await db
    .select({ displayName: brandLabels.displayName })
    .from(brandLabels)
    .where(eq(brandLabels.isActive, true));
  const allowedBrands = allBrandLabels.map((b) => b.displayName);

  let themeDescription: string | undefined;
  if (session.themeId) {
    const [theme] = await db
      .select({ description: themes.description })
      .from(themes)
      .where(eq(themes.id, parseInt(session.themeId)))
      .limit(1);
    themeDescription = theme?.description;
  }

  const globalContext = { allowedBrands, themeDescription, brandVoice };

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    let currentOutput = '';
    const insightsOn = await isInsightsEnabled();

    // Build active pipeline: blog-writer is always first, then enabled optional agents
    const enabledOptional = [];
    for (const opt of OPTIONAL_AGENTS) {
      if (await isAgentEnabled(opt.id)) {
        enabledOptional.push(opt);
      }
    }
    const totalSteps = 1 + enabledOptional.length;

    // Send full pipeline info upfront so frontend shows all agents immediately
    const pipelineAgents = [
      { id: 'blog-writer', label: 'Blog Writer' },
      ...enabledOptional.map((opt) => ({ id: opt.id, label: opt.label })),
    ];
    sendEvent(res, 'pipeline-info', { agents: pipelineAgents, totalSteps });

    // Step 1: Blog Writer (always runs, has tool access)
    {
      const stepNum = 1;
      let traceId: string | null = null;
      if (insightsOn) {
        traceId = await startTrace('blog-writer', sessionId);
      }

      sendEvent(res, 'agent-start', { agent: 'blog-writer', agentLabel: 'Blog Writer', step: stepNum, totalSteps, traceId });

      let inputPrompt = `Write a blog post featuring these wedding dresses. Use the fetch-dress-details tool to get information about the dresses with IDs: ${selectedDressIds.join(', ')}`;
      if (effectiveInstructions.trim()) {
        inputPrompt += `\n\nIMPORTANT — The client has provided these additional instructions that you MUST follow:\n${effectiveInstructions}`;
      }
      if (insightsOn && traceId) {
        traceLog(traceId, sessionId, 'blog-writer', 'agent-input', { prompt: inputPrompt });
      }

      const agent = await createBlogWriterAgent(brandVoice, selectedDressIds, effectiveInstructions, { generateImages, generateLinks }, globalContext);
      const writerRetries = await getMaxRetries('blog-writer');

      const text = await streamAgentWithRetry(
        agent,
        [{ role: 'user' as const, content: inputPrompt }],
        {
          maxRetries: writerRetries,
          onStreamEvent: (value) => {
            if (value.type === 'text-delta') {
              const chunk = (value as any).payload?.text ?? '';
              if (chunk) sendEvent(res, 'agent-chunk', { agent: 'blog-writer', chunk });
            }
          },
          onRetry: (attempt, maxAttempts) => {
            console.warn(`[Blog] blog-writer empty response, retry ${attempt + 1}/${maxAttempts}`);
            sendEvent(res, 'agent-retry', { agent: 'blog-writer', attempt: attempt + 1, maxAttempts });
          },
        },
      );

      currentOutput = text;

      if (insightsOn && traceId) {
        traceLog(traceId, sessionId, 'blog-writer', 'agent-output', { text: currentOutput, charCount: currentOutput.length });
      }

      // Send agent's full output so frontend can store per-agent versions for diff
      const writerParsed = parseFinalOutput(currentOutput);
      sendEvent(res, 'agent-complete', { agent: 'blog-writer', step: stepNum, traceId, output: writerParsed.blog });
    }

    // Remaining enabled agents
    for (let i = 0; i < enabledOptional.length; i++) {
      const opt = enabledOptional[i];
      const stepNum = i + 2;
      let traceId: string | null = null;
      if (insightsOn) {
        traceId = await startTrace(opt.id, sessionId);
      }

      sendEvent(res, 'agent-start', { agent: opt.id, agentLabel: opt.label, step: stepNum, totalSteps, traceId });

      if (insightsOn && traceId) {
        traceLog(traceId, sessionId, opt.id, 'agent-input', { prompt: currentOutput, charCount: currentOutput.length });
      }

      // Build user message: include additional instructions so every agent respects them
      let agentInput = currentOutput;
      if (effectiveInstructions.trim()) {
        agentInput = `IMPORTANT — The client has provided these additional instructions that you MUST follow throughout your work:\n${effectiveInstructions}\n\n---\n\n${currentOutput}`;
      }

      const agent = await opt.creator(globalContext);
      const agentRetries = await getMaxRetries(opt.id);

      const text = await streamAgentWithRetry(
        agent,
        [{ role: 'user' as const, content: agentInput }],
        {
          maxRetries: agentRetries,
          onStreamEvent: (value) => {
            if (value.type === 'text-delta') {
              const chunk = (value as any).payload?.text ?? '';
              if (chunk) sendEvent(res, 'agent-chunk', { agent: opt.id, chunk });
            }
          },
          onRetry: (attempt, maxAttempts) => {
            console.warn(`[Blog] ${opt.id} empty response, retry ${attempt + 1}/${maxAttempts}`);
            sendEvent(res, 'agent-retry', { agent: opt.id, attempt: attempt + 1, maxAttempts });
          },
        },
      );

      currentOutput = text;

      if (insightsOn && traceId) {
        traceLog(traceId, sessionId, opt.id, 'agent-output', { text: currentOutput, charCount: currentOutput.length });
      }

      // Send agent's full output so frontend can store per-agent versions for diff
      const agentParsed = parseFinalOutput(currentOutput);
      sendEvent(res, 'agent-complete', { agent: opt.id, step: stepNum, traceId, output: agentParsed.blog });
    }

    // Parse final output
    const { blog, seoMetadata, review } = parseFinalOutput(currentOutput);

    // Save to DB
    await db.update(blogSessions)
      .set({
        status: 'completed',
        generatedBlog: blog,
        seoMetadata: seoMetadata ? JSON.stringify(seoMetadata) : null,
        agentLog: review ? JSON.stringify(review) : null,
        updatedAt: new Date(),
      })
      .where(eq(blogSessions.id, sessionId));

    // Send completion
    sendEvent(res, 'complete', {
      sessionId,
      blog,
      seoMetadata,
      review,
    });

  } catch (err) {
    console.error('[Blog] Pipeline error:', err);
    sendEvent(res, 'error', { message: err instanceof Error ? err.message : 'Pipeline failed' });

    await db.update(blogSessions)
      .set({ status: 'error', updatedAt: new Date() })
      .where(eq(blogSessions.id, sessionId));
  }

  res.end();
});

// Fetch all traces for a blog session
router.get('/:sessionId/traces', async (req, res) => {
  try {
    const logs = await getSessionTraces(req.params.sessionId);
    return res.json({ success: true, data: logs });
  } catch (err) {
    console.error(`[Blog] Error fetching traces for session ${req.params.sessionId}:`, err);
    return res.status(500).json({ success: false, error: 'Failed to fetch traces' });
  }
});

function parseFinalOutput(text: string): {
  blog: string;
  seoMetadata: { title: string; description: string; keywords: string[] } | null;
  review: { qualityScore: number; strengths: string[]; suggestions: string[]; flags: string[] } | null;
} {
  let blog = text;
  let seoMetadata = null;
  let review = null;

  // Extract SEO metadata
  const seoMatch = text.match(/---SEO_METADATA---\s*([\s\S]*?)\s*---END_SEO_METADATA---/);
  if (seoMatch) {
    try {
      seoMetadata = JSON.parse(seoMatch[1].trim());
      blog = blog.replace(seoMatch[0], '').trim();
    } catch { /* ignore parse errors */ }
  }

  // Extract review
  const reviewMatch = text.match(/---REVIEW---\s*([\s\S]*?)\s*---END_REVIEW---/);
  if (reviewMatch) {
    try {
      review = JSON.parse(reviewMatch[1].trim());
      blog = blog.replace(reviewMatch[0], '').trim();
    } catch { /* ignore parse errors */ }
  }

  return { blog, seoMetadata, review };
}

export default router;
