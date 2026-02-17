import { db } from '../db';
import { appSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

// ── Guest Mode ──────────────────────────────────────────────

let guestCachedValue: boolean | null = null;
let guestCachedAt = 0;
const CACHE_TTL = 60_000; // 60 seconds

export async function isGuestModeEnabled(): Promise<boolean> {
  const now = Date.now();
  if (guestCachedValue !== null && now - guestCachedAt < CACHE_TTL) {
    return guestCachedValue;
  }

  try {
    const row = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'guest_mode_enabled'))
      .limit(1);

    guestCachedValue = row[0]?.value !== 'false'; // default true if missing
    guestCachedAt = now;
    return guestCachedValue;
  } catch {
    return true; // fail-open: allow guests if DB is unavailable
  }
}

export function invalidateGuestModeCache(): void {
  guestCachedValue = null;
  guestCachedAt = 0;
}

// ── Registration ────────────────────────────────────────────

let registrationCachedValue: boolean | null = null;
let registrationCachedAt = 0;

export async function isRegistrationEnabled(): Promise<boolean> {
  const now = Date.now();
  if (registrationCachedValue !== null && now - registrationCachedAt < CACHE_TTL) {
    return registrationCachedValue;
  }

  try {
    const row = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'registration_enabled'))
      .limit(1);

    registrationCachedValue = row[0]?.value !== 'false'; // default true if missing
    registrationCachedAt = now;
    return registrationCachedValue;
  } catch {
    return true; // fail-open: allow registration if DB is unavailable
  }
}

export function invalidateRegistrationCache(): void {
  registrationCachedValue = null;
  registrationCachedAt = 0;
}
