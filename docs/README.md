# Blogwriter

AI-powered wedding dress blog writing platform. Users go through a 4-step wizard to provide store information, confirm brand voice, select dresses, and add instructions. Multiple AI agents then collaborate to generate a professional blog post.

**Access**: `http://blogwriter.test:8081`

---

## Current Status

> **Phase 1: Frontend Stepper UI** — Not started

| Phase | Status | Description |
|-------|--------|-------------|
| 0. Project Documentation | Done | Design docs, coding standards, architecture decisions |
| **1. Frontend Stepper UI** | **Up Next** | **4-step wizard with placeholder data** |
| 2. Backend Foundation | Planned | Drizzle ORM, Postgres schema, API route structure, Valkey |
| 3. Admin + Model Config | Planned | Secret admin page, agent model CRUD, DB seeding |
| 4. Mastra + Brand Voice | Planned | Mastra setup, scrape tool, brand voice agent (Step 1 wired) |
| 5. Dress API Integration | Planned | External dress API, caching, Step 3 wired |
| 6. Blog Generation Pipeline | Planned | 5-agent pipeline with SSE streaming (full flow wired) |
| 7. Polish | Planned | Error handling, loading states, responsive design |

---

## Phase 1: Frontend Stepper UI

**Goal**: Replace the scaffolded welcome page with a 4-step wizard. All data is placeholder — no backend wiring yet.

**Design doc**: [Frontend Components](designs/frontend-components.md)

### What to build

1. **Zustand store** (`stores/wizard-store.ts`) — wizard state: current step, URL, brand voice, dress selections, instructions
2. **StepIndicator** (`components/wizard/StepIndicator.tsx`) — horizontal stepper bar showing 4 steps with active/completed/pending states
3. **StoreInfoStep** (`components/wizard/StoreInfoStep.tsx`) — large heading "Store Website", URL input, blue NEXT button
4. **BrandVoiceStep** (`components/wizard/BrandVoiceStep.tsx`) — brand voice display with tone badges, edit toggle, confirm button (placeholder data)
5. **DressSelectionStep** (`components/wizard/DressSelectionStep.tsx`) — searchable dress card grid with select/deselect (placeholder data)
6. **AdditionalInstructionsStep** (`components/wizard/AdditionalInstructionsStep.tsx`) — textarea + session summary + Generate button
7. **page.tsx** (`app/page.tsx`) — rewrite to render wizard based on store state
8. **globals.scss** (`app/globals.scss`) — strip welcome-page styles, keep `@layer base` CSS variables
9. **layout.tsx** (`app/layout.tsx`) — update metadata title/description

### Dependencies to install

```bash
cd apps/nextjs
npm install zustand
npx shadcn@latest add button input textarea label badge
```

### Supporting files

- `types/index.ts` — `BrandVoice`, `Dress`, `WizardStep`, `AppView` types
- `lib/api.ts` — API client stubs (functions exist but return placeholder data for now)

### How to verify

1. `./cli up` → visit `http://blogwriter.test:8081`
2. Stepper shows 4 steps with "Store Info" active
3. Enter a URL → click NEXT → moves to Brand Voice (placeholder)
4. Confirm → moves to Dress Selection (placeholder grid)
5. Select dresses → moves to Additional Instructions
6. Back navigation works at every step
7. Responsive on mobile viewport

### Key references

- [Frontend Components design](designs/frontend-components.md) — full component specs, Zustand store shape, placeholder data, responsive breakpoints
- [Coding Standards](guidelines/coding-standards.md) — SOLID principles, file organization, component folder rule

---

## Architecture

```
User → Apache Proxy (:8081) → Next.js (:3000) ← fetch → Express API (:4000)
                                                             ↕            ↕
                                                         Postgres     Valkey
                                                             ↕
                                                       Mastra Agents → OpenRouter → LLMs
```

| Service | Technology | Port (Internal) | Port (External) |
|---------|-----------|-----------------|-----------------|
| Frontend | Next.js 16 / React 19 | 3000 | 4443 |
| API | Express.js 4 | 4000 | 4444 |
| Proxy | Apache 2.4 | 80/443 | 8081/8444 |
| Database | PostgreSQL 16 | 5432 | 5432 |
| Cache | Valkey (Redis-compatible) | 6379 | 6380 |

---

## Documentation Index

### Guidelines

| Document | Description |
|----------|-------------|
| [Coding Standards](guidelines/coding-standards.md) | SOLID principles, TypeScript/React/API conventions, file organization |
| [Documentation Standards](guidelines/documentation-standards.md) | How to write and maintain project docs |
| [Git Workflow](guidelines/git-workflow.md) | Branch strategy, commit conventions, PR process |
| [Testing Strategy](guidelines/testing-strategy.md) | What to test, tools, file co-location |
| [Security](guidelines/security.md) | Secrets handling, admin access, input validation |

### Design Documents

| Document | Description |
|----------|-------------|
| [Architecture Overview](designs/architecture-overview.md) | System topology, data flow, service boundaries |
| [Database Schema](designs/database-schema.md) | Tables, Drizzle schemas, caching strategy |
| [API Endpoints](designs/api-endpoints.md) | Full REST API spec with request/response examples |
| [Agent Pipeline](designs/agent-pipeline.md) | Mastra agents, tools, model resolution, SSE orchestration |
| [Frontend Components](designs/frontend-components.md) | Component hierarchy, Zustand store, wizard step specs |
| [Admin Panel](designs/admin-panel.md) | Hidden model configuration page |

### Architecture Decisions

| Document | Description |
|----------|-------------|
| [ADR-001: Tech Stack](decisions/adr-001-tech-stack.md) | Why Zustand, Drizzle, Mastra, SSE, OpenRouter, factory pattern |

---

## Quick Start

```bash
./cli up              # Start all containers
./cli down            # Stop containers
./cli build           # Rebuild containers
./cli logs            # View logs
./cli shell api       # Shell into a container

./cli db push         # Push schema changes directly (no migration files)
./cli db sync         # Generate migrations + apply them
./cli db migrate      # Run pending migrations
./cli db generate     # Generate migration files from schema

./cli certs           # Generate SSL certificates
./cli certs-renew     # Renew Let's Encrypt certificates
./cli typecheck       # Run TypeScript type checking
```

---

## Project Structure

```
blogwriter/
├── apps/
│   ├── api/                    # Express.js backend
│   │   └── src/
│   │       ├── db/             # Drizzle ORM schema + connection
│   │       ├── routes/         # API route handlers
│   │       ├── mastra/         # Agent definitions, tools, pipeline
│   │       │   ├── agents/
│   │       │   ├── tools/
│   │       │   └── lib/
│   │       └── middleware/     # Auth, validation, error handling
│   └── nextjs/                 # Next.js frontend (SPA)
│       ├── app/                # App router (page.tsx is the SPA entry)
│       ├── components/         # Organized by feature domain
│       │   ├── ui/             # shadcn/ui primitives
│       │   ├── wizard/         # Stepper + 4 wizard step components
│       │   ├── blog/           # Blog generation progress + preview
│       │   └── admin/          # Agent model configuration panel
│       ├── stores/             # Zustand state stores
│       ├── lib/                # Utilities, API client
│       └── types/              # Shared TypeScript types
├── docker/                     # Docker configs, compose, proxy
├── docs/                       # This documentation
└── cli                         # CLI tool for container management
```

---

## Future Phases (Quick Reference)

Each phase is fully documented in the design docs linked above. Here's a summary:

**Phase 2 — Backend Foundation**: Install Drizzle ORM + pg driver. Create 4 database tables (`agent_model_configs`, `cached_dresses`, `blog_sessions`, `brand_voice_cache`). Set up API route structure. Connect Valkey. See [Database Schema](designs/database-schema.md), [API Endpoints](designs/api-endpoints.md).

**Phase 3 — Admin + Model Config**: Build admin page at `/settings` (JWT cookie auth). CRUD for agent model configs. Seed default configs on startup. See [Admin Panel](designs/admin-panel.md).

**Phase 4 — Mastra + Brand Voice**: Install `@mastra/core`. Build `scrapeWebpage` tool. Build Brand Voice Analyzer agent. Wire Step 1 end-to-end. See [Agent Pipeline](designs/agent-pipeline.md).

**Phase 5 — Dress API**: Connect external wedding dress API. Implement two-layer caching (Valkey hot cache → Postgres durable cache). Wire Step 3. See [Database Schema](designs/database-schema.md).

**Phase 6 — Blog Generation**: Build 5 blog agents (Writer, Editor, SEO, Senior Editor, Reviewer). Manual orchestration with SSE streaming. Wire the full Generate flow. See [Agent Pipeline](designs/agent-pipeline.md).

**Phase 7 — Polish**: Error handling, loading skeletons, retry logic, responsive pass, copy/export actions.

---

## Deployment

### Prerequisites

- Docker + Docker Compose v2
- A domain with DNS pointing to your server
- Ports 80 and 443 open

### Quick Deploy (Guided Wizard)

```bash
git clone <repo-url> blogwriter && cd blogwriter
./cli deploy
```

The wizard walks you through: environment config, image builds, container startup, database setup, and SSL certificates.

### Manual Deployment

```bash
# 1. Configure environment
./cli env                        # interactive .env setup (set APP_ENV=prod)

# 2. Build & start
./cli --env=prod up              # builds production images + starts containers

# 3. Initialize database
./cli db push                    # create tables (first deploy only)

# 4. SSL certificates (Let's Encrypt)
./cli certs --email=you@example.com   # request cert (proxy must be running)
```

After obtaining certificates, HTTP automatically redirects to HTTPS.

### The `--env` Flag

Override `APP_ENV` from any position:

```bash
./cli --env=prod up
./cli up --env=staging
./cli build --env=prod api
```

Default is `local` (from `.env` or fallback). The flag overrides the `.env` value for that invocation.

### Environment Files

| File | Purpose |
|------|---------|
| `.env` | Active configuration (gitignored) |
| `.env.example` | Documented template with all variables |

Run `./cli env` to interactively create/update `.env`. Existing values are used as defaults.

### Docker Compose Layering

| Environment | Compose files loaded |
|-------------|---------------------|
| `local` | `docker-compose.yml` + `docker-compose.override.yml` |
| `staging` | `docker-compose.yml` + `docker-compose.staging.yml` |
| `prod` | `docker-compose.yml` + `docker-compose.prod.yml` |

### SSL Certificates

`./cli certs` behaves differently based on `APP_ENV`:

| Environment | Method | Details |
|-------------|--------|---------|
| `local` | Self-signed (openssl) | Creates a local CA + domain cert. Optional macOS Keychain trust. |
| `staging` / `prod` | Let's Encrypt (certbot) | HTTP-01 challenge. Requires proxy running + port 80 open. |

```bash
# Local development — self-signed
./cli certs

# Staging/Production — Let's Encrypt
./cli certs --email=you@example.com

# Test with Let's Encrypt staging server first
./cli certs --email=you@example.com --staging-le

# Force regenerate
./cli certs --force
```

### Database Commands

```bash
./cli db push         # Push schema directly (quick, no migration files)
./cli db sync         # Generate migration files + apply them
./cli db generate     # Generate migration files only
./cli db migrate      # Run pending migrations only
```

In production, `drizzle-kit` isn't in the runtime image. The CLI automatically spins up a one-off `api-migrations` container (built from the `migrations` Dockerfile stage) to run these commands.

### Using External Database

To use an external Postgres/Valkey instead of Docker containers:

1. Remove `db` from `COMPOSE_PROFILES` in `.env`
2. Set `DATABASE_URL` to your external connection string
3. Configure `VALKEY_HOST` and `VALKEY_PORT` if using external Valkey

### SSL Certificate Renewal

After initial cert generation, `./cli certs` offers to start the auto-renewal service — a container that checks for renewal every 12 hours. The proxy auto-reloads within 1 hour of a cert change.

```bash
# Manual one-shot renewal
./cli certs-renew

# Start auto-renewal service manually (if skipped during ./cli certs)
COMPOSE_PROFILES=auto-renew ./cli up certbot-renew

# Or add auto-renew to COMPOSE_PROFILES in .env for permanent auto-start
# COMPOSE_PROFILES=db,auto-renew
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `local` | Environment: `local`, `staging`, `prod` |
| `DOMAIN` | `blogwriter.test` | Public domain (proxy + SSL) |
| `CONTAINER_PREFIX` | `blogwriter` | Docker container name prefix |
| `POSTGRES_USER` | `blogwriter_user` | Database user |
| `POSTGRES_PASSWORD` | `blogwriter_pass` | Database password |
| `POSTGRES_DB` | `blogwriter_db` | Database name |
| `DATABASE_URL` | *(auto-composed)* | Override for external database |
| `OPENROUTER_API_KEY` | — | OpenRouter API key for AI agents |
| `NEXT_PUBLIC_API_URL` | `http://blogwriter.test:4444` | Browser API URL (build-time) |
| `CORS_ORIGIN` | — | Restrict CORS in production |
| `PROXY_PORT` | `8081` | Proxy HTTP port (local only) |
| `PROXY_SSL_PORT` | `8444` | Proxy HTTPS port (local only) |
| `API_EXTERNAL_PORT` | `4444` | API direct port (local only) |
| `NEXTJS_EXTERNAL_PORT` | `4443` | Next.js direct port (local only) |
| `CERT_EMAIL` | `admin@example.com` | Let's Encrypt registration email |
| `COMPOSE_PROFILES` | `db` | `db` = Postgres/Valkey, `auto-renew` = cert renewal service |
