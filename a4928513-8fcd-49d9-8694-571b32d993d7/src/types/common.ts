export interface PaginationParams {
  page: number
  pageSize: number
  keyword?: string
}

export interface PaginationResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export type UserRole =
  | 'admin'
  | 'funeral_attendant'
  | 'embalmer'
  | 'cremator'
  | 'ritualist'
  | 'cemetery_manager'
  | 'family'

export interface UserInfo {
  id: string
  username: string
  name: string
  role: UserRole
  avatar?: string
  phone: string
  department: string
  token: string
}

export interface DictItem {
  value: string | number
  label: string
  color?: string
}
