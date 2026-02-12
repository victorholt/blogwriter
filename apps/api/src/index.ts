import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import apiRoutes from './routes/api'
import { runMigrations } from './db/migrate'
import { seedDatabase } from './db/seed'

const app = express()
const PORT = process.env.PORT || 4000

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}))
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api', apiRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'blogwriter API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/*',
    },
  })
})

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
})

// Start server
app.listen(PORT, async () => {
  console.log(`API server running on http://localhost:${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)

  // Run migrations (no-op if drizzle/ folder doesn't exist)
  try {
    await runMigrations()
  } catch (err) {
    console.error('[Startup] Migration error (may be expected if using db:push):', err)
  }

  // Seed default data — must run even if migrations fail
  try {
    await seedDatabase()
  } catch (err) {
    console.error('[Startup] Failed to seed database:', err)
  }
})
