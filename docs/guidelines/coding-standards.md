# Coding Standards

## SOLID Principles

These principles guide all architectural and implementation decisions in this project.

### Single Responsibility (SRP)

Every module, class, component, and function should have exactly one reason to change.

**Frontend:**
- Each wizard step is its own component (`StoreInfoStep.tsx`, `BrandVoiceStep.tsx`, etc.)
- The wizard container (`Wizard.tsx`) only handles step navigation, not step logic
- The stepper indicator (`StepIndicator.tsx`) only renders step status, not wizard state
- Each Zustand store slice manages one domain (wizard state, not UI state)

**Backend:**
- Each route file handles one resource (`brand-voice.ts`, `dresses.ts`, `blog.ts`)
- Each Mastra agent has one role (Writer writes, Editor edits, SEO optimizes)
- Database access is isolated in `db/` — routes never construct raw SQL
- Middleware functions handle one concern (auth, validation, error handling)

**Anti-patterns to avoid:**
- God components that handle multiple steps
- Route handlers that do DB queries, validation, and business logic inline
- Utility files that become catch-all dumping grounds

### Open/Closed (OCP)

Software entities should be open for extension, closed for modification.

**How we apply this:**
- Agent model selection is database-driven — changing a model requires a DB update, not a code change
- Agent instructions are configurable strings, not hardcoded logic
- The wizard step list is defined as a configuration array — adding a step means adding to the array, not rewriting the wizard
- API response format is consistent (`{ success, data, error }`) — new endpoints extend the pattern, never break it
- Tools are registered on agents declaratively — adding a tool means adding to the tools object

**Example — extensible step definition:**
```typescript
const WIZARD_STEPS = [
  { id: 1, label: 'Store Info', icon: Store, component: StoreInfoStep },
  { id: 2, label: 'Brand Voice', icon: Volume2, component: BrandVoiceStep },
  // Adding a new step requires only adding here
] as const;
```

### Liskov Substitution (LSP)

Subtypes must be substitutable for their base types without altering correctness.

**How we apply this:**
- All API responses conform to `ApiResponse<T>` — consumers can handle any endpoint response uniformly
- All wizard step components accept the same base props interface — the wizard container renders them interchangeably
- All Mastra agents follow the same `Agent` interface — the pipeline orchestrator calls `.generate()` or `.stream()` on any agent without knowing which one

**Example — consistent API response:**
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Every endpoint returns this shape. Consumers never need to check which endpoint was called.
```

### Interface Segregation (ISP)

Clients should not be forced to depend on interfaces they don't use.

**How we apply this:**
- API client exports one function per endpoint (`analyzeBrandVoice()`, `fetchDresses()`) — components import only what they need
- Zustand store uses selectors — `StoreInfoStep` subscribes to `storeUrl` only, not the entire store
- Mastra tools define minimal input schemas — a scrape tool takes `{ url }`, not the entire session state
- Route middleware is composed per-route, not applied globally (admin auth only on admin routes)

**Example — selective store consumption:**
```typescript
// Good: component only re-renders when storeUrl changes
const storeUrl = useWizardStore((state) => state.storeUrl);

// Bad: component re-renders on ANY store change
const store = useWizardStore();
```

### Dependency Inversion (DIP)

High-level modules should not depend on low-level modules. Both should depend on abstractions.

**How we apply this:**
- Components import from `lib/api.ts` (abstraction), never call `fetch()` directly
- Agent factory reads model config from a resolver module, not directly from Drizzle
- Route handlers call service functions, not Mastra agent constructors directly
- Types are defined in `types/index.ts` and imported everywhere — no inline type definitions for shared shapes

**Example — API abstraction layer:**
```typescript
// lib/api.ts — the abstraction
export async function analyzeBrandVoice(url: string): Promise<ApiResponse<BrandVoice>> {
  const res = await fetch(`${API_BASE}/api/brand-voice/analyze`, { ... });
  return res.json();
}

// Component depends on the abstraction, not fetch details
const result = await analyzeBrandVoice(storeUrl);
```

---

## TypeScript Conventions

### Strictness
- `strict: true` is enabled in both `apps/api/tsconfig.json` and `apps/nextjs/tsconfig.json`
- No `any` type — use `unknown` with type narrowing when the type is truly unknown
- No non-null assertions (`!`) unless there is a guaranteed check immediately above
- Enable `noUncheckedIndexedAccess` where possible

### Types vs Interfaces
- **Interfaces** for object shapes that may be extended:
  ```typescript
  interface BrandVoice {
    brandName: string;
    tone: string[];
    targetAudience: string;
  }
  ```
- **Type aliases** for unions, intersections, and computed types:
  ```typescript
  type WizardStep = 1 | 2 | 3 | 4;
  type AppView = 'wizard' | 'generating' | 'result';
  ```

### Return Types
- Explicit return types on all exported functions
- Inferred return types acceptable for private/internal functions and simple lambdas
  ```typescript
  // Good: exported function
  export function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  // OK: internal lambda
  const isSelected = (id: string) => selectedIds.has(id);
  ```

### Validation
- Use Zod schemas for all external data boundaries:
  - API request bodies
  - API response parsing
  - Environment variable validation
- Define Zod schemas alongside their TypeScript types:
  ```typescript
  const BrandVoiceSchema = z.object({
    brandName: z.string(),
    tone: z.array(z.string()),
    targetAudience: z.string(),
  });
  type BrandVoice = z.infer<typeof BrandVoiceSchema>;
  ```

### Imports
- Use path aliases: `@/` maps to the app root
  ```typescript
  import { cn } from '@/lib/utils';       // Good
  import { cn } from '../../../lib/utils'; // Bad
  ```
- Barrel exports (`index.ts`) only in `types/` directory
- Order: external packages → internal modules → relative imports → types

### Naming
- **Constants**: UPPER_SNAKE_CASE for true constants (`MAX_RETRIES`, `API_BASE`)
- **Functions/variables**: camelCase
- **Types/Interfaces**: PascalCase
- **Enums**: PascalCase for the enum, PascalCase for values
- **Boolean variables**: prefix with `is`, `has`, `should`, `can`
  ```typescript
  const isLoading = true;
  const hasError = false;
  const shouldRetry = attempts < MAX_RETRIES;
  ```

---

## React Conventions

### Components
- Functional components only (React 19 — no class components)
- One component per file, filename matches the default export
- Use `'use client'` directive only on components that need client-side interactivity
- Prefer server components where possible (Next.js 16 default)

### State Management
- **Zustand** for application state (wizard progress, selections, generation status)
- **Local `useState`** for UI-only state (input focus, dropdown open, tooltip visibility)
- **No React Context** for app state — Zustand handles this without provider nesting
- **No prop drilling** past 2 levels — if a child of a child needs data, use Zustand

### Event Handlers
- Prefix with `handle`: `handleSubmit`, `handleNext`, `handleDressToggle`
- Define outside JSX for readability:
  ```typescript
  // Good
  const handleNext = () => { ... };
  return <button onClick={handleNext}>Next</button>;

  // Bad
  return <button onClick={() => { /* complex logic */ }}>Next</button>;
  ```

### Performance
- Memoize expensive computations with `useMemo`
- Do NOT wrap every component in `React.memo` — only when profiling shows a problem
- Use Zustand selectors for fine-grained subscriptions
- Avoid creating new objects/arrays in render (triggers re-renders in children)

### Effects
- Avoid `useEffect` for derived state — compute it during render
- Cleanup subscriptions and event listeners in effect return
- One effect per concern, not one monolithic effect

---

## API Conventions

### REST Design
- Resource-based URLs: `/api/dresses`, `/api/blog`, `/api/brand-voice`
- HTTP verbs match actions: GET (read), POST (create/action), PUT (update), DELETE (remove)
- Plural nouns for collections: `/api/dresses`, not `/api/dress`
- Nested resources for relationships: `/api/admin/:token/agents/:agentId`

### Response Envelope
Every endpoint returns:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Status Codes
| Code | Usage |
|------|-------|
| 200 | Successful read or update |
| 201 | Successful creation |
| 400 | Validation error (bad input) |
| 401 | Authentication required |
| 403 | Forbidden (wrong admin token) |
| 404 | Resource not found |
| 500 | Server error |

### Error Responses
```json
{
  "success": false,
  "error": "Store URL is required"
}
```
- Error messages are user-facing and actionable
- Stack traces only in development (`NODE_ENV === 'development'`)
- Never expose internal paths, query details, or secrets in errors

### Validation
- Zod middleware validates request bodies on all POST/PUT routes
- Validation errors return 400 with specific field errors
- Query parameters validated inline with sensible defaults

---

## CSS / Styling

### Pure SCSS with BEM
- All styles live in `app/globals.scss` — no per-component SCSS files, no CSS modules
- Use **BEM naming convention** for all class names:
  ```scss
  .dress-card { ... }           // Block
  .dress-card__name { ... }     // Element
  .dress-card--selected { ... } // Modifier
  ```
- Use SCSS nesting with `&` for BEM elements and modifiers:
  ```scss
  .dress-card {
    border: 2px solid var(--color-gray-200);

    &__name {
      font-size: 14px;
      font-weight: 600;
    }

    &--selected {
      border-color: var(--color-blue);
    }
  }
  ```

### CSS Custom Properties (Design Tokens)
- All colors, radii, shadows, and fonts are defined as CSS variables in `:root`
- Reference them via `var(--color-blue)`, `var(--shadow-card)`, etc.
- Never hardcode colors or shadows inline — always use the design token

### No Inline Styles
```typescript
// Bad
<div style={{ marginTop: '1rem', color: 'blue' }}>

// Good
<div className="dress-card dress-card--selected">
```

### No Tailwind, No shadcn/ui
- This project deliberately does not use Tailwind utility classes or shadcn/ui components
- All UI is built with plain HTML elements + SCSS classes from `globals.scss`
- Conditional classes are applied with string interpolation or ternaries:
  ```typescript
  <button className={`btn ${isActive ? 'btn--primary' : 'btn--ghost'}`}>
  ```

---

## File Organization

### Frontend (`apps/nextjs/`)
```
app/                  # App Router (page.tsx = the SPA entry point)
components/           # Organized by feature domain
  wizard/             # Wizard flow components
    StepIndicator.tsx     # Horizontal stepper bar
    StoreInfoStep.tsx     # Step 1: URL input
    BrandVoiceStep.tsx    # Step 2: Brand voice review/confirm
    DressSelectionStep.tsx        # Step 3: Dress selection grid
    AdditionalInstructionsStep.tsx  # Step 4: Instructions textarea
  blog/               # Blog output components
    BlogGenerator.tsx     # Generation progress (SSE consumer)
    BlogPreview.tsx       # Final rendered blog + export actions
  admin/              # Admin panel components
    AgentConfigPanel.tsx  # Model configuration per agent
stores/               # Zustand stores
lib/                  # Utilities, API client
types/                # Shared TypeScript types (barrel export OK here)
hooks/                # Custom React hooks
```

**Component folder rule:** Every component belongs in a domain folder under `components/`. No loose files directly in `components/`. The domain folders are:
- `wizard/` — Everything related to the 4-step wizard flow
- `blog/` — Blog generation progress and final output display
- `admin/` — Admin-only configuration UI (settings page)

If a new feature area emerges, create a new domain folder. Do not add files to an unrelated folder.

### Backend (`apps/api/`)
```
src/
  db/                 # Drizzle schema + connection
  routes/             # Express route handlers (one file per resource)
  middleware/          # Auth, validation, error handling
  mastra/
    agents/           # Agent definitions
    tools/            # Mastra tool definitions
    lib/              # Model resolver, agent factory
  lib/                # Utilities (Valkey client, etc.)
  types/              # Shared backend types
```

### Naming Rules
| Type | Convention | Example |
|------|-----------|---------|
| React components | PascalCase | `StoreInfoStep.tsx` |
| Utilities / hooks | camelCase | `wizard-store.ts`, `useWizard.ts` |
| Route files | kebab-case | `brand-voice.ts` |
| Test files | Co-located, `.test.` suffix | `Wizard.test.tsx` |
| Types | PascalCase, in `types/` | `index.ts` with `BrandVoice`, `Dress` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_BASE` |
