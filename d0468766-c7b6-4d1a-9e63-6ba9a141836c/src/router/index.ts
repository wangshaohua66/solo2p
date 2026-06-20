import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAppStore } from '@/stores/app'

const MainLayout = () => import('@/layouts/MainLayout.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '运营驾驶舱', icon: 'Odometer' }
      },
      {
        path: 'schedule',
        name: 'Schedule',
        component: () => import('@/views/Schedule.vue'),
        meta: { title: '智能排片', icon: 'Calendar' }
      },
      {
        path: 'booking',
        name: 'Booking',
        component: () => import('@/views/Booking.vue'),
        meta: { title: '在线选座', icon: 'Film' }
      },
      {
        path: 'dcp',
        name: 'Dcp',
        component: () => import('@/views/Dcp.vue'),
        meta: { title: 'DCP调度', icon: 'Box' }
      },
      {
        path: 'member',
        name: 'Member',
        component: () => import('@/views/Member.vue'),
        meta: { title: '会员通兑', icon: 'Medal' }
      },
      {
        path: 'concession',
        name: 'Concession',
        component: () => import('@/views/Concession.vue'),
        meta: { title: '卖品进销存', icon: 'Goods' }
      },
      {
        path: 'analytics',
        name: 'Analytics',
        component: () => import('@/views/Analytics.vue'),
        meta: { title: '票房数据中心', icon: 'TrendCharts' }
      },
      {
        path: 'monitor',
        name: 'Monitor',
        component: () => import('@/views/Monitor.vue'),
        meta: { title: '影厅监控', icon: 'Monitor' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  const appStore = useAppStore()
  const path = `/${to.path.split('/').filter(Boolean)[0] || 'dashboard'}`
  if (!appStore.canAccess(path)) {
    return appStore.allowedRoutes[0] || '/dashboard'
  }
})

export default router
