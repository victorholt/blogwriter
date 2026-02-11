import { Router } from 'express'
import brandVoiceRoutes from './brand-voice'
import adminRoutes from './admin'
import dressRoutes from './dresses'
import blogRoutes from './blog'
import themeRoutes from './themes'
import { db } from '../db'
import { appSettings } from '../db/schema'
import { eq, inArray } from 'drizzle-orm'

const router = Router()

// Brand Voice
router.use('/brand-voice', brandVoiceRoutes)

// Dresses
router.use('/dresses', dressRoutes)

// Blog Generation
router.use('/blog', blogRoutes)

// Themes
router.use('/themes', themeRoutes)

// Admin
router.use('/admin', adminRoutes)

// Public settings endpoint (no auth required)
router.get('/settings/debug-mode', async (_req, res) => {
  try {
    const setting = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'debug_mode'))
      .limit(1);
    return res.json({ debugMode: setting[0]?.value === 'true' });
  } catch {
    return res.json({ debugMode: false });
  }
})

// Public blog settings endpoint (no auth required)
router.get('/settings/blog', async (_req, res) => {
  try {
    const settings = await db
      .select()
      .from(appSettings)
      .where(inArray(appSettings.key, ['blog_timeline_style', 'blog_generate_images', 'blog_generate_links']));
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    return res.json({
      timelineStyle: map.blog_timeline_style || 'preview-bar',
      generateImages: map.blog_generate_images !== 'false',
      generateLinks: map.blog_generate_links !== 'false',
    });
  } catch {
    return res.json({ timelineStyle: 'preview-bar', generateImages: true, generateLinks: true });
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
