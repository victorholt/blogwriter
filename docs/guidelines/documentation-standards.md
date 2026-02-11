# Documentation Standards

## Core Principles

1. **Docs before code**: Every new feature gets a design doc in `docs/designs/` before implementation begins
2. **Docs are living**: Update documentation when implementation changes — stale docs are worse than no docs
3. **Concise over verbose**: Write enough to be unambiguous, not more
4. **Examples over explanations**: Show a code example or JSON payload instead of describing it in prose

---

## Document Types

### Design Documents (`docs/designs/`)

Created before implementing a new feature or significant change.

**Required sections:**
- **Purpose**: What problem this solves (1-2 sentences)
- **Design**: The technical approach with diagrams, schemas, or code snippets
- **Files affected**: List of files to create or modify
- **Dependencies**: New packages, services, or environment variables needed

**When to create:**
- New API endpoint or endpoint group
- New UI feature or page
- Database schema change
- New agent or tool
- Integration with external service

### Architecture Decision Records (`docs/decisions/`)

Created when making a significant technology or architecture choice.

**Format (ADR template):**
```markdown
# ADR-NNN: Title

## Status
Accepted | Superseded by ADR-XXX | Deprecated

## Context
What is the issue or decision that needs to be made?

## Decision
What is the decision and why?

## Consequences
What are the positive and negative outcomes?
```

**When to create:**
- Choosing between technologies (e.g., Zustand vs Context)
- Significant architectural patterns (e.g., agent orchestration approach)
- Changes to core infrastructure (e.g., adding a new service)

### Guidelines (`docs/guidelines/`)

Established conventions that apply project-wide. Updated rarely, only when conventions change.

---

## Writing Style

- Use second person ("you") or imperative mood ("Use Tailwind", not "One should use Tailwind")
- Use code blocks with language tags for all code examples
- Use tables for structured comparisons
- Use Mermaid diagrams for flow/sequence/entity diagrams:
  ````markdown
  ```mermaid
  graph LR
    A[User] --> B[Next.js]
    B --> C[Express API]
    C --> D[Mastra Agents]
  ```
  ````
- Keep line length under 120 characters in markdown
- Use relative links between docs: `[Coding Standards](../guidelines/coding-standards.md)`

---

## API Documentation

Every API endpoint must be documented with:
- HTTP method and path
- Request body schema (with Zod or TypeScript interface)
- Response body example (success and error)
- Authentication requirements
- Query parameter descriptions with defaults

Example:
```markdown
### POST /api/brand-voice/analyze

Analyzes a store URL and extracts brand voice characteristics.

**Request:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | Yes | Store homepage URL |

**Response (200):**
{json}
{
  "success": true,
  "data": {
    "brandName": "Bella Bridal",
    "tone": ["elegant", "romantic"],
    ...
  }
}

**Error (400):**
{json}
{
  "success": false,
  "error": "Invalid URL format"
}
```

---

## Component Documentation

Components are documented in `docs/designs/frontend-components.md`, not in per-component files.

**Document for each component:**
- Purpose (one sentence)
- Props interface
- Key user interactions
- State it reads from / writes to (Zustand selectors)

Do NOT add JSDoc comments to every component — the design doc is the source of truth. Only add inline comments where the logic is genuinely non-obvious.

---

## Keeping Docs Updated

- When modifying a feature: update its design doc in the same PR
- When adding a new endpoint: add it to `api-endpoints.md`
- When changing schema: update `database-schema.md`
- When a decision is reversed: mark the ADR as "Superseded" and create a new one
- The project `README.md` at the root stays high-level — link to docs for details
