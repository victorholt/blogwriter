# Security Guidelines

## Secrets Management

### Environment Variables

All secrets are stored as environment variables, never in code or config files.

| Variable | Where Used | Sensitivity |
|----------|-----------|-------------|
| `OPENROUTER_API_KEY` | API server | High — LLM API access |
| `ADMIN_TOKEN` | API server | High — admin panel access |
| `DATABASE_URL` | API server | High — database credentials |
| `DRESS_API_KEY` | API server | Medium — external API access |
| `NEXT_PUBLIC_API_URL` | Next.js client | Low — public URL |

### Rules

- **Never commit `.env` files** — already in `.gitignore`
- **Never use `NEXT_PUBLIC_` prefix for secrets** — `NEXT_PUBLIC_` variables are embedded in client-side JavaScript and visible to anyone
- **Only `NEXT_PUBLIC_API_URL` is safe for the client** — it's a public URL, not a secret
- Create `.env.example` with placeholder values for documentation:
  ```
  OPENROUTER_API_KEY=sk-or-your-key-here
  ADMIN_TOKEN=generate-a-uuid
  DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
  ```
- In Docker, secrets are injected via `docker-compose.yml` environment section or `.env` file

---

## Admin Panel Access

The admin panel at `/settings/{token}` is protected by a URL token pattern:

- The token is a UUID stored in `ADMIN_TOKEN` environment variable
- The Next.js page at `app/settings/[token]/page.tsx` passes the token to API calls
- The API middleware validates `req.params.token === process.env.ADMIN_TOKEN`
- Wrong token returns `403` — the frontend shows a generic "Not Found" page (no hint that admin exists)
- The admin URL is never linked from the main UI
- The admin bookmarks or manually types the URL

**Why not session auth?** For MVP simplicity. There is no user authentication system. The token approach is sufficient for a single-admin scenario. If multi-user admin is needed later, add proper auth (see ADR).

---

## Input Validation

### API Layer

All user-facing endpoints validate input with Zod before processing:

```typescript
import { z } from 'zod';

const AnalyzeBrandVoiceSchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

// In route handler:
const parsed = AnalyzeBrandVoiceSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({
    success: false,
    error: parsed.error.issues[0].message,
  });
}
```

**Validate at the boundary:**
- POST/PUT request bodies
- Query parameters (with defaults for optional ones)
- URL path parameters (e.g., sessionId format)

**Trust internal code:**
- Don't re-validate data that came from the database
- Don't validate between internal functions
- Don't validate Mastra agent outputs (they're generated text, not user input)

### Frontend Layer

- URL input: basic format check before sending to API (final validation is server-side)
- Textarea: length limits
- Dress selection: enforce minimum 1 selection before enabling "Next"
- Never trust client-side validation alone — always validate server-side

---

## HTTP Security Headers

Express uses `helmet` middleware (already configured) which sets:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (when HTTPS is enabled)
- Content Security Policy (default)

---

## CORS

```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
```

For production, set `CORS_ORIGIN` to the specific proxy domain:
```
CORS_ORIGIN=http://blogwriter.test:8081
```

---

## Web Scraping Safety

The brand voice analyzer scrapes user-provided URLs. Mitigations:

- **Timeout**: HTTP requests to external URLs timeout after 10 seconds
- **Size limit**: Only read the first 100KB of HTML (prevents memory exhaustion)
- **Content type check**: Only process `text/html` responses
- **No JavaScript execution**: Use Cheerio (static HTML parser), not a headless browser
- **URL validation**: Reject private/internal IPs (localhost, 10.x, 192.168.x) to prevent SSRF
- **Rate limiting**: Maximum 5 brand voice analyses per minute per IP

---

## Database Security

- Database credentials in environment variables only
- Connection via Docker internal network (not exposed to host in production)
- Parameterized queries via Drizzle ORM (prevents SQL injection)
- No raw SQL strings — always use Drizzle's query builder

---

## Dependency Security

- Run `npm audit` periodically
- Keep dependencies updated (especially security patches)
- Minimize dependency count — prefer standard library where possible
- Review new dependencies before adding (check download count, maintenance, license)
