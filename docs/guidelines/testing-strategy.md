# Testing Strategy

## Overview

Testing priority for the MVP: correctness of data flow over comprehensive coverage. Focus tests on boundaries (API endpoints, store logic, data transformations) rather than UI rendering details.

---

## Test Levels

### Unit Tests

**What to test:**
- Zustand store actions and selectors
- Utility functions (`lib/utils.ts`, data formatters, validators)
- Zod schema validation (ensure invalid input is rejected)
- Agent factory / model resolver logic

**Tools:**
- Vitest (fast, TypeScript-native, compatible with both apps)
- Testing with Zod schemas directly (no mocking needed)

**Example:**
```typescript
// stores/wizard-store.test.ts
import { useWizardStore } from './wizard-store';

test('toggleDress adds and removes dress IDs', () => {
  const store = useWizardStore.getState();
  store.toggleDress('dress-1');
  expect(store.selectedDressIds.has('dress-1')).toBe(true);
  store.toggleDress('dress-1');
  expect(store.selectedDressIds.has('dress-1')).toBe(false);
});
```

### Integration Tests (API)

**What to test:**
- Each API endpoint returns correct response shape
- Validation rejects bad input with 400
- Admin routes return 403 for wrong token
- Database queries return expected data

**Tools:**
- Vitest + supertest for Express route testing
- Test database (separate from dev — use `blogwriter_test_db`)

**Example:**
```typescript
// routes/brand-voice.test.ts
import request from 'supertest';
import { app } from '../index';

test('POST /api/brand-voice/analyze rejects missing URL', async () => {
  const res = await request(app)
    .post('/api/brand-voice/analyze')
    .send({});
  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
});
```

### Component Tests

**What to test:**
- User interactions trigger correct store updates
- Conditional rendering based on store state
- Form submission calls correct API functions

**Tools:**
- Vitest + React Testing Library
- Mock Zustand stores and API functions

**What NOT to test:**
- Exact CSS classes or pixel-perfect rendering
- shadcn/ui component internals
- Static text content

### E2E Tests (Post-MVP)

Deferred until after the core features are stable. When added:
- Playwright for browser automation
- Test the complete wizard flow end-to-end
- Run against the Docker stack

---

## File Organization

Tests are co-located with source files:

```
components/
  StoreInfoStep.tsx
  StoreInfoStep.test.tsx
stores/
  wizard-store.ts
  wizard-store.test.ts
lib/
  api.ts
  api.test.ts
```

---

## Running Tests

```bash
# Frontend tests
cd apps/nextjs && npm test

# API tests
cd apps/api && npm test

# Watch mode
npm test -- --watch
```

---

## What to Test First (MVP Priority)

1. Zustand store — wizard state transitions
2. API endpoint validation — bad input rejected
3. API response shapes — correct envelope format
4. Agent model resolver — correct config lookup with cache
5. Component interactions — wizard step navigation
