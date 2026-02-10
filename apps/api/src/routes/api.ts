import { Router } from 'express'

const router = Router()

// Hello endpoint - called by Next.js frontend
router.get('/hello', (req, res) => {
  res.json({
    message: 'Hello from blogwriter API! 👋',
    timestamp: new Date().toISOString(),
    service: 'Express.js',
    version: '1.0.0',
  })
})

// Example: Get items
router.get('/items', (req, res) => {
  const items = [
    { id: 1, name: 'Item 1', description: 'First example item' },
    { id: 2, name: 'Item 2', description: 'Second example item' },
    { id: 3, name: 'Item 3', description: 'Third example item' },
  ]

  res.json({ items, count: items.length })
})

// Example: Get item by ID
router.get('/items/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const item = { id, name: `Item ${id}`, description: `Example item ${id}` }

  res.json(item)
})

// Example: Create item (POST)
router.post('/items', (req, res) => {
  const { name, description } = req.body

  if (!name) {
    return res.status(400).json({ error: 'Name is required' })
  }

  const newItem = {
    id: Date.now(),
    name,
    description: description || 'No description provided',
    createdAt: new Date().toISOString(),
  }

  res.status(201).json(newItem)
})

export default router
