import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores'
import router from '@/router'

const BASE_URL = import.meta.env.VITE_API_BASE || ''

const service: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
})

service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const userStore = useUserStore()
    if (userStore.accessToken) {
      config.headers.Authorization = `Bearer ${userStore.accessToken}`
    }
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

async function processQueue(token: string | null) {
  refreshQueue.forEach(cb => cb(token || ''))
  refreshQueue = []
}

service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data
    if (response.config.responseType === 'blob') {
      return response
    }
    return res
  },
  async (error) => {
    const userStore = useUserStore()
    const config = error.config

    if (error.response) {
      const status = error.response.status

      if (status === 401) {
        if (isRefreshing) {
          return new Promise(resolve => {
            refreshQueue.push((token: string) => {
              config.headers.Authorization = `Bearer ${token}`
              resolve(service(config))
            })
          })
        }

        isRefreshing = true
        try {
          const ok = await userStore.refresh()
          if (ok) {
            processQueue(userStore.accessToken)
            config.headers.Authorization = `Bearer ${userStore.accessToken}`
            return service(config)
          }
        } catch {
        } finally {
          isRefreshing = false
        }

        ElMessageBox.confirm('登录已过期，请重新登录', '提示', {
          confirmButtonText: '重新登录',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(() => {
          userStore.logout()
          router.replace({ name: 'Login', query: { redirect: router.currentRoute.value.fullPath } })
        }).catch(() => {})
        return Promise.reject(error)
      }

      if (status === 403) {
        ElMessage.error('权限不足，无法访问该资源')
        return Promise.reject(error)
      }

      if (status === 404) {
        ElMessage.error('请求的资源不存在')
        return Promise.reject(error)
      }

      if (status >= 500) {
        ElMessage.error('服务器错误，请稍后重试')
        return Promise.reject(error)
      }

      const data = error.response.data
      if (data?.message) {
        ElMessage.error(data.message)
      }
    } else if (error.code === 'ECONNABORTED') {
      ElMessage.error('请求超时，请检查网络')
    } else if (error.message?.includes('Network Error')) {
      ElMessage.error('网络连接错误')
    } else {
      ElMessage.error(error.message || '请求失败')
    }

    return Promise.reject(error)
  }
)

export interface RequestConfig extends AxiosRequestConfig {
  showError?: boolean
}

export function request<T = any>(config: RequestConfig): Promise<T> {
  return service(config) as Promise<T>
}

export function get<T = any>(url: string, params?: any, config?: RequestConfig): Promise<T> {
  return request<T>({ method: 'GET', url, params, ...config })
}

export function post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
  return request<T>({ method: 'POST', url, data, ...config })
}

export function put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
  return request<T>({ method: 'PUT', url, data, ...config })
}

export function del<T = any>(url: string, config?: RequestConfig): Promise<T> {
  return request<T>({ method: 'DELETE', url, ...config })
}

export function uploadFile<T = any>(url: string, file: File | FormData, config?: RequestConfig): Promise<T> {
  const formData = file instanceof FormData ? file : new FormData()
  if (!(file instanceof FormData)) {
    formData.append('file', file)
  }
  return request<T>({
    method: 'POST',
    url,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  })
}

export default service
