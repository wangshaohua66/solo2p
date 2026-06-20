import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { useUserStore } from '../stores/userStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { token } = useUserStore.getState();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    const { code, message: msg, data } = response.data;
    
    if (code === 0 || code === 200) {
      return data;
    }
    
    if (code === 401) {
      message.error('登录已过期，请重新登录');
      useUserStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(new Error(msg || 'Unauthorized'));
    }
    
    if (code === 403) {
      message.error('没有权限访问该资源');
      return Promise.reject(new Error(msg || 'Forbidden'));
    }
    
    message.error(msg || '请求失败');
    return Promise.reject(new Error(msg || 'Request failed'));
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        message.error('登录已过期，请重新登录');
        useUserStore.getState().logout();
        window.location.href = '/login';
      } else if (status === 403) {
        message.error('没有权限访问该资源');
      } else if (status === 404) {
        message.error('请求的资源不存在');
      } else if (status === 500) {
        message.error('服务器错误，请稍后重试');
      } else if (status === 504) {
        message.error('请求超时，请稍后重试');
      } else {
        message.error(data?.message || error.message || '请求失败');
      }
    } else if (error.request) {
      message.error('网络错误，请检查网络连接');
    } else {
      message.error(error.message || '请求失败');
    }
    
    return Promise.reject(error);
  }
);

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.get(url, config);
  },
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.post(url, data, config);
  },
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.put(url, data, config);
  },
  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.delete(url, config);
  },
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.patch(url, data, config);
  },
  download: (url: string, config?: AxiosRequestConfig): Promise<Blob> => {
    return axiosInstance.get(url, {
      ...config,
      responseType: 'blob',
    });
  },
  upload: <T>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> => {
    for (const [, value] of formData.entries()) {
      if (value instanceof File) {
        if (value.size > MAX_UPLOAD_SIZE) {
          const errorMsg = `文件 ${value.name} 大小超过限制，最大允许上传 50MB`;
          message.error(errorMsg);
          return Promise.reject(new Error(errorMsg));
        }
      }
    }
    return axiosInstance.post(url, formData, {
      ...config,
      headers: {
        ...config?.headers,
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  visitors: {
    getById: (id: string) => api.get(`/visitors/${id}`),
    recordBoothVisit: (visitorId: string, data: { boothId: string; boothNo?: string; zone?: string; enterTime?: string; leaveTime?: string; durationSec?: number }) =>
      api.post(`/visitors/${visitorId}/booth-visit`, data),
  },
  finance: {
    exportToSystem: (recordIds: string[]) => api.post('/finance/export-to-system', { recordIds }),
  },
};

export default axiosInstance;
