/**
 * Wrapper around drizzle-kit push that sanitizes DATABASE_URL first.
 * drizzle-kit uses pg-connection-string which chokes on special chars in credentials.
 */
import { execSync } from 'child_process';

let url = process.env.DATABASE_URL || '';
const m = url.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.+)@(.+)$/);
if (m) {
  const [, proto, rawUser, rawPass, rest] = m;
  url = proto + encodeURIComponent(decodeURIComponent(rawUser)) + ':' + encodeURIComponent(decodeURIComponent(rawPass)) + '@' + rest;
}

process.env.DATABASE_URL = url;
execSync('drizzle-kit push', { stdio: 'inherit', env: process.env });
