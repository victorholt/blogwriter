import { createConfiguredAgent } from '../lib/agent-factory';
import { scrapeWebpage } from '../tools/scrape-webpage';

const INSTRUCTIONS = `You are a brand strategist specializing in bridal retail. When given a store URL, use the scrape-webpage tool to fetch the page content, then analyze it.

CRITICAL RULES:
- First scrape the given URL. The result includes a "links" array of internal pages found on that page.
- If the homepage lacks brand details, pick ONE link from the returned links array that looks most useful (e.g. an about page, our story, or blog page). Do NOT guess URLs — only use links from the array.
- If a page returns an error (e.g. 404), you may try ONE more link from the array. Never retry the same URL.
- Scrape AT MOST 3 pages total. Work with what you get.
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
  options?: { debugMode?: boolean },
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
