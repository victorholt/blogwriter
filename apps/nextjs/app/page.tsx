'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Rocket,
  Server,
  Database,
  Terminal,
  Code2,
  Zap,
  Package,
  ArrowRight,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'

interface HelloResponse {
  message: string
  timestamp: string
  service: string
  version: string
}

interface Item {
  id: number
  name: string
  description: string
}

interface ItemsResponse {
  items: Item[]
  count: number
}

type ConnectionStatus = 'loading' | 'connected' | 'error'

export default function Home() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('loading')
  const [helloData, setHelloData] = useState<HelloResponse | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://blogwriter.test:4444'

  const fetchData = async () => {
    setIsRefreshing(true)
    try {
      // Fetch hello endpoint
      const helloRes = await fetch(`${apiUrl}/api/hello`)
      if (!helloRes.ok) throw new Error('Failed to connect to API')
      const helloJson: HelloResponse = await helloRes.json()
      setHelloData(helloJson)

      // Fetch items endpoint
      const itemsRes = await fetch(`${apiUrl}/api/items`)
      if (itemsRes.ok) {
        const itemsJson: ItemsResponse = await itemsRes.json()
        setItems(itemsJson.items)
      }

      setConnectionStatus('connected')
      setError(null)
    } catch (err) {
      setConnectionStatus('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className="welcome-page">
      <div className="container">
        {/* Hero Section */}
        <header className="hero">
          <h1 className="hero__title">blogwriter</h1>
          <p className="hero__subtitle">
            Your Docker-powered full-stack application is ready.
            Start building something amazing.
          </p>
          {connectionStatus === 'connected' && (
            <div className="hero__badge">
              <CheckCircle2 size={16} />
              All systems operational
            </div>
          )}
        </header>

        {/* Status Cards */}
        <div className="content-grid" style={{ marginBottom: '2rem' }}>
          {/* API Connection Status */}
          <div className="feature-card">
            <div className="feature-card__header">
              <div className={`feature-card__icon ${connectionStatus === 'connected' ? 'feature-card__icon--success' : ''}`}>
                <Server size={20} />
              </div>
              <h2 className="feature-card__title">API Connection</h2>
            </div>

            <div className={`status-indicator status-indicator--${connectionStatus}`}>
              {connectionStatus === 'loading' && (
                <>
                  <div className="spinner" />
                  <span>Connecting to Express API...</span>
                </>
              )}
              {connectionStatus === 'connected' && (
                <>
                  <div className="status-indicator__dot status-indicator__dot--pulse" />
                  <span>Connected to {helloData?.service} {helloData?.version}</span>
                </>
              )}
              {connectionStatus === 'error' && (
                <>
                  <XCircle size={16} />
                  <span>Connection failed</span>
                </>
              )}
            </div>

            {error && (
              <p className="feature-card__description" style={{ marginTop: '0.75rem', color: 'rgb(239, 68, 68)' }}>
                {error}. Make sure the API container is running.
              </p>
            )}

            {helloData && (
              <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                <p style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <strong>Message:</strong> {helloData.message}
                </p>
                <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
                  <strong>Last checked:</strong> {new Date(helloData.timestamp).toLocaleTimeString()}
                </p>
              </div>
            )}

            <button
              onClick={fetchData}
              disabled={isRefreshing}
              style={{
                marginTop: '1rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: 'hsl(var(--primary))',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                opacity: isRefreshing ? 0.7 : 1,
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'spinner' : ''} />
              Refresh
            </button>
          </div>

          {/* Live API Data */}
          <div className="feature-card">
            <div className="feature-card__header">
              <div className="feature-card__icon feature-card__icon--secondary">
                <Database size={20} />
              </div>
              <h2 className="feature-card__title">Live API Data</h2>
            </div>

            {items.length > 0 ? (
              <div className="api-demo__grid">
                {items.map((item) => (
                  <div key={item.id} className="api-demo__item">
                    <div className="api-demo__item-info">
                      <span className="api-demo__item-id">{item.id}</span>
                      <div>
                        <div className="api-demo__item-name">{item.name}</div>
                        <div className="api-demo__item-desc">{item.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="feature-card__description">
                {connectionStatus === 'loading'
                  ? 'Loading items from API...'
                  : 'No items loaded. Check API connection.'}
              </p>
            )}

            <p className="feature-card__description" style={{ marginTop: '1rem' }}>
              Data fetched from <code style={{ background: 'hsl(var(--muted))', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>/api/items</code>
            </p>
          </div>

          {/* Tech Stack */}
          <div className="feature-card">
            <div className="feature-card__header">
              <div className="feature-card__icon">
                <Zap size={20} />
              </div>
              <h2 className="feature-card__title">Tech Stack</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { icon: Code2, name: 'Next.js 16', desc: 'React framework with App Router' },
                { icon: Server, name: 'Express.js', desc: 'Fast, unopinionated API' },
                { icon: Package, name: 'Docker', desc: 'Containerized deployment' },
              ].map(({ icon: Icon, name, desc }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Icon size={18} style={{ color: 'hsl(var(--primary))' }} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Start Section */}
        <div className="feature-card" style={{ marginBottom: '2rem' }}>
          <div className="feature-card__header">
            <div className="feature-card__icon feature-card__icon--success">
              <Rocket size={20} />
            </div>
            <h2 className="feature-card__title">Quick Start Guide</h2>
          </div>

          <div className="quick-start">
            <div className="quick-start__step">
              <span className="quick-start__number">1</span>
              <div className="quick-start__content">
                <div className="quick-start__title">Edit the frontend</div>
                <div className="quick-start__description">
                  Modify <code>apps/nextjs/app/page.tsx</code> to customize this page
                </div>
              </div>
            </div>

            <div className="quick-start__step">
              <span className="quick-start__number">2</span>
              <div className="quick-start__content">
                <div className="quick-start__title">Add API endpoints</div>
                <div className="quick-start__description">
                  Create new routes in <code>apps/api/src/routes/</code>
                </div>
              </div>
            </div>

            <div className="quick-start__step">
              <span className="quick-start__number">3</span>
              <div className="quick-start__content">
                <div className="quick-start__title">Install UI components</div>
                <div className="quick-start__description">
                  Add shadcn/ui components: <code>npx shadcn@latest add button</code>
                </div>
              </div>
            </div>

            <div className="quick-start__step">
              <span className="quick-start__number">4</span>
              <div className="quick-start__content">
                <div className="quick-start__title">Configure environment</div>
                <div className="quick-start__description">
                  Update <code>.env</code> with your settings
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CLI Commands */}
        <div className="feature-card">
          <div className="feature-card__header">
            <div className="feature-card__icon">
              <Terminal size={20} />
            </div>
            <h2 className="feature-card__title">Useful Commands</h2>
          </div>

          <div className="code-block">
            <span className="code-block__comment"># Start all services</span>
            <span className="code-block__line">./cli up</span>
            <br />
            <span className="code-block__comment"># View logs</span>
            <span className="code-block__line">./cli logs</span>
            <br />
            <span className="code-block__comment"># Stop all services</span>
            <span className="code-block__line">./cli down</span>
            <br />
            <span className="code-block__comment"># Rebuild containers</span>
            <span className="code-block__line">./cli build</span>
            <br />
            <span className="code-block__comment"># Access container shell</span>
            <span className="code-block__line">./cli shell nextjs</span>
          </div>

          <p className="feature-card__description" style={{ marginTop: '1rem' }}>
            Run <code style={{ background: 'hsl(var(--muted))', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>./cli help</code> to see all available commands.
          </p>
        </div>

        {/* Footer */}
        <footer style={{
          textAlign: 'center',
          marginTop: '3rem',
          paddingTop: '2rem',
          borderTop: '1px solid hsl(var(--border))',
          color: 'hsl(var(--muted-foreground))',
          fontSize: '0.875rem'
        }}>
          <p>Generated with Docker Project Builder</p>
        </footer>
      </div>
    </div>
  )
}
