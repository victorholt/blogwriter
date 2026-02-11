/**
 * Word-level diff utility for comparing agent outputs.
 * Uses a longest common subsequence (LCS) approach on word tokens.
 */

export type DiffSegmentType = 'equal' | 'added' | 'removed';

export interface DiffSegment {
  type: DiffSegmentType;
  text: string;
}

/**
 * Agent color assignments for attribution highlighting.
 */
export const AGENT_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  'blog-writer': { bg: 'transparent', border: '#cbd5e1', label: 'Writer' },
  'blog-editor': { bg: 'rgba(168, 85, 247, 0.10)', border: '#a855f7', label: 'Editor' },
  'seo-specialist': { bg: 'rgba(34, 197, 94, 0.10)', border: '#22c55e', label: 'SEO' },
  'senior-editor': { bg: 'rgba(249, 115, 22, 0.10)', border: '#f97316', label: 'Senior Editor' },
  'blog-reviewer': { bg: 'rgba(107, 114, 128, 0.10)', border: '#6b7280', label: 'Reviewer' },
};

/**
 * Tokenize text into words while preserving whitespace/punctuation
 * so we can reconstruct the text exactly from tokens.
 */
function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) || [];
}

/**
 * Compute LCS table for two token arrays.
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Compute a word-level diff between two strings.
 * Returns an array of segments marking text as equal, added, or removed.
 */
export function computeDiff(oldText: string, newText: string): DiffSegment[] {
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);
  const dp = lcsTable(oldTokens, newTokens);

  const rawSegments: DiffSegment[] = [];
  let i = oldTokens.length;
  let j = newTokens.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      rawSegments.push({ type: 'equal', text: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawSegments.push({ type: 'added', text: newTokens[j - 1] });
      j--;
    } else {
      rawSegments.push({ type: 'removed', text: oldTokens[i - 1] });
      i--;
    }
  }

  rawSegments.reverse();

  // Merge consecutive segments of the same type
  const segments: DiffSegment[] = [];
  for (const seg of rawSegments) {
    if (segments.length > 0 && segments[segments.length - 1].type === seg.type) {
      segments[segments.length - 1].text += seg.text;
    } else {
      segments.push({ ...seg });
    }
  }

  return segments;
}

/**
 * Wrap text in an HTML tag, splitting at markdown block boundaries
 * so the tags don't prevent markdown from recognising headings,
 * list items, blockquotes, etc.
 */
function wrapBlockAware(text: string, tag: string, cls: string, extraAttrs?: string): string {
  const attrStr = extraAttrs ? ` ${extraAttrs}` : '';
  const open = `<${tag} class="${cls}"${attrStr}>`;
  const close = `</${tag}>`;

  // Pure inline text (no block boundaries) — wrap directly
  if (!text.includes('\n\n') && !/^#{1,6}\s/m.test(text)) {
    return `${open}${text}${close}`;
  }

  // Split into blocks at double-newline boundaries
  const blocks = text.split(/(\n\n+)/);
  let result = '';

  for (const block of blocks) {
    // Preserve paragraph-break whitespace as-is
    if (/^\n+$/.test(block)) {
      result += block;
      continue;
    }

    // Heading: place tag after # markers
    const headingMatch = block.match(/^(#{1,6}\s+)([\s\S]*)/);
    if (headingMatch) {
      result += `${headingMatch[1]}${open}${headingMatch[2]}${close}`;
      continue;
    }

    // List item: place tag after bullet
    const listMatch = block.match(/^([-*]\s+|\d+\.\s+)([\s\S]*)/);
    if (listMatch) {
      result += `${listMatch[1]}${open}${listMatch[2]}${close}`;
      continue;
    }

    // Blockquote: place tag after >
    const quoteMatch = block.match(/^(>\s+)([\s\S]*)/);
    if (quoteMatch) {
      result += `${quoteMatch[1]}${open}${quoteMatch[2]}${close}`;
      continue;
    }

    // Plain paragraph — wrap entirely
    result += `${open}${block}${close}`;
  }

  return result;
}

/**
 * Build an annotated markdown string with <ins>/<del> tags for diff
 * highlighting. Designed to be fed through react-markdown + rehype-raw
 * so the blog renders with editorial styling and diff overlays.
 */
export function buildAnnotatedMarkdown(segments: DiffSegment[]): string {
  let result = '';

  for (const seg of segments) {
    if (seg.type === 'equal') {
      result += seg.text;
    } else if (seg.type === 'removed') {
      result += wrapBlockAware(seg.text, 'del', 'diff-hl diff-hl--removed');
    } else {
      result += wrapBlockAware(seg.text, 'ins', 'diff-hl diff-hl--added');
    }
  }

  return result;
}

/**
 * Build an annotated markdown string from attribution segments.
 * Each segment is wrapped in a <span> with inline styles for agent color
 * and a data-seg-idx attribute for tooltip lookup via event delegation.
 */
export function buildAnnotatedAttributionMarkdown(segments: AttributionSegment[]): string {
  let result = '';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const color = AGENT_COLORS[seg.agent] || AGENT_COLORS['blog-writer'];
    const isModified = !!seg.previousText;

    const cls = `attribution__segment${isModified ? ' attribution__segment--modified' : ''}`;
    const style = `background:${color.bg};border-bottom:2px solid ${color.border}`;
    const attrs = `style="${style}" data-seg-idx="${i}"`;

    result += wrapBlockAware(seg.text, 'span', cls, attrs);
  }

  return result;
}

export interface AttributionSegment {
  text: string;
  /** The agent that introduced or last modified this text */
  agent: string;
  /** The previous version of this text (if modified), for hover tooltip */
  previousText?: string;
  /** The agent whose version was replaced */
  previousAgent?: string;
}

/**
 * Build attribution segments by comparing successive agent outputs.
 * Each segment of the final text is attributed to the agent that wrote or last modified it.
 *
 * Strategy: We maintain an array of [char, agentId] tuples for the current text.
 * When diffing against the next agent's output:
 * - 'equal' chars keep their existing attribution
 * - 'added' chars get the new agent's attribution
 * - 'removed' chars disappear
 *
 * @param agentOutputs - Ordered array of [agentId, outputText] pairs
 * @returns Array of attributed text segments
 */
export function buildAttribution(
  agentOutputs: [string, string][],
): AttributionSegment[] {
  if (agentOutputs.length === 0) return [];

  // Start: every character attributed to the first agent
  const [firstAgent, firstText] = agentOutputs[0];
  let charAttribution: { char: string; agent: string }[] = [];
  for (const ch of firstText) {
    charAttribution.push({ char: ch, agent: firstAgent });
  }

  // Process each subsequent agent
  for (let a = 1; a < agentOutputs.length; a++) {
    const [agentId, agentText] = agentOutputs[a];
    const prevText = charAttribution.map((c) => c.char).join('');

    const diff = computeDiff(prevText, agentText);

    const nextAttribution: { char: string; agent: string }[] = [];
    let prevCharIdx = 0; // position in previous text

    for (const seg of diff) {
      if (seg.type === 'equal') {
        // Copy attribution from previous
        for (const ch of seg.text) {
          if (prevCharIdx < charAttribution.length) {
            nextAttribution.push({ ...charAttribution[prevCharIdx] });
          }
          prevCharIdx++;
        }
      } else if (seg.type === 'removed') {
        // Skip past these chars in the old attribution
        prevCharIdx += seg.text.length;
      } else if (seg.type === 'added') {
        // New text from this agent
        for (const ch of seg.text) {
          nextAttribution.push({ char: ch, agent: agentId });
        }
      }
    }

    charAttribution = nextAttribution;
  }

  // Now build segments by grouping consecutive chars with the same agent
  const segments: AttributionSegment[] = [];
  for (const ca of charAttribution) {
    if (segments.length > 0 && segments[segments.length - 1].agent === ca.agent) {
      segments[segments.length - 1].text += ca.char;
    } else {
      segments.push({ text: ca.char, agent: ca.agent });
    }
  }

  // Now add previous text info for modified segments by diffing
  // adjacent agent pairs and finding replacements
  if (agentOutputs.length >= 2) {
    for (let a = 1; a < agentOutputs.length; a++) {
      const [agentId, agentText] = agentOutputs[a];
      const prevText = agentOutputs[a - 1][1];
      const prevAgentId = agentOutputs[a - 1][0];
      const diff = computeDiff(prevText, agentText);

      // Find removed→added pairs (replacements)
      for (let d = 0; d < diff.length - 1; d++) {
        if (diff[d].type === 'removed' && diff[d + 1].type === 'added') {
          const addedText = diff[d + 1].text;
          const removedText = diff[d].text;
          // Find matching segment
          const match = segments.find(
            (s) => s.agent === agentId && s.text === addedText && !s.previousText,
          );
          if (match) {
            match.previousText = removedText;
            match.previousAgent = prevAgentId;
          }
        }
      }
    }
  }

  return segments;
}
