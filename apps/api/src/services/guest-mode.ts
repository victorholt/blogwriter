import { db } from '../db';
import { appSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

let cachedValue: boolean | null = null;
let cachedAt = 0;
const CACHE_TTL = 60_000; // 60 seconds

export async function isGuestModeEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cachedValue !== null && now - cachedAt < CACHE_TTL) {
    return cachedValue;
  }

  try {
    const row = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'guest_mode_enabled'))
      .limit(1);

    cachedValue = row[0]?.value !== 'false'; // default true if missing
    cachedAt = now;
    return cachedValue;
  } catch {
    return true; // fail-open: allow guests if DB is unavailable
  }
}

export function invalidateGuestModeCache(): void {
  cachedValue = null;
  cachedAt = 0;
}
