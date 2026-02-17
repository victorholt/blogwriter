# Admin Panel

## Purpose

Define the hidden admin page for configuring which LLM model each AI agent uses. This is the only way to change agent models — there is no other configuration UI.

---

## Access Pattern

### URL

```
/settings
```

Example: `http://blogwriter.test:8081/settings`

### Security

- Admin panel requires JWT cookie authentication with `role === 'admin'`
- The `requireAdmin` Express middleware verifies the JWT from `blogwriter_access` cookie
- Unauthenticated users → redirected to `/login`
- Non-admin users → API returns 403
- Frontend API calls use `credentials: 'include'` to send cookies automatically

---

## File Structure

| File | Purpose |
|------|---------|
| `app/settings/layout.tsx` | Admin layout (auth check + sidebar) |
| `app/settings/page.tsx` | Redirects to `/settings/api` |
| `app/settings/*/page.tsx` | Individual settings sections |
| `components/admin/SettingsLayout.tsx` | Shared layout with sidebar |
| `components/admin/AgentModelsTab.tsx` | Agent configuration UI |

---

## Page Design

### Layout

```
+----------------------------------------------------------+
|  Agent Configuration                                      |
|  Manage AI model settings for each agent                  |
+----------------------------------------------------------+
|                                                          |
|  Brand Voice Analyzer                                     |
|  Model: [openrouter/anthropic/claude-sonnet-4-5-20.. v]  |
|  Temperature: [====o====] 0.5                            |
|  Max Tokens:  [4096        ]                              |
|                                          [ Save ]         |
|  --------------------------------------------------------|
|  Blog Writer                                              |
|  Model: [openrouter/anthropic/claude-sonnet-4-5-20.. v]  |
|  Temperature: [======o==] 0.8                            |
|  Max Tokens:  [8192        ]                              |
|                                          [ Save ]         |
|  --------------------------------------------------------|
|  Blog Editor                                              |
|  ...                                                      |
|  --------------------------------------------------------|
|  SEO Specialist                                           |
|  ...                                                      |
|  --------------------------------------------------------|
|  Senior Editor                                            |
|  ...                                                      |
|  --------------------------------------------------------|
|  Blog Reviewer                                            |
|  ...                                                      |
+----------------------------------------------------------+
```

### Each Agent Row

- **Agent label** (bold heading): "Brand Voice Analyzer"
- **Model ID input**: Text input showing the current OpenRouter model string
  - Editable — admin types or pastes the model string
  - Format: `openrouter/vendor/model-name`
  - Placeholder: `openrouter/anthropic/claude-sonnet-4-5-20250929`
- **Temperature**: Range slider (0.0 to 2.0, step 0.1) with numeric display
- **Max Tokens**: Numeric input
- **Save button**: Per-agent save (PUT request)
- **Last updated**: Timestamp shown in muted text

### States

- **Loading**: Skeleton cards while fetching configs
- **Unauthorized**: "Page not found" message (no admin-specific error)
- **Save success**: Brief green "Saved" feedback next to the button
- **Save error**: Red error message inline

---

## Component: AgentConfigPanel

**Behavior:**
1. On mount, fetch `GET /api/admin/agents` (with cookies)
2. If 401/403 → redirect to `/login`
3. If 200 → render list of agent config cards
4. Each card is independently saveable
5. On save → PUT `/api/admin/agents/{agentId}` with updated config
6. Show success/error feedback per card

---

## API Integration

```typescript
// Fetch all agent configs
const response = await fetch(`${API_BASE}/api/admin/agents`, {
  credentials: 'include',
});

// Update one agent's config
const response = await fetch(`${API_BASE}/api/admin/agents/${agentId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ modelId, temperature, maxTokens }),
});
```

---

## Default Agent Configs (Seeded on Startup)

When the API starts and the `agent_model_configs` table is empty, it seeds these defaults:

| Agent | Default Model | Temperature | Max Tokens |
|-------|--------------|-------------|------------|
| Brand Voice Analyzer | `openrouter/anthropic/claude-sonnet-4-5-20250929` | 0.5 | 4096 |
| Blog Writer | `openrouter/anthropic/claude-sonnet-4-5-20250929` | 0.8 | 8192 |
| Blog Editor | `openrouter/anthropic/claude-sonnet-4-5-20250929` | 0.5 | 4096 |
| SEO Specialist | `openrouter/anthropic/claude-sonnet-4-5-20250929` | 0.4 | 4096 |
| Senior Editor | `openrouter/anthropic/claude-sonnet-4-5-20250929` | 0.5 | 4096 |
| Blog Reviewer | `openrouter/anthropic/claude-sonnet-4-5-20250929` | 0.3 | 4096 |

The seed function runs on server startup, only inserting rows that don't already exist (upsert with `ON CONFLICT DO NOTHING`).

---

## Model Discovery (Future Enhancement)

For MVP, the admin manually types model strings. Future enhancement:
- Fetch available models from OpenRouter API (`GET https://openrouter.ai/api/v1/models`)
- Show a searchable dropdown instead of a text input
- Display model pricing, context window, and capability information
- Group by provider (Anthropic, OpenAI, Google, etc.)
