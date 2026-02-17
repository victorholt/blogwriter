# API Endpoints

## Purpose

Full REST API specification for the blogwriter Express.js backend. All endpoints are prefixed with `/api/`.

---

## Response Envelope

Every endpoint returns this shape:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## Brand Voice

### POST /api/brand-voice/analyze

Analyzes a store URL and extracts brand voice characteristics using the Brand Voice Analyzer agent.

**Request:**

```json
{
  "url": "https://www.bellabridalshop.com"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `url` | string | Yes | Must be a valid URL |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "brandName": "Bella Bridal",
    "tone": ["elegant", "romantic", "modern"],
    "targetAudience": "Brides aged 25-35 seeking designer gowns",
    "priceRange": "Premium ($2,000 - $8,000)",
    "uniqueSellingPoints": [
      "Exclusive designer partnerships",
      "In-house alterations team",
      "Private appointment experience"
    ],
    "suggestedBlogTone": "Warm, aspirational, and knowledgeable — like a trusted friend who happens to be a bridal expert",
    "summary": "Bella Bridal positions itself as a premium bridal boutique with a focus on personalized service and exclusive designer collections."
  },
  "cached": true
}
```

**Errors:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "URL is required" | Missing `url` field |
| 400 | "Invalid URL format" | Malformed URL |
| 400 | "URL must use http or https protocol" | Non-HTTP URL |
| 500 | "Failed to analyze brand voice" | Agent or scraping failure |

**Behavior:**
1. Validate URL
2. Check `brand_voice_cache` table for this URL
3. If cached and not expired → return cached result with `cached: true`
4. If not cached → run Brand Voice Analyzer agent → cache result (7-day TTL) → return with `cached: false`

---

## Dresses

### GET /api/dresses

Returns paginated list of wedding dresses from the cache (or fetches from external API if cache is stale).

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `category` | string | — | Filter by dress category |
| `search` | string | — | Search by name or designer |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "dresses": [
      {
        "externalId": "dress-001",
        "name": "Aurora A-Line Gown",
        "designer": "Vera Wang",
        "description": "A stunning A-line silhouette with delicate lace appliques...",
        "price": "$3,200",
        "imageUrl": "https://example.com/images/aurora.jpg",
        "category": "A-line"
      }
    ],
    "total": 150,
    "page": 1,
    "totalPages": 8
  }
}
```

**Errors:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Page must be a positive number" | Invalid page param |
| 500 | "Failed to fetch dresses" | External API and cache both failed |

**Caching behavior:**
1. Check Valkey hot cache (key: `dresses:page:{p}:limit:{l}:category:{c}:search:{s}`)
2. If hit → return immediately
3. Check Postgres `cached_dresses` table
4. If all rows expired → fetch from external API → upsert into Postgres → set Valkey (5-min TTL)
5. If Postgres data is fresh → query with filters → set Valkey → return

---

## Blog Generation

### POST /api/blog/generate

Starts a blog generation session. Creates a `blog_session` record and returns the session ID for SSE streaming.

**Request:**

```json
{
  "storeUrl": "https://www.bellabridalshop.com",
  "brandVoice": {
    "brandName": "Bella Bridal",
    "tone": ["elegant", "romantic"],
    "targetAudience": "Brides aged 25-35",
    "priceRange": "Premium",
    "uniqueSellingPoints": ["Exclusive designers"],
    "suggestedBlogTone": "Warm and aspirational",
    "summary": "Premium bridal boutique..."
  },
  "selectedDressIds": ["dress-001", "dress-015", "dress-042"],
  "additionalInstructions": "Focus on spring wedding trends. Include tips for choosing the right silhouette."
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "status": "generating"
  }
}
```

**Errors:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Brand voice is required" | Missing brandVoice |
| 400 | "At least one dress must be selected" | Empty selectedDressIds |
| 409 | "Session is already generating" | Duplicate generation attempt |

---

### GET /api/blog/:sessionId/stream

Server-Sent Events (SSE) stream of blog generation progress.

**Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event types:**

```
event: agent-start
data: {"agent": "blog-writer", "agentLabel": "Blog Writer", "step": 1, "totalSteps": 5}

event: agent-progress
data: {"agent": "blog-writer", "chunk": "The world of wedding fashion..."}

event: agent-complete
data: {"agent": "blog-writer", "step": 1}

event: agent-start
data: {"agent": "blog-editor", "agentLabel": "Blog Editor", "step": 2, "totalSteps": 5}

... (repeats for each agent) ...

event: complete
data: {"sessionId": "f47ac10b-...", "blog": "# Spring Wedding Dress Trends\n\n..."}

event: error
data: {"message": "Blog generation failed at step 3 (SEO Specialist)"}
```

**Errors:**

| Status | Error | Cause |
|--------|-------|-------|
| 404 | "Session not found" | Invalid sessionId |
| 400 | "Session is not generating" | Session already completed or failed |

---

### GET /api/blog/:sessionId

Retrieves a completed blog session.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "storeUrl": "https://www.bellabridalshop.com",
    "status": "completed",
    "generatedBlog": "# Spring Wedding Dress Trends\n\n...",
    "seoMetadata": {
      "title": "Spring Wedding Dress Trends 2026 | Bella Bridal",
      "description": "Discover the top wedding dress trends for spring 2026...",
      "keywords": ["wedding dresses", "spring 2026", "bridal trends"]
    },
    "createdAt": "2026-02-10T12:00:00.000Z",
    "updatedAt": "2026-02-10T12:05:00.000Z"
  }
}
```

**Errors:**

| Status | Error | Cause |
|--------|-------|-------|
| 404 | "Session not found" | Invalid sessionId |

---

## Admin (Protected)

All admin routes require JWT cookie authentication with `role === 'admin'`. The `requireAdmin` middleware validates the JWT from the `blogwriter_access` cookie.

### GET /api/admin/agents

Returns all agent model configurations.

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "agentId": "brand-voice-analyzer",
      "agentLabel": "Brand Voice Analyzer",
      "modelId": "openrouter/anthropic/claude-sonnet-4-5-20250929",
      "temperature": "0.5",
      "maxTokens": "4096",
      "updatedAt": "2026-02-10T10:00:00.000Z"
    },
    {
      "id": 2,
      "agentId": "blog-writer",
      "agentLabel": "Blog Writer",
      "modelId": "openrouter/anthropic/claude-sonnet-4-5-20250929",
      "temperature": "0.8",
      "maxTokens": "8192",
      "updatedAt": "2026-02-10T10:00:00.000Z"
    }
  ]
}
```

**Errors:**

| Status | Error | Cause |
|--------|-------|-------|
| 403 | — (empty response or generic "Not found") | Wrong token |

---

### PUT /api/admin/agents/:agentId

Updates a specific agent's model configuration.

**Request:**

```json
{
  "modelId": "openrouter/google/gemini-2.5-pro",
  "temperature": "0.6",
  "maxTokens": "8192"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `modelId` | string | Yes | OpenRouter model identifier |
| `temperature` | string | No | LLM temperature (0.0-2.0) |
| `maxTokens` | string | No | Max output tokens |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "agentId": "blog-writer",
    "agentLabel": "Blog Writer",
    "modelId": "openrouter/google/gemini-2.5-pro",
    "temperature": "0.6",
    "maxTokens": "8192",
    "updatedAt": "2026-02-10T12:30:00.000Z"
  }
}
```

**Errors:**

| Status | Error | Cause |
|--------|-------|-------|
| 403 | — | Wrong token |
| 404 | "Agent not found" | Invalid agentId |
| 400 | "Model ID is required" | Missing modelId |

---

### GET /api/admin/settings

Returns application settings (API keys masked for display).

**Response (200):**

```json
{
  "success": true,
  "data": {
    "openrouter_api_key": "sk-or-...****7890"
  }
}
```

**Errors:**

| Status | Error | Cause |
|--------|-------|-------|
| 403 | — | Wrong token |

**Behavior:**
- Returns all settings from the `app_settings` table
- API keys are masked: first 8 chars + `****` + last 4 chars
- Empty values returned as empty strings (not masked)

---

### PUT /api/admin/settings

Updates application settings.

**Request:**

```json
{
  "openrouter_api_key": "sk-or-v1-abc123..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `openrouter_api_key` | string | No | OpenRouter API key |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "openrouter_api_key": "sk-or-v1-...****3..."
  }
}
```

**Errors:**

| Status | Error | Cause |
|--------|-------|-------|
| 403 | — | Wrong token |

---

## Existing Endpoints (Keep)

### GET /health

Health check that verifies database and cache connectivity.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-10T12:00:00.000Z",
  "services": {
    "postgres": "connected",
    "valkey": "connected"
  }
}
```

### GET /

API root info.

**Response (200):**
```json
{
  "message": "blogwriter API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "api": "/api/*"
  }
}
```
