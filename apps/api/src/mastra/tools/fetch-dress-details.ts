import { createTool } from '@mastra/core';
import { z } from 'zod';
import { loadProductApiConfig, fetchProducts } from '../../services/product-api-client';
import { getCachedDressesByIds, cacheDresses } from '../../services/dress-cache';
import type { MappedDress } from '../../services/product-api-client';

export const fetchDressDetails = createTool({
  id: 'fetch-dress-details',
  description: 'Fetches full details about specific wedding dresses by their IDs. Returns dress names, descriptions, style IDs, categories, and image URLs.',
  inputSchema: z.object({
    dressIds: z.array(z.string()).describe('Array of dress external IDs to fetch details for'),
  }),
  outputSchema: z.object({
    dresses: z.array(z.object({
      externalId: z.string(),
      name: z.string(),
      designer: z.string().optional(),
      description: z.string().optional(),
      styleId: z.string().optional(),
      category: z.string().optional(),
      imageUrl: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })),
  }),
  execute: async ({ context }) => {
    const { dressIds } = context;

    // Try cache first
    const cached = await getCachedDressesByIds(dressIds);
    const cachedIds = new Set(cached.map((d) => d.externalId));
    const missingIds = dressIds.filter((id) => !cachedIds.has(id));

    let found: MappedDress[] = [...cached];

    // Fetch missing from external API
    if (missingIds.length > 0) {
      const config = await loadProductApiConfig();
      const remaining = new Set(missingIds);
      const fromApi: MappedDress[] = [];
      let offset = 0;
      const batchSize = 100;

      while (remaining.size > 0 && offset < 1000) {
        const result = await fetchProducts(config, batchSize, offset);
        for (const dress of result.dresses) {
          if (remaining.has(dress.externalId)) {
            fromApi.push(dress);
            remaining.delete(dress.externalId);
          }
        }
        if (result.count < batchSize) break;
        offset += batchSize;
      }

      // Cache the newly fetched dresses
      if (fromApi.length > 0) {
        cacheDresses(fromApi).catch((err) =>
          console.error('[FetchDressDetails] Cache write failed:', err),
        );
      }

      found = found.concat(fromApi);
    }

    return {
      dresses: found.map((d) => ({
        externalId: d.externalId,
        name: d.name,
        designer: d.designer,
        description: d.description,
        styleId: d.styleId,
        category: d.category,
        imageUrl: d.imageUrl,
        tags: d.tags,
      })),
    };
  },
});
