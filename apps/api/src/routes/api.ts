import { Router } from 'express'
import brandVoiceRoutes from './brand-voice'
import adminRoutes from './admin'
import dressRoutes from './dresses'
import blogRoutes from './blog'

const router = Router()

// Brand Voice
router.use('/brand-voice', brandVoiceRoutes)

// Dresses
router.use('/dresses', dressRoutes)

// Blog Generation
router.use('/blog', blogRoutes)

// Admin
router.use('/admin', adminRoutes)

// Health/info
router.get('/hello', (req, res) => {
  res.json({
    message: 'blogwriter API',
    timestamp: new Date().toISOString(),
  })
})

export default router
