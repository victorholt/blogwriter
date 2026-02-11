import { Agent, ModelRouterLanguageModel } from '@mastra/core';
import { getAgentModelConfig, getOpenRouterApiKey } from './model-resolver';

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

export async function createConfiguredAgent(
  agentId: string,
  defaultInstructions: string,
  tools: Record<string, any> = {},
): Promise<Agent> {
  const config = await getAgentModelConfig(agentId);
  const apiKey = await getOpenRouterApiKey();

  if (!apiKey) {
    throw new Error('AI_SERVICE_UNAVAILABLE');
  }

  const model = createOpenRouterModel(config.modelId, apiKey);

  // DB instructions override code defaults (if set)
  const baseInstructions = config.instructions || defaultInstructions;
  const instructions = buildContextPreamble() + baseInstructions;

  return new Agent({
    name: agentId,
    instructions,
    model,
    tools,
  });
}
