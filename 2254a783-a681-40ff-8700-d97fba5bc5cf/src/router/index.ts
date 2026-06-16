import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useVesselStore } from '@/stores/vessel'
import DashboardView from '@/views/DashboardView.vue'
import ScheduleView from '@/views/ScheduleView.vue'
import VesselView from '@/views/VesselView.vue'
import ApplicationView from '@/views/ApplicationView.vue'
import AnalyticsView from '@/views/AnalyticsView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: { title: '主看板', icon: 'Monitor' }
  },
  {
    path: '/schedule',
    name: 'schedule',
    component: ScheduleView,
    meta: { title: '计划编排', icon: 'Calendar', roles: ['director', 'dispatcher'] }
  },
  {
    path: '/vessel',
    name: 'vessel',
    component: VesselView,
    meta: { title: '船舶动态', icon: 'Ship' }
  },
  {
    path: '/application',
    name: 'application',
    component: ApplicationView,
    meta: { title: '靠泊申请', icon: 'Document', roles: ['director', 'dispatcher', 'agent'] }
  },
  {
    path: '/analytics',
    name: 'analytics',
    component: AnalyticsView,
    meta: { title: '吞吐量分析', icon: 'DataAnalysis', roles: ['director', 'dispatcher'] }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const vesselStore = useVesselStore()
  const userRole = vesselStore.currentUser.role

  const roles = to.meta.roles as string[] | undefined
  if (roles && !roles.includes(userRole)) {
    next('/dashboard')
    return
  }

  document.title = `${to.meta.title || '港口调度系统'} - 港口泊位调度监控系统`
  next()
})

export default router
