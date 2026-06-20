import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserRole } from '@/types'

export const ROLE_META: Record<UserRole, { label: string; avatar: string; desc: string; color: string }> = {
  management: { label: '院线管理层', avatar: '管', desc: '15家影院 · 120厅', color: '#E8B547' },
  cinema_manager: { label: '影院经理', avatar: '经', desc: '单店经营 · 人员调度', color: '#60A5FA' },
  scheduler: { label: '排片员', avatar: '排', desc: '排片规划 · 场次协调', color: '#4ADE80' },
  cashier: { label: '售票员', avatar: '售', desc: '票务销售 · 会员服务', color: '#FBBF24' },
  concession_staff: { label: '卖品员', avatar: '卖', desc: '卖品销售 · 库存管理', color: '#C8364F' }
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  management: ['/dashboard', '/schedule', '/booking', '/dcp', '/member', '/concession', '/analytics', '/monitor'],
  cinema_manager: ['/dashboard', '/schedule', '/booking', '/member', '/concession', '/analytics', '/monitor'],
  scheduler: ['/schedule', '/dcp', '/analytics'],
  cashier: ['/booking', '/member'],
  concession_staff: ['/concession']
}

export const useAppStore = defineStore('app', () => {
  const collapsed = ref(false)
  const role = ref<UserRole>('management')

  const roleMeta = computed(() => ROLE_META[role.value])
  const allowedRoutes = computed(() => ROLE_PERMISSIONS[role.value])

  function toggleSidebar() {
    collapsed.value = !collapsed.value
  }

  function setCollapsed(val: boolean) {
    collapsed.value = val
  }

  function setRole(r: UserRole) {
    role.value = r
  }

  function canAccess(route: string) {
    return allowedRoutes.value.includes(route)
  }

  return { collapsed, role, roleMeta, allowedRoutes, toggleSidebar, setCollapsed, setRole, canAccess }
})
