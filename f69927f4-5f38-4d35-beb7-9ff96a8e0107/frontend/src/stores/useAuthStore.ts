import { create } from 'zustand';
import type { AuthUser } from '@/types';
import { mockLoginResponse } from '@/mocks';
import { delay } from '@/api/index';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (username: string, _password: string) => {
    await delay(500);
    localStorage.setItem('token', mockLoginResponse.token);
    localStorage.setItem('refreshToken', mockLoginResponse.refreshToken);
    set({
      user: mockLoginResponse.user,
      token: mockLoginResponse.token,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  setUser: (user: AuthUser) => set({ user }),
}));
