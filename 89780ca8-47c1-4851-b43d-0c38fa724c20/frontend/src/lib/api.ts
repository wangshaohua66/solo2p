const BASE_URL = 'http://localhost:8000/api/v1'

function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: unknown
  params?: Record<string, string>
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, params } = options

  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const token = getToken()
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }
  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url.toString(), {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.message || `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

export function get<T>(path: string, params?: Record<string, string>) {
  return api<T>(path, { params })
}

export function post<T>(path: string, body?: unknown) {
  return api<T>(path, { method: 'POST', body })
}

export function put<T>(path: string, body?: unknown) {
  return api<T>(path, { method: 'PUT', body })
}

export function del<T>(path: string) {
  return api<T>(path, { method: 'DELETE' })
}
