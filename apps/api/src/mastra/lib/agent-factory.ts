import { Agent, ModelRouterLanguageModel } from '@mastra/core';
import { asc } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { agentAdditionalInstructions } from '../../db/schema';
import { getAgentModelConfig, getOpenRouterApiKey } from './model-resolver';
import type { AgentConfig } from './model-resolver';

function createOpenRouterModel(modelId: string, apiKey: string): ModelRouterLanguageModel {
  // modelId is stored as "openrouter/vendor/model-name" in the DB
  // We need to extract the vendor/model part for the actual model ID
  const actualModelId = modelId.startsWith('openrouter/')
    ? modelId.slice('openrouter/'.length)
    : modelId;

  return new ModelRouterLanguageModel({
    providerId: 'openrouter',
    modelId: actualModelId,
    url: 'https://openrouter.ai/api/v1',
    apiKey,
  });
}

/**
 * Build a context preamble prepended to every agent's instructions.
 * Ensures all agents share awareness of dynamic facts like the current date.
 */
function buildContextPreamble(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.toLocaleString('en-US', { month: 'long' });
  return `[Context] Today's date is ${month} ${year}. Always reference the current year (${year}) when mentioning trends, seasons, or timely content. Never reference past years as current.\n\n`;
}

export interface BrandRule {
  displayName: string;
  seoKeywords: string[];
  avoidTerms: string[];
}

export interface GlobalContext {
  allowedBrands?: string[];
  brandRules?: BrandRule[];
  themeDescription?: string;
  brandVoice?: Record<string, unknown>;
}

export async function createConfiguredAgent(
  agentId: string,
  defaultInstructions: string,
  tools: Record<string, any> = {},
  globalContext?: GlobalContext,
): Promise<Agent> {
  const config = await getAgentModelConfig(agentId);
  const apiKey = await getOpenRouterApiKey();

  if (!apiKey) {
    throw new Error('AI_SERVICE_UNAVAILABLE');
  }

  const model = createOpenRouterModel(config.modelId, apiKey);

  // DB instructions override code defaults (if set)
  let baseInstructions = config.instructions || defaultInstructions;

  // Append additional instruction snippets (if any)
  const additionalRows = await db
    .select()
    .from(agentAdditionalInstructions)
    .where(eq(agentAdditionalInstructions.agentId, agentId))
    .orderBy(asc(agentAdditionalInstructions.sortOrder), asc(agentAdditionalInstructions.id));

  if (additionalRows.length > 0) {
    const joined = additionalRows.map(r => r.content).join('\n\n');
    baseInstructions += '\n\n[Additional Instructions]\n' + joined;
  }

  let contextPreamble = buildContextPreamble();

  if (globalContext?.allowedBrands?.length) {
    const brandList = globalContext.allowedBrands.join(', ');
    contextPreamble += `[Brand Exclusivity] You must ONLY mention or reference these wedding dress brands: ${brandList}. Do NOT mention, recommend, or compare with any other wedding dress brands or designers from other companies. If you are unsure whether a brand is allowed, do not mention it.\n\n`;
  }

  if (globalContext?.brandRules?.length) {
    const rulesWithContent = globalContext.brandRules.filter(
      (r) => r.seoKeywords.length > 0 || r.avoidTerms.length > 0,
    );
    if (rulesWithContent.length > 0) {
      let rulesBlock = '[Brand Vocabulary Rules]';
      for (const rule of rulesWithContent) {
        rulesBlock += `\n${rule.displayName}:`;
        if (rule.seoKeywords.length > 0) {
          rulesBlock += `\n  Keywords to use: ${rule.seoKeywords.join(', ')}`;
        }
        if (rule.avoidTerms.length > 0) {
          rulesBlock += `\n  Terms to AVOID: ${rule.avoidTerms.join(', ')}`;
        }
      }
      contextPreamble += rulesBlock + '\n\n';
    }
  }

  if (globalContext?.themeDescription) {
    contextPreamble += `[Blog Theme] ${globalContext.themeDescription}\n\n`;
  }

  if (globalContext?.brandVoice) {
    const bv = globalContext.brandVoice as Record<string, any>;
    let voiceBlock = `[Brand Voice]\nBrand: ${bv.brandName || 'Unknown'}`;

    if (bv.location) {
      voiceBlock += `\nLocation: ${bv.location}`;
    }

    if (bv.personality) {
      voiceBlock += `\nPersonality: ${bv.personality.archetype} — ${bv.personality.description}`;
    }

    if (bv.toneAttributes?.length) {
      voiceBlock += '\nTone:';
      for (const attr of bv.toneAttributes) {
        voiceBlock += `\n  - ${attr.name}: ${attr.description}`;
      }
    }

    if (bv.vocabulary?.length) {
      voiceBlock += '\nVocabulary:';
      for (const cat of bv.vocabulary) {
        voiceBlock += `\n  ${cat.category}: ${cat.terms?.join(', ')}`;
      }
    }

    if (bv.writingStyle?.length) {
      voiceBlock += '\nWriting style:';
      for (const rule of bv.writingStyle) {
        voiceBlock += `\n  - ${rule.rule}: ${rule.description}`;
      }
    }

    if (bv.avoidances?.length) {
      voiceBlock += '\nAvoid:';
      for (const rule of bv.avoidances) {
        voiceBlock += `\n  - ${rule.rule}: ${rule.description}`;
      }
    }

    if (bv.writingDirection) {
      voiceBlock += `\nWriting direction: ${bv.writingDirection}`;
    }

    contextPreamble += voiceBlock + '\n\n';
  }

  const instructions = contextPreamble + baseInstructions;

  return new Agent({
    name: agentId,
    instructions,
    model,
    tools,
  });
}

/**
 * Get the configured max retries for an agent.
 */
export async function getMaxRetries(agentId: string): Promise<number> {
  const config = await getAgentModelConfig(agentId);
  return config.maxRetries;
}

/**
 * Stream an agent call with automatic retry on empty responses.
 *
 * Consumes the fullStream, collecting text chunks and forwarding all stream
 * events to the optional `onStreamEvent` callback. If the response is empty,
 * retries up to `maxRetries` times (read from agent config).
 *
 * Returns the full text output on success, throws on exhausted retries.
 */
export interface StreamWithRetryOptions {
  /** Called for every stream event (text-delta, tool-call, etc.) */
  onStreamEvent?: (value: { type: string; payload?: any }) => void;
  /** Called when a retry is about to happen */
  onRetry?: (attempt: number, maxAttempts: number, error: string) => void;
  /** Override the max retries from config */
  maxRetries?: number;
}

export async function streamAgentWithRetry(
  agent: Agent,
  messages: Parameters<Agent['stream']>[0],
  options?: StreamWithRetryOptions,
): Promise<string> {
  const maxAttempts = (options?.maxRetries ?? 3) + 1; // retries + initial attempt

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await agent.stream(messages);

    let fullText = '';
    const reader = result.fullStream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value.type === 'text-delta') {
        const chunk = (value as any).payload?.text ?? '';
        fullText += chunk;
      }

      // Forward all events to caller
      options?.onStreamEvent?.(value as any);
    }

    // Fallback to result.text if streaming didn't capture
    if (!fullText.trim() && result.text) {
      fullText = typeof result.text === 'string' ? result.text : await result.text;
    }

    if (fullText.trim()) {
      return fullText;
    }

    // Empty response — retry if attempts remain
    if (attempt < maxAttempts) {
      console.warn(`[AgentRetry] Empty response on attempt ${attempt}/${maxAttempts}. Retrying...`);
      options?.onRetry?.(attempt, maxAttempts, 'Empty response from model');
    }
  }

  throw new Error('No response from model after ' + maxAttempts + ' attempts');
}
