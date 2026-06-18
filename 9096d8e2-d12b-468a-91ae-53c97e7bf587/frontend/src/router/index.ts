import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false, title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layout/MainLayout.vue'),
    meta: { requiresAuth: true },
    redirect: '/dispatch',
    children: [
      {
        path: 'dispatch',
        name: 'Dispatch',
        component: () => import('@/views/dispatch/DispatchBoard.vue'),
        meta: { title: '调度指挥', icon: 'Monitor', roles: ['DISPATCHER', 'ADMIN'] }
      },
      {
        path: 'record',
        name: 'Record',
        component: () => import('@/views/record/MedicalRecordList.vue'),
        meta: { title: '病历管理', icon: 'Document', roles: ['DOCTOR', 'ADMIN', 'QC'] }
      },
      {
        path: 'record/:id',
        name: 'RecordEdit',
        component: () => import('@/views/record/MedicalRecordEdit.vue'),
        meta: { title: '病历录入', icon: 'EditPen', roles: ['DOCTOR', 'ADMIN'], hidden: true }
      },
      {
        path: 'vehicle',
        name: 'Vehicle',
        component: () => import('@/views/vehicle/VehicleManagement.vue'),
        meta: { title: '车辆管理', icon: 'Van', roles: ['VEHICLE_MANAGER', 'ADMIN'] }
      },
      {
        path: 'quality',
        name: 'Quality',
        component: () => import('@/views/quality/QualityDashboard.vue'),
        meta: { title: '质控报表', icon: 'DataAnalysis', roles: ['QC', 'ADMIN'] }
      },
      {
        path: 'hospital',
        name: 'HospitalNotification',
        component: () => import('@/views/hospital/HospitalNotification.vue'),
        meta: { title: '医院预通知', icon: 'Bell', roles: ['HOSPITAL', 'ADMIN', 'DOCTOR'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const userStore = useUserStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth && !userStore.isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta.roles && userStore.user) {
    const hasRole = (to.meta.roles as string[]).includes(userStore.user.role)
    if (!hasRole) {
      next('/403')
      return
    }
  }

  document.title = to.meta.title ? `${to.meta.title} - 急救调度指挥中心` : '急救调度指挥中心'
  next()
})

export default router
