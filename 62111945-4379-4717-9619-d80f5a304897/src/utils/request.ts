import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'
import { ApiResponse } from '@/types'

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
})

service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { code, message: msg, data } = response.data
    
    if (code === 200 || code === 0) {
      return data as any
    }
    
    if (code === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      window.location.href = '/login'
      return Promise.reject(new Error('未授权，请重新登录'))
    }
    
    if (code === 403) {
      message.error('没有访问权限')
      return Promise.reject(new Error('没有访问权限'))
    }
    
    message.error(msg || '请求失败')
    return Promise.reject(new Error(msg || '请求失败'))
  },
  (error) => {
    console.error('Response error:', error)
    const errMsg = error.response?.data?.message || error.message || '网络错误'
    message.error(errMsg)
    return Promise.reject(error)
  }
)

export interface RequestConfig extends AxiosRequestConfig {}

const request = {
  get<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return service.get(url, config)
  },
  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return service.post(url, data, config)
  },
  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return service.put(url, data, config)
  },
  delete<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return service.delete(url, config)
  },
  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return service.patch(url, data, config)
  }
}

export default request
