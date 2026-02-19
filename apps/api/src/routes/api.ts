import { Router } from 'express'
import brandVoiceRoutes from './brand-voice'
import adminRoutes from './admin'
import dressRoutes from './dresses'
import blogRoutes from './blog'
import themeRoutes from './themes'
import shareRoutes from './share'
import voicePresetRoutes from './voice-presets'
import authRoutes from './auth'
import userBlogRoutes from './user-blogs'
import blogSharingRoutes from './blog-sharing'
import savedVoiceRoutes from './saved-voices'
import voiceMergeRoutes from './voice-merge'
import { db } from '../db'
import { appSettings, agentModelConfigs } from '../db/schema'
import { eq, inArray } from 'drizzle-orm'
import { isGuestModeEnabled, isRegistrationEnabled } from '../services/site-settings'

const router = Router()

// Brand Voice
router.use('/brand-voice', brandVoiceRoutes)

// Dresses
router.use('/dresses', dressRoutes)

// Blog Generation
router.use('/blog', blogRoutes)

// Themes
router.use('/themes', themeRoutes)

// Share
router.use('/share', shareRoutes)

// Voice Presets
router.use('/voice-presets', voicePresetRoutes)

// Auth
router.use('/auth', authRoutes)

// User Blogs (requires auth)
router.use('/blogs', userBlogRoutes)

// Blog Sharing (requires auth)
router.use('/blogs', blogSharingRoutes)

// Saved Brand Voices (requires auth)
router.use('/saved-voices', savedVoiceRoutes)

// Voice Merge (requires auth)
router.use('/voice-merge', voiceMergeRoutes)

// Admin
router.use('/admin', adminRoutes)

// Public settings endpoint (no auth required)
router.get('/settings/debug-mode', async (_req, res) => {
  try {
    const settings = await db
      .select()
      .from(appSettings)
      .where(inArray(appSettings.key, ['debug_mode', 'insights_enabled']));
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    return res.json({
      debugMode: map.debug_mode === 'true',
      insightsEnabled: map.insights_enabled !== 'false',
    });
  } catch {
    return res.json({ debugMode: false, insightsEnabled: true });
  }
})

// Public blog settings endpoint (no auth required)
router.get('/settings/blog', async (_req, res) => {
  try {
    const [settings, agents] = await Promise.all([
      db.select()
        .from(appSettings)
        .where(inArray(appSettings.key, ['blog_timeline_style', 'blog_generate_images', 'blog_generate_links', 'blog_sharing_enabled'])),
      db.select({ agentId: agentModelConfigs.agentId, showPreview: agentModelConfigs.showPreview })
        .from(agentModelConfigs)
        .where(eq(agentModelConfigs.showPreview, true)),
    ]);
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    // Build previewAgents: comma-separated IDs of agents with showPreview enabled
    const previewIds = agents.map((a) => a.agentId);
    return res.json({
      timelineStyle: map.blog_timeline_style || 'preview-bar',
      generateImages: map.blog_generate_images !== 'false',
      generateLinks: map.blog_generate_links !== 'false',
      sharingEnabled: map.blog_sharing_enabled === 'true',
      previewAgents: previewIds.length > 0 ? previewIds.join(',') : 'none',
    });
  } catch {
    return res.json({ timelineStyle: 'preview-bar', generateImages: true, generateLinks: true, sharingEnabled: false, previewAgents: 'none' });
  }
})

// Public app settings endpoint (no auth required)
router.get('/settings/app', async (_req, res) => {
  try {
    const setting = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'app_name'))
      .limit(1);
    return res.json({ appName: setting[0]?.value || 'BlogWriter' });
  } catch {
    return res.json({ appName: 'BlogWriter' });
  }
})

// Public auth settings endpoint (no auth required)
router.get('/settings/auth', async (_req, res) => {
  try {
    const [guestModeEnabled, registrationEnabled] = await Promise.all([
      isGuestModeEnabled(),
      isRegistrationEnabled(),
    ]);
    return res.json({ guestModeEnabled, registrationEnabled });
  } catch {
    return res.json({ guestModeEnabled: true, registrationEnabled: true });
  }
})

// Consolidated public settings — returns everything the client needs on init in a single call
router.get('/settings/init', async (_req, res) => {
  try {
    const [settingsRows, agents, guestModeEnabled, registrationEnabled] = await Promise.all([
      db.select()
        .from(appSettings)
        .where(inArray(appSettings.key, [
          'debug_mode', 'insights_enabled',
          'blog_timeline_style', 'blog_generate_images', 'blog_generate_links', 'blog_sharing_enabled',
          'app_name',
        ])),
      db.select({ agentId: agentModelConfigs.agentId })
        .from(agentModelConfigs)
        .where(eq(agentModelConfigs.showPreview, true)),
      isGuestModeEnabled(),
      isRegistrationEnabled(),
    ]);

    const map = Object.fromEntries(settingsRows.map((s) => [s.key, s.value]));
    const previewIds = agents.map((a) => a.agentId);

    return res.json({
      debugMode: map.debug_mode === 'true',
      insightsEnabled: map.insights_enabled !== 'false',
      timelineStyle: map.blog_timeline_style || 'preview-bar',
      generateImages: map.blog_generate_images !== 'false',
      generateLinks: map.blog_generate_links !== 'false',
      sharingEnabled: map.blog_sharing_enabled === 'true',
      previewAgents: previewIds.length > 0 ? previewIds.join(',') : 'none',
      appName: map.app_name || 'BlogWriter',
      guestModeEnabled,
      registrationEnabled,
    });
  } catch {
    return res.json({
      debugMode: false, insightsEnabled: true,
      timelineStyle: 'preview-bar', generateImages: true, generateLinks: true,
      sharingEnabled: false, previewAgents: 'none', appName: 'BlogWriter',
      guestModeEnabled: true, registrationEnabled: true,
    });
  }
})

// Health/info
router.get('/hello', (req, res) => {
  res.json({
    message: 'blogwriter API',
    timestamp: new Date().toISOString(),
  })
})

export default router
