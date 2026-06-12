import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types';
import { authApi } from '@/api';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      login: async (username, password) => {
        const response = await authApi.login(username, password);
        const { token, refresh_token, user } = response as any;
        localStorage.setItem('jwt_token', token);
        localStorage.setItem('jwt_refresh', refresh_token);
        set({
          token,
          refreshToken: refresh_token,
          user,
          isAuthenticated: true
        });
      },

      logout: () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('jwt_refresh');
        set({
          token: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false
        });
      },

      refreshUser: async () => {
        try {
          const user = await authApi.me();
          set({ user });
        } catch (e) {
          get().logout();
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
