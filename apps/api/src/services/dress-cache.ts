import { db } from '../db';
import { cachedDresses } from '../db/schema';
import { eq, sql, like, or, inArray } from 'drizzle-orm';
import type { MappedDress, ProductApiConfig } from './product-api-client';
import { fetchProducts } from './product-api-client';

// All brand types in the product API
const PRODUCT_TYPES = [
  'essense-dress',
  'stella-dress',
  'martina-dress',
  'luxe-dress',
  'wander-dress',
  'sorella-dress',
];

// --- Read from cache ---

export async function getCachedDresses(params: {
  limit: number;
  offset: number;
  search?: string;
  category?: string;
  allowedStyleIds?: string[];
  brand?: string;
}): Promise<{ dresses: MappedDress[]; total: number } | null> {
  const { limit, offset, search, category, allowedStyleIds, brand } = params;

  // Check if cache has any rows
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cachedDresses);

  const cacheCount = countResult[0]?.count ?? 0;
  if (cacheCount === 0) return null;

  // Build query conditions
  const conditions: ReturnType<typeof eq>[] = [];

  if (search) {
    const q = `%${search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${cachedDresses.name})`, q),
        like(sql`lower(${cachedDresses.designer})`, q),
        like(sql`lower(coalesce(${cachedDresses.category}, ''))`, q),
        like(sql`lower(coalesce(${cachedDresses.styleId}, ''))`, q),
      )!,
    );
  }

  if (category) {
    conditions.push(
      or(
        eq(cachedDresses.category, category),
        like(cachedDresses.tags, `%${category}%`),
      )!,
    );
  }

  if (allowedStyleIds && allowedStyleIds.length > 0) {
    conditions.push(inArray(cachedDresses.styleId, allowedStyleIds));
  }

  if (brand) {
    conditions.push(eq(cachedDresses.brandSlug, brand));
  }

  const whereClause = conditions.length > 0
    ? sql`${sql.join(conditions, sql` AND `)}`
    : undefined;

  // Count matching
  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cachedDresses)
    .where(whereClause);

  // Fetch page
  const rows = await db
    .select()
    .from(cachedDresses)
    .where(whereClause)
    .orderBy(cachedDresses.name)
    .limit(limit)
    .offset(offset);

  const dresses: MappedDress[] = rows.map((r) => ({
    externalId: r.externalId,
    name: r.name,
    designer: r.designer || undefined,
    description: r.description || undefined,
    price: r.price || undefined,
    imageUrl: r.imageUrl || undefined,
    category: r.category || undefined,
    tags: r.tags ? JSON.parse(r.tags) : undefined,
    styleId: r.styleId || undefined,
  }));

  return { dresses, total };
}

export async function getCachedDressById(externalId: string): Promise<MappedDress | null> {
  const rows = await db
    .select()
    .from(cachedDresses)
    .where(eq(cachedDresses.externalId, externalId))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0];
  const dress: MappedDress = {
    externalId: r.externalId,
    name: r.name,
    designer: r.designer || undefined,
    description: r.description || undefined,
    price: r.price || undefined,
    imageUrl: r.imageUrl || undefined,
    category: r.category || undefined,
    tags: r.tags ? JSON.parse(r.tags) : undefined,
    styleId: r.styleId || undefined,
  };

  return dress;
}

export async function getCachedDressesByIds(externalIds: string[]): Promise<MappedDress[]> {
  const results: MappedDress[] = [];
  for (const id of externalIds) {
    const dress = await getCachedDressById(id);
    if (dress) results.push(dress);
  }
  return results;
}

// --- Write to cache ---

export async function cacheDresses(dresses: MappedDress[], brandSlug?: string): Promise<number> {
  if (dresses.length === 0) return 0;

  let cached = 0;
  // Far-future expiry — cache only clears manually
  const farFuture = new Date('2099-01-01');

  for (const d of dresses) {
    await db
      .insert(cachedDresses)
      .values({
        externalId: d.externalId,
        name: d.name,
        designer: d.designer || null,
        description: d.description || null,
        price: d.price || null,
        imageUrl: d.imageUrl || null,
        category: d.category || null,
        tags: d.tags ? JSON.stringify(d.tags) : null,
        styleId: d.styleId || null,
        brandSlug: brandSlug || null,
        expiresAt: farFuture,
      })
      .onConflictDoUpdate({
        target: cachedDresses.externalId,
        set: {
          name: d.name,
          designer: d.designer || null,
          description: d.description || null,
          price: d.price || null,
          imageUrl: d.imageUrl || null,
          category: d.category || null,
          tags: d.tags ? JSON.stringify(d.tags) : null,
          styleId: d.styleId || null,
          brandSlug: brandSlug || null,
          cachedAt: new Date(),
          expiresAt: farFuture,
        },
      });
    cached++;
  }

  return cached;
}

// --- Clear cache ---

export async function clearDressCache(): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cachedDresses);

  await db.delete(cachedDresses);
  return count;
}

// --- Sync: full refresh from external API (all brand types) ---

export async function syncDressesFromApi(config: ProductApiConfig): Promise<{ synced: number; total: number; byType: Record<string, number> }> {
  const byType: Record<string, number> = {};
  let totalSynced = 0;
  let totalFromApi = 0;

  for (const type of PRODUCT_TYPES) {
    const typeConfig = { ...config, type };
    const result = await fetchProducts(typeConfig, 5000, 0);
    const synced = await cacheDresses(result.dresses, type);
    byType[type] = result.dresses.length;
    totalSynced += synced;
    totalFromApi += result.dresses.length;
  }

  return { synced: totalSynced, total: totalFromApi, byType };
}

// --- Cache stats ---

export async function getCacheStats(): Promise<{ total: number }> {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(cachedDresses);

  return { total };
}
