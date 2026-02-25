import { createConfiguredAgent } from '../lib/agent-factory';

const INSTRUCTIONS = `You are a feedback quality reviewer for a pilot product survey.

Given a list of survey questions and a user's submitted answers, identify any of the following issues:
- Contradictions between answers (e.g. selecting "much faster" for time savings but "not usable" for quality — these are contradictory)
- Suspiciously brief or nonsensical free-text answers that suggest the user didn't engage meaningfully
- Incoherent, repetitive, or spam-like responses

Output ONLY valid JSON with this exact shape:
{ "flagged": boolean, "flags": string[], "summary": string }

Rules:
- "flagged" is true ONLY if there is a genuine concern
- "flags" is an array of short descriptions of specific issues found (empty array if none)
- "summary" is 1-2 sentences describing the overall quality of the response
- Do NOT flag responses just because free-text answers are short — brevity is acceptable
- Do NOT flag responses just because the user had low confidence in the tool — that is valid feedback`;

export { INSTRUCTIONS as DEFAULT_INSTRUCTIONS };

export interface FeedbackReview {
  flagged: boolean;
  flags: string[];
  summary: string;
}

export async function reviewFeedback(
  questionsJson: string,
  answers: Record<string, string>,
): Promise<FeedbackReview> {
  const agent = await createConfiguredAgent('feedback-reviewer', INSTRUCTIONS);

  const prompt = `Survey questions:\n${questionsJson}\n\nSubmitted answers:\n${JSON.stringify(answers, null, 2)}`;

  const result = await agent.generate([{ role: 'user' as const, content: prompt }]);
  const text = typeof result.text === 'string' ? result.text.trim() : '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON output from feedback reviewer');
  }

  return JSON.parse(jsonMatch[0]) as FeedbackReview;
}
