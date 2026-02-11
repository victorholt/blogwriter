import { db } from '../../db';
import { agentModelConfigs, appSettings } from '../../db/schema';
import { eq } from 'drizzle-orm';

export interface AgentConfig {
  modelId: string;
  temperature: number;
  maxTokens: number;
  instructions: string | null;
}

let configCache: Map<string, AgentConfig> = new Map();
let apiKeyCache: string = '';
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 60 seconds

async function refreshCache(): Promise<void> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL) return;

  // Load all agent configs
  const configs = await db.select().from(agentModelConfigs);
  configCache = new Map(
    configs.map((c) => [
      c.agentId,
      {
        modelId: c.modelId,
        temperature: parseFloat(c.temperature ?? '0.7'),
        maxTokens: parseInt(c.maxTokens ?? '4096', 10),
        instructions: c.instructions ?? null,
      },
    ]),
  );

  // Load API key from app_settings
  const apiKeySetting = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, 'openrouter_api_key'))
    .limit(1);

  apiKeyCache = apiKeySetting[0]?.value || '';
  cacheTimestamp = now;
}

export async function getAgentModelConfig(agentId: string): Promise<AgentConfig> {
  await refreshCache();
  return (
    configCache.get(agentId) ?? {
      modelId: 'openrouter/anthropic/claude-sonnet-4-5-20250929',
      temperature: 0.7,
      maxTokens: 4096,
      instructions: null,
    }
  );
}

export async function getOpenRouterApiKey(): Promise<string> {
  await refreshCache();
  // DB setting takes priority, env var as fallback
  return apiKeyCache || process.env.OPENROUTER_API_KEY || '';
}

export function invalidateCache(): void {
  cacheTimestamp = 0;
}
