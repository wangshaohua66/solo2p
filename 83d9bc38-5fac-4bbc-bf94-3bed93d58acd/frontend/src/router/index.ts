import { createRouter, createWebHistory, type RouteRecordRaw, type RouteMeta } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import type { UserRole } from '@/types'

declare module 'vue-router' {
  interface RouteMeta {
    title: string
    requiresAuth: boolean
    permissions?: string[]
    roles?: UserRole[]
  }
}

export interface AppRouteRecordRaw extends Omit<RouteRecordRaw, 'meta' | 'children'> {
  meta: RouteMeta
  children?: AppRouteRecordRaw[]
}

const routes: AppRouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: {
      title: '登录',
      requiresAuth: false
    }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/dashboard/Dashboard.vue'),
    meta: {
      title: '首页仪表盘',
      requiresAuth: true
    }
  },
  {
    path: '/dashboard',
    redirect: '/'
  },
  {
    path: '/equipment',
    name: 'EquipmentList',
    component: () => import('@/views/equipment/EquipmentList.vue'),
    meta: {
      title: '设备列表',
      requiresAuth: true
    }
  },
  {
    path: '/equipment/:id',
    name: 'EquipmentDetail',
    component: () => import('@/views/equipment/EquipmentDetail.vue'),
    meta: {
      title: '设备详情',
      requiresAuth: true
    },
    props: true
  },
  {
    path: '/booking',
    name: 'BookingCalendar',
    component: () => import('@/views/booking/BookingCalendar.vue'),
    meta: {
      title: '预约日历',
      requiresAuth: true
    }
  },
  {
    path: '/booking/list',
    name: 'BookingList',
    component: () => import('@/views/booking/BookingList.vue'),
    meta: {
      title: '预约列表',
      requiresAuth: true
    }
  },
  {
    path: '/billing',
    name: 'Billing',
    component: () => import('@/views/billing/BillingList.vue'),
    meta: {
      title: '账单管理',
      requiresAuth: true,
      roles: ['teacher', 'admin', 'super_admin']
    }
  },
  {
    path: '/maintenance',
    name: 'Maintenance',
    component: () => import('@/views/maintenance/MaintenanceList.vue'),
    meta: {
      title: '维护计划',
      requiresAuth: true,
      roles: ['admin', 'operator', 'super_admin']
    }
  },
  {
    path: '/stats',
    name: 'Stats',
    component: () => import('@/views/stats/StatsDashboard.vue'),
    meta: {
      title: '统计分析',
      requiresAuth: true,
      roles: ['admin', 'super_admin']
    }
  },
  {
    path: '/audit',
    name: 'Audit',
    component: () => import('@/views/audit/AuditLogList.vue'),
    meta: {
      title: '日志审计',
      requiresAuth: true,
      roles: ['super_admin']
    }
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('@/views/user/UserList.vue'),
    meta: {
      title: '用户管理',
      requiresAuth: true,
      roles: ['super_admin']
    }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/user/Profile.vue'),
    meta: {
      title: '个人中心',
      requiresAuth: true
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: {
      title: '页面未找到',
      requiresAuth: false
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes: routes as RouteRecordRaw[],
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach((to, _from, next) => {
  const userStore = useUserStore()

  document.title = `${to.meta.title} - 设备预约管理系统`

  if (to.meta.requiresAuth) {
    if (!userStore.token || !userStore.isLoggedIn) {
      ElMessage.warning('请先登录')
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }

    if (to.meta.roles && to.meta.roles.length > 0) {
      if (!userStore.hasAnyRole(to.meta.roles)) {
        ElMessage.error('权限不足，无法访问该页面')
        next('/')
        return
      }
    }

    if (to.meta.permissions && to.meta.permissions.length > 0) {
      const hasAllPermissions = to.meta.permissions.every(permission =>
        userStore.hasPermission(permission)
      )
      if (!hasAllPermissions) {
        ElMessage.error('权限不足，无法访问该页面')
        next('/')
        return
      }
    }

    next()
  } else {
    if (to.path === '/login' && userStore.token && userStore.isLoggedIn) {
      next('/')
      return
    }
    next()
  }
})

export default router
