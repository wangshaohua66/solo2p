import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('ws_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) {
        return body.data
      }
      const error = new Error(body.message || 'Request failed')
      ;(error as any).code = body.code
      ;(error as any).data = body.data
      return Promise.reject(error)
    }
    return response.data
  },
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      const path = window.location.pathname
      if (!path.includes('/login')) {
        localStorage.removeItem('ws_token')
        localStorage.removeItem('ws_user')
        localStorage.removeItem('ws_supplier')
        window.location.href = '/login'
      }
    }
    const body = error.response?.data
    if (body && typeof body === 'object' && 'code' in body) {
      const e = new Error(body.message || 'Request failed')
      ;(e as any).code = body.code
      ;(e as any).data = body.data
      return Promise.reject(e)
    }
    return Promise.reject(error)
  },
)

export default http

export async function downloadBlob(url: string, filename: string) {
  const token = localStorage.getItem('ws_token')
  const resp = await fetch(`/api${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!resp.ok) throw new Error('下载失败')
  const blob = await resp.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
