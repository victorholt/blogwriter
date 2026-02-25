import type { BrandVoice } from '@/types';
import { normalizeBrandVoice } from './brand-voice-compat';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

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

export async function fetchModels(): Promise<ApiResponse<ModelOption[]>> {
  const res = await fetch(`${API_BASE}/api/admin/models`, { credentials: 'include' });
  return res.json();
}

export async function fetchAgentConfigs(): Promise<ApiResponse<AgentConfig[]>> {
  const res = await fetch(`${API_BASE}/api/admin/agents`, { credentials: 'include' });
  return res.json();
}

export async function updateAgentConfig(
  agentId: string,
  data: { modelId: string; temperature?: string; maxTokens?: string; instructions?: string; enabled?: boolean; showPreview?: boolean; maxRetries?: number },
): Promise<ApiResponse<AgentConfig>> {
  const res = await fetch(`${API_BASE}/api/admin/agents/${agentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchSettings(): Promise<ApiResponse<Record<string, string>> & { status?: number }> {
  const res = await fetch(`${API_BASE}/api/admin/settings`, { credentials: 'include' });
  const json = await res.json();
  return { ...json, status: res.status };
}

export async function updateSettings(
  data: Record<string, string>,
): Promise<ApiResponse<Record<string, string>>> {
  const res = await fetch(`${API_BASE}/api/admin/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

// --- OpenRouter Credits ---

export interface OpenRouterCredits {
  label: string;
  limit: number | null;
  limit_remaining: number | null;
  usage: number;
  is_free_tier: boolean;
  total_credits: number | null;
}

export async function fetchOpenRouterCredits(): Promise<ApiResponse<OpenRouterCredits>> {
  const res = await fetch(`${API_BASE}/api/admin/openrouter/credits`, { credentials: 'include' });
  return res.json();
}

export async function clearCache(): Promise<ApiResponse<{ cleared: number }>> {
  const res = await fetch(`${API_BASE}/api/admin/cache`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.json();
}

// --- Dress Cache ---

export async function fetchDressCacheStats(): Promise<ApiResponse<{ total: number }>> {
  const res = await fetch(`${API_BASE}/api/admin/dress-cache`, { credentials: 'include' });
  return res.json();
}

export async function clearDressCache(): Promise<ApiResponse<{ cleared: number }>> {
  const res = await fetch(`${API_BASE}/api/admin/dress-cache`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.json();
}

export async function syncDresses(): Promise<ApiResponse<{ synced: number; total: number; byType: Record<string, number> }>> {
  const res = await fetch(`${API_BASE}/api/admin/dress-cache/sync`, {
    method: 'POST',
    credentials: 'include',
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

export async function fetchAdminThemes(): Promise<ApiResponse<AdminTheme[]>> {
  const res = await fetch(`${API_BASE}/api/admin/themes`, { credentials: 'include' });
  return res.json();
}

export async function createTheme(
  data: { name: string; description: string },
): Promise<ApiResponse<AdminTheme>> {
  const res = await fetch(`${API_BASE}/api/admin/themes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateTheme(
  id: number,
  data: { name?: string; description?: string; isActive?: boolean; sortOrder?: number },
): Promise<ApiResponse<AdminTheme>> {
  const res = await fetch(`${API_BASE}/api/admin/themes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteTheme(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`${API_BASE}/api/admin/themes/${id}`, {
    method: 'DELETE',
    credentials: 'include',
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
  seoKeywords: string;
  avoidTerms: string;
  websiteUrl: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAdminBrandLabels(): Promise<ApiResponse<AdminBrandLabel[]>> {
  const res = await fetch(`${API_BASE}/api/admin/brand-labels`, { credentials: 'include' });
  return res.json();
}

export async function createBrandLabel(
  data: { slug: string; displayName: string },
): Promise<ApiResponse<AdminBrandLabel>> {
  const res = await fetch(`${API_BASE}/api/admin/brand-labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateBrandLabel(
  id: number,
  data: { slug?: string; displayName?: string; isActive?: boolean; sortOrder?: number; seoKeywords?: string; avoidTerms?: string; websiteUrl?: string; description?: string },
): Promise<ApiResponse<AdminBrandLabel>> {
  const res = await fetch(`${API_BASE}/api/admin/brand-labels/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteBrandLabel(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`${API_BASE}/api/admin/brand-labels/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.json();
}

// --- Agent Defaults ---

export interface AgentDefaultInstructions {
  instructions: string;
  isDynamic: boolean;
}

export async function fetchAgentDefaults(): Promise<ApiResponse<Record<string, AgentDefaultInstructions>>> {
  const res = await fetch(`${API_BASE}/api/admin/agents/defaults`, { credentials: 'include' });
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
  agentId: string,
): Promise<ApiResponse<AdditionalInstruction[]>> {
  const res = await fetch(`${API_BASE}/api/admin/agents/${agentId}/instructions`, { credentials: 'include' });
  return res.json();
}

export async function createAdditionalInstruction(
  agentId: string,
  data: { title: string; content: string },
): Promise<ApiResponse<AdditionalInstruction>> {
  const res = await fetch(`${API_BASE}/api/admin/agents/${agentId}/instructions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateAdditionalInstruction(
  agentId: string,
  id: number,
  data: { title?: string; content?: string },
): Promise<ApiResponse<AdditionalInstruction>> {
  const res = await fetch(`${API_BASE}/api/admin/agents/${agentId}/instructions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteAdditionalInstruction(
  agentId: string,
  id: number,
): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`${API_BASE}/api/admin/agents/${agentId}/instructions/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.json();
}

// --- App Version ---

export async function fetchAppVersion(): Promise<ApiResponse<{ version: string }>> {
  const res = await fetch(`${API_BASE}/api/admin/version`, { credentials: 'include' });
  return res.json();
}

// --- Enhance Text ---

export async function enhanceText(
  text: string,
  context?: string,
): Promise<ApiResponse<{ text: string }>> {
  const res = await fetch(`${API_BASE}/api/admin/enhance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text, context }),
  });
  return res.json();
}

// --- SMTP ---

export async function testSmtp(): Promise<ApiResponse<{ message: string }>> {
  const res = await fetch(`${API_BASE}/api/admin/smtp/test`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.json();
}

// --- Email Templates ---

export interface EmailTemplatePreview {
  id: string;
  name: string;
  description: string;
  subject: string;
  html: string;
}

export async function fetchEmailTemplates(): Promise<ApiResponse<EmailTemplatePreview[]>> {
  const res = await fetch(`${API_BASE}/api/admin/email/templates`, { credentials: 'include' });
  return res.json();
}

export async function sendTestEmail(
  templateId: string,
  to: string,
): Promise<ApiResponse<{ message: string }>> {
  const res = await fetch(`${API_BASE}/api/admin/email/templates/${templateId}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ to }),
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

export async function fetchVoicePresets(): Promise<ApiResponse<AdminVoicePreset[]>> {
  const res = await fetch(`${API_BASE}/api/admin/voice-presets`, { credentials: 'include' });
  return res.json();
}

export async function createVoicePreset(
  data: { name: string; description?: string; rawSourceText?: string; formattedVoice?: string; additionalInstructions?: string },
): Promise<ApiResponse<AdminVoicePreset>> {
  const res = await fetch(`${API_BASE}/api/admin/voice-presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateVoicePreset(
  id: number,
  data: { name?: string; description?: string; rawSourceText?: string; formattedVoice?: string; additionalInstructions?: string; isActive?: boolean; sortOrder?: number },
): Promise<ApiResponse<AdminVoicePreset>> {
  const res = await fetch(`${API_BASE}/api/admin/voice-presets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteVoicePreset(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`${API_BASE}/api/admin/voice-presets/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.json();
}

// --- Feedback ---

export interface FeedbackResponseItem {
  id: string;
  formSlug: string;
  storeCode: string | null;
  answers: string; // JSON
  agentReview: string | null; // JSON: { flagged, flags[], summary }
  agentReviewedAt: string | null;
  status: string; // 'new' | 'reviewed' | 'actioned'
  adminNotes: string | null;
  createdAt: string;
}

export interface FeedbackFormItem {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  questions: string; // JSON
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackStats {
  total: number;
  new: number;
  reviewed: number;
  actioned: number;
  flagged: number;
}

export async function fetchFeedbackResponse(id: string): Promise<ApiResponse<FeedbackResponseItem>> {
  const res = await fetch(`${API_BASE}/api/admin/feedback/${id}`, { credentials: 'include' });
  return res.json();
}

export async function fetchFeedbackResponses(
  page = 1,
  filters: { status?: string; storeCode?: string; formSlug?: string } = {},
): Promise<ApiResponse<{ responses: FeedbackResponseItem[]; totalPages: number; total: number }>> {
  const params = new URLSearchParams({ page: String(page) });
  if (filters.status) params.set('status', filters.status);
  if (filters.storeCode) params.set('storeCode', filters.storeCode);
  if (filters.formSlug) params.set('formSlug', filters.formSlug);
  const res = await fetch(`${API_BASE}/api/admin/feedback?${params}`, { credentials: 'include' });
  return res.json();
}

export async function fetchFeedbackStats(): Promise<ApiResponse<FeedbackStats>> {
  const res = await fetch(`${API_BASE}/api/admin/feedback/stats`, { credentials: 'include' });
  return res.json();
}

export async function fetchFeedbackForms(): Promise<ApiResponse<FeedbackFormItem[]>> {
  const res = await fetch(`${API_BASE}/api/admin/feedback/forms`, { credentials: 'include' });
  return res.json();
}

export async function updateFeedbackResponse(
  id: string,
  data: { status?: string; adminNotes?: string },
): Promise<ApiResponse<unknown>> {
  const res = await fetch(`${API_BASE}/api/admin/feedback/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchPendingReviewIds(limit: number): Promise<ApiResponse<{ ids: string[]; total: number }>> {
  const res = await fetch(`${API_BASE}/api/admin/feedback/pending-review-ids?limit=${limit}`, { credentials: 'include' });
  return res.json();
}

export async function triggerFeedbackReview(id: string): Promise<ApiResponse<unknown>> {
  const res = await fetch(`${API_BASE}/api/admin/feedback/${id}/review`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.json();
}

export async function updateFeedbackForm(
  id: string,
  data: { name?: string; description?: string; questions?: string; isActive?: boolean; isDefault?: boolean },
): Promise<ApiResponse<unknown>> {
  const res = await fetch(`${API_BASE}/api/admin/feedback/forms/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function exportFeedbackForm(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/feedback/forms/${id}/export`, { credentials: 'include' });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `feedback-form-${id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function formatVoicePresetStream(
  rawText: string,
  onStatus: (message: string) => void,
  additionalInstructions?: string,
): Promise<ApiResponse<BrandVoice>> {
  const body: Record<string, string> = { rawText };
  if (additionalInstructions) body.additionalInstructions = additionalInstructions;

  const res = await fetch(`${API_BASE}/api/admin/voice-presets/format-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
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
