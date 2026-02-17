const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://blogwriter.test:4444';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  spaceId: string | null;
}

interface AuthResponse {
  user?: AuthUser;
  error?: string;
  success?: boolean;
}

export async function register(email: string, password: string, displayName: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, displayName }),
  });
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function getMe(): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: 'include',
    });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export async function getAuthSettings(): Promise<{ guestModeEnabled: boolean; registrationEnabled: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/settings/auth`);
    return res.json();
  } catch {
    return { guestModeEnabled: true, registrationEnabled: true };
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success?: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return res.json();
}
