import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';
import { Result } from '@/types';
import { useAuthStore } from '@/store/authStore';

const service: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  withCredentials: true,
});

service.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    config.headers = {
      ...config.headers,
      'X-Request-Id': requestId,
    };
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res: Result<any> = response.data;
    if (res.code === 200) {
      return res.data;
    }
    if (res.code === 401) {
      useAuthStore.getState().logout();
      message.error('登录已过期，请重新登录');
      window.location.href = '/login';
      return Promise.reject(res);
    }
    if (res.code === 403) {
      message.error('没有权限访问');
      return Promise.reject(res);
    }
    message.error(res.message || '请求失败');
    return Promise.reject(res);
  },
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      message.error('登录已过期，请重新登录');
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      message.error('没有权限访问');
    } else if (error.code === 'ECONNABORTED') {
      message.error('请求超时');
    } else {
      message.error(error.message || '网络错误');
    }
    return Promise.reject(error);
  }
);

export default service;
