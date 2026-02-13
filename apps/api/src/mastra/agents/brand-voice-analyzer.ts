import { createConfiguredAgent, getMaxRetries, streamAgentWithRetry } from '../lib/agent-factory';
import { scrapeWebpage } from '../tools/scrape-webpage';

const INSTRUCTIONS = `You are an expert brand strategist who builds comprehensive writing voice guides by analyzing websites. When given a URL, use the scrape-webpage tool to explore the site thoroughly, then produce a detailed voice profile.

CRAWL STRATEGY:
1. First scrape the given URL. The result includes a "links" array of internal pages.
2. From the returned links, pick 4-7 MORE pages to scrape. Prioritize:
   - About / Our Story / Who We Are pages
   - Blog posts (pick 2-3 diverse ones)
   - Product or collection pages
   - Testimonial or review pages
3. If a page returns an error (e.g. 404), skip it and pick another link.
4. Scrape 5-8 pages total. Work with what you get — quality over quantity.
5. Do NOT guess URLs — only use links from the returned arrays.

ANALYSIS APPROACH:
- Pay attention to the language, phrasing, and word choices used across the site
- Note recurring themes, brand-specific terminology, and emotional triggers
- Identify what the brand emphasizes and what it avoids
- Determine the target customer from the content, not just surface-level demographics
- Look for personality cues: is the brand formal or casual? authoritative or friendly?

OUTPUT FORMAT:
Do NOT output any text before the JSON. No explanations, no commentary.
Your ENTIRE response must be a single JSON object matching this exact structure:

{
  "brandName": "string — the brand or business name",
  "summary": "string — 2-3 sentence overview of the brand's identity and positioning",
  "targetAudience": "string — detailed description of the ideal customer",
  "priceRange": "string — one of: budget, mid-range, premium, luxury",
  "businessType": "string — the type of business, e.g. 'bridal retail', 'SaaS', 'outdoor gear'",
  "uniqueSellingPoints": ["string — 2-5 key differentiators"],
  "personality": {
    "archetype": "string — a short, memorable name for the brand personality, e.g. 'The Trusted Guide', 'The Creative Rebel'",
    "description": "string — 2-3 sentences explaining the personality, who the brand is as a 'character'"
  },
  "toneAttributes": [
    {
      "name": "string — e.g. 'Warm & Approachable'",
      "description": "string — detailed description with specific language examples from the site, e.g. 'Uses conversational language like \\"we're here to help\\" and \\"your journey\\"'"
    }
  ],
  "vocabulary": [
    {
      "category": "string — e.g. 'Brand Lexicon', 'Emotional Language', 'Product Descriptors'",
      "terms": ["string — actual words and phrases found on or inspired by the site"]
    }
  ],
  "writingStyle": [
    {
      "rule": "string — e.g. 'Use second person (you/your)'",
      "description": "string — explanation of why and how, with examples"
    }
  ],
  "avoidances": [
    {
      "rule": "string — e.g. 'Don't use jargon'",
      "description": "string — explanation of what to avoid and why"
    }
  ],
  "writingDirection": "string — a single guiding statement that captures the essence of how to write for this brand, like a creative brief"
}

REQUIREMENTS:
- toneAttributes must have 3-5 items, each with a descriptive name and rich description including specific language examples
- vocabulary must have 2-4 categories, each with 5-10 actual terms
- writingStyle must have 3-6 rules
- avoidances must have 2-5 items
- Every field must be filled — do not leave any empty or with placeholder text
- Base everything on actual content you scraped, not generic assumptions`;

export { INSTRUCTIONS as DEFAULT_INSTRUCTIONS };

/** Strip trailing commas before ] or } — common LLM JSON mistake */
function fixTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, '$1');
}

function tryParse(json: string): Record<string, unknown> | null {
  try { return JSON.parse(json); } catch { /* continue */ }
  // Retry after fixing trailing commas
  try { return JSON.parse(fixTrailingCommas(json)); } catch { return null; }
}

function extractJson(text: string): Record<string, unknown> {
  // Try direct parse first
  const direct = tryParse(text.trim());
  if (direct) return direct;

  // Try extracting from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const fromBlock = tryParse(codeBlockMatch[1].trim());
    if (fromBlock) return fromBlock;
  }

  // Try finding a JSON object in the text
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    const fromBraces = tryParse(text.slice(braceStart, braceEnd + 1));
    if (fromBraces) return fromBraces;
  }

  // Log what we received for debugging
  console.error(`[BrandVoice] extractJson failed. Length: ${text.length}, preview: ${text.slice(0, 300)}`);
  throw new Error(`Failed to parse brand voice JSON (${text.length} chars). Check API logs for preview.`);
}

export async function analyzeBrandVoice(
  url: string,
  previousAttempt?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const agent = await createConfiguredAgent('brand-voice-analyzer', INSTRUCTIONS, {
    'scrape-webpage': scrapeWebpage,
  });

  let prompt = `Analyze the brand voice of this website: ${url}`;
  if (previousAttempt) {
    prompt += `\n\nIMPORTANT: The user rejected a previous voice analysis. Here is what was rejected:\n${JSON.stringify(previousAttempt, null, 2)}\n\nExplore different pages than before, reconsider the tone interpretation, and produce a meaningfully different result. Do NOT produce the same analysis again.`;
  }

  const result = await agent.generate([
    { role: 'user' as const, content: prompt },
  ]);

  const text = typeof result.text === 'string' ? result.text : '';
  return extractJson(text);
}

export async function streamBrandVoiceAnalysis(
  url: string,
  onEvent: (event: { type: string; data?: unknown }) => void,
  options?: { debugMode?: boolean; previousAttempt?: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  onEvent({ type: 'status', data: 'Connecting to analysis service...' });

  const agent = await createConfiguredAgent('brand-voice-analyzer', INSTRUCTIONS, {
    'scrape-webpage': scrapeWebpage,
  });
  const maxRetries = await getMaxRetries('brand-voice-analyzer');

  let prompt = `Analyze the brand voice of this website: ${url}`;
  if (options?.previousAttempt) {
    prompt += `\n\nIMPORTANT: The user rejected a previous voice analysis. Here is what was rejected:\n${JSON.stringify(options.previousAttempt, null, 2)}\n\nExplore different pages than before, reconsider the tone interpretation, and produce a meaningfully different result. Do NOT produce the same analysis again.`;
    onEvent({ type: 'status', data: 'Re-analyzing with a fresh perspective...' });
  } else {
    onEvent({ type: 'status', data: `Visiting ${new URL(url).hostname}...` });
  }

  let sentAnalyzingMsg = false;

  const fullText = await streamAgentWithRetry(
    agent,
    [{ role: 'user' as const, content: prompt }],
    {
      maxRetries,
      onStreamEvent: (value) => {
        const payload = (value as any).payload;

        if (value.type === 'tool-call') {
          const toolUrl = payload?.args?.url || (value as any).args?.url || url;
          try {
            onEvent({ type: 'status', data: `Scraping ${new URL(toolUrl).hostname}${new URL(toolUrl).pathname}...` });
          } catch {
            onEvent({ type: 'status', data: `Scraping page...` });
          }
          if (options?.debugMode) {
            onEvent({ type: 'debug', data: {
              kind: 'tool-call',
              toolName: payload?.toolName || 'scrape-webpage',
              args: payload?.args || {},
            }});
          }
        } else if (value.type === 'tool-result') {
          onEvent({ type: 'status', data: 'Reading page content...' });
          if (options?.debugMode) {
            const raw = payload?.result || payload || (value as any).result || value;
            let toolResult: Record<string, any> = {};
            if (typeof raw === 'string') {
              try { toolResult = JSON.parse(raw); } catch { toolResult = { text: raw }; }
            } else if (typeof raw === 'object' && raw !== null) {
              toolResult = raw;
            }
            const resultUrl = payload?.args?.url || '';
            onEvent({ type: 'debug', data: {
              kind: 'tool-result',
              url: resultUrl,
              title: toolResult.title || '',
              metaDescription: toolResult.metaDescription || '',
              contentPreview: (toolResult.text || '').slice(0, 500),
              contentLength: (toolResult.text || '').length,
              ...(toolResult.error ? { error: toolResult.error } : {}),
            }});
          }
        } else if (value.type === 'text-delta') {
          if (!sentAnalyzingMsg) {
            onEvent({ type: 'status', data: 'Building brand voice profile...' });
            sentAnalyzingMsg = true;
          }
        } else if (value.type === 'error') {
          const errMsg = payload?.message || payload?.error || JSON.stringify(payload) || 'Unknown model error';
          console.error(`[BrandVoice] Stream error event:`, errMsg);
        }
      },
      onRetry: (attempt, maxAttempts) => {
        sentAnalyzingMsg = false; // Reset for retry
        onEvent({ type: 'status', data: `Model didn\u2019t respond \u2014 retrying (attempt ${attempt + 1}/${maxAttempts})...` });
      },
    },
  );

  console.log(`[BrandVoice] Raw response (${fullText.length} chars):`, fullText.slice(0, 500));

  if (options?.debugMode) {
    onEvent({ type: 'debug', data: {
      kind: 'raw-response',
      text: fullText,
      charCount: fullText.length,
    }});
  }

  const parsed = extractJson(fullText);
  return parsed;
}
