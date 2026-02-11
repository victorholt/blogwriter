import { Router } from 'express'
import brandVoiceRoutes from './brand-voice'
import adminRoutes from './admin'
import dressRoutes from './dresses'
import blogRoutes from './blog'
import { db } from '../db'
import { appSettings } from '../db/schema'
import { eq } from 'drizzle-orm'

const router = Router()

// Brand Voice
router.use('/brand-voice', brandVoiceRoutes)

// Dresses
router.use('/dresses', dressRoutes)

// Blog Generation
router.use('/blog', blogRoutes)

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

// Health/info
router.get('/hello', (req, res) => {
  res.json({
    message: 'blogwriter API',
    timestamp: new Date().toISOString(),
  })
})

export default router
