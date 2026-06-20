import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/Login.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/',
    name: 'Root',
    component: () => import('@/components/layout/MainLayout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/pages/Dashboard.vue'),
        meta: { title: '工作台', icon: 'Odometer', breadcrumb: [{ title: '工作台' }] }
      },
      {
        path: 'remains',
        name: 'Remains',
        redirect: '/remains/list',
        meta: { title: '业务办理' },
        children: [
          {
            path: 'list',
            name: 'RemainsList',
            component: () => import('@/pages/remains/List.vue'),
            meta: { title: '遗体档案', breadcrumb: [{ title: '业务办理' }, { title: '遗体档案' }] }
          },
          {
            path: 'detail/:id',
            name: 'RemainsDetail',
            component: () => import('@/pages/remains/Detail.vue'),
            meta: { title: '档案详情', breadcrumb: [{ title: '业务办理' }, { title: '遗体档案', path: '/remains/list' }, { title: '档案详情' }] }
          },
          {
            path: 'register',
            name: 'RemainsRegister',
            component: () => import('@/pages/remains/Register.vue'),
            meta: { title: '遗体登记', breadcrumb: [{ title: '业务办理' }, { title: '遗体登记' }] }
          },
          {
            path: 'settlement',
            name: 'BillingSettlement',
            component: () => import('@/pages/billing/Settlement.vue'),
            meta: { title: '费用结算', breadcrumb: [{ title: '业务办理' }, { title: '费用结算' }] }
          }
        ]
      },
      {
        path: 'dispatch',
        name: 'Dispatch',
        redirect: '/hall/booking',
        meta: { title: '资源调度' },
        children: [
          {
            path: '/hall/booking',
            name: 'HallBooking',
            component: () => import('@/pages/hall/Booking.vue'),
            meta: { title: '告别厅预约', breadcrumb: [{ title: '资源调度' }, { title: '告别厅预约' }] }
          },
          {
            path: '/vehicle/dispatch',
            name: 'VehicleDispatch',
            component: () => import('@/pages/vehicle/Dispatch.vue'),
            meta: { title: '车辆调度', breadcrumb: [{ title: '资源调度' }, { title: '车辆调度' }] }
          }
        ]
      },
      {
        path: 'cemetery',
        name: 'Cemetery',
        redirect: '/cemetery/map',
        meta: { title: '墓园管理' },
        children: [
          {
            path: 'map',
            name: 'CemeteryMap',
            component: () => import('@/pages/cemetery/Map.vue'),
            meta: { title: '园区管理', breadcrumb: [{ title: '墓园管理' }, { title: '园区管理' }] }
          },
          {
            path: 'memorial',
            name: 'MemorialBooking',
            component: () => import('@/pages/cemetery/Memorial.vue'),
            meta: { title: '祭扫预约', breadcrumb: [{ title: '墓园管理' }, { title: '祭扫预约' }] }
          }
        ]
      },
      {
        path: 'statistics',
        name: 'Statistics',
        component: () => import('@/pages/statistics/Report.vue'),
        meta: { title: '统计报表', breadcrumb: [{ title: '统计报表' }] }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/pages/settings/Index.vue'),
        meta: { title: '系统设置', breadcrumb: [{ title: '系统设置' }] }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  document.title = to.meta?.title ? `${to.meta.title} - 殡葬管理综合服务平台` : '殡葬管理综合服务平台'

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } })
  } else if (to.path === '/login' && authStore.isLoggedIn) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
