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
./cli logs            # View logs
./cli down            # Stop containers
./cli build           # Rebuild containers
./cli shell nextjs    # Shell into Next.js container
./cli shell api       # Shell into API container
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

**Phase 3 — Admin + Model Config**: Build hidden admin page at `/settings/{ADMIN_TOKEN}`. CRUD for agent model configs. Seed default configs on startup. See [Admin Panel](designs/admin-panel.md).

**Phase 4 — Mastra + Brand Voice**: Install `@mastra/core`. Build `scrapeWebpage` tool. Build Brand Voice Analyzer agent. Wire Step 1 end-to-end. See [Agent Pipeline](designs/agent-pipeline.md).

**Phase 5 — Dress API**: Connect external wedding dress API. Implement two-layer caching (Valkey hot cache → Postgres durable cache). Wire Step 3. See [Database Schema](designs/database-schema.md).

**Phase 6 — Blog Generation**: Build 5 blog agents (Writer, Editor, SEO, Senior Editor, Reviewer). Manual orchestration with SSE streaming. Wire the full Generate flow. See [Agent Pipeline](designs/agent-pipeline.md).

**Phase 7 — Polish**: Error handling, loading skeletons, retry logic, responsive pass, copy/export actions.

---

## Environment Variables

```env
# API
DATABASE_URL=postgresql://blogwriter_user:blogwriter_pass@postgres:5432/blogwriter_db
VALKEY_HOST=valkey
VALKEY_PORT=6379
OPENROUTER_API_KEY=sk-or-...
ADMIN_TOKEN=<random-uuid>
DRESS_API_URL=<external-api-url>
DRESS_API_KEY=<if-needed>

# Next.js
NEXT_PUBLIC_API_URL=http://blogwriter.test:4444
```
