# Agent Pipeline

## Purpose

Define the Mastra agent architecture, tool specifications, model resolution, and the multi-agent blog generation pipeline.

---

## Dependencies

```bash
cd apps/api
npm install @mastra/core zod cheerio
```

- `@mastra/core` — Agent and tool framework
- `zod` — Schema validation (used by Mastra for tool I/O)
- `cheerio` — HTML parsing for web scraping tool

---

## File Structure

```
apps/api/src/mastra/
├── index.ts                    # Mastra instance registration
├── agents/
│   ├── brand-voice-analyzer.ts # Step 1 agent
│   ├── blog-writer.ts          # Pipeline: step 1
│   ├── blog-editor.ts          # Pipeline: step 2
│   ├── seo-specialist.ts       # Pipeline: step 3
│   ├── senior-editor.ts        # Pipeline: step 4
│   └── blog-reviewer.ts        # Pipeline: step 5
├── tools/
│   ├── scrape-webpage.ts       # Fetches and cleans HTML
│   └── fetch-dress-details.ts  # Gets dress data from DB
└── lib/
    ├── model-resolver.ts       # Reads agent configs from DB
    └── agent-factory.ts        # Creates configured agent instances
```

---

## Model Resolution

Each agent's model is configurable at runtime via the `agent_model_configs` database table. The resolution chain:

```
Route handler → Agent factory → Model resolver → DB (with 60s cache) → Agent constructor
```

### Model Resolver (`mastra/lib/model-resolver.ts`)

```typescript
import { db } from '../../db';
import { agentModelConfigs } from '../../db/schema';

interface AgentConfig {
  modelId: string;
  temperature: string;
  maxTokens: string;
}

let configCache: Map<string, AgentConfig> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 60 seconds

export async function getAgentModelConfig(agentId: string): Promise<AgentConfig> {
  const now = Date.now();
  if (now - cacheTimestamp > CACHE_TTL) {
    const configs = await db.select().from(agentModelConfigs);
    configCache = new Map(configs.map(c => [c.agentId, {
      modelId: c.modelId,
      temperature: c.temperature ?? '0.7',
      maxTokens: c.maxTokens ?? '4096',
    }]));
    cacheTimestamp = now;
  }
  return configCache.get(agentId) ?? {
    modelId: 'openrouter/anthropic/claude-sonnet-4-5-20250929',
    temperature: '0.7',
    maxTokens: '4096',
  };
}
```

### Agent Factory (`mastra/lib/agent-factory.ts`)

```typescript
import { Agent } from '@mastra/core/agent';
import { getAgentModelConfig } from './model-resolver';

export async function createConfiguredAgent(
  agentId: string,
  instructions: string,
  tools: Record<string, any> = {},
): Promise<Agent> {
  const config = await getAgentModelConfig(agentId);
  return new Agent({
    id: agentId,
    name: agentId,
    instructions,
    model: config.modelId,
    tools,
  });
}
```

**Why factory pattern?** Mastra agents accept a `model` string at construction. Since each agent's model is database-configurable, we create fresh agent instances per request with the current config. The 60-second cache prevents hitting the DB on every call while allowing near-real-time config changes from the admin panel.

---

## Tools

### scrapeWebpage (`tools/scrape-webpage.ts`)

Fetches a webpage and returns cleaned text content for brand voice analysis.

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import * as cheerio from 'cheerio';

export const scrapeWebpage = createTool({
  id: 'scrape-webpage',
  description: 'Fetches a webpage URL and returns cleaned text content for analysis',
  inputSchema: z.object({
    url: z.string().url(),
  }),
  outputSchema: z.object({
    title: z.string(),
    text: z.string(),
    metaDescription: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const response = await fetch(context.url, {
      signal: AbortSignal.timeout(10_000), // 10s timeout
      headers: { 'User-Agent': 'Blogwriter/1.0 (Brand Analysis)' },
    });

    const html = await response.text();
    const $ = cheerio.load(html.slice(0, 100_000)); // Limit to 100KB

    // Remove non-content elements
    $('script, style, nav, footer, header, iframe, noscript').remove();

    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8_000);

    return { title, text, metaDescription };
  },
});
```

**Safety:**
- 10-second timeout
- 100KB HTML limit
- 8,000 character text limit (fits in most LLM contexts)
- Static HTML parsing only (no JavaScript execution)

### fetchDressDetails (`tools/fetch-dress-details.ts`)

Retrieves full details for selected dresses from the Postgres cache.

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { db } from '../../db';
import { cachedDresses } from '../../db/schema';
import { inArray } from 'drizzle-orm';

export const fetchDressDetails = createTool({
  id: 'fetch-dress-details',
  description: 'Retrieves full details for selected wedding dresses from the database',
  inputSchema: z.object({
    dressIds: z.array(z.string()),
  }),
  outputSchema: z.object({
    dresses: z.array(z.object({
      name: z.string(),
      designer: z.string().optional(),
      description: z.string().optional(),
      price: z.string().optional(),
      category: z.string().optional(),
    })),
  }),
  execute: async ({ context }) => {
    const results = await db
      .select()
      .from(cachedDresses)
      .where(inArray(cachedDresses.externalId, context.dressIds));

    return {
      dresses: results.map(d => ({
        name: d.name,
        designer: d.designer ?? undefined,
        description: d.description ?? undefined,
        price: d.price ?? undefined,
        category: d.category ?? undefined,
      })),
    };
  },
});
```

---

## Agent Definitions

### Brand Voice Analyzer

**Purpose:** Analyze a store's homepage to extract brand personality, tone, and positioning.

**ID:** `brand-voice-analyzer`

**Tools:** `scrapeWebpage`

**Instructions:**
```
You are a brand strategist specializing in bridal retail. When given a store URL, use the scrapeWebpage tool to fetch the page content, then analyze it to extract:

1. Brand name
2. Tone descriptors (3-5 adjectives that describe the brand's voice)
3. Target audience profile
4. Price positioning (budget, mid-range, premium, luxury)
5. Unique selling points (2-4 key differentiators)
6. Suggested blog tone (a sentence describing how blog posts should sound)
7. Summary (2-3 sentence overview of the brand)

Return your analysis as structured JSON matching this format:
{
  "brandName": "...",
  "tone": ["...", "...", "..."],
  "targetAudience": "...",
  "priceRange": "...",
  "uniqueSellingPoints": ["...", "..."],
  "suggestedBlogTone": "...",
  "summary": "..."
}
```

---

### Blog Writer

**Purpose:** Write the initial draft of the blog post.

**ID:** `blog-writer`

**Tools:** `fetchDressDetails`

**Instructions (dynamic — constructed at runtime):**
```
You are a professional wedding blog writer. Write an engaging, SEO-friendly blog post about wedding dresses.

Brand Voice: {brandVoice.summary}
Tone: {brandVoice.tone.join(', ')}
Target Audience: {brandVoice.targetAudience}

Use the fetchDressDetails tool to get full details about the selected dresses, then feature them naturally within the blog narrative.

Selected dress IDs: {selectedDressIds}

Additional instructions from the client: {additionalInstructions}

Requirements:
- 800-1200 words
- Include H2 and H3 headers
- Feature each selected dress naturally (don't just list them)
- Match the brand's tone
- Write in Markdown format
- Include a compelling introduction and conclusion
```

---

### Blog Editor

**Purpose:** Polish the draft for clarity, flow, and consistency.

**ID:** `blog-editor`

**Tools:** None

**Instructions:**
```
You are a professional editor specializing in bridal content. Review and improve the provided blog draft.

Focus on:
- Grammar and spelling
- Sentence flow and readability
- Consistent tone throughout
- Smooth transitions between sections
- Removing redundancy
- Ensuring the brand voice is maintained

Keep the same structure and length. Return the improved version in Markdown.
Do NOT add new sections or significantly change the content — your job is to polish, not rewrite.
```

---

### SEO Specialist

**Purpose:** Optimize the blog for search engines without hurting readability.

**ID:** `seo-specialist`

**Tools:** None

**Instructions:**
```
You are an SEO specialist for bridal e-commerce. Optimize this blog post for search engines while preserving its natural readability.

Optimize:
- H2/H3 headers (include target keywords naturally)
- Keyword placement (2-3% density, primary keyword in first 100 words)
- Internal linking suggestions (add placeholders like [INTERNAL_LINK: topic])
- Image alt text suggestions (add placeholders like [ALT: description])

After the blog content, add a JSON block with SEO metadata:
---SEO_METADATA---
{
  "title": "Under 60 characters, includes primary keyword",
  "description": "Under 160 characters, compelling summary",
  "keywords": ["primary keyword", "secondary", "tertiary"]
}
---END_SEO_METADATA---

Do NOT stuff keywords or make the text sound unnatural. The blog should read perfectly well without knowing it was SEO-optimized.
```

---

### Senior Editor

**Purpose:** Final content quality gate before publication.

**ID:** `senior-editor`

**Tools:** None

**Instructions:**
```
You are a senior editor at a premium bridal publication. This is the final editorial review before publication.

Review for:
- Factual consistency (dress details match throughout)
- Brand voice alignment
- Professional tone appropriate for the target audience
- Compelling narrative flow
- Proper Markdown formatting
- No placeholder text or incomplete sections

Make final refinements. Keep the SEO metadata block intact at the end.
If you find critical issues, fix them. If the content is strong, make minimal changes.
Return the final blog in clean Markdown with the SEO metadata block.
```

---

### Blog Reviewer

**Purpose:** Validate quality and produce the final structured output.

**ID:** `blog-reviewer`

**Tools:** None

**Instructions:**
```
You are a content quality reviewer. Evaluate the final blog post and produce a structured assessment.

Review criteria:
- Content quality (writing, engagement, information value)
- SEO optimization (headers, keyword usage, metadata)
- Brand voice consistency
- Technical accuracy (dress details, pricing if mentioned)
- Formatting (clean Markdown, proper headers, no artifacts)

Return your output in this exact format:

---REVIEW---
{
  "qualityScore": 8,
  "strengths": ["Well-structured narrative", "Natural keyword integration"],
  "suggestions": ["Could add more specific styling tips"],
  "flags": []
}
---END_REVIEW---

Then return the final blog post (unchanged if quality score >= 7, or with fixes if below 7).
Include the SEO metadata block from the previous step.
```

---

## Pipeline Orchestration

The 5 blog agents run sequentially. Each agent receives the previous agent's output as input.

```mermaid
graph LR
    A[Blog Writer] -->|draft| B[Blog Editor]
    B -->|polished| C[SEO Specialist]
    C -->|optimized| D[Senior Editor]
    D -->|final| E[Blog Reviewer]
    E -->|published| F[Result]
```

### Why Manual Orchestration (Not Mastra Workflows)?

Mastra workflows run to completion and return a final result. They don't natively emit intermediate progress events. We need SSE streaming between each agent step so the user sees real-time progress. Manual orchestration gives us full control over the SSE event stream.

### Orchestration Code Pattern

```typescript
async function runBlogPipeline(session: BlogSession, res: express.Response): Promise<void> {
  const agents = [
    { id: 'blog-writer', label: 'Blog Writer', instructions: buildWriterInstructions(session), tools: { fetchDressDetails } },
    { id: 'blog-editor', label: 'Blog Editor', instructions: EDITOR_INSTRUCTIONS, tools: {} },
    { id: 'seo-specialist', label: 'SEO Specialist', instructions: SEO_INSTRUCTIONS, tools: {} },
    { id: 'senior-editor', label: 'Senior Editor', instructions: SENIOR_EDITOR_INSTRUCTIONS, tools: {} },
    { id: 'blog-reviewer', label: 'Blog Reviewer', instructions: REVIEWER_INSTRUCTIONS, tools: {} },
  ];

  let currentContent = buildInitialPrompt(session);

  for (let i = 0; i < agents.length; i++) {
    const { id, label, instructions, tools } = agents[i];

    sendSSE(res, 'agent-start', { agent: id, agentLabel: label, step: i + 1, totalSteps: agents.length });

    const agent = await createConfiguredAgent(id, instructions, tools);
    const stream = await agent.stream([{ role: 'user', content: currentContent }]);

    let fullText = '';
    for await (const chunk of stream.textStream) {
      fullText += chunk;
      sendSSE(res, 'agent-progress', { agent: id, chunk });
    }

    currentContent = fullText;
    sendSSE(res, 'agent-complete', { agent: id, step: i + 1 });
  }

  // Parse final output for blog content and SEO metadata
  const { blog, seoMetadata, review } = parseFinalOutput(currentContent);

  // Save to database
  await updateBlogSession(session.id, { generatedBlog: blog, seoMetadata, status: 'completed' });

  sendSSE(res, 'complete', { sessionId: session.id, blog, seoMetadata, review });
}
```

### SSE Helper

```typescript
function sendSSE(res: express.Response, event: string, data: Record<string, unknown>): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
```

---

## Error Handling

### Per-Agent Retry

If an agent call fails (network error, rate limit, model error):
1. Retry once with exponential backoff (2 seconds)
2. If retry fails, send `error` SSE event and update session status to `failed`
3. Log the error with agent ID and step number for debugging

### Partial Recovery (Future)

The `agent_log` column in `blog_sessions` stores each agent's output. In the future, this enables resuming a failed pipeline from the last successful step.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | No (fallback) | OpenRouter API key — used only if `app_settings` table has no key set |
| `ADMIN_TOKEN` | Yes | UUID token for admin panel access |

### API Key Resolution

The OpenRouter API key is resolved in this order:
1. **Database** (`app_settings` table, key `openrouter_api_key`) — primary, set via admin panel
2. **Environment variable** (`OPENROUTER_API_KEY`) — fallback for initial setup before admin panel is configured

The model resolver caches the API key alongside agent configs (60s TTL).
