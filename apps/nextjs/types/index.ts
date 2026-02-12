export interface ToneAttribute {
  name: string;
  description: string;
}

export interface VocabularyCategory {
  category: string;
  terms: string[];
}

export interface WritingRule {
  rule: string;
  description: string;
}

export interface BrandVoice {
  // Display metadata
  brandName: string;
  summary: string;
  targetAudience: string;
  priceRange: string;
  businessType: string;
  uniqueSellingPoints: string[];

  // Rich voice definition
  personality: {
    archetype: string;
    description: string;
  };
  toneAttributes: ToneAttribute[];
  vocabulary: VocabularyCategory[];
  writingStyle: WritingRule[];
  avoidances: WritingRule[];
  writingDirection: string;
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

export interface Theme {
  id: number;
  name: string;
}

export interface BrandLabel {
  id: number;
  slug: string;
  displayName: string;
}

export type WizardStep = 1 | 2 | 3 | 4;

export interface SharedBlog {
  hash: string;
  blogContent: string;
  brandName: string | null;
  createdAt: string;
}

export type AppView = 'wizard' | 'generating' | 'result';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  traceId?: string | null;
}

// Debug mode types for brand voice analysis
export interface DebugToolCall {
  kind: 'tool-call';
  toolName: string;
  args: Record<string, unknown>;
}

export interface DebugToolResult {
  kind: 'tool-result';
  url?: string;
  title: string;
  metaDescription: string;
  contentPreview: string;
  contentLength: number;
  error?: string;
}

export interface DebugRawResponse {
  kind: 'raw-response';
  text: string;
  charCount: number;
}

export type DebugEvent = DebugToolCall | DebugToolResult | DebugRawResponse;

// Agent tracing types
export interface AgentLogEntry {
  id: string;
  traceId: string;
  sessionId: string | null;
  agentId: string;
  eventType: 'tool-call' | 'tool-result' | 'agent-input' | 'agent-output' | 'error';
  data: Record<string, unknown>;
  createdAt: string;
}
