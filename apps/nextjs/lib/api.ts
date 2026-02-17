import type { BrandVoice, Dress, DressFacet, Theme, BrandLabel, SharedBlog, ApiResponse, DebugEvent, AgentLogEntry } from '@/types';
import { normalizeBrandVoice } from './brand-voice-compat';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://writer.essensedesigns.com:4444';

// --- Brand Voice ---

export async function analyzeBrandVoice(url: string): Promise<ApiResponse<BrandVoice>> {
  const res = await fetch(`${API_BASE}/api/brand-voice/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ url }),
  });
  return res.json();
}

export async function analyzeBrandVoiceStream(
  url: string,
  onStatus: (message: string) => void,
  onDebug?: (data: DebugEvent) => void,
  previousAttempt?: BrandVoice,
): Promise<ApiResponse<BrandVoice>> {
  const body: Record<string, unknown> = { url };
  if (previousAttempt) body.previousAttempt = previousAttempt;

  const res = await fetch(`${API_BASE}/api/brand-voice/analyze-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    return { success: false, error: 'Failed to connect to analysis service' };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ApiResponse<BrandVoice> = { success: false, error: 'Analysis did not complete' };

  function processLine(line: string): void {
    if (!line.startsWith('data: ')) return;
    try {
      const event = JSON.parse(line.slice(6));
      if (event.type === 'status') {
        onStatus(event.data);
      } else if (event.type === 'result') {
        const normalized = normalizeBrandVoice(event.data.data);
        result = { success: true, data: normalized, cached: event.data.cached, traceId: event.data.traceId };
      } else if (event.type === 'debug' && onDebug) {
        onDebug(event.data);
      } else if (event.type === 'error') {
        result = { success: false, error: event.data };
      }
    } catch { /* skip malformed lines */ }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) processLine(line);
    }
  } catch {
    // Connection dropped (proxy closed, network error, etc.)
    // If we already received a successful result, we can still use it
  }

  // Flush decoder and process any remaining data in the buffer
  buffer += decoder.decode();
  if (buffer.trim()) processLine(buffer);

  return result;
}

// --- Dresses ---

export async function fetchDresses(params: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  unfiltered?: boolean;
  brand?: string;
}): Promise<ApiResponse<{ dresses: Dress[]; total: number; page: number; totalPages: number }>> {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`${API_BASE}/api/dresses?${qs}`);
  return res.json();
}

export async function fetchDressFacets(): Promise<ApiResponse<DressFacet[]>> {
  const res = await fetch(`${API_BASE}/api/dresses/facets`);
  return res.json();
}

// --- Blog Generation ---

export async function fetchThemes(): Promise<ApiResponse<Theme[]>> {
  const res = await fetch(`${API_BASE}/api/themes`);
  return res.json();
}

export async function fetchBrandLabels(): Promise<ApiResponse<BrandLabel[]>> {
  const res = await fetch(`${API_BASE}/api/dresses/brands`);
  return res.json();
}

export async function startBlogGeneration(data: {
  storeUrl: string;
  brandVoice: BrandVoice;
  selectedDressIds: string[];
  additionalInstructions: string;
  themeId?: number;
  brandLabelSlug?: string;
}): Promise<ApiResponse<{ sessionId: string }>> {
  const res = await fetch(`${API_BASE}/api/blog/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export function createBlogStream(sessionId: string): EventSource {
  return new EventSource(`${API_BASE}/api/blog/${sessionId}/stream`, { withCredentials: true });
}

export async function fetchSessionStatus(sessionId: string): Promise<{
  success: boolean;
  status?: string;
  blog?: string;
  seoMetadata?: { title: string; description: string; keywords: string[] } | null;
  review?: { qualityScore: number; strengths: string[]; suggestions: string[]; flags: string[] } | null;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/api/blog/${sessionId}/status`);
  return res.json();
}

// --- Debug / Trace ---

export async function fetchDebugMode(): Promise<{ debugMode: boolean; insightsEnabled: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/settings/debug-mode`);
    const data = await res.json();
    return { debugMode: !!data.debugMode, insightsEnabled: data.insightsEnabled !== false };
  } catch {
    return { debugMode: false, insightsEnabled: true };
  }
}

export type TimelineStyle = 'preview-bar' | 'timeline' | 'stepper';

export async function fetchBlogSettings(): Promise<{
  timelineStyle: TimelineStyle;
  generateImages: boolean;
  generateLinks: boolean;
  sharingEnabled: boolean;
  previewAgents: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/settings/blog`);
    return res.json();
  } catch {
    return { timelineStyle: 'preview-bar', generateImages: true, generateLinks: true, sharingEnabled: false, previewAgents: 'last' };
  }
}

export interface InitSettings {
  debugMode: boolean;
  insightsEnabled: boolean;
  timelineStyle: TimelineStyle;
  generateImages: boolean;
  generateLinks: boolean;
  sharingEnabled: boolean;
  previewAgents: string;
  appName: string;
  guestModeEnabled: boolean;
  registrationEnabled: boolean;
}

const INIT_DEFAULTS: InitSettings = {
  debugMode: false, insightsEnabled: true,
  timelineStyle: 'preview-bar', generateImages: true, generateLinks: true,
  sharingEnabled: false, previewAgents: 'none', appName: 'BlogWriter',
  guestModeEnabled: true, registrationEnabled: true,
};

export async function fetchInitSettings(): Promise<InitSettings> {
  try {
    const res = await fetch(`${API_BASE}/api/settings/init`);
    const data = await res.json();
    return { ...INIT_DEFAULTS, ...data };
  } catch {
    return INIT_DEFAULTS;
  }
}

export async function fetchBrandVoiceTrace(traceId: string): Promise<ApiResponse<AgentLogEntry[]>> {
  const res = await fetch(`${API_BASE}/api/brand-voice/trace/${traceId}`);
  return res.json();
}

export async function fetchBlogSessionTraces(sessionId: string): Promise<ApiResponse<AgentLogEntry[]>> {
  const res = await fetch(`${API_BASE}/api/blog/${sessionId}/traces`);
  return res.json();
}

// --- Share ---

export async function createShareLink(data: {
  blogContent: string;
  brandName?: string;
}): Promise<ApiResponse<{ hash: string }>> {
  const res = await fetch(`${API_BASE}/api/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchSharedBlog(hash: string): Promise<ApiResponse<SharedBlog>> {
  const res = await fetch(`${API_BASE}/api/share/${hash}`);
  return res.json();
}

export async function deleteSharedBlog(hash: string): Promise<ApiResponse<void>> {
  const res = await fetch(`${API_BASE}/api/share/${hash}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.json();
}

// --- Voice Presets ---

export interface VoicePreset {
  id: number;
  name: string;
  formattedVoice: string;
}

export async function fetchVoicePresets(): Promise<ApiResponse<VoicePreset[]>> {
  const res = await fetch(`${API_BASE}/api/voice-presets`);
  return res.json();
}
