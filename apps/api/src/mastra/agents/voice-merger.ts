import { createConfiguredAgent, getMaxRetries } from '../lib/agent-factory';

// ---------------------------------------------------------------------------
// Instructions — merge two brand voices (identity + style)
// ---------------------------------------------------------------------------

const INSTRUCTIONS = `You are a brand voice merging specialist. Your job is to take two brand voices and merge them: keeping the IDENTITY from one voice while adopting the STYLE from the other.

You will receive two JSON objects:
- USER VOICE: The user's analyzed brand voice (their store, their identity)
- PRESET VOICE: A curated style persona (its personality, tone, and writing style)

MERGE RULES:

KEEP FROM USER VOICE (identity — these define WHO the brand is):
- brandName: exact value from user voice
- location: exact value from user voice
- targetAudience: exact value from user voice
- priceRange: exact value from user voice
- businessType: exact value from user voice
- uniqueSellingPoints: exact values from user voice

ADOPT FROM PRESET VOICE (style — these define HOW to write):
- personality: use the preset's archetype and description, but weave in the user's brand identity so it reads naturally
- toneAttributes: use the preset's tone attributes entirely
- writingStyle: use the preset's writing style rules entirely
- avoidances: use the preset's avoidances entirely
- writingDirection: use the preset's writing direction but reference the user's brand name/identity where appropriate

INTELLIGENTLY MERGE:
- summary: Rewrite to describe the user's store through the lens of the preset's personality. Keep the factual content about the store (what they sell, where they are, who they serve) but express it in the preset's voice and tone.
- vocabulary: Start with ALL of the user's vocabulary terms (these are store-specific and must be preserved). Keep the user's categories but you may rename them to better fit the new tone. Add any terms from the preset that complement the user's brand without conflicting.

OUTPUT FORMAT:
Your ENTIRE response must be a single JSON object. No text before or after. No explanations, no commentary, no markdown formatting.

The JSON must match this exact structure:
{
  "brandName": "string",
  "summary": "string — 2-3 sentences, user's store described in preset's voice",
  "targetAudience": "string",
  "priceRange": "string",
  "businessType": "string",
  "location": "string",
  "uniqueSellingPoints": ["string"],
  "personality": {
    "archetype": "string",
    "description": "string"
  },
  "toneAttributes": [{ "name": "string", "description": "string" }],
  "vocabulary": [{ "category": "string", "terms": ["string"] }],
  "writingStyle": [{ "rule": "string", "description": "string" }],
  "avoidances": [{ "rule": "string", "description": "string" }],
  "writingDirection": "string"
}

REQUIREMENTS:
- Every field must be filled
- toneAttributes must have 3-5 items
- vocabulary must have 2-4 categories, each with 5-10 terms
- writingStyle must have 3-6 rules
- avoidances must have 2-5 items
- The result should feel like the user's store naturally speaks in the preset's voice — not like two voices awkwardly stitched together`;

export { INSTRUCTIONS as DEFAULT_INSTRUCTIONS };

// ---------------------------------------------------------------------------
// JSON parsing helpers (same as brand-voice-formatter)
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

  console.error(`[VoiceMerger] extractJson failed. Length: ${text.length}, preview: ${text.slice(0, 300)}`);
  throw new Error(`Failed to parse merged voice JSON (${text.length} chars). Check API logs for preview.`);
}

// ---------------------------------------------------------------------------
// Main merge function
// ---------------------------------------------------------------------------

export async function mergeVoices(
  userVoice: Record<string, unknown>,
  presetVoice: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const agent = await createConfiguredAgent('voice-merger', INSTRUCTIONS, {});
  const maxRetries = await getMaxRetries('voice-merger');

  const prompt = `Merge these two brand voices according to your instructions.

USER VOICE (keep identity from this):
${JSON.stringify(userVoice, null, 2)}

PRESET VOICE (adopt style from this):
${JSON.stringify(presetVoice, null, 2)}`;

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
        console.warn(`[VoiceMerger] Empty response on attempt ${attempt}/${totalAttempts}. Retrying...`);
      }
    } catch (err) {
      if (attempt >= totalAttempts) throw err;
      console.warn(`[VoiceMerger] Error on attempt ${attempt}/${totalAttempts}:`, err);
    }
  }

  if (!fullText.trim()) {
    throw new Error('No response from model after ' + totalAttempts + ' attempts');
  }

  console.log(`[VoiceMerger] Raw response (${fullText.length} chars):`, fullText.slice(0, 500));

  return extractJson(fullText);
}
