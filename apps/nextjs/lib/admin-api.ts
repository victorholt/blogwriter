import type { BrandVoice } from '@/types';
import { normalizeBrandVoice } from './brand-voice-compat';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://blogwriter.test:4444';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AgentConfig {
  id: number;
  agentId: string;
  agentLabel: string;
  modelId: string;
  temperature: string;
  maxTokens: string;
  instructions: string | null;
  enabled: boolean;
  showPreview: boolean;
  maxRetries: number;
  updatedAt: string;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export async function fetchModels(token: string): Promise<ApiResponse<ModelOption[]>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/models`);
  return res.json();
}

export async function fetchAgentConfigs(token: string): Promise<ApiResponse<AgentConfig[]>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/agents`);
  return res.json();
}

export async function updateAgentConfig(
  token: string,
  agentId: string,
  data: { modelId: string; temperature?: string; maxTokens?: string; instructions?: string; enabled?: boolean; showPreview?: boolean; maxRetries?: number },
): Promise<ApiResponse<AgentConfig>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/agents/${agentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchSettings(token: string): Promise<ApiResponse<Record<string, string>>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/settings`);
  return res.json();
}

export async function updateSettings(
  token: string,
  data: Record<string, string>,
): Promise<ApiResponse<Record<string, string>>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function clearCache(token: string): Promise<ApiResponse<{ cleared: number }>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/cache`, {
    method: 'DELETE',
  });
  return res.json();
}

// --- Dress Cache ---

export async function fetchDressCacheStats(token: string): Promise<ApiResponse<{ total: number }>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/dress-cache`);
  return res.json();
}

export async function clearDressCache(token: string): Promise<ApiResponse<{ cleared: number }>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/dress-cache`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function syncDresses(token: string): Promise<ApiResponse<{ synced: number; total: number; byType: Record<string, number> }>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/dress-cache/sync`, {
    method: 'POST',
  });
  return res.json();
}

// --- Themes ---

export interface AdminTheme {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAdminThemes(token: string): Promise<ApiResponse<AdminTheme[]>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/themes`);
  return res.json();
}

export async function createTheme(
  token: string,
  data: { name: string; description: string },
): Promise<ApiResponse<AdminTheme>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/themes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateTheme(
  token: string,
  id: number,
  data: { name?: string; description?: string; isActive?: boolean; sortOrder?: number },
): Promise<ApiResponse<AdminTheme>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/themes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteTheme(token: string, id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/themes/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

// --- Brand Labels ---

export interface AdminBrandLabel {
  id: number;
  slug: string;
  displayName: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAdminBrandLabels(token: string): Promise<ApiResponse<AdminBrandLabel[]>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/brand-labels`);
  return res.json();
}

export async function createBrandLabel(
  token: string,
  data: { slug: string; displayName: string },
): Promise<ApiResponse<AdminBrandLabel>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/brand-labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateBrandLabel(
  token: string,
  id: number,
  data: { slug?: string; displayName?: string; isActive?: boolean; sortOrder?: number },
): Promise<ApiResponse<AdminBrandLabel>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/brand-labels/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteBrandLabel(token: string, id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/brand-labels/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

// --- Agent Defaults ---

export interface AgentDefaultInstructions {
  instructions: string;
  isDynamic: boolean;
}

export async function fetchAgentDefaults(token: string): Promise<ApiResponse<Record<string, AgentDefaultInstructions>>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/agents/defaults`);
  return res.json();
}

// --- Additional Instructions ---

export interface AdditionalInstruction {
  id: number;
  agentId: string;
  title: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAdditionalInstructions(
  token: string,
  agentId: string,
): Promise<ApiResponse<AdditionalInstruction[]>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/agents/${agentId}/instructions`);
  return res.json();
}

export async function createAdditionalInstruction(
  token: string,
  agentId: string,
  data: { title: string; content: string },
): Promise<ApiResponse<AdditionalInstruction>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/agents/${agentId}/instructions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateAdditionalInstruction(
  token: string,
  agentId: string,
  id: number,
  data: { title?: string; content?: string },
): Promise<ApiResponse<AdditionalInstruction>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/agents/${agentId}/instructions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteAdditionalInstruction(
  token: string,
  agentId: string,
  id: number,
): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/agents/${agentId}/instructions/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

// --- App Version ---

export async function fetchAppVersion(token: string): Promise<ApiResponse<{ version: string }>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/version`);
  return res.json();
}

// --- Enhance Text ---

export async function enhanceText(
  token: string,
  text: string,
  context?: string,
): Promise<ApiResponse<{ text: string }>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/enhance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, context }),
  });
  return res.json();
}

// --- Voice Presets ---

export interface AdminVoicePreset {
  id: number;
  name: string;
  description: string | null;
  rawSourceText: string | null;
  formattedVoice: string | null;
  additionalInstructions: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function fetchVoicePresets(token: string): Promise<ApiResponse<AdminVoicePreset[]>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/voice-presets`);
  return res.json();
}

export async function createVoicePreset(
  token: string,
  data: { name: string; description?: string; rawSourceText?: string; formattedVoice?: string; additionalInstructions?: string },
): Promise<ApiResponse<AdminVoicePreset>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/voice-presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateVoicePreset(
  token: string,
  id: number,
  data: { name?: string; description?: string; rawSourceText?: string; formattedVoice?: string; additionalInstructions?: string; isActive?: boolean; sortOrder?: number },
): Promise<ApiResponse<AdminVoicePreset>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/voice-presets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteVoicePreset(token: string, id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`${API_BASE}/api/admin/${token}/voice-presets/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function formatVoicePresetStream(
  token: string,
  rawText: string,
  onStatus: (message: string) => void,
  additionalInstructions?: string,
): Promise<ApiResponse<BrandVoice>> {
  const body: Record<string, string> = { rawText };
  if (additionalInstructions) body.additionalInstructions = additionalInstructions;

  const res = await fetch(`${API_BASE}/api/admin/${token}/voice-presets/format-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    return { success: false, error: 'Failed to connect to formatting service' };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ApiResponse<BrandVoice> = { success: false, error: 'Formatting did not complete' };

  function processLine(line: string): void {
    if (!line.startsWith('data: ')) return;
    try {
      const event = JSON.parse(line.slice(6));
      if (event.type === 'status') {
        onStatus(event.data);
      } else if (event.type === 'result') {
        const normalized = normalizeBrandVoice(event.data.data);
        result = { success: true, data: normalized };
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
      for (const line of lines) {
        processLine(line.trim());
      }
    }
    if (buffer.trim()) processLine(buffer.trim());
  } finally {
    reader.releaseLock();
  }

  return result;
}
