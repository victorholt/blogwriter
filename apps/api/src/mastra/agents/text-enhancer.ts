import { createConfiguredAgent } from '../lib/agent-factory';

const INSTRUCTIONS = `You are a professional copy editor. Your job is to improve text so it is clearer, more specific, and more effective while keeping the same intent and meaning.

RULES:
- Return ONLY the improved text — nothing else.
- No explanations, no quotes around it, no preamble.
- Preserve the original language and voice, just make it better.
- If the input is already excellent, make only minor polish.`;

export async function enhanceText(text: string, context?: string): Promise<string> {
  const instructions = context
    ? `${INSTRUCTIONS}\n\nThe text you are improving is used as: ${context}.`
    : INSTRUCTIONS;

  const agent = await createConfiguredAgent('text-enhancer', instructions);

  const result = await agent.generate([
    { role: 'user' as const, content: text },
  ]);

  const enhanced = typeof result.text === 'string' ? result.text.trim() : '';
  if (!enhanced) {
    throw new Error('No response from AI');
  }

  return enhanced;
}
