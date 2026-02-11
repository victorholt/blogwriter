import { createConfiguredAgent } from '../lib/agent-factory';
import { scrapeWebpage } from '../tools/scrape-webpage';

const INSTRUCTIONS = `You are a brand strategist specializing in bridal retail. When given a store URL, use the scrape-webpage tool to fetch the page content, then analyze it.

CRITICAL RULES:
- Scrape AT MOST 2 pages total: the given URL plus optionally ONE more page (e.g. /about or /our-story) if the homepage lacks brand details.
- Do NOT scrape more than 2 pages. Work with what you get.
- Do NOT output any text before the JSON. No explanations, no commentary.
- Your ENTIRE response must be a single JSON object — nothing else.

Extract:
1. Brand name
2. Tone descriptors (3-5 adjectives)
3. Target audience profile
4. Price positioning (budget, mid-range, premium, luxury)
5. Unique selling points (2-4 key differentiators)
6. Suggested blog tone (one sentence)
7. Summary (2-3 sentences)

Return ONLY this JSON:
{
  "brandName": "...",
  "tone": ["...", "...", "..."],
  "targetAudience": "...",
  "priceRange": "...",
  "uniqueSellingPoints": ["...", "..."],
  "suggestedBlogTone": "...",
  "summary": "..."
}`;

function extractJson(text: string): Record<string, unknown> {
  // Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch { /* continue */ }

  // Try extracting from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch { /* continue */ }
  }

  // Try finding a JSON object in the text
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(text.slice(braceStart, braceEnd + 1));
    } catch { /* continue */ }
  }

  throw new Error(`Failed to parse brand voice analysis from agent response`);
}

export async function analyzeBrandVoice(url: string): Promise<Record<string, unknown>> {
  const agent = await createConfiguredAgent('brand-voice-analyzer', INSTRUCTIONS, {
    'scrape-webpage': scrapeWebpage,
  });

  const result = await agent.generate([
    {
      role: 'user' as const,
      content: `Analyze the brand voice of this website: ${url}`,
    },
  ]);

  const text = typeof result.text === 'string' ? result.text : '';
  return extractJson(text);
}

export async function streamBrandVoiceAnalysis(
  url: string,
  onEvent: (event: { type: string; data?: unknown }) => void,
): Promise<Record<string, unknown>> {
  onEvent({ type: 'status', data: 'Connecting to analysis service...' });

  const agent = await createConfiguredAgent('brand-voice-analyzer', INSTRUCTIONS, {
    'scrape-webpage': scrapeWebpage,
  });

  onEvent({ type: 'status', data: `Visiting ${new URL(url).hostname}...` });

  const result = await agent.stream([
    {
      role: 'user' as const,
      content: `Analyze the brand voice of this website: ${url}`,
    },
  ]);

  let fullText = '';
  const reader = result.fullStream.getReader();
  let sentAnalyzingMsg = false;
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const payload = (value as any).payload;

    if (value.type === 'tool-call') {
      const toolUrl = payload?.args?.url || (value as any).args?.url || url;
      try {
        onEvent({ type: 'status', data: `Scraping ${new URL(toolUrl).hostname}${new URL(toolUrl).pathname}...` });
      } catch {
        onEvent({ type: 'status', data: `Scraping page...` });
      }
    } else if (value.type === 'tool-result') {
      onEvent({ type: 'status', data: 'Reading page content...' });
    } else if (value.type === 'text-delta') {
      if (!sentAnalyzingMsg) {
        onEvent({ type: 'status', data: 'Building brand profile...' });
        sentAnalyzingMsg = true;
      }
      fullText += payload?.text ?? '';
    } else if (value.type === 'error') {
      const errMsg = payload?.message || payload?.error || JSON.stringify(payload) || 'Unknown model error';
      console.error(`[BrandVoice] Stream error event:`, errMsg);
      streamError = errMsg;
    }
  }

  // If streaming didn't capture text, fall back to the result's text property
  if (!fullText.trim() && result.text) {
    fullText = typeof result.text === 'string' ? result.text : await result.text;
  }

  if (!fullText.trim()) {
    const detail = streamError || 'No response from model';
    console.error(`[BrandVoice] Empty response for ${url}. Detail: ${detail}`);
    throw new Error(`Brand voice analysis failed: ${detail}`);
  }

  console.log(`[BrandVoice] Raw response (${fullText.length} chars):`, fullText.slice(0, 500));

  const parsed = extractJson(fullText);
  return parsed;
}
