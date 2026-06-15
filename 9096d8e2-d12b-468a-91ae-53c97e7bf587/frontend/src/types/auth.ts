export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  username: string
  realName: string
  role: string
}

export interface UserInfo {
  id?: number
  username: string
  realName: string
  role: string
  department?: string
  phone?: string
}
