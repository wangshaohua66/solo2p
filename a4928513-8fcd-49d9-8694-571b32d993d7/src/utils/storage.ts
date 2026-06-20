const TOKEN_KEY = 'FUNERAL_TOKEN'
const USER_KEY = 'FUNERAL_USER'
const SIDEBAR_KEY = 'FUNERAL_SIDEBAR'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getUser<T = any>(): T | null {
  const data = localStorage.getItem(USER_KEY)
  return data ? JSON.parse(data) : null
}

export function setUser<T = any>(user: T): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function removeUser(): void {
  localStorage.removeItem(USER_KEY)
}

export function getSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_KEY) === '1'
}

export function setSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
}

export function clearAuth(): void {
  removeToken()
  removeUser()
}
