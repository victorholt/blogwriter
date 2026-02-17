import { createConfiguredAgent, getMaxRetries } from '../lib/agent-factory';

// ---------------------------------------------------------------------------
// Instructions — format raw text into BrandVoice JSON (no web scraping)
// ---------------------------------------------------------------------------

const INSTRUCTIONS = `You are a text formatting specialist. Your job is to take raw brand voice text and organize it into a structured JSON format.

CRITICAL RULES:
- Do NOT invent, embellish, or change the voice content. Your job is ONLY to organize and format.
- Preserve the original wording, tone, and meaning as closely as possible.
- If the text doesn't explicitly cover a required field, make a minimal, reasonable inference from context.
- If the text is ambiguous about a particular section, use the closest matching content.

OUTPUT FORMAT:
Do NOT output any text before the JSON. No explanations, no commentary.
Your ENTIRE response must be a single JSON object matching this exact structure:

{
  "brandName": "string — the brand or business name",
  "summary": "string — 2-3 sentence overview of the brand's identity and positioning",
  "targetAudience": "string — detailed description of the ideal customer",
  "priceRange": "string — one of: budget, mid-range, premium, luxury",
  "businessType": "string — the type of business, e.g. 'bridal retail', 'SaaS', 'outdoor gear'",
  "location": "string — the physical location (city, state/region, or full address) of the business, as found in the text. If multiple locations, list the primary one. If no location is found, use an empty string.",
  "uniqueSellingPoints": ["string — 2-5 key differentiators"],
  "personality": {
    "archetype": "string — a short, memorable name for the brand personality, e.g. 'The Trusted Guide', 'The Creative Rebel'",
    "description": "string — 2-3 sentences explaining the personality, who the brand is as a 'character'"
  },
  "toneAttributes": [
    {
      "name": "string — e.g. 'Warm & Approachable'",
      "description": "string — detailed description with specific language examples"
    }
  ],
  "vocabulary": [
    {
      "category": "string — e.g. 'Brand Lexicon', 'Emotional Language', 'Product Descriptors'",
      "terms": ["string — actual words and phrases from or inspired by the source text"]
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

FORMATTING APPROACH:
- Extract the brand name from the text (look for company/brand mentions)
- Summarize the overall voice in 2-3 sentences for the "summary" field
- Identify tone attributes from descriptive language about the voice
- Group vocabulary terms into logical categories
- Extract writing rules and avoidances from explicit guidelines
- Determine the writing direction from any overarching guidance statements
- Identify target audience from demographic or psychographic descriptions
- Extract location from address mentions, "visit us" language, or city/state references

If the user provides additional formatting instructions, follow them to adjust HOW you organize the content (e.g., "emphasize the luxury aspects", "split vocabulary into more categories"), but still do not change the underlying voice content.

REQUIREMENTS:
- toneAttributes must have 3-5 items, each with a descriptive name and rich description
- vocabulary must have 2-4 categories, each with 5-10 actual terms
- writingStyle must have 3-6 rules
- avoidances must have 2-5 items
- Every field must be filled — do not leave any empty or with placeholder text
- Base everything on the actual text provided, not generic assumptions`;

export { INSTRUCTIONS as DEFAULT_INSTRUCTIONS };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatusCallback {
  (event: { type: string; data?: unknown }): void;
}

// ---------------------------------------------------------------------------
// JSON parsing helpers
// ---------------------------------------------------------------------------

function fixTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, '$1');
}

function tryParse(json: string): Record<string, unknown> | null {
  try { return JSON.parse(json); } catch { /* continue */ }
  try { return JSON.parse(fixTrailingCommas(json)); } catch { return null; }
}

function extractJson(text: string): Record<string, unknown> {
  const direct = tryParse(text.trim());
  if (direct) return direct;

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const fromBlock = tryParse(codeBlockMatch[1].trim());
    if (fromBlock) return fromBlock;
  }

  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    const fromBraces = tryParse(text.slice(braceStart, braceEnd + 1));
    if (fromBraces) return fromBraces;
  }

  console.error(`[BrandVoiceFormatter] extractJson failed. Length: ${text.length}, preview: ${text.slice(0, 300)}`);
  throw new Error(`Failed to parse brand voice JSON (${text.length} chars). Check API logs for preview.`);
}

// ---------------------------------------------------------------------------
// Main formatting function
// ---------------------------------------------------------------------------

export async function formatBrandVoiceText(
  rawText: string,
  onEvent: StatusCallback,
  options?: { additionalInstructions?: string },
): Promise<Record<string, unknown>> {
  onEvent({ type: 'status', data: 'Connecting to formatting service...' });

  const agent = await createConfiguredAgent('brand-voice-formatter', INSTRUCTIONS, {});
  const maxRetries = await getMaxRetries('brand-voice-formatter');

  let prompt = `Here is raw brand voice text to organize into the structured JSON format:\n\n${rawText}`;

  if (options?.additionalInstructions?.trim()) {
    prompt += `\n\n[Additional Formatting Instructions]\n${options.additionalInstructions.trim()}`;
  }

  onEvent({ type: 'status', data: 'Formatting brand voice text...' });

  let fullText = '';
  const totalAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      const result = await agent.generate([
        { role: 'user' as const, content: prompt },
      ]);

      fullText = typeof result.text === 'string' ? result.text : '';

      if (fullText.trim()) break;

      if (attempt < totalAttempts) {
        console.warn(`[BrandVoiceFormatter] Empty response on attempt ${attempt}/${totalAttempts}. Retrying...`);
        onEvent({ type: 'status', data: `Retrying formatting (attempt ${attempt + 1}/${totalAttempts})...` });
      }
    } catch (err) {
      if (attempt >= totalAttempts) throw err;
      console.warn(`[BrandVoiceFormatter] Error on attempt ${attempt}/${totalAttempts}:`, err);
      onEvent({ type: 'status', data: `Retrying formatting (attempt ${attempt + 1}/${totalAttempts})...` });
    }
  }

  if (!fullText.trim()) {
    throw new Error('No response from model after ' + totalAttempts + ' attempts');
  }

  console.log(`[BrandVoiceFormatter] Raw response (${fullText.length} chars):`, fullText.slice(0, 500));

  onEvent({ type: 'status', data: 'Building voice profile...' });

  return extractJson(fullText);
}
