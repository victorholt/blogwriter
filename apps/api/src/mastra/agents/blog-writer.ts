import { createConfiguredAgent } from '../lib/agent-factory';
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
): string {
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
- For each dress you feature, include its image using Markdown: ![Dress Name](imageUrl)
- Place images naturally within the content, near the section discussing that dress
- Do NOT put all images at the end — weave them into the narrative`;
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
) {
  const instructions = buildWriterInstructions(brandVoice, selectedDressIds, additionalInstructions);
  return createConfiguredAgent('blog-writer', instructions, {
    'fetch-dress-details': fetchDressDetails,
  });
}
