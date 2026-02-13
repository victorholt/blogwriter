import * as cheerio from 'cheerio';
import { createConfiguredAgent, getMaxRetries } from '../lib/agent-factory';

// ---------------------------------------------------------------------------
// Instructions — analysis only, no tool-call guidance
// ---------------------------------------------------------------------------

const INSTRUCTIONS = `You are an expert brand strategist who builds comprehensive writing voice guides by analyzing website content. You will receive pre-scraped content from multiple pages of a website. Analyze it carefully and produce a detailed voice profile.

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
- Base everything on actual content you were given, not generic assumptions`;

export { INSTRUCTIONS as DEFAULT_INSTRUCTIONS };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScrapedPage {
  url: string;
  title: string;
  text: string;
}

interface StatusCallback {
  (event: { type: string; data?: unknown }): void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PAGES = 8;
const FETCH_TIMEOUT = 15_000;
const HTML_LIMIT = 200_000;
const TEXT_LIMIT = 15_000;

// URL patterns scored by priority for brand voice analysis
const HIGH_PRIORITY = /\/(about|our-story|who-we-are|team|testimonials?|reviews?|blog|journal|stories|mission|values)/i;
const MEDIUM_PRIORITY = /\/(collections?|products?|pages?|services?|gallery|portfolio|faq)/i;
const SKIP_PATTERNS = /\/(cart|login|sign-?in|register|account|privacy|terms|legal|search|checkout|wishlist|compare|cdn-cgi|\.well-known)/i;
const FILE_EXTENSIONS = /\.(jpg|jpeg|png|gif|svg|pdf|css|js|ico|woff2?|ttf|eot|mp4|mp3|zip|xml|json)$/i;

// ---------------------------------------------------------------------------
// Helpers — JSON parsing (shared with v1)
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

  console.error(`[BrandVoiceFast] extractJson failed. Length: ${text.length}, preview: ${text.slice(0, 300)}`);
  throw new Error(`Failed to parse brand voice JSON (${text.length} chars). Check API logs for preview.`);
}

// ---------------------------------------------------------------------------
// Step 1: Fetch + parse a single page
// ---------------------------------------------------------------------------

async function fetchPage(url: string): Promise<{ title: string; text: string; links: string[] } | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: {
        'User-Agent': 'Blogwriter/1.0 (Brand Analysis)',
        Accept: 'text/html',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html.slice(0, HTML_LIMIT));

    // Extract internal links before removing nav/header
    let baseUrl: URL;
    try { baseUrl = new URL(url); } catch { return null; }

    const seen = new Set<string>();
    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const resolved = new URL(href, url);
        if (resolved.origin !== baseUrl.origin) return;
        if (resolved.pathname === '/' || resolved.pathname === baseUrl.pathname) return;
        if (FILE_EXTENSIONS.test(resolved.pathname)) return;
        const key = resolved.origin + resolved.pathname;
        if (seen.has(key)) return;
        seen.add(key);
        links.push(key);
      } catch { /* skip invalid */ }
    });

    // Remove non-content elements
    $('script, style, nav, footer, header, iframe, noscript, svg').remove();

    const title = $('title').text().trim();
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);

    return { title, text, links };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 2: Discover pages — fetch homepage, score & rank links
// ---------------------------------------------------------------------------

function scoreUrl(url: string): number {
  const pathname = new URL(url).pathname;
  if (SKIP_PATTERNS.test(pathname)) return -1;
  if (HIGH_PRIORITY.test(pathname)) return 3;
  if (MEDIUM_PRIORITY.test(pathname)) return 2;
  return 1;
}

async function discoverPages(startUrl: string, onStatus: StatusCallback): Promise<string[]> {
  onStatus({ type: 'status', data: 'Discovering pages...' });

  const homepage = await fetchPage(startUrl);
  if (!homepage) {
    throw new Error(`Could not fetch the homepage: ${startUrl}`);
  }

  // Score and sort discovered links
  const scored = homepage.links
    .map((link) => ({ url: link, score: scoreUrl(link) }))
    .filter((l) => l.score > 0)
    .sort((a, b) => b.score - a.score);

  // Take top N-1 (homepage is always first)
  const topLinks = scored.slice(0, MAX_PAGES - 1).map((l) => l.url);
  const urls = [startUrl, ...topLinks];

  onStatus({ type: 'status', data: `Found ${homepage.links.length} links, selected ${urls.length} pages to analyze` });
  return urls;
}

// ---------------------------------------------------------------------------
// Step 3: Scrape pages in parallel
// ---------------------------------------------------------------------------

async function scrapePages(urls: string[], onStatus: StatusCallback): Promise<ScrapedPage[]> {
  onStatus({ type: 'status', data: `Scraping ${urls.length} pages in parallel...` });

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const page = await fetchPage(url);
      if (!page || !page.text.trim()) return null;
      return { url, title: page.title, text: page.text };
    }),
  );

  const pages: ScrapedPage[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      pages.push(result.value);
    }
  }

  onStatus({ type: 'status', data: `Successfully scraped ${pages.length} of ${urls.length} pages` });
  return pages;
}

// ---------------------------------------------------------------------------
// Step 4: Single-call analysis
// ---------------------------------------------------------------------------

export async function streamBrandVoiceFastAnalysis(
  url: string,
  onEvent: StatusCallback,
  options?: { debugMode?: boolean; previousAttempt?: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  onEvent({ type: 'status', data: 'Connecting to analysis service...' });

  // 1. Discover pages
  const urls = await discoverPages(url, onEvent);

  // 2. Scrape in parallel
  const pages = await scrapePages(urls, onEvent);

  if (pages.length === 0) {
    throw new Error('Could not scrape any pages from the website');
  }

  // 3. Build content block for the LLM
  const contentBlock = pages
    .map((p) => `--- ${p.title || p.url} ---\n${p.text}`)
    .join('\n\n');

  let prompt = `I have scraped ${pages.length} pages from ${url}:\n\n${contentBlock}\n\nAnalyze this content and produce the brand voice JSON profile.`;

  if (options?.previousAttempt) {
    prompt += `\n\nIMPORTANT: The user rejected a previous voice analysis. Here is what was rejected:\n${JSON.stringify(options.previousAttempt, null, 2)}\n\nReconsider the tone interpretation and produce a meaningfully different result. Do NOT produce the same analysis again.`;
    onEvent({ type: 'status', data: 'Re-analyzing with a fresh perspective...' });
  }

  if (options?.debugMode) {
    onEvent({
      type: 'debug',
      data: {
        kind: 'fast-scrape-summary',
        pagesAttempted: urls.length,
        pagesScraped: pages.length,
        urls: pages.map((p) => p.url),
        totalChars: pages.reduce((sum, p) => sum + p.text.length, 0),
      },
    });
  }

  // 4. Create agent (NO tools — pure analysis)
  const agent = await createConfiguredAgent('brand-voice-fast', INSTRUCTIONS, {});
  const maxRetries = await getMaxRetries('brand-voice-fast');

  onEvent({ type: 'status', data: `Analyzing brand voice from ${pages.length} pages...` });

  // 5. Generate with retry (analysis only — no re-scraping)
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
        console.warn(`[BrandVoiceFast] Empty response on attempt ${attempt}/${totalAttempts}. Retrying...`);
        onEvent({ type: 'status', data: `Retrying analysis (attempt ${attempt + 1}/${totalAttempts})...` });
      }
    } catch (err) {
      if (attempt >= totalAttempts) throw err;
      console.warn(`[BrandVoiceFast] Error on attempt ${attempt}/${totalAttempts}:`, err);
      onEvent({ type: 'status', data: `Retrying analysis (attempt ${attempt + 1}/${totalAttempts})...` });
    }
  }

  if (!fullText.trim()) {
    throw new Error('No response from model after ' + totalAttempts + ' attempts');
  }

  console.log(`[BrandVoiceFast] Raw response (${fullText.length} chars):`, fullText.slice(0, 500));

  if (options?.debugMode) {
    onEvent({
      type: 'debug',
      data: { kind: 'raw-response', text: fullText, charCount: fullText.length },
    });
  }

  return extractJson(fullText);
}
