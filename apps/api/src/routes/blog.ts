import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { blogSessions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createBlogWriterAgent } from '../mastra/agents/blog-writer';
import { createBlogEditorAgent } from '../mastra/agents/blog-editor';
import { createSeoSpecialistAgent } from '../mastra/agents/seo-specialist';
import { createSeniorEditorAgent } from '../mastra/agents/senior-editor';
import { createBlogReviewerAgent } from '../mastra/agents/blog-reviewer';

const router = Router();

const generateSchema = z.object({
  storeUrl: z.string().min(1),
  brandVoice: z.object({
    brandName: z.string(),
    tone: z.array(z.string()),
    targetAudience: z.string(),
    priceRange: z.string(),
    uniqueSellingPoints: z.array(z.string()),
    suggestedBlogTone: z.string(),
    summary: z.string(),
  }),
  selectedDressIds: z.array(z.string()).min(1),
  additionalInstructions: z.string().optional(),
});

// POST /api/blog/generate - Create session
router.post('/generate', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid request';
    return res.status(400).json({ success: false, error: message });
  }

  try {
    const { storeUrl, brandVoice, selectedDressIds, additionalInstructions } = parsed.data;

    const [session] = await db.insert(blogSessions).values({
      storeUrl,
      brandVoice: JSON.stringify(brandVoice),
      selectedDressIds: JSON.stringify(selectedDressIds),
      additionalInstructions: additionalInstructions || '',
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

// Pipeline agent definitions
const PIPELINE = [
  { id: 'blog-writer', label: 'Blog Writer', step: 1 },
  { id: 'blog-editor', label: 'Blog Editor', step: 2 },
  { id: 'seo-specialist', label: 'SEO Specialist', step: 3 },
  { id: 'senior-editor', label: 'Senior Editor', step: 4 },
  { id: 'blog-reviewer', label: 'Blog Reviewer', step: 5 },
];
const TOTAL_STEPS = PIPELINE.length;

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

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    let currentOutput = '';

    // Step 1: Blog Writer (with tool access)
    {
      const step = PIPELINE[0];
      sendEvent(res, 'agent-start', { agent: step.id, agentLabel: step.label, step: step.step, totalSteps: TOTAL_STEPS });

      const agent = await createBlogWriterAgent(brandVoice, selectedDressIds, additionalInstructions);
      const result = await agent.stream([
        { role: 'user' as const, content: `Write a blog post featuring these wedding dresses. Use the fetch-dress-details tool to get information about the dresses with IDs: ${selectedDressIds.join(', ')}` },
      ]);

      let text = '';
      const reader = result.fullStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.type === 'text-delta') {
          const chunk = (value as any).payload?.text ?? '';
          text += chunk;
          if (chunk) sendEvent(res, 'agent-chunk', { agent: step.id, chunk });
        }
      }

      // Fallback to result.text if streaming didn't capture
      if (!text.trim() && result.text) {
        text = typeof result.text === 'string' ? result.text : await result.text;
      }

      currentOutput = text;
      sendEvent(res, 'agent-complete', { agent: step.id, step: step.step });
    }

    // Steps 2-5: Editor, SEO, Senior Editor, Reviewer
    const agentCreators = [
      createBlogEditorAgent,
      createSeoSpecialistAgent,
      createSeniorEditorAgent,
      createBlogReviewerAgent,
    ];

    for (let i = 0; i < agentCreators.length; i++) {
      const step = PIPELINE[i + 1];
      sendEvent(res, 'agent-start', { agent: step.id, agentLabel: step.label, step: step.step, totalSteps: TOTAL_STEPS });

      const agent = await agentCreators[i]();
      const result = await agent.stream([
        { role: 'user' as const, content: currentOutput },
      ]);

      let text = '';
      const reader = result.fullStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.type === 'text-delta') {
          const chunk = (value as any).payload?.text ?? '';
          text += chunk;
          if (chunk) sendEvent(res, 'agent-chunk', { agent: step.id, chunk });
        }
      }

      if (!text.trim() && result.text) {
        text = typeof result.text === 'string' ? result.text : await result.text;
      }

      currentOutput = text;
      sendEvent(res, 'agent-complete', { agent: step.id, step: step.step });
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
