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
  const instructions = config.instructions || defaultInstructions;

  return new Agent({
    name: agentId,
    instructions,
    model,
    tools,
  });
}
