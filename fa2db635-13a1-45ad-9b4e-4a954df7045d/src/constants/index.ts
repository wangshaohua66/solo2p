import type { WeddingStage, ContractStatus, TaskStatus, StaffRole, ResourceType } from '@/types'

export const STAGE_LABELS: Record<WeddingStage, string> = {
  CONSULT: '咨询',
  DESIGN: '方案设计',
  CONTRACT: '合同签订',
  PREPARE: '筹备执行',
  ONSITE: '现场督导',
  DELIVERY: '后期交付',
}

export const STAGE_ORDER: WeddingStage[] = ['CONSULT', 'DESIGN', 'CONTRACT', 'PREPARE', 'ONSITE', 'DELIVERY']

export const STAGE_STYLE: Record<WeddingStage, string> = {
  CONSULT: 'bg-wine-50 text-wine-600',
  DESIGN: 'bg-gold-50 text-gold-700',
  CONTRACT: 'bg-blue-50 text-blue-600',
  PREPARE: 'bg-purple-50 text-purple-600',
  ONSITE: 'bg-amber-50 text-amber-700',
  DELIVERY: 'bg-emerald-50 text-emerald-600',
}

export const CONTRACT_LABELS: Record<ContractStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待签署',
  SIGNED: '已签署',
  VOID: '已作废',
}

export const CONTRACT_STYLE: Record<ContractStatus, string> = {
  DRAFT: 'bg-wine-50 text-wine-600',
  PENDING: 'bg-amber-50 text-amber-700',
  SIGNED: 'bg-emerald-50 text-emerald-600',
  VOID: 'bg-gray-100 text-gray-500',
}

export const TASK_LABELS: Record<TaskStatus, string> = {
  TODO: '待办',
  DOING: '进行中',
  DONE: '已完成',
}

export const TASK_STYLE: Record<TaskStatus, string> = {
  TODO: 'bg-wine-50 text-wine-600',
  DOING: 'bg-amber-50 text-amber-700',
  DONE: 'bg-emerald-50 text-emerald-600',
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  PLANNER: '策划师',
  HOST: '主持人',
  MAKEUP: '化妆师',
  PHOTO: '摄影师',
  FLORIST: '花艺师',
}

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  STAFF: '人员',
  VENUE: '场地',
  PROP: '道具',
}

export const RESOURCE_STYLE: Record<ResourceType, string> = {
  STAFF: '#5b2a4e',
  VENUE: '#c9a86a',
  PROP: '#3f7d58',
}

export interface MenuItem {
  key: string
  label: string
  icon: string
  path: string
  group: string
}

export const MENU_GROUPS: { group: string; items: MenuItem[] }[] = [
  {
    group: '运营总览',
    items: [
      { key: 'dashboard', label: '工作台', icon: 'LayoutDashboard', path: '/dashboard' },
      { key: 'schedule', label: '档期日历', icon: 'CalendarDays', path: '/schedule' },
    ],
  },
  {
    group: '婚礼管理',
    items: [
      { key: 'weddings', label: '婚礼项目', icon: 'HeartHandshake', path: '/weddings' },
      { key: 'followup', label: '客户跟进', icon: 'ListChecks', path: '/followup' },
    ],
  },
  {
    group: '报价合同',
    items: [
      { key: 'packages', label: '套餐模板', icon: 'Package', path: '/packages' },
      { key: 'pricing', label: '报价计算器', icon: 'Calculator', path: '/pricing' },
      { key: 'contracts', label: '合同管理', icon: 'FileSignature', path: '/contracts' },
    ],
  },
  {
    group: '财务报表',
    items: [
      { key: 'finance', label: '财务核算', icon: 'Wallet', path: '/finance' },
      { key: 'reports', label: '报表统计', icon: 'BarChart3', path: '/reports' },
    ],
  },
  {
    group: '系统',
    items: [
      { key: 'settings', label: '基础设置', icon: 'Settings', path: '/settings' },
    ],
  },
]

export const ROLE_OPTIONS = [
  { value: 'ADMIN', label: '集团管理员' },
  { value: 'OPERATOR', label: '门店运营' },
  { value: 'PLANNER', label: '策划师' },
  { value: 'FINANCE', label: '财务人员' },
]
