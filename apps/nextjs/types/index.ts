export interface BrandVoice {
  brandName: string;
  tone: string[];
  targetAudience: string;
  priceRange: string;
  uniqueSellingPoints: string[];
  suggestedBlogTone: string;
  summary: string;
}

export interface Dress {
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

export interface DressFacet {
  term_id: string;
  slug: string;
  name: string;
}

export interface BlogReview {
  qualityScore: number;
  strengths: string[];
  suggestions: string[];
  flags: string[];
}

export type WizardStep = 1 | 2 | 3 | 4;

export type AppView = 'wizard' | 'generating' | 'result';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
