import { create } from 'zustand';
import type { AuthUser } from '@/lib/auth-api';
import * as authApi from '@/lib/auth-api';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  guestModeEnabled: boolean;
  registrationEnabled: boolean;

  checkAuth: () => Promise<void>;
  setAuthState: (user: AuthUser | null, guestModeEnabled: boolean, registrationEnabled: boolean) => void;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  setGuestModeEnabled: (enabled: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isGuest: false,
  guestModeEnabled: true,
  registrationEnabled: true,

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const [authResult, settingsResult] = await Promise.all([
        authApi.getMe(),
        authApi.getAuthSettings(),
      ]);

      if (authResult.user) {
        set({
          user: authResult.user,
          isAuthenticated: true,
          isGuest: false,
          guestModeEnabled: settingsResult.guestModeEnabled,
          registrationEnabled: settingsResult.registrationEnabled,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isGuest: settingsResult.guestModeEnabled,
          guestModeEnabled: settingsResult.guestModeEnabled,
          registrationEnabled: settingsResult.registrationEnabled,
          isLoading: false,
        });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isGuest: true, isLoading: false });
    }
  },

  setAuthState: (user, guestModeEnabled, registrationEnabled) => {
    if (user) {
      set({ user, isAuthenticated: true, isGuest: false, guestModeEnabled, registrationEnabled, isLoading: false });
    } else {
      set({ user: null, isAuthenticated: false, isGuest: guestModeEnabled, guestModeEnabled, registrationEnabled, isLoading: false });
    }
  },

  login: async (email, password) => {
    const result = await authApi.login(email, password);
    if (result.user) {
      set({ user: result.user, isAuthenticated: true, isGuest: false });
      return {};
    }
    return { error: result.error || 'Login failed' };
  },

  register: async (email, password, displayName) => {
    const result = await authApi.register(email, password, displayName);
    if (result.user) {
      set({ user: result.user, isAuthenticated: true, isGuest: false });
      return {};
    }
    return { error: result.error || 'Registration failed' };
  },

  logout: async () => {
    await authApi.logout();
    set({ user: null, isAuthenticated: false, isGuest: true });
  },

  setGuestModeEnabled: (enabled) => set({ guestModeEnabled: enabled }),
}));
