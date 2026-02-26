import { Router } from 'express';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { db } from '../db';
import { agentModelConfigs, agentAdditionalInstructions, appSettings, brandVoiceCache, themes, brandLabels, voicePresets, auditLogs, users, blogSessions, feedbackForms, feedbackResponses, docsPages } from '../db/schema';
import { eq, asc, and, desc, sql, isNull, isNotNull } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth';
import { invalidateCache, getOpenRouterApiKey } from '../mastra/lib/model-resolver';
import { enhanceText as agentEnhanceText } from '../mastra/agents/text-enhancer';
import { clearDressCache, syncDressesFromApi, getCacheStats } from '../services/dress-cache';
import { AGENT_DEFAULTS } from '../mastra/lib/agent-defaults';
import { loadProductApiConfig } from '../services/product-api-client';
import { invalidateInsightsCache } from '../services/agent-trace';
import { formatBrandVoiceText } from '../mastra/agents/brand-voice-formatter';
import { testSmtpConnection, sendTemplateEmail } from '../services/email';
import { renderAllPreviews, EMAIL_TEMPLATES } from '../services/email-templates';
import { invalidateGuestModeCache, invalidateRegistrationCache, invalidateDocsCache } from '../services/site-settings';
import adminUsersRoutes from './admin-users';
import adminDatabaseRoutes from './admin-database';
import adminMediaRoutes from './admin-media';

// Read app version once at startup
let appVersion = '0.0.0';
try {
  appVersion = readFileSync('/etc/app-version', 'utf-8').trim();
} catch {
  // VERSION file may not exist in some environments
}

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/models', { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  const json: any = await res!.json();
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
router.use(requireAdmin);

// --- Available Models ---

router.get('/models', async (_req, res) => {
  try {
    const models = await fetchOpenRouterModels();
    return res.json({ success: true, data: models });
  } catch (err) {
    console.error('[Admin] Error fetching models:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch available models' });
  }
});

// --- OpenRouter Credits ---

router.get('/openrouter/credits', async (_req, res) => {
  try {
    const apiKey = await getOpenRouterApiKey();
    if (!apiKey) {
      return res.json({ success: false, error: 'No OpenRouter API key configured' });
    }

    const headers = { Authorization: `Bearer ${apiKey}` };

    // Fetch both endpoints in parallel
    const [authRes, creditsRes] = await Promise.all([
      fetch('https://openrouter.ai/api/v1/auth/key', { headers }),
      fetch('https://openrouter.ai/api/v1/credits', { headers }).catch(() => null),
    ]);

    if (!authRes.ok) {
      return res.json({ success: false, error: `OpenRouter returned ${authRes.status}` });
    }

    const authJson: any = await authRes.json();
    const data = { ...authJson.data };

    // Merge total_credits from /credits endpoint if available
    if (creditsRes?.ok) {
      const creditsJson: any = await creditsRes.json();
      if (creditsJson.data) {
        data.total_credits = creditsJson.data.total_credits ?? null;
      }
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Admin] Error fetching OpenRouter credits:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch credits' });
  }
});

// --- Agent Configs ---

router.get('/agents', async (req, res) => {
  try {
    const agents = await db.select().from(agentModelConfigs).orderBy(agentModelConfigs.id);
    return res.json({ success: true, data: agents });
  } catch (err) {
    console.error('[Admin] Error fetching agents:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch agent configs' });
  }
});

// --- Agent Default Instructions (read-only, from code) ---

router.get('/agents/defaults', async (_req, res) => {
  return res.json({ success: true, data: AGENT_DEFAULTS });
});

// --- Agent Additional Instructions CRUD ---

const additionalInstructionSchema = z.object({
  title: z.string().max(100).optional().default('Instruction'),
  content: z.string().min(1).max(5000),
});

router.get('/agents/:agentId/instructions', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(agentAdditionalInstructions)
      .where(eq(agentAdditionalInstructions.agentId, req.params.agentId))
      .orderBy(asc(agentAdditionalInstructions.sortOrder), asc(agentAdditionalInstructions.id));
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Admin] Error fetching additional instructions:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch additional instructions' });
  }
});

router.post('/agents/:agentId/instructions', async (req, res) => {
  const parsed = additionalInstructionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }

  try {
    const [row] = await db
      .insert(agentAdditionalInstructions)
      .values({ agentId: req.params.agentId, ...parsed.data })
      .returning();
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Admin] Error creating additional instruction:', err);
    return res.status(500).json({ success: false, error: 'Failed to create additional instruction' });
  }
});

router.put('/agents/:agentId/instructions/:id', async (req, res) => {
  const parsed = additionalInstructionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const result = await db
      .update(agentAdditionalInstructions)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(agentAdditionalInstructions.id, id), eq(agentAdditionalInstructions.agentId, req.params.agentId)))
      .returning();

    if (result.length === 0) return res.status(404).json({ success: false, error: 'Instruction not found' });
    return res.json({ success: true, data: result[0] });
  } catch (err) {
    console.error(`[Admin] Error updating instruction ${id}:`, err);
    return res.status(500).json({ success: false, error: 'Failed to update instruction' });
  }
});

router.delete('/agents/:agentId/instructions/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const result = await db
      .delete(agentAdditionalInstructions)
      .where(and(eq(agentAdditionalInstructions.id, id), eq(agentAdditionalInstructions.agentId, req.params.agentId)))
      .returning();

    if (result.length === 0) return res.status(404).json({ success: false, error: 'Instruction not found' });
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error(`[Admin] Error deleting instruction ${id}:`, err);
    return res.status(500).json({ success: false, error: 'Failed to delete instruction' });
  }
});

const updateAgentSchema = z.object({
  modelId: z.string().min(1, 'Model ID is required'),
  temperature: z.string().optional(),
  maxTokens: z.string().optional(),
  instructions: z.string().optional(),
  enabled: z.boolean().optional(),
  showPreview: z.boolean().optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
});

router.put('/agents/:agentId', async (req, res) => {
  const parsed = updateAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid request';
    return res.status(400).json({ success: false, error: message });
  }

  const { agentId } = req.params;
  const { modelId, temperature, maxTokens, instructions, enabled, showPreview, maxRetries } = parsed.data;

  try {
    const result = await db
      .update(agentModelConfigs)
      .set({
        modelId,
        ...(temperature !== undefined && { temperature }),
        ...(maxTokens !== undefined && { maxTokens }),
        ...(instructions !== undefined && { instructions: instructions || null }),
        ...(enabled !== undefined && { enabled }),
        ...(showPreview !== undefined && { showPreview }),
        ...(maxRetries !== undefined && { maxRetries }),
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

router.get('/settings', async (req, res) => {
  try {
    const settings = await db.select().from(appSettings);
    const masked: Record<string, string> = {};
    for (const s of settings) {
      masked[s.key] = (s.key.includes('key') || s.key === 'smtp_password') ? maskApiKey(s.value) : s.value;
    }
    return res.json({ success: true, data: masked });
  } catch (err) {
    console.error('[Admin] Error fetching settings:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

const updateSettingsSchema = z.object({
  app_name: z.string().min(1).max(100).optional(),
  app_url: z.string().max(500).optional(),
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
  blog_sharing_enabled: z.enum(['true', 'false']).optional(),
  guest_mode_enabled: z.enum(['true', 'false']).optional(),
  registration_enabled: z.enum(['true', 'false']).optional(),
  smtp_host: z.string().optional(),
  smtp_port: z.string().optional(),
  smtp_user: z.string().optional(),
  smtp_password: z.string().optional(),
  smtp_from_email: z.string().optional(),
  smtp_from_name: z.string().optional(),
  smtp_secure: z.enum(['true', 'false']).optional(),
  smtp_encryption: z.enum(['none', 'ssl', 'tls']).optional(),
  smtp_auto_tls: z.enum(['true', 'false']).optional(),
  smtp_auth: z.enum(['true', 'false']).optional(),
  gtm_id: z.string().max(20).optional(),
  feedback_enabled: z.enum(['true', 'false']).optional(),
  feedback_widget_enabled: z.enum(['true', 'false']).optional(),
  feedback_agent_enabled: z.enum(['true', 'false']).optional(),
  docs_enabled: z.enum(['true', 'false']).optional(),
  media_allowed_types: z.string().optional(),
});

router.put('/settings', async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid request' });
  }

  try {
    const updates = parsed.data;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        await db
          .insert(appSettings)
          .values({ key, value })
          .onConflictDoUpdate({
            target: appSettings.key,
            set: { value, updatedAt: new Date() },
          });
      }
    }

    // Invalidate model resolver cache so the new API key takes effect immediately
    invalidateCache();
    // Invalidate insights cache if insights_enabled was changed
    if (updates.insights_enabled !== undefined) {
      invalidateInsightsCache();
    }
    // Invalidate guest mode cache if guest_mode_enabled was changed
    if (updates.guest_mode_enabled !== undefined) {
      invalidateGuestModeCache();
    }
    // Invalidate registration cache if registration_enabled was changed
    if (updates.registration_enabled !== undefined) {
      invalidateRegistrationCache();
    }
    // Invalidate docs cache if docs_enabled was changed
    if (updates.docs_enabled !== undefined) {
      invalidateDocsCache();
    }

    // Return masked values
    const settings = await db.select().from(appSettings);
    const masked: Record<string, string> = {};
    for (const s of settings) {
      masked[s.key] = (s.key.includes('key') || s.key === 'smtp_password') ? maskApiKey(s.value) : s.value;
    }

    return res.json({ success: true, data: masked });
  } catch (err) {
    console.error('[Admin] Error updating settings:', err);
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// --- Cache Management ---

router.delete('/cache', async (_req, res) => {
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

router.get('/dress-cache', async (_req, res) => {
  try {
    const stats = await getCacheStats();
    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error('[Admin] Error fetching dress cache stats:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch dress cache stats' });
  }
});

router.delete('/dress-cache', async (_req, res) => {
  try {
    const cleared = await clearDressCache();
    console.log(`[Admin] Cleared ${cleared} cached dresses`);
    return res.json({ success: true, data: { cleared } });
  } catch (err) {
    console.error('[Admin] Error clearing dress cache:', err);
    return res.status(500).json({ success: false, error: 'Failed to clear dress cache' });
  }
});

router.post('/dress-cache/sync', async (_req, res) => {
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

// --- Themes CRUD ---

router.get('/themes', async (_req, res) => {
  try {
    const rows = await db.select().from(themes).orderBy(themes.sortOrder);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Admin] Error fetching themes:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch themes' });
  }
});

const createThemeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
});

router.post('/themes', async (req, res) => {
  const parsed = createThemeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }

  try {
    const [row] = await db.insert(themes).values(parsed.data).returning();
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Admin] Error creating theme:', err);
    return res.status(500).json({ success: false, error: 'Failed to create theme' });
  }
});

const updateThemeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

router.put('/themes/:id', async (req, res) => {
  const parsed = updateThemeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const result = await db
      .update(themes)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(themes.id, id))
      .returning();

    if (result.length === 0) return res.status(404).json({ success: false, error: 'Theme not found' });
    return res.json({ success: true, data: result[0] });
  } catch (err) {
    console.error(`[Admin] Error updating theme ${id}:`, err);
    return res.status(500).json({ success: false, error: 'Failed to update theme' });
  }
});

router.delete('/themes/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const result = await db.delete(themes).where(eq(themes.id, id)).returning();
    if (result.length === 0) return res.status(404).json({ success: false, error: 'Theme not found' });
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error(`[Admin] Error deleting theme ${id}:`, err);
    return res.status(500).json({ success: false, error: 'Failed to delete theme' });
  }
});

// --- Brand Labels CRUD ---

router.get('/brand-labels', async (_req, res) => {
  try {
    const rows = await db.select().from(brandLabels).orderBy(brandLabels.sortOrder);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Admin] Error fetching brand labels:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch brand labels' });
  }
});

const createBrandLabelSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
  displayName: z.string().min(1, 'Display name is required'),
  seoKeywords: z.string().optional(),
  avoidTerms: z.string().optional(),
  websiteUrl: z.string().optional(),
  description: z.string().optional(),
});

router.post('/brand-labels', async (req, res) => {
  const parsed = createBrandLabelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }

  try {
    const [row] = await db.insert(brandLabels).values(parsed.data).returning();
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Admin] Error creating brand label:', err);
    return res.status(500).json({ success: false, error: 'Failed to create brand label' });
  }
});

const updateBrandLabelSchema = z.object({
  slug: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
  seoKeywords: z.string().optional(),
  avoidTerms: z.string().optional(),
  websiteUrl: z.string().optional(),
  description: z.string().optional(),
});

router.put('/brand-labels/:id', async (req, res) => {
  const parsed = updateBrandLabelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const result = await db
      .update(brandLabels)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(brandLabels.id, id))
      .returning();

    if (result.length === 0) return res.status(404).json({ success: false, error: 'Brand label not found' });
    return res.json({ success: true, data: result[0] });
  } catch (err) {
    console.error(`[Admin] Error updating brand label ${id}:`, err);
    return res.status(500).json({ success: false, error: 'Failed to update brand label' });
  }
});

router.delete('/brand-labels/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const result = await db.delete(brandLabels).where(eq(brandLabels.id, id)).returning();
    if (result.length === 0) return res.status(404).json({ success: false, error: 'Brand label not found' });
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error(`[Admin] Error deleting brand label ${id}:`, err);
    return res.status(500).json({ success: false, error: 'Failed to delete brand label' });
  }
});

// --- Voice Presets CRUD ---

router.get('/voice-presets', async (_req, res) => {
  try {
    const rows = await db.select().from(voicePresets).orderBy(voicePresets.sortOrder);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Admin] Error fetching voice presets:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch voice presets' });
  }
});

const createVoicePresetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  rawSourceText: z.string().optional(),
  formattedVoice: z.string().optional(),
  additionalInstructions: z.string().optional(),
});

router.post('/voice-presets', async (req, res) => {
  const parsed = createVoicePresetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }

  try {
    const [row] = await db.insert(voicePresets).values(parsed.data).returning();
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Admin] Error creating voice preset:', err);
    return res.status(500).json({ success: false, error: 'Failed to create voice preset' });
  }
});

const updateVoicePresetSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  rawSourceText: z.string().optional(),
  formattedVoice: z.string().optional(),
  additionalInstructions: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

router.put('/voice-presets/:id', async (req, res) => {
  const parsed = updateVoicePresetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const result = await db
      .update(voicePresets)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(voicePresets.id, id))
      .returning();

    if (result.length === 0) return res.status(404).json({ success: false, error: 'Voice preset not found' });
    return res.json({ success: true, data: result[0] });
  } catch (err) {
    console.error(`[Admin] Error updating voice preset ${id}:`, err);
    return res.status(500).json({ success: false, error: 'Failed to update voice preset' });
  }
});

router.delete('/voice-presets/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const result = await db.delete(voicePresets).where(eq(voicePresets.id, id)).returning();
    if (result.length === 0) return res.status(404).json({ success: false, error: 'Voice preset not found' });
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error(`[Admin] Error deleting voice preset ${id}:`, err);
    return res.status(500).json({ success: false, error: 'Failed to delete voice preset' });
  }
});

// --- Voice Preset Format Stream (SSE) ---

const formatVoiceSchema = z.object({
  rawText: z.string().min(1, 'Raw text is required').max(50000),
  additionalInstructions: z.string().optional(),
});

router.post('/voice-presets/format-stream', async (req, res) => {
  const parsed = formatVoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid request';
    return res.status(400).json({ success: false, error: message });
  }

  const { rawText, additionalInstructions } = parsed.data;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (type: string, data: unknown) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch { /* connection closed */ }
  }, 15_000);

  try {
    const eventHandler = (event: { type: string; data?: unknown }) => {
      sendEvent(event.type, event.data);
    };

    const result = await formatBrandVoiceText(rawText, eventHandler, { additionalInstructions });

    sendEvent('result', { data: result });
    res.end();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Failed to format voice text';
    console.error('[Admin] Voice format-stream error:', errMsg);
    try { sendEvent('error', errMsg); } catch { /* connection closed */ }
    try { res.end(); } catch { /* connection closed */ }
  } finally {
    clearInterval(heartbeat);
  }
});

// --- Enhance Text (generic AI rewrite) ---

const enhanceSchema = z.object({
  text: z.string().min(1).max(5000),
  context: z.string().optional(), // e.g. "theme description for a blog writing AI agent"
});

router.post('/enhance', async (req, res) => {
  try {
    const { text, context } = enhanceSchema.parse(req.body);
    const enhanced = await agentEnhanceText(text, context);
    return res.json({ success: true, data: { text: enhanced } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input' });
    }
    const message = err instanceof Error ? err.message : 'Failed to enhance text';
    console.error('[Admin] Enhance error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// --- App Version ---

router.get('/version', async (_req, res) => {
  return res.json({ success: true, data: { version: appVersion } });
});

// --- User Management ---

router.use('/users', adminUsersRoutes);
router.use('/database', adminDatabaseRoutes);
router.use('/media', adminMediaRoutes);

// --- Audit Logs ---

router.get('/audit/filters', async (_req, res) => {
  try {
    const [actions, resourceTypes, storeCodes] = await Promise.all([
      db.selectDistinct({ value: auditLogs.action }).from(auditLogs).orderBy(auditLogs.action),
      db.selectDistinct({ value: auditLogs.resourceType }).from(auditLogs).orderBy(auditLogs.resourceType),
      db.selectDistinct({ value: users.storeCode })
        .from(auditLogs)
        .innerJoin(users, eq(auditLogs.userId, users.id))
        .where(isNotNull(users.storeCode))
        .orderBy(users.storeCode),
    ]);
    return res.json({
      success: true,
      data: {
        actions: actions.map((r) => r.value),
        resourceTypes: resourceTypes.map((r) => r.value).filter(Boolean),
        storeCodes: storeCodes.map((r) => r.value).filter(Boolean),
      },
    });
  } catch (err) {
    console.error('[Admin] Audit filters error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch audit filters' });
  }
});

router.get('/audit', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    const action = (req.query.action as string) || '';
    const resourceType = (req.query.resourceType as string) || '';
    const userId = (req.query.userId as string) || '';
    const storeCode = (req.query.storeCode as string) || '';

    const conditions = [];
    if (action) conditions.push(eq(auditLogs.action, action));
    if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));
    if (userId === 'guest') conditions.push(isNull(auditLogs.userId));
    else if (userId) conditions.push(eq(auditLogs.userId, userId));
    if (storeCode === '__none__') {
      conditions.push(isNotNull(auditLogs.userId));
      conditions.push(isNull(users.storeCode));
    } else if (storeCode) {
      conditions.push(eq(users.storeCode, storeCode));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          spaceId: auditLogs.spaceId,
          action: auditLogs.action,
          resourceType: auditLogs.resourceType,
          resourceId: auditLogs.resourceId,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
          userDisplayName: users.displayName,
          userEmail: users.email,
          userStoreCode: users.storeCode,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(whereClause),
    ]);
    const total = Number(countResult[0]?.count || 0);

    return res.json({ success: true, data: { logs: rows, total, page, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Admin] Audit logs error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

router.get('/stats', async (_req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, blogsToday, blogsWeek, blogsMonth, activeUsers30d] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(blogSessions).where(sql`${blogSessions.createdAt} >= ${today}`),
      db.select({ count: sql<number>`count(*)` }).from(blogSessions).where(sql`${blogSessions.createdAt} >= ${weekAgo}`),
      db.select({ count: sql<number>`count(*)` }).from(blogSessions).where(sql`${blogSessions.createdAt} >= ${monthAgo}`),
      db.select({ count: sql<number>`count(distinct ${auditLogs.userId})` }).from(auditLogs).where(sql`${auditLogs.createdAt} >= ${monthAgo} AND ${auditLogs.userId} IS NOT NULL`),
    ]);

    return res.json({
      success: true,
      data: {
        totalUsers: Number(totalUsers[0]?.count || 0),
        blogsToday: Number(blogsToday[0]?.count || 0),
        blogsThisWeek: Number(blogsWeek[0]?.count || 0),
        blogsThisMonth: Number(blogsMonth[0]?.count || 0),
        activeUsers30d: Number(activeUsers30d[0]?.count || 0),
      },
    });
  } catch (err) {
    console.error('[Admin] Stats error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// --- SMTP Test ---

router.post('/smtp/test', async (_req, res) => {
  try {
    const result = await testSmtpConnection();
    return res.json({ success: result.success, error: result.error });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SMTP test failed';
    return res.status(500).json({ success: false, error: message });
  }
});

// --- Email Templates ---

router.get('/email/templates', async (_req, res) => {
  try {
    const previews = renderAllPreviews();
    return res.json({ success: true, data: previews });
  } catch (err) {
    console.error('[Admin] Error fetching email templates:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch email templates' });
  }
});

const testEmailSchema = z.object({
  to: z.string().email('Valid email address is required'),
});

router.post('/email/templates/:id/test', async (req, res) => {
  const { id } = req.params;
  if (!EMAIL_TEMPLATES[id]) {
    return res.status(404).json({ success: false, error: 'Template not found' });
  }

  const parsed = testEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }

  try {
    const sent = await sendTemplateEmail(parsed.data.to, id);
    if (!sent) {
      return res.json({ success: false, error: 'SMTP not configured or send failed' });
    }
    return res.json({ success: true, data: { message: `Test email sent to ${parsed.data.to}` } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send test email';
    console.error(`[Admin] Error sending test email (${id}):`, message);
    return res.status(500).json({ success: false, error: message });
  }
});

// --- Feedback Forms (CRUD) ---

const PILOT_SURVEY_QUESTIONS = JSON.stringify([
  { id: 'contentWorkflow', section: 1, required: true, type: 'radio', question: 'How does your team currently handle blog content?', options: [
    { value: 'established', label: 'Established', description: 'We follow a consistent, defined content calendar.' },
    { value: 'ad_hoc', label: 'Ad Hoc', description: 'We create content when we have time or inspiration.' },
    { value: 'none', label: 'None', description: 'We rarely or never publish blog content.' },
  ]},
  { id: 'draftReadiness', section: 1, required: true, type: 'radio', question: 'How close was the AI\'s draft to being "ready to publish"?', options: [
    { value: 'ready', label: 'Ready to Ship', description: 'I could post this with zero or very minor tweaks (typos/formatting).' },
    { value: 'polishing', label: 'Polishing Needed', description: 'I made light edits to align it with my specific brand voice/details.' },
    { value: 'draft', label: 'Draft Only', description: 'I used it as a structural outline, but rewrote significant portions.' },
    { value: 'not_usable', label: 'Not Usable', description: 'The content did not meet my quality or brand standards.' },
  ]},
  { id: 'timeComparison', section: 1, required: true, type: 'radio', question: 'Compared to your usual way of working, using this tool felt:', options: [
    { value: 'much_faster', label: 'Much faster', description: 'Saved hours of work' },
    { value: 'somewhat_faster', label: 'Somewhat faster', description: 'Saved some time' },
    { value: 'neutral', label: 'Neutral', description: 'Took about the same effort as writing myself' },
    { value: 'more_work', label: 'More work', description: 'Editing/fixing took longer than writing from scratch' },
  ]},
  { id: 'brandConfidence', section: 1, required: true, type: 'radio', question: 'How confident would you feel letting this tool represent your store\'s brand with only a quick "sanity check" review?', options: [
    { value: 'high', label: 'High Confidence', description: 'I trust the tone and accuracy.' },
    { value: 'moderate', label: 'Moderate Confidence', description: 'I\'d use it, but I\'d always check the "vibe" first.' },
    { value: 'low', label: 'Low Confidence', description: 'I\'m hesitant; it doesn\'t quite sound like us yet.' },
    { value: 'none', label: 'No Confidence', description: 'I wouldn\'t trust it to represent our brand.' },
  ]},
  { id: 'improvement', section: 2, required: false, type: 'textarea', question: 'If you could change one specific thing to make this tool more helpful for your store, what would it be?' },
  { id: 'role', section: 3, required: true, type: 'radio', question: 'Your Role:', options: [
    { value: 'owner', label: 'Store Owner' },
    { value: 'manager', label: 'Store Manager / Employee' },
    { value: 'corporate', label: 'Corporate Team' },
  ]},
  { id: 'businessType', section: 3, required: true, type: 'radio', question: 'Business Type:', options: [
    { value: 'single', label: 'Single Boutique Location' },
    { value: 'multi', label: 'Multi-Location / Regional Group' },
  ]},
]);

// Seed pilot survey if it doesn't exist
async function seedPilotSurvey(): Promise<void> {
  try {
    const existing = await db.select({ id: feedbackForms.id }).from(feedbackForms).where(eq(feedbackForms.slug, 'pilot-v1')).limit(1);
    if (existing.length === 0) {
      await db.insert(feedbackForms).values({
        name: 'Pilot Survey',
        slug: 'pilot-v1',
        type: 'form',
        description: 'Initial pilot feedback survey for Bride Write users.',
        questions: PILOT_SURVEY_QUESTIONS,
        isActive: true,
        isDefault: true,
        sortOrder: 0,
      });
      console.log('[Feedback] Seeded pilot survey form.');
    }
  } catch (err) {
    console.error('[Feedback] Failed to seed pilot survey:', err);
  }
}
// Run seed asynchronously at startup
seedPilotSurvey().catch(() => {});

router.get('/feedback/forms', async (_req, res) => {
  try {
    const rows = await db.select().from(feedbackForms).orderBy(feedbackForms.sortOrder, feedbackForms.createdAt);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Admin] Error fetching feedback forms:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch feedback forms' });
  }
});

const createFeedbackFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  type: z.enum(['form', 'chat']).default('form'),
  description: z.string().optional(),
  questions: z.string().default('[]'),  // JSON string
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

router.post('/feedback/forms', async (req, res) => {
  const parsed = createFeedbackFormSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }
  try {
    const [row] = await db.insert(feedbackForms).values(parsed.data).returning();
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Admin] Error creating feedback form:', err);
    return res.status(500).json({ success: false, error: 'Failed to create feedback form' });
  }
});

const updateFeedbackFormSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  questions: z.string().optional(),  // JSON string
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

router.put('/feedback/forms/:id', async (req, res) => {
  const parsed = updateFeedbackFormSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }
  try {
    const [row] = await db.update(feedbackForms)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(feedbackForms.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Form not found' });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Admin] Error updating feedback form:', err);
    return res.status(500).json({ success: false, error: 'Failed to update feedback form' });
  }
});

router.get('/feedback/forms/:id/export', async (req, res) => {
  try {
    const [form] = await db.select().from(feedbackForms).where(eq(feedbackForms.id, req.params.id)).limit(1);
    if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
    const responses = await db.select().from(feedbackResponses).where(eq(feedbackResponses.formId, req.params.id)).orderBy(desc(feedbackResponses.createdAt));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="feedback-${form.slug}-export.json"`);
    return res.send(JSON.stringify({ form, responses }, null, 2));
  } catch (err) {
    console.error('[Admin] Error exporting feedback form:', err);
    return res.status(500).json({ success: false, error: 'Failed to export form' });
  }
});

// --- Feedback Responses ---

router.get('/feedback', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const status = (req.query.status as string) || '';
    const storeCode = (req.query.storeCode as string) || '';
    const formSlug = (req.query.formSlug as string) || '';

    const conditions = [];
    if (status) conditions.push(eq(feedbackResponses.status, status));
    if (storeCode) conditions.push(eq(feedbackResponses.storeCode, storeCode));
    if (formSlug) conditions.push(eq(feedbackResponses.formSlug, formSlug));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db.select().from(feedbackResponses).where(whereClause).orderBy(desc(feedbackResponses.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(feedbackResponses).where(whereClause),
    ]);
    const total = Number(countResult[0]?.count || 0);
    return res.json({ success: true, data: { responses: rows, total, page, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Admin] Error fetching feedback:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch feedback' });
  }
});

router.get('/feedback/stats', async (_req, res) => {
  try {
    const [total, byStatus, flagged] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(feedbackResponses),
      db.select({ status: feedbackResponses.status, count: sql<number>`count(*)` }).from(feedbackResponses).groupBy(feedbackResponses.status),
      db.select({ count: sql<number>`count(*)` }).from(feedbackResponses).where(sql`${feedbackResponses.agentReview} IS NOT NULL AND ${feedbackResponses.agentReview} LIKE '%"flagged":true%'`),
    ]);
    const statusMap: Record<string, number> = {};
    for (const row of byStatus) statusMap[row.status] = Number(row.count);
    return res.json({
      success: true,
      data: {
        total: Number(total[0]?.count || 0),
        new: statusMap['new'] || 0,
        reviewed: statusMap['reviewed'] || 0,
        actioned: statusMap['actioned'] || 0,
        flagged: Number(flagged[0]?.count || 0),
      },
    });
  } catch (err) {
    console.error('[Admin] Error fetching feedback stats:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

router.get('/feedback/pending-review-ids', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const [totalRow, rows] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(feedbackResponses).where(isNull(feedbackResponses.agentReviewedAt)),
      db.select({ id: feedbackResponses.id })
        .from(feedbackResponses)
        .where(isNull(feedbackResponses.agentReviewedAt))
        .orderBy(asc(feedbackResponses.createdAt))
        .limit(limit),
    ]);
    return res.json({
      success: true,
      data: {
        ids: rows.map((r) => r.id),
        total: Number(totalRow[0]?.count || 0),
      },
    });
  } catch (err) {
    console.error('[Admin] Error fetching pending review IDs:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch pending review IDs' });
  }
});

router.get('/feedback/:id', async (req, res) => {
  try {
    const [row] = await db.select().from(feedbackResponses).where(eq(feedbackResponses.id, req.params.id)).limit(1);
    if (!row) return res.status(404).json({ success: false, error: 'Response not found' });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Admin] Error fetching feedback response:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch feedback response' });
  }
});

router.post('/feedback/:id/review', async (req, res) => {
  try {
    const [row] = await db.select().from(feedbackResponses).where(eq(feedbackResponses.id, req.params.id)).limit(1);
    if (!row) return res.status(404).json({ success: false, error: 'Response not found' });

    const [form] = await db.select().from(feedbackForms).where(eq(feedbackForms.id, row.formId ?? '')).limit(1);
    if (!form) return res.status(404).json({ success: false, error: 'Form not found' });

    const { reviewFeedback } = await import('../mastra/agents/feedback-reviewer');
    const answers = JSON.parse(row.answers) as Record<string, string>;
    const review = await reviewFeedback(form.questions, answers);
    const [updated] = await db.update(feedbackResponses)
      .set({ agentReview: JSON.stringify(review), agentReviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(feedbackResponses.id, req.params.id))
      .returning();
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[Admin] Error running feedback review:', err);
    return res.status(500).json({ success: false, error: 'Failed to run agent review' });
  }
});

const updateFeedbackResponseSchema = z.object({
  status: z.enum(['new', 'reviewed', 'actioned']).optional(),
  adminNotes: z.string().optional(),
});

router.put('/feedback/:id', async (req, res) => {
  const parsed = updateFeedbackResponseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }
  try {
    const [row] = await db.update(feedbackResponses)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(feedbackResponses.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Response not found' });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Admin] Error updating feedback response:', err);
    return res.status(500).json({ success: false, error: 'Failed to update feedback response' });
  }
});

// ============================================================
// Docs Pages
// ============================================================

router.get('/docs', async (_req, res) => {
  try {
    const rows = await db
      .select({ id: docsPages.id, slug: docsPages.slug, title: docsPages.title, parentId: docsPages.parentId, sortOrder: docsPages.sortOrder, isPublished: docsPages.isPublished, isDefault: docsPages.isDefault })
      .from(docsPages)
      .orderBy(asc(docsPages.sortOrder), asc(docsPages.createdAt));
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Admin] Error fetching docs:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch docs' });
  }
});

const createDocsPageSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  content: z.string().default(''),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isPublished: z.boolean().default(false),
});

router.post('/docs', async (req, res) => {
  const parsed = createDocsPageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }
  try {
    const [row] = await db.insert(docsPages)
      .values({ ...parsed.data, updatedBy: req.user?.id })
      .returning();
    return res.json({ success: true, data: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique')) return res.status(409).json({ success: false, error: 'A page with that slug already exists' });
    console.error('[Admin] Error creating docs page:', err);
    return res.status(500).json({ success: false, error: 'Failed to create page' });
  }
});

const updateDocsPageSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  content: z.string().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

// GET /docs/by-slug/:slug — fetch single page by slug (includes unpublished)
router.get('/docs/by-slug/:slug', async (req, res) => {
  try {
    const [row] = await db.select().from(docsPages).where(eq(docsPages.slug, req.params.slug)).limit(1);
    if (!row) return res.status(404).json({ success: false, error: 'Page not found' });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Admin] Error fetching docs page:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch page' });
  }
});

// POST /docs/reorder must be declared before PUT /docs/:id to avoid conflict
router.post('/docs/reorder', async (req, res) => {
  const schema = z.array(z.object({ id: z.string(), sortOrder: z.number().int(), parentId: z.string().nullable().optional() }));
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid reorder payload' });
  }
  try {
    for (const item of parsed.data) {
      await db.update(docsPages)
        .set({ sortOrder: item.sortOrder, ...(item.parentId !== undefined ? { parentId: item.parentId } : {}), updatedAt: new Date() })
        .where(eq(docsPages.id, item.id));
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Error reordering docs:', err);
    return res.status(500).json({ success: false, error: 'Failed to reorder pages' });
  }
});

router.put('/docs/:id', async (req, res) => {
  const parsed = updateDocsPageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
  }
  try {
    // If setting this page as default, unset all others first
    if (parsed.data.isDefault === true) {
      await db.update(docsPages).set({ isDefault: false }).where(eq(docsPages.isDefault, true));
    }
    const [row] = await db.update(docsPages)
      .set({ ...parsed.data, updatedBy: req.user?.id, updatedAt: new Date() })
      .where(eq(docsPages.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Page not found' });
    return res.json({ success: true, data: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique')) return res.status(409).json({ success: false, error: 'A page with that slug already exists' });
    console.error('[Admin] Error updating docs page:', err);
    return res.status(500).json({ success: false, error: 'Failed to update page' });
  }
});

router.delete('/docs/:id', async (req, res) => {
  try {
    // Orphan children rather than cascade-delete
    await db.update(docsPages).set({ parentId: null, updatedAt: new Date() }).where(eq(docsPages.parentId, req.params.id));
    const [row] = await db.delete(docsPages).where(eq(docsPages.id, req.params.id)).returning({ id: docsPages.id });
    if (!row) return res.status(404).json({ success: false, error: 'Page not found' });
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('[Admin] Error deleting docs page:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete page' });
  }
});

export default router;
