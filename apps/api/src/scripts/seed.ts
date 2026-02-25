import { seedDatabase } from '../db/seed';

seedDatabase()
  .then(() => {
    console.log('[Seed] Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Seed] Failed:', err);
    process.exit(1);
  });
