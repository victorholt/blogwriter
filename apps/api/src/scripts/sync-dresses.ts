/**
 * Sync all dresses from external product API into local cache.
 *
 * Usage:
 *   npx tsx src/scripts/sync-dresses.ts
 *   npm run sync-dresses
 *   ./cli exec api npm run sync-dresses
 */

import 'dotenv/config';
import { loadProductApiConfig } from '../services/product-api-client';
import { syncDressesFromApi, getCacheStats } from '../services/dress-cache';

async function main(): Promise<void> {
  console.log('[sync-dresses] Loading product API config...');
  const config = await loadProductApiConfig();
  console.log(`[sync-dresses] API: ${config.baseUrl}`);
  console.log(`[sync-dresses] Type: ${config.type}, App: ${config.app}, Lang: ${config.language}`);

  console.log('[sync-dresses] Fetching all dresses from external API...');
  const result = await syncDressesFromApi(config);
  console.log(`[sync-dresses] Synced ${result.synced} dresses (${result.total} total from API)`);
  for (const [type, count] of Object.entries(result.byType)) {
    console.log(`  ${type}: ${count}`);
  }

  const stats = await getCacheStats();
  console.log(`[sync-dresses] Cache total: ${stats.total}`);

  console.log('[sync-dresses] Done!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[sync-dresses] Fatal error:', err);
  process.exit(1);
});
