import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getToken } from '@/api'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false, title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '工作台', icon: 'DataBoard' }
      },
      {
        path: 'cases',
        name: 'Cases',
        component: () => import('@/views/CaseManage.vue'),
        meta: { title: '案件管理', icon: 'Document' }
      },
      {
        path: 'cases/:id',
        name: 'CaseDetail',
        component: () => import('@/views/CaseDetail.vue'),
        meta: { title: '案件详情', hidden: true }
      },
      {
        path: 'calendar',
        name: 'Calendar',
        component: () => import('@/views/CalendarView.vue'),
        meta: { title: '庭审日程', icon: 'Calendar' }
      },
      {
        path: 'evidence',
        name: 'Evidence',
        component: () => import('@/views/EvidenceCenter.vue'),
        meta: { title: '证据中心', icon: 'FolderOpened' }
      },
      {
        path: 'billing',
        name: 'Billing',
        component: () => import('@/views/BillingManage.vue'),
        meta: { title: '工时计费', icon: 'Money' }
      },
      {
        path: 'templates',
        name: 'Templates',
        component: () => import('@/views/TemplateManage.vue'),
        meta: { title: '文书模板', icon: 'Tickets' }
      },
      {
        path: 'clients',
        name: 'Clients',
        component: () => import('@/views/ClientManage.vue'),
        meta: { title: '客户管理', icon: 'UserFilled' }
      },
      {
        path: 'contracts',
        name: 'Contracts',
        component: () => import('@/views/ContractManage.vue'),
        meta: { title: '合同管理', icon: 'Notebook' }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/UserManage.vue'),
        meta: { title: '人员管理', icon: 'Avatar', roles: ['admin', 'partner'] }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/UserProfile.vue'),
        meta: { title: '个人中心', hidden: true }
      }
    ]
  },
  {
    path: '/portal',
    component: () => import('@/layouts/PortalLayout.vue'),
    meta: { requiresAuth: false },
    children: [
      {
        path: '',
        name: 'PortalHome',
        component: () => import('@/views/portal/PortalHome.vue'),
        meta: { title: '客户门户' }
      },
      {
        path: 'cases',
        name: 'PortalCases',
        component: () => import('@/views/portal/PortalCases.vue'),
        meta: { title: '我的案件' }
      },
      {
        path: 'documents',
        name: 'PortalDocuments',
        component: () => import('@/views/portal/PortalDocuments.vue'),
        meta: { title: '法律文书' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach((to, from, next) => {
  const title = to.meta.title as string
  if (title) {
    document.title = `${title} - 律所案件管理系统`
  }
  if (to.meta.requiresAuth === false) {
    next()
    return
  }
  const token = getToken()
  if (!token) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }
  const userStore = useUserStore()
  if (!userStore.user) {
    userStore.fetchUserInfo().then(() => {
      if (to.meta.roles) {
        const roles = to.meta.roles as string[]
        if (roles.includes(userStore.user?.role || '')) {
          next()
        } else {
          next('/dashboard')
        }
      } else {
        next()
      }
    }).catch(() => {
      next('/login')
    })
  } else {
    if (to.meta.roles) {
      const roles = to.meta.roles as string[]
      if (roles.includes(userStore.user?.role || '')) {
        next()
      } else {
        next('/dashboard')
      }
    } else {
      next()
    }
  }
})

export default router
