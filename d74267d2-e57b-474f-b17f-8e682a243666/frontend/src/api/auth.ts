import request from '@/utils/request';
import { LoginRequest, LoginResponse } from '@/types/api';

export const login = (data: LoginRequest): Promise<LoginResponse> => {
  return request.post('/auth/auth/login', data);
};

export const logout = (): Promise<void> => {
  return request.post('/auth/auth/logout');
};

export const refreshToken = (refreshToken: string): Promise<LoginResponse> => {
  return request.post('/auth/auth/refresh', { refreshToken });
};

export const getCurrentUser = () => {
  return request.get('/auth/auth/current');
};

export const getUserInfo = (id: number) => {
  return request.get(`/auth/users/${id}`);
};

export const changePassword = (oldPassword: string, newPassword: string) => {
  return request.put('/auth/users/password', { oldPassword, newPassword });
};
