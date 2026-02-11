# ADR-001: Technology Stack Decisions

## Status

Accepted

## Context

The blogwriter project needs to make several key technology choices that affect the entire system architecture. This ADR documents the decisions and rationale for each major choice.

---

## Decision 1: Zustand over React Context

### Decision
Use Zustand for client-side state management instead of React Context.

### Rationale
- **Selective subscriptions**: Components subscribe to individual store slices, preventing unnecessary re-renders. With Context, any change re-renders all consumers.
- **No provider nesting**: Zustand stores are standalone — no wrapping the app in `<WizardProvider>`. The SPA already has enough complexity without provider trees.
- **Simple API**: `create()` + `useStore(selector)` is the entire API. No reducers, dispatchers, or actions boilerplate.
- **React 19 compatible**: Works out of the box with React 19 and concurrent features.
- **Bundle size**: ~1KB gzipped vs Context (0KB but with significant boilerplate code).

### Consequences
- Positive: Simpler code, better performance, easier testing
- Negative: Extra dependency (minimal — 1KB)

---

## Decision 2: Drizzle ORM over Prisma

### Decision
Use Drizzle ORM with the `pg` driver for database access.

### Rationale
- **SQL-close**: Drizzle generates predictable SQL. You can read the query builder and know exactly what SQL runs. Prisma's query engine is a black box.
- **Lighter**: No Prisma client generation step, no binary engine. Drizzle is pure TypeScript.
- **Schema in TypeScript**: Schema is defined in `.ts` files using `pgTable()`, not a custom `.prisma` DSL. Easier to work with in a TypeScript project.
- **Migration flexibility**: `drizzle-kit push` for rapid dev iteration, `generate + migrate` for production. Prisma's migration workflow is more rigid.
- **Performance**: Direct `pg` driver connection, no Prisma engine overhead.

### Consequences
- Positive: Faster development cycle, smaller footprint, predictable queries
- Negative: Smaller ecosystem than Prisma, fewer auto-generated utilities
- Negative: No Prisma Studio (but Drizzle has Drizzle Studio)

---

## Decision 3: Manual Agent Orchestration over Mastra Workflows

### Decision
Orchestrate the 5-agent blog generation pipeline manually in Express route handlers instead of using Mastra's built-in workflow system.

### Rationale
- **SSE streaming requirement**: The user needs to see real-time progress (which agent is working, what step we're on). Mastra workflows run to completion and return a final result — they don't natively emit intermediate events.
- **Full control over streaming**: Manual orchestration lets us emit SSE events between each agent step, stream partial text from each agent, and handle errors with custom fallback logic.
- **Simpler mental model**: The pipeline is a sequential loop over 5 agents. A for-loop with SSE writes is easier to understand and debug than a workflow graph definition.
- **Dynamic agent construction**: Each agent is constructed at runtime with database-configured models. The factory pattern is easier to integrate with a manual loop than with workflow step definitions.

### Consequences
- Positive: Complete control over SSE events, simpler debugging, easier to modify pipeline order
- Negative: No built-in retry/resume from Mastra workflows (must implement manually)
- Negative: No visual workflow debugging in Mastra Studio

---

## Decision 4: SSE over WebSocket

### Decision
Use Server-Sent Events (SSE) for streaming blog generation progress from the API to the frontend.

### Rationale
- **Unidirectional**: Blog generation progress is strictly server-to-client. There's no client-to-server communication during generation. SSE is designed for exactly this pattern.
- **HTTP-native**: Works over standard HTTP/1.1. No protocol upgrade, no special proxy configuration (Apache already supports it).
- **Auto-reconnect**: The browser's `EventSource` API automatically reconnects on disconnection. WebSocket requires manual reconnection logic.
- **Simpler implementation**: Express writes `text/event-stream` responses. No WebSocket library, no connection management, no ping/pong heartbeats.
- **Structured events**: SSE natively supports named events (`event: agent-start`), making the protocol self-documenting.

### Consequences
- Positive: Simpler code on both server and client, reliable auto-reconnect
- Negative: No bidirectional communication (not needed for this use case)
- Negative: Limited to UTF-8 text (not needed — all data is JSON)

---

## Decision 5: OpenRouter as Model Provider

### Decision
Use OpenRouter as the LLM API gateway, with the option to change later.

### Rationale
- **Multi-model access**: Single API key provides access to 100+ models from OpenAI, Anthropic, Google, Meta, Mistral, etc.
- **Per-agent flexibility**: Different agents can use different models (e.g., Claude for writing, GPT for SEO) without managing multiple API keys.
- **Cost optimization**: Route less critical agents (reviewer) to cheaper models, writing agents to premium models.
- **Mastra integration**: Mastra supports OpenRouter via the `openrouter/vendor/model` string format. No additional provider packages needed.
- **Abstracted**: If we switch to direct provider APIs later, only the model string format changes (e.g., `openrouter/anthropic/claude-sonnet-4-5-20250929` → `anthropic/claude-sonnet-4-5-20250929`).

### Consequences
- Positive: Maximum model flexibility, single API key, easy experimentation
- Negative: Additional latency vs direct provider API (typically 50-200ms)
- Negative: Dependency on OpenRouter's availability

---

## Decision 6: Factory Pattern for Agent Construction

### Decision
Create Mastra agents via a factory function that reads model configuration from the database at runtime, rather than defining static agent instances at module level.

### Rationale
- **Runtime configurability**: The admin can change any agent's model via the admin panel. Changes take effect within 60 seconds (cache TTL) without restarting the server.
- **No code changes for model updates**: Changing from Claude to GPT for the blog writer is a database update, not a code deploy.
- **Consistent pattern**: All agents are constructed the same way — `createConfiguredAgent(id, instructions, tools)`. Easy to understand and extend.
- **Cache efficiency**: The model resolver caches all configs for 60 seconds. A typical blog generation (5 agents) makes 0-1 DB queries, not 5.

### Consequences
- Positive: Hot-swappable models, consistent API, minimal DB load
- Negative: Agents are recreated per request (negligible cost — it's just object construction)
- Negative: 60-second delay between config change and effect (acceptable for admin operations)

---

## Decision 7: SPA Architecture (No Server Components for Wizard)

### Decision
The wizard and blog generation views are client-side rendered (`'use client'`). The admin page is also client-rendered.

### Rationale
- **Wizard is interactive state**: Every step involves user input, selections, and state transitions. Server components cannot manage this.
- **SSE consumption**: The `EventSource` API requires a client-side JavaScript context.
- **Simpler routing**: No page transitions, no loading states between routes. One URL (`/`), all state in Zustand.
- **Offline-capable (future)**: Client-side state makes it possible to add offline support later.

### Consequences
- Positive: Simpler architecture, snappier interactions, no hydration issues
- Negative: No SEO benefit from server rendering (acceptable — the wizard is an authenticated tool, not a public page)
- Negative: Initial load includes all step components (mitigated by code splitting if needed)
