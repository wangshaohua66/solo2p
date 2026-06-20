import type { UserRole } from './common'
import type { ServiceCategory } from './billing'

export interface SystemUser {
  id: string
  username: string
  name: string
  role: UserRole
  department: string
  phone: string
  email?: string
  avatar?: string
  status: 'active' | 'inactive'
  createTime: string
  lastLoginTime?: string
  remark?: string
}

export interface Role {
  id: string
  code: UserRole | string
  name: string
  description: string
  permissions: string[]
  createTime: string
  status: 'active' | 'inactive'
}

export interface PermissionNode {
  id: string
  code: string
  name: string
  module: 'business' | 'dispatch' | 'cemetery' | 'report' | 'system'
  parentId?: string
  children?: PermissionNode[]
  type: 'module' | 'menu' | 'action'
  icon?: string
}

export interface NotificationTemplate {
  id: string
  type: 'sms' | 'wechat' | 'email'
  scene: string
  sceneLabel: string
  title: string
  content: string
  variables: string[]
  enabled: boolean
  updateTime: string
}
