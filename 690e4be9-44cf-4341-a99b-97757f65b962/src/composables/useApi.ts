import { ElMessage } from 'element-plus'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  params?: Record<string, string | number>
}

interface PaginatedParams {
  page?: number
  pageSize?: number
  [key: string]: unknown
}

export function useApi(baseUrl = '/api') {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, params } = options
    let url = `${baseUrl}${path}`

    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value))
      })
      url += `?${searchParams.toString()}`
    }

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`)
      }

      return await response.json() as T
    } catch (error) {
      const message = error instanceof Error ? error.message : '网络请求异常'
      ElMessage.error(message)
      throw error
    }
  }

  function get<T>(path: string, params?: Record<string, string | number>) {
    return request<T>(path, { method: 'GET', params })
  }

  function post<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'POST', body })
  }

  function put<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PUT', body })
  }

  function del<T>(path: string) {
    return request<T>(path, { method: 'DELETE' })
  }

  function paginated<T>(path: string, params: PaginatedParams = {}) {
    const { page = 1, pageSize = 20, ...rest } = params
    return request<{ data: T[]; total: number }>(path, {
      method: 'GET',
      params: { page, pageSize, ...rest as Record<string, string> },
    })
  }

  return { request, get, post, put, del, paginated }
}
