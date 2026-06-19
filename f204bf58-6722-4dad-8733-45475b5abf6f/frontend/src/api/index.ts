import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import router from '@/router'

const service: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

const TOKEN_KEY = 'law_firm_token'
const REFRESH_KEY = 'law_firm_refresh'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string, refresh?: string) => {
  localStorage.setItem(TOKEN_KEY, token)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
}
export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

service.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const token = getToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data
    if (res.code !== undefined && res.code !== 200) {
      if (res.code === 401) {
        const url = response.config?.url || ''
        if (!url.includes('/auth/login')) {
          handleAuthError()
        }
      }
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || 'Error'))
    }
    return res
  },
  (error: AxiosError) => {
    const status = error.response?.status
    if (status === 401) {
      handleAuthError()
    } else if (status === 403) {
      ElMessage.error('没有权限执行此操作')
    } else if (status === 404) {
      ElMessage.error('请求资源不存在')
    } else if (status >= 500) {
      ElMessage.error('服务器错误，请稍后重试')
    } else {
      ElMessage.error(error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

function handleAuthError() {
  removeToken()
  ElMessageBox.confirm('登录状态已过期，请重新登录', '提示', {
    confirmButtonText: '重新登录',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    router.push('/login')
  }).catch(() => {})
}

export default service

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface PageResult<T = any> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
