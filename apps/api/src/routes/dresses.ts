import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { appSettings } from '../db/schema';
import {
  loadProductApiConfig,
  fetchProducts,
  fetchProductFacets,
} from '../services/product-api-client';
import {
  getCachedDresses,
  cacheDresses,
  syncDressesFromApi,
  getCacheStats,
} from '../services/dress-cache';

const router = Router();

// GET /api/dresses — Cache-first: read from cached_dresses, fallback to external API
router.get('/', async (req, res) => {
  try {
    const search = (req.query.search as string) || '';
    const category = (req.query.category as string) || '';
    const unfiltered = req.query.unfiltered === 'true';

    // Load allowed style IDs filter (unless unfiltered requested)
    let allowedStyleIds: string[] | undefined;
    if (!unfiltered) {
      const [row] = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, 'allowed_dress_ids'));
      const raw = row?.value || '';
      if (raw.trim()) {
        // Format is "externalId:styleId,externalId:styleId,..." — extract styleIds
        allowedStyleIds = raw.split(',').map((entry) => {
          const sep = entry.indexOf(':');
          return sep !== -1 ? entry.slice(sep + 1).trim() : entry.trim();
        }).filter(Boolean);
      }
    }

    // When a filter is active, return all matching dresses at once (no pagination)
    const isFiltered = !!allowedStyleIds;
    const page = isFiltered ? 1 : Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = isFiltered ? 1000 : Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    const offset = (page - 1) * limit;

    // Try cache first
    const cached = await getCachedDresses({ limit, offset, search, category, allowedStyleIds });

    if (cached) {
      const totalPages = Math.max(1, Math.ceil(cached.total / limit));
      return res.json({
        success: true,
        data: {
          dresses: cached.dresses,
          total: cached.total,
          page,
          totalPages,
          source: 'cache',
        },
      });
    }

    // Cache miss — fetch from external API
    const config = await loadProductApiConfig();
    const fetchLimit = (search || category) ? 200 : limit;
    const result = await fetchProducts(config, fetchLimit, (search || category) ? 0 : offset);

    let dresses = result.dresses;

    // Cache the fetched dresses in background (don't await)
    cacheDresses(dresses).catch((err) =>
      console.error('[Dresses] Background cache write failed:', err),
    );

    // Local search filter
    if (search) {
      const q = search.toLowerCase();
      dresses = dresses.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.designer?.toLowerCase().includes(q) ||
          d.styleId?.toLowerCase().includes(q),
      );
    }

    // Local category filter
    if (category) {
      dresses = dresses.filter(
        (d) => d.category === category || d.tags?.includes(category),
      );
    }

    const total = (search || category) ? dresses.length : result.totalCount;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Paginate local results if filtering
    if (search || category) {
      const start = (page - 1) * limit;
      dresses = dresses.slice(start, start + limit);
    }

    return res.json({
      success: true,
      data: {
        dresses,
        total,
        page,
        totalPages,
        source: 'api',
      },
    });
  } catch (err) {
    console.error('[Dresses] Error fetching dresses:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch dresses',
    });
  }
});

// GET /api/dresses/facets
router.get('/facets', async (_req, res) => {
  try {
    const config = await loadProductApiConfig();
    const facets = await fetchProductFacets(config);

    return res.json({
      success: true,
      data: facets,
    });
  } catch (err) {
    console.error('[Dresses] Error fetching facets:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch facets',
    });
  }
});

// POST /api/dresses/sync — Full refresh from external API into cache
router.post('/sync', async (_req, res) => {
  try {
    const config = await loadProductApiConfig();
    const result = await syncDressesFromApi(config);

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[Dresses] Sync error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to sync dresses',
    });
  }
});

// GET /api/dresses/cache-stats — Cache health info
router.get('/cache-stats', async (_req, res) => {
  try {
    const stats = await getCacheStats();
    return res.json({ success: true, data: stats });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get cache stats',
    });
  }
});

export default router;
