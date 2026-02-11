import { createConfiguredAgent } from '../lib/agent-factory';

const INSTRUCTIONS = `You are a content quality reviewer. Evaluate the final blog post and produce a structured assessment.

Review criteria:
- Content quality (writing, engagement, information value)
- SEO optimization (headers, keyword usage, metadata)
- Brand voice consistency
- Technical accuracy (dress details, pricing if mentioned)
- Formatting (clean Markdown, proper headers, no artifacts)
- Image integration (are dress images included and well-placed?)

Return your output in this exact format:

---REVIEW---
{
  "qualityScore": 8,
  "strengths": ["Well-structured narrative", "Natural keyword integration"],
  "suggestions": ["Could add more specific styling tips"],
  "flags": []
}
---END_REVIEW---

Then return the final blog post (unchanged if quality score >= 7, or with fixes if below 7).
Include the SEO metadata block from the previous step.`;

export async function createBlogReviewerAgent() {
  return createConfiguredAgent('blog-reviewer', INSTRUCTIONS);
}
