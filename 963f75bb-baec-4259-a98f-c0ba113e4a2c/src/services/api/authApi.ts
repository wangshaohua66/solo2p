import apiClient from './apiClient';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  permissions: string[];
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const authApi = {
  login: (data: LoginRequest): Promise<LoginResponse> => {
    return apiClient.post('/auth/login', data).then(res => res.data);
  },

  register: (data: RegisterRequest): Promise<LoginResponse> => {
    return apiClient.post('/auth/register', data).then(res => res.data);
  },

  logout: (): Promise<void> => {
    return apiClient.post('/auth/logout').then(res => res.data);
  },

  getCurrentUser: (): Promise<UserInfo> => {
    return apiClient.get('/auth/me').then(res => res.data);
  },

  refreshToken: (refreshToken: string): Promise<{ accessToken: string }> => {
    return apiClient.post('/auth/refresh', { refreshToken }).then(res => res.data);
  },

  changePassword: (data: ChangePasswordRequest): Promise<void> => {
    return apiClient.post('/auth/change-password', data).then(res => res.data);
  },

  forgotPassword: (email: string): Promise<void> => {
    return apiClient.post('/auth/forgot-password', { email }).then(res => res.data);
  },

  resetPassword: (token: string, newPassword: string): Promise<void> => {
    return apiClient.post('/auth/reset-password', { token, newPassword }).then(res => res.data);
  },

  verifyEmail: (token: string): Promise<void> => {
    return apiClient.get(`/auth/verify-email?token=${token}`).then(res => res.data);
  },
};
