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
  data: { modelId: string; temperature?: string; maxTokens?: string; instructions?: string },
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
