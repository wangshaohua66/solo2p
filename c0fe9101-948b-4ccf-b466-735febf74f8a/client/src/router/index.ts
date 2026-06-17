import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import NProgress from 'nprogress'
import { useUserStore } from '@/stores'

NProgress.configure({ showSpinner: false, trickleSpeed: 100 })

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/',
    component: () => import('@/layout/AppLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '工作台', icon: 'DataBoard', roles: ['doctor', 'lab_tech', 'pharmacist', 'nurse', 'manager', 'director'] }
      },
      {
        path: 'medical',
        name: 'Medical',
        component: () => import('@/views/medical/MedicalListView.vue'),
        meta: { title: '病历管理', icon: 'Document', roles: ['doctor', 'nurse', 'manager', 'director'] }
      },
      {
        path: 'medical/:recordId',
        name: 'MedicalDetail',
        component: () => import('@/views/medical/MedicalDetailView.vue'),
        meta: { title: '病历详情', icon: 'Document', roles: ['doctor', 'nurse', 'manager', 'director'], hideMenu: true }
      },
      {
        path: 'pets/:petId',
        name: 'PetDetail',
        component: () => import('@/views/medical/PetHistoryView.vue'),
        meta: { title: '宠物档案', icon: 'Pets', roles: ['doctor', 'nurse', 'manager', 'director'], hideMenu: true }
      },
      {
        path: 'hospitalization',
        name: 'Hospitalization',
        component: () => import('@/views/HospitalizationView.vue'),
        meta: { title: '住院管理', icon: 'HomeFilled', roles: ['doctor', 'nurse', 'manager', 'director'] }
      },
      {
        path: 'lab',
        name: 'Lab',
        component: () => import('@/views/LabView.vue'),
        meta: { title: '检验中心', icon: 'Microscope', roles: ['doctor', 'lab_tech', 'nurse', 'manager', 'director'] }
      },
      {
        path: 'pharmacy',
        name: 'Pharmacy',
        component: () => import('@/views/PharmacyView.vue'),
        meta: { title: '药房管理', icon: 'Medicine', roles: ['doctor', 'pharmacist', 'manager', 'director'] }
      },
      {
        path: 'schedule',
        name: 'Schedule',
        component: () => import('@/views/ScheduleView.vue'),
        meta: { title: '排班调度', icon: 'Calendar', roles: ['doctor', 'lab_tech', 'pharmacist', 'nurse', 'manager', 'director'] }
      },
      {
        path: 'report',
        name: 'Report',
        component: () => import('@/views/ReportView.vue'),
        meta: { title: '经营报表', icon: 'TrendCharts', roles: ['manager', 'director'] }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '404', public: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach(async (to, from, next) => {
  NProgress.start()
  const userStore = useUserStore()

  document.title = to.meta?.title
    ? `${to.meta.title} - ${import.meta.env.VITE_APP_TITLE}`
    : import.meta.env.VITE_APP_TITLE

  if (to.meta?.public) {
    if (to.name === 'Login' && userStore.isLoggedIn) {
      next('/dashboard')
      return
    }
    next()
    return
  }

  if (!userStore.isLoggedIn) {
    if (userStore.refreshToken) {
      const refreshed = await userStore.refresh()
      if (refreshed) {
        await userStore.loadUserInfo()
        await userStore.loadHospitals()
        next()
        return
      }
    }
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta?.roles && userStore.userInfo) {
    const roles = to.meta.roles as string[]
    if (!roles.includes(userStore.userInfo.role)) {
      next('/404')
      return
    }
  }

  if (userStore.hospitals.length === 0) {
    await userStore.loadHospitals()
  }

  next()
})

router.afterEach(() => {
  NProgress.done()
})

export default router
