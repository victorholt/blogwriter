import { db } from '../db';
import { appSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface ProductApiConfig {
  baseUrl: string;
  timeout: number;
  language: string;
  type: string;
  app: string;
}

export interface ExternalProduct {
  ID: string;
  post_title: string;
  post_content: string;
  brand: string;
  style_id: string;
  images: string[];
  termData: Array<{
    termID: string;
    termName: string;
    taxonomy: string;
  }>;
}

export interface MappedDress {
  externalId: string;
  name: string;
  designer?: string;
  description?: string;
  price?: string;
  imageUrl?: string;
  category?: string;
  tags?: string[];
  styleId?: string;
}

export interface ProductListResult {
  dresses: MappedDress[];
  count: number;
  totalCount: number;
}

export interface ProductFacet {
  term_id: string;
  slug: string;
  name: string;
}

export async function loadProductApiConfig(): Promise<ProductApiConfig> {
  const keys = [
    'product_api_base_url',
    'product_api_timeout',
    'product_api_language',
    'product_api_type',
    'product_api_app',
  ];

  const rows = await db.select().from(appSettings);
  const settings = new Map(rows.map((r) => [r.key, r.value]));

  return {
    baseUrl: settings.get('product_api_base_url') || 'https://product.dev.essensedesigns.info',
    timeout: parseInt(settings.get('product_api_timeout') || '30000', 10),
    language: settings.get('product_api_language') || 'en',
    type: settings.get('product_api_type') || 'essense-dress',
    app: settings.get('product_api_app') || 'essense-designs',
  };
}

function mapExternalProduct(p: ExternalProduct): MappedDress {
  const facets = p.termData?.filter((t) => t.taxonomy === 'product_facet') ?? [];
  const category = facets[0]?.termName;
  const tags = facets.map((f) => f.termName);

  return {
    externalId: p.ID,
    name: p.post_title,
    designer: p.brand || undefined,
    description: p.post_content || undefined,
    imageUrl: p.images?.[0] || undefined,
    styleId: p.style_id || undefined,
    category,
    tags: tags.length > 0 ? tags : undefined,
  };
}

export async function fetchProducts(
  config: ProductApiConfig,
  limit: number = 20,
  offset: number = 0,
): Promise<ProductListResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    // Symfony reads params from form-encoded body, not JSON
    const body = new URLSearchParams({
      language: config.language,
      type: config.type,
      app: config.app,
      limit: String(limit),
      offset: String(offset),
      noCache: '1',
    });

    const res = await fetch(`${config.baseUrl}/product/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Product API responded with ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    const dresses = (data.results || []).map((p: ExternalProduct) => mapExternalProduct(p));

    return {
      dresses,
      count: dresses.length,
      totalCount: data.totalCount ?? 0,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchProductFacets(config: ProductApiConfig): Promise<ProductFacet[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const body = new URLSearchParams({
      language: config.language,
      type: config.type,
      app: config.app,
      noCache: '1',
    });

    const res = await fetch(`${config.baseUrl}/product/facets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Product API responded with ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    return (data.filters || []).map((f: any) => ({
      term_id: f.term_id,
      slug: f.slug,
      name: f.name,
    }));
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchProductsByIds(
  config: ProductApiConfig,
  ids: string[],
): Promise<MappedDress[]> {
  if (ids.length === 0) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    // The API supports postIds as comma-separated list
    const body = new URLSearchParams({
      language: config.language,
      type: config.type,
      app: config.app,
      postIds: ids.join(','),
      limit: String(ids.length),
      offset: '0',
      noCache: '1',
    });

    const res = await fetch(`${config.baseUrl}/product/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Product API responded with ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    return (data.results || []).map((p: ExternalProduct) => mapExternalProduct(p));
  } finally {
    clearTimeout(timeoutId);
  }
}
