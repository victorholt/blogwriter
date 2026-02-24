/**
 * Sanitize a PostgreSQL connection string by URL-encoding the username and password.
 *
 * Handles passwords with special characters (e.g. <, >, @, #, %, /) that
 * break URL parsing when left unencoded in DATABASE_URL.
 *
 * Format: postgresql://user:password@host:port/database
 */
export function sanitizeConnectionString(url: string): string {
  // Match postgresql:// (or postgres://) followed by user:pass@rest
  const match = url.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.+)@(.+)$/);
  if (!match) return url;

  const [, protocol, rawUser, rawPass, hostAndDb] = match;

  // Decode first (in case parts are already encoded), then re-encode
  const user = encodeURIComponent(decodeURIComponent(rawUser));
  const pass = encodeURIComponent(decodeURIComponent(rawPass));

  return `${protocol}${user}:${pass}@${hostAndDb}`;
}
