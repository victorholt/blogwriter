import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index';

export async function runMigrations(): Promise<void> {
  console.log('[Migrate] Running database migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[Migrate] Migrations complete');
}
