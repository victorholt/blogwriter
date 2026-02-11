# Architecture Overview

## Purpose

Define the system topology, service boundaries, and data flow for the blogwriter platform — an AI-powered SPA that generates wedding dress blog posts through a multi-agent pipeline.

---

## System Topology

```mermaid
graph TB
    subgraph Docker["Docker Network (app-network)"]
        Proxy["Apache Proxy<br/>:80/:443"]
        NextJS["Next.js 16<br/>:3000"]
        API["Express.js 4<br/>:4000"]
        Postgres["PostgreSQL 16<br/>:5432"]
        Valkey["Valkey<br/>:6379"]
    end

    User["Browser"] -->|":8081 / :8444"| Proxy
    Proxy -->|"/"| NextJS
    Proxy -->|"/api/*"| API
    NextJS -->|"fetch"| API
    API --> Postgres
    API --> Valkey
    API -->|"OpenRouter API"| LLMs["LLM Models"]
    API -->|"External API"| DressAPI["Dress API"]
```

## External Ports (Host)

| Service | Port | Purpose |
|---------|------|---------|
| Proxy HTTP | 8081 | Main entry point |
| Proxy HTTPS | 8444 | SSL entry point |
| API (dev) | 4444 | Direct API access during development |
| Next.js (dev) | 4443 | Direct frontend access during development |
| Postgres | 5432 | Database access (dev tools) |
| Valkey | 6380 | Cache access (dev tools) |

---

## Service Responsibilities

### Apache Proxy
- **Routing**: `/ → Next.js`, `/api/* → Express API`
- **SSL termination**: Handles HTTPS, forwards HTTP internally
- **Static**: No application logic

### Next.js Frontend (SPA)
- **Single page application**: One page (`/`) with a 4-step wizard
- **Client-side rendering**: Wizard state managed in browser via Zustand
- **API communication**: All data fetched from Express API via `fetch()`
- **Admin page**: Hidden route at `/settings/[token]`
- **No server-side data fetching**: All API calls happen client-side

### Express API
- **REST endpoints**: Brand voice analysis, dress fetching, blog generation, admin config
- **Agent orchestration**: Creates and runs Mastra agents, streams progress via SSE
- **Data layer**: Drizzle ORM for Postgres, ioredis for Valkey
- **Validation**: Zod schemas on all input boundaries

### PostgreSQL
- **Persistent storage**: Agent model configs, cached dresses, blog sessions, brand voice cache
- **Durable cache**: Dress data and brand voice analysis with TTL-based expiration

### Valkey (Redis-compatible)
- **Hot cache**: 5-minute TTL on frequently accessed dress listings
- **Session locks**: Prevent duplicate blog generation for the same session

---

## Data Flow: Complete User Journey

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant N as Next.js (SPA)
    participant A as Express API
    participant P as PostgreSQL
    participant V as Valkey
    participant M as Mastra Agents
    participant O as OpenRouter
    participant D as Dress API

    Note over U,N: Step 1: Store Info
    U->>N: Enter store URL
    N->>A: POST /api/brand-voice/analyze
    A->>P: Check brand_voice_cache
    alt Cache hit
        P-->>A: Cached analysis
    else Cache miss
        A->>M: Brand Voice Analyzer agent
        M->>O: LLM call (with scraped content)
        O-->>M: Analysis result
        M-->>A: Brand voice data
        A->>P: Cache result (7-day TTL)
    end
    A-->>N: Brand voice response
    N-->>U: Show brand voice

    Note over U,N: Step 2: Brand Voice
    U->>N: Confirm/edit brand voice

    Note over U,N: Step 3: Dress Selection
    N->>A: GET /api/dresses
    A->>V: Check hot cache
    alt Hot cache hit
        V-->>A: Cached dresses
    else Hot cache miss
        A->>P: Check cached_dresses table
        alt DB cache valid
            P-->>A: Cached dresses
        else DB cache expired
            A->>D: Fetch from external API
            D-->>A: Dress data
            A->>P: Upsert dresses
        end
        A->>V: Set hot cache (5-min TTL)
    end
    A-->>N: Dress list
    N-->>U: Show dress grid
    U->>N: Select dresses

    Note over U,N: Step 4: Additional Instructions
    U->>N: Enter instructions

    Note over U,N: Blog Generation
    N->>A: POST /api/blog/generate
    A->>P: Create blog_session (status: generating)
    A-->>N: { sessionId }
    N->>A: GET /api/blog/:id/stream (SSE)

    loop For each agent (Writer → Editor → SEO → Senior Editor → Reviewer)
        A->>M: Create agent with DB config
        M->>O: LLM stream call
        O-->>M: Token stream
        M-->>A: Stream chunks
        A-->>N: SSE: agent-progress events
    end

    A->>P: Save generated blog
    A-->>N: SSE: complete event
    N-->>U: Show blog preview
```

---

## Service Communication

| From | To | Protocol | Auth |
|------|-----|---------|------|
| Browser → Proxy | HTTP/HTTPS | None (public) |
| Proxy → Next.js | HTTP | Internal network |
| Proxy → API | HTTP | Internal network |
| Next.js → API | HTTP fetch | None (same-origin via proxy) |
| API → Postgres | TCP (pg) | DB credentials |
| API → Valkey | TCP (Redis) | None (internal) |
| API → OpenRouter | HTTPS | API key header |
| API → Dress API | HTTPS | API key (if required) |

---

## Docker Network

All services communicate over the `app-network` bridge network. Services reference each other by container name:
- `postgres` — database host
- `valkey` — cache host
- `api` — API host (for proxy routing)
- `nextjs` — frontend host (for proxy routing)

No service is exposed to the public internet directly — all traffic goes through the Apache proxy.

---

## Deployment

### Current (Development)
- Docker Compose on local machine
- `./cli up` starts all services
- Hot reload enabled for both Next.js and Express (via tsx watch)
- Self-signed SSL certificates via `./cli certs`

### Future (Production)
- Same Docker Compose on a VPS/cloud server
- Let's Encrypt certificates via `./cli certs-renew`
- Environment variables from `.env` file or cloud secrets manager
- Consider adding health check monitoring
