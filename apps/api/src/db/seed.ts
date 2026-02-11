import { db } from './index';
import { agentModelConfigs, appSettings } from './schema';
import { sql } from 'drizzle-orm';

const DEFAULT_MODEL = 'openrouter/anthropic/claude-sonnet-4.5';

const DEFAULT_AGENTS = [
  { agentId: 'brand-voice-analyzer', agentLabel: 'Brand Voice Analyzer', modelId: DEFAULT_MODEL, temperature: '0.5', maxTokens: '4096' },
  { agentId: 'blog-writer', agentLabel: 'Blog Writer', modelId: DEFAULT_MODEL, temperature: '0.8', maxTokens: '8192' },
  { agentId: 'blog-editor', agentLabel: 'Blog Editor', modelId: DEFAULT_MODEL, temperature: '0.5', maxTokens: '4096' },
  { agentId: 'seo-specialist', agentLabel: 'SEO Specialist', modelId: DEFAULT_MODEL, temperature: '0.4', maxTokens: '4096' },
  { agentId: 'senior-editor', agentLabel: 'Senior Editor', modelId: DEFAULT_MODEL, temperature: '0.5', maxTokens: '4096' },
  { agentId: 'blog-reviewer', agentLabel: 'Blog Reviewer', modelId: DEFAULT_MODEL, temperature: '0.3', maxTokens: '4096' },
];

const DEFAULT_SETTINGS = [
  { key: 'openrouter_api_key', value: '' },
  { key: 'product_api_base_url', value: 'https://product.dev.essensedesigns.info' },
  { key: 'product_api_timeout', value: '30000' },
  { key: 'product_api_language', value: 'en' },
  { key: 'product_api_type', value: 'essense-dress' },
  { key: 'product_api_app', value: 'essense-designs' },
  { key: 'allowed_dress_ids', value: '' },
  { key: 'debug_mode', value: 'false' },
  { key: 'insights_enabled', value: 'true' },
];

export async function seedDatabase(): Promise<void> {
  console.log('[Seed] Checking for default data...');

  // Seed agent configs (ON CONFLICT DO NOTHING)
  for (const agent of DEFAULT_AGENTS) {
    await db.insert(agentModelConfigs)
      .values(agent)
      .onConflictDoNothing({ target: agentModelConfigs.agentId });
  }
  console.log(`[Seed] Agent configs: ${DEFAULT_AGENTS.length} defaults ensured`);

  // Seed app settings (ON CONFLICT DO NOTHING)
  for (const setting of DEFAULT_SETTINGS) {
    await db.insert(appSettings)
      .values(setting)
      .onConflictDoNothing({ target: appSettings.key });
  }
  console.log(`[Seed] App settings: ${DEFAULT_SETTINGS.length} defaults ensured`);
}
