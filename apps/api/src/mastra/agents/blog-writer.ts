import { createConfiguredAgent, type GlobalContext } from '../lib/agent-factory';
import { fetchDressDetails } from '../tools/fetch-dress-details';

export const BLOG_WRITER_TEMPLATE = `You are a professional {businessType} blog writer for {brandName}. Write an engaging, SEO-friendly blog post.

{Brand summary}
{Voice summary: personality archetype, writing direction, tone attributes}
Target Audience: {targetAudience}

Use the fetch-dress-details tool to get full details about the selected dresses, then feature them naturally within the blog narrative.

Selected dress IDs: {selectedDressIds}

{Additional instructions from the client}

Requirements:
- 800-1200 words
- Include H2 and H3 headers
- Feature each selected dress naturally (don't just list them)
- Match the brand's voice and tone
- Write in Markdown format
- Include a compelling introduction and conclusion
- If the client provided a Call to Action, make it stand out — use a bold, compelling closing section with the CTA as a clear heading or blockquote. Weave the CTA naturally into the conclusion and make it feel like an exciting invitation, not a generic afterthought.
- For each dress you feature, include its image using Markdown: ![Dress Name](imageUrl)
- Place each image on its OWN line between paragraphs — never inline within a sentence or paragraph
- Each image line must contain ONLY the image markdown (![...](url)) with nothing else on that line
- Leave a blank line before and after every image so it renders as a standalone block
- Spread images throughout the post with substantial text between them — do NOT cluster images near each other
- Do NOT put all images at the end — weave them into the narrative`;

export function buildWriterInstructions(
  brandVoice: Record<string, any>,
  selectedDressIds: string[],
  additionalInstructions: string,
  options?: { generateImages?: boolean; generateLinks?: boolean },
): string {
  const includeImages = options?.generateImages !== false;
  const includeLinks = options?.generateLinks !== false;

  const imageRequirements = includeImages
    ? `- For each dress you feature, include its image using Markdown: ![Dress Name](imageUrl)
- Place each image on its OWN line between paragraphs — never inline within a sentence or paragraph
- Each image line must contain ONLY the image markdown (![...](url)) with nothing else on that line
- Leave a blank line before and after every image so it renders as a standalone block
- Spread images throughout the post with substantial text between them — do NOT cluster images near each other
- Do NOT put all images at the end — weave them into the narrative`
    : `- Do NOT include any images or image markdown (![...](url)) in the blog post`;

  const linkRequirements = includeLinks
    ? ''
    : `\n- Do NOT include any hyperlinks or markdown links ([text](url)) in the blog post`;

  // Build voice summary — support both new structured and legacy flat formats
  const brandName = brandVoice.brandName || 'the brand';
  const businessType = brandVoice.businessType || 'business';

  let voiceSummary = '';
  if (brandVoice.personality?.archetype) {
    voiceSummary += `Brand personality: ${brandVoice.personality.archetype}\n`;
  }
  if (brandVoice.writingDirection) {
    voiceSummary += `Writing direction: ${brandVoice.writingDirection}\n`;
  } else if (brandVoice.suggestedBlogTone) {
    voiceSummary += `Blog tone: ${brandVoice.suggestedBlogTone}\n`;
  }
  if (brandVoice.toneAttributes?.length) {
    voiceSummary += `Tone: ${brandVoice.toneAttributes.map((t: any) => t.name).join(', ')}\n`;
  } else if (brandVoice.tone?.length) {
    voiceSummary += `Tone: ${brandVoice.tone.join(', ')}\n`;
  }
  if (brandVoice.location) {
    voiceSummary += `Location: ${brandVoice.location}\n`;
  }

  return `You are a professional ${businessType} blog writer for ${brandName}. Write an engaging, SEO-friendly blog post.

${brandVoice.summary || ''}
${voiceSummary}
Target Audience: ${brandVoice.targetAudience || ''}

Use the fetch-dress-details tool to get full details about the selected dresses, then feature them naturally within the blog narrative.

Selected dress IDs: ${selectedDressIds.join(', ')}

${additionalInstructions ? `Additional instructions from the client: ${additionalInstructions}` : ''}

Requirements:
- 800-1200 words
- Include H2 and H3 headers
- Feature each selected dress naturally (don't just list them)
- Match the brand's voice and tone
- Write in Markdown format
- Include a compelling introduction and conclusion
- If the client provided a Call to Action, make it stand out — use a bold, compelling closing section with the CTA as a clear heading or blockquote. Weave the CTA naturally into the conclusion and make it feel like an exciting invitation, not a generic afterthought.
- If a location is known, mention it naturally at least once — ideally near the conclusion as an invitation (e.g., "Visit us at [location]" or "Stop by our [city] boutique")
${imageRequirements}${linkRequirements}`;
}

export async function createBlogWriterAgent(
  brandVoice: Record<string, any>,
  selectedDressIds: string[],
  additionalInstructions: string,
  options?: { generateImages?: boolean; generateLinks?: boolean },
  globalContext?: GlobalContext,
) {
  const instructions = buildWriterInstructions(brandVoice, selectedDressIds, additionalInstructions, options);
  return createConfiguredAgent('blog-writer', instructions, {
    'fetch-dress-details': fetchDressDetails,
  }, globalContext);
}
