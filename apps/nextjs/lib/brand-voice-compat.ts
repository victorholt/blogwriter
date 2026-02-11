import type { BrandVoice } from '@/types';

/**
 * Normalizes a brand voice object from the API (which may be old 7-field format
 * or new rich format) into the current BrandVoice shape.
 */
export function normalizeBrandVoice(raw: Record<string, unknown>): BrandVoice {
  // New shape — already has personality
  if (raw.personality && typeof raw.personality === 'object') {
    return raw as unknown as BrandVoice;
  }

  // Old shape — upgrade it
  const tone = Array.isArray(raw.tone) ? (raw.tone as string[]) : [];
  const usps = Array.isArray(raw.uniqueSellingPoints) ? (raw.uniqueSellingPoints as string[]) : [];

  return {
    brandName: (raw.brandName as string) || '',
    summary: (raw.summary as string) || '',
    targetAudience: (raw.targetAudience as string) || '',
    priceRange: (raw.priceRange as string) || '',
    businessType: 'retail',
    uniqueSellingPoints: usps,
    personality: {
      archetype: 'Brand Voice',
      description: (raw.summary as string) || '',
    },
    toneAttributes: tone.map((t) => ({ name: t, description: '' })),
    vocabulary: [],
    writingStyle: [],
    avoidances: [],
    writingDirection: (raw.suggestedBlogTone as string) || '',
  };
}
