import { createConfiguredAgent, type GlobalContext } from '../lib/agent-factory';
import { fetchDressDetails } from '../tools/fetch-dress-details';

export function buildWriterInstructions(
  brandVoice: {
    brandName: string;
    tone: string[];
    targetAudience: string;
    suggestedBlogTone: string;
    summary: string;
  },
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

  return `You are a professional wedding blog writer. Write an engaging, SEO-friendly blog post about wedding dresses.

Brand Voice: ${brandVoice.summary}
Brand: ${brandVoice.brandName}
Tone: ${brandVoice.tone.join(', ')}
Target Audience: ${brandVoice.targetAudience}
Blog Tone: ${brandVoice.suggestedBlogTone}

Use the fetch-dress-details tool to get full details about the selected dresses, then feature them naturally within the blog narrative.

Selected dress IDs: ${selectedDressIds.join(', ')}

${additionalInstructions ? `Additional instructions from the client: ${additionalInstructions}` : ''}

Requirements:
- 800-1200 words
- Include H2 and H3 headers
- Feature each selected dress naturally (don't just list them)
- Match the brand's tone
- Write in Markdown format
- Include a compelling introduction and conclusion
${imageRequirements}${linkRequirements}`;
}

export async function createBlogWriterAgent(
  brandVoice: {
    brandName: string;
    tone: string[];
    targetAudience: string;
    suggestedBlogTone: string;
    summary: string;
  },
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
