import type { BrandVoice, Dress, DressFacet, ApiResponse, DebugEvent, AgentLogEntry } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://blogwriter.test:4444';

// --- Brand Voice ---

export async function analyzeBrandVoice(url: string): Promise<ApiResponse<BrandVoice>> {
  const res = await fetch(`${API_BASE}/api/brand-voice/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

export async function analyzeBrandVoiceStream(
  url: string,
  onStatus: (message: string) => void,
  onDebug?: (data: DebugEvent) => void,
): Promise<ApiResponse<BrandVoice>> {
  const res = await fetch(`${API_BASE}/api/brand-voice/analyze-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok || !res.body) {
    return { success: false, error: 'Failed to connect to analysis service' };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ApiResponse<BrandVoice> = { success: false, error: 'Analysis did not complete' };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'status') {
          onStatus(event.data);
        } else if (event.type === 'result') {
          result = { success: true, data: event.data.data, cached: event.data.cached, traceId: event.data.traceId };
        } else if (event.type === 'debug' && onDebug) {
          onDebug(event.data);
        } else if (event.type === 'error') {
          result = { success: false, error: event.data };
        }
      } catch { /* skip malformed lines */ }
    }
  }

  return result;
}

// --- Dresses ---

export async function fetchDresses(params: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  unfiltered?: boolean;
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

export async function startBlogGeneration(data: {
  storeUrl: string;
  brandVoice: BrandVoice;
  selectedDressIds: string[];
  additionalInstructions: string;
}): Promise<ApiResponse<{ sessionId: string }>> {
  const res = await fetch(`${API_BASE}/api/blog/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export function createBlogStream(sessionId: string): EventSource {
  return new EventSource(`${API_BASE}/api/blog/${sessionId}/stream`);
}

// --- Debug / Trace ---

export async function fetchDebugMode(): Promise<{ debugMode: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/settings/debug-mode`);
    return res.json();
  } catch {
    return { debugMode: false };
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
