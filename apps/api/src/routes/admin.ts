import { Router } from 'express';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { db } from '../db';
import { agentModelConfigs, agentAdditionalInstructions, appSettings, brandVoiceCache, themes, brandLabels, voicePresets, auditLogs, users, blogSessions } from '../db/schema';
import { eq, asc, and, desc, sql } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth';
import { invalidateCache } from '../mastra/lib/model-resolver';
import { enhanceText as agentEnhanceText } from '../mastra/agents/text-enhancer';
import { clearDressCache, syncDressesFromApi, getCacheStats } from '../services/dress-cache';
import { AGENT_DEFAULTS } from '../mastra/lib/agent-defaults';
import { loadProductApiConfig } from '../services/product-api-client';
import { invalidateInsightsCache } from '../services/agent-trace';
import { formatBrandVoiceText } from '../mastra/agents/brand-voice-formatter';
import { testSmtpConnection } from '../services/email';
import { invalidateGuestModeCache, invalidateRegistrationCache } from '../services/site-settings';
import adminUsersRoutes from './admin-users';

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
  const res = await fetch('https://openrouter.ai/api/v1/models');
  const json: any = await res.json();
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

// --- Audit Logs ---

router.get('/audit', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const rows = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(auditLogs);
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

export default router;
