import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    meta: { requiresAuth: true },
    redirect: '/schedule',
    children: [
      {
        path: 'schedule',
        name: 'Schedule',
        component: () => import('@/views/ScheduleBoard.vue'),
        meta: { title: '档期看板', icon: 'Calendar' }
      },
      {
        path: 'bookings',
        name: 'Bookings',
        component: () => import('@/views/BookingList.vue'),
        meta: { title: '档期管理', icon: 'Tickets', roles: ['venue_manager', 'producer'] }
      },
      {
        path: 'rehearsals',
        name: 'Rehearsals',
        component: () => import('@/views/RehearsalBooking.vue'),
        meta: { title: '排练厅预约', icon: 'Clock', roles: ['troupe_admin', 'venue_manager'] }
      },
      {
        path: 'equipments',
        name: 'Equipments',
        component: () => import('@/views/EquipmentManage.vue'),
        meta: { title: '设备管理', icon: 'SetUp', roles: ['tech_director', 'venue_manager'] }
      },
      {
        path: 'contracts',
        name: 'Contracts',
        component: () => import('@/views/ContractApproval.vue'),
        meta: { title: '合同审批', icon: 'Document' }
      },
      {
        path: 'budgets',
        name: 'Budgets',
        component: () => import('@/views/BudgetTracking.vue'),
        meta: { title: '预算追踪', icon: 'Money' }
      },
      {
        path: 'settlements',
        name: 'Settlements',
        component: () => import('@/views/SettlementReport.vue'),
        meta: { title: '结算报表', icon: 'DataAnalysis', roles: ['finance', 'venue_manager'] }
      },
      {
        path: 'venues',
        name: 'Venues',
        component: () => import('@/views/VenueManage.vue'),
        meta: { title: '场馆管理', icon: 'OfficeBuilding', roles: ['venue_manager'] }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '404' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '场馆调度系统'} - 演艺集团资源管理`

  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')

  if (to.meta.requiresAuth === false) {
    next()
    return
  }

  if (!token) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta.roles && userStr) {
    try {
      const user = JSON.parse(userStr)
      if (!(to.meta.roles as string[]).includes(user.Role)) {
        next('/schedule')
        return
      }
    } catch {
      next('/login')
      return
    }
  }

  next()
})

export default router
