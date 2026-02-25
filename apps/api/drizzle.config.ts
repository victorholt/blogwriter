import { defineConfig } from 'drizzle-kit';

// drizzle-kit uses pg-connection-string which chokes on special chars in credentials.
// URL-encode user/pass so it parses correctly.
function sanitizeDbUrl(url: string): string {
  const m = url.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.+)@(.+)$/);
  if (m) {
    const [, proto, rawUser, rawPass, rest] = m;
    return proto + encodeURIComponent(decodeURIComponent(rawUser)) + ':' + encodeURIComponent(decodeURIComponent(rawPass)) + '@' + rest;
  }
  return url;
}

const rawUrl = process.env.DATABASE_URL || 'postgresql://blogwriter_user:blogwriter_pass@localhost:5432/blogwriter_db';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: sanitizeDbUrl(rawUrl),
  },
});
