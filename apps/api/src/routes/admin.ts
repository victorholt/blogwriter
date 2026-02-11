import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { agentModelConfigs, appSettings, brandVoiceCache } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { validateAdminToken } from '../middleware/admin-auth';
import { invalidateCache } from '../mastra/lib/model-resolver';
import { clearDressCache, syncDressesFromApi, getCacheStats } from '../services/dress-cache';
import { loadProductApiConfig } from '../services/product-api-client';
import { invalidateInsightsCache } from '../services/agent-trace';

const router = Router();

// --- Available Models (from OpenRouter) ---

interface CachedModels {
  data: { id: string; name: string; provider: string }[];
  fetchedAt: number;
}

let modelsCache: CachedModels | null = null;
const MODELS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

const ALLOWED_PREFIXES = ['anthropic/', 'openai/', 'google/gemini'];
const EXCLUDED_PATTERNS = [
  ':free', ':extended', ':thinking', ':exacto',
  'audio', 'image', '-search-', 'instruct',
  'gpt-oss', 'deep-research', '-chat',
  // Exclude old dated OpenAI variants
  '-0314', '-0613', '-16k', '-1106', '-2024-',
];

function isAllowedModel(id: string): boolean {
  if (!ALLOWED_PREFIXES.some((p) => id.startsWith(p))) return false;
  if (EXCLUDED_PATTERNS.some((p) => id.includes(p))) return false;
  return true;
}

function getProvider(id: string): string {
  if (id.startsWith('anthropic/')) return 'Anthropic';
  if (id.startsWith('openai/')) return 'OpenAI';
  if (id.startsWith('google/')) return 'Google';
  return 'Other';
}

async function fetchOpenRouterModels(): Promise<CachedModels['data']> {
  if (modelsCache && Date.now() - modelsCache.fetchedAt < MODELS_CACHE_TTL) {
    return modelsCache.data;
  }

  console.log('[Admin] Fetching models from OpenRouter...');
  const res = await fetch('https://openrouter.ai/api/v1/models');
  const json = await res.json();
  const models = (json.data || [])
    .filter((m: any) => isAllowedModel(m.id))
    .map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      provider: getProvider(m.id),
    }))
    .sort((a: any, b: any) => a.id.localeCompare(b.id));

  modelsCache = { data: models, fetchedAt: Date.now() };
  console.log(`[Admin] Cached ${models.length} models`);
  return models;
}

// All admin routes require token validation
router.use('/:token', validateAdminToken);

// --- Available Models ---

router.get('/:token/models', async (_req, res) => {
  try {
    const models = await fetchOpenRouterModels();
    return res.json({ success: true, data: models });
  } catch (err) {
    console.error('[Admin] Error fetching models:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch available models' });
  }
});

// --- Agent Configs ---

router.get('/:token/agents', async (req, res) => {
  try {
    const agents = await db.select().from(agentModelConfigs).orderBy(agentModelConfigs.id);
    return res.json({ success: true, data: agents });
  } catch (err) {
    console.error('[Admin] Error fetching agents:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch agent configs' });
  }
});

const updateAgentSchema = z.object({
  modelId: z.string().min(1, 'Model ID is required'),
  temperature: z.string().optional(),
  maxTokens: z.string().optional(),
  instructions: z.string().optional(),
  enabled: z.boolean().optional(),
});

router.put('/:token/agents/:agentId', async (req, res) => {
  const parsed = updateAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid request';
    return res.status(400).json({ success: false, error: message });
  }

  const { agentId } = req.params;
  const { modelId, temperature, maxTokens, instructions, enabled } = parsed.data;

  try {
    const result = await db
      .update(agentModelConfigs)
      .set({
        modelId,
        ...(temperature !== undefined && { temperature }),
        ...(maxTokens !== undefined && { maxTokens }),
        ...(instructions !== undefined && { instructions: instructions || null }),
        ...(enabled !== undefined && { enabled }),
        updatedAt: new Date(),
      })
      .where(eq(agentModelConfigs.agentId, agentId))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    // Invalidate model resolver cache so changes take effect immediately
    invalidateCache();

    return res.json({ success: true, data: result[0] });
  } catch (err) {
    console.error(`[Admin] Error updating agent ${agentId}:`, err);
    return res.status(500).json({ success: false, error: 'Failed to update agent config' });
  }
});

// --- App Settings ---

function maskApiKey(value: string): string {
  if (!value || value.length < 12) return value ? '****' : '';
  return value.slice(0, 8) + '****' + value.slice(-4);
}

router.get('/:token/settings', async (req, res) => {
  try {
    const settings = await db.select().from(appSettings);
    const masked: Record<string, string> = {};
    for (const s of settings) {
      masked[s.key] = s.key.includes('key') ? maskApiKey(s.value) : s.value;
    }
    return res.json({ success: true, data: masked });
  } catch (err) {
    console.error('[Admin] Error fetching settings:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

const updateSettingsSchema = z.object({
  openrouter_api_key: z.string().optional(),
  product_api_base_url: z.string().optional(),
  product_api_timeout: z.string().optional(),
  product_api_language: z.string().optional(),
  product_api_type: z.string().optional(),
  product_api_app: z.string().optional(),
  allowed_dress_ids: z.string().optional(),
  debug_mode: z.enum(['true', 'false']).optional(),
  insights_enabled: z.enum(['true', 'false']).optional(),
  blog_timeline_style: z.enum(['preview-bar', 'timeline', 'stepper']).optional(),
  blog_generate_images: z.enum(['true', 'false']).optional(),
  blog_generate_links: z.enum(['true', 'false']).optional(),
});

router.put('/:token/settings', async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid request' });
  }

  try {
    const updates = parsed.data;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        await db
          .update(appSettings)
          .set({ value, updatedAt: new Date() })
          .where(eq(appSettings.key, key));
      }
    }

    // Invalidate model resolver cache so the new API key takes effect immediately
    invalidateCache();
    // Invalidate insights cache if insights_enabled was changed
    if (updates.insights_enabled !== undefined) {
      invalidateInsightsCache();
    }

    // Return masked values
    const settings = await db.select().from(appSettings);
    const masked: Record<string, string> = {};
    for (const s of settings) {
      masked[s.key] = s.key.includes('key') ? maskApiKey(s.value) : s.value;
    }

    return res.json({ success: true, data: masked });
  } catch (err) {
    console.error('[Admin] Error updating settings:', err);
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// --- Cache Management ---

router.delete('/:token/cache', async (_req, res) => {
  try {
    const result = await db.delete(brandVoiceCache).returning({ id: brandVoiceCache.id });
    console.log(`[Admin] Cleared ${result.length} cached brand voice entries`);
    return res.json({ success: true, data: { cleared: result.length } });
  } catch (err) {
    console.error('[Admin] Error clearing cache:', err);
    return res.status(500).json({ success: false, error: 'Failed to clear cache' });
  }
});

// --- Dress Cache Management ---

router.get('/:token/dress-cache', async (_req, res) => {
  try {
    const stats = await getCacheStats();
    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error('[Admin] Error fetching dress cache stats:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch dress cache stats' });
  }
});

router.delete('/:token/dress-cache', async (_req, res) => {
  try {
    const cleared = await clearDressCache();
    console.log(`[Admin] Cleared ${cleared} cached dresses`);
    return res.json({ success: true, data: { cleared } });
  } catch (err) {
    console.error('[Admin] Error clearing dress cache:', err);
    return res.status(500).json({ success: false, error: 'Failed to clear dress cache' });
  }
});

router.post('/:token/dress-cache/sync', async (_req, res) => {
  try {
    const config = await loadProductApiConfig();
    const result = await syncDressesFromApi(config);
    console.log(`[Admin] Synced ${result.synced} dresses (${result.total} from API)`);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Admin] Error syncing dresses:', err);
    return res.status(500).json({ success: false, error: 'Failed to sync dresses' });
  }
});

export default router;
