import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { sanitizeConnectionString } from '../lib/sanitize-url';

const connectionString = sanitizeConnectionString(process.env.DATABASE_URL || '');
const isLocal = connectionString.includes('@localhost') || connectionString.includes('@postgres:');

const pool = new Pool({
  connectionString,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
});

export const db = drizzle(pool, { schema });
export { pool };
