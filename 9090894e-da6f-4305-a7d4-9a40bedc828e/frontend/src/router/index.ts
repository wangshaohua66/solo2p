import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import { useUserStore } from '@/stores/userStore'
import { ElMessage } from 'element-plus'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: {
          title: '数据看板',
          icon: 'DataAnalysis',
          roles: ['declarant', 'reviewer', 'admin']
        }
      },
      {
        path: 'declarations',
        name: 'DeclarationList',
        component: () => import('@/views/DeclarationList.vue'),
        meta: {
          title: '申报清单',
          icon: 'Document',
          roles: ['declarant', 'reviewer', 'admin']
        }
      },
      {
        path: 'declarations/:id',
        name: 'DeclarationDetail',
        component: () => import('@/views/DeclarationDetail.vue'),
        meta: {
          title: '申报详情',
          icon: 'Document',
          roles: ['declarant', 'reviewer', 'admin'],
          hidden: true
        }
      },
      {
        path: 'hs-search',
        name: 'HSSearch',
        component: () => import('@/views/HSSearch.vue'),
        meta: {
          title: 'HS编码检索',
          icon: 'Search',
          roles: ['declarant', 'reviewer', 'admin']
        }
      },
      {
        path: 'tax-calculator',
        name: 'TaxCalculator',
        component: () => import('@/views/TaxCalculator.vue'),
        meta: {
          title: '退税计算器',
          icon: 'Calculator',
          roles: ['declarant', 'reviewer', 'admin']
        }
      },
      {
        path: 'exceptions',
        name: 'ExceptionList',
        component: () => import('@/views/ExceptionList.vue'),
        meta: {
          title: '通关异常',
          icon: 'Warning',
          roles: ['declarant', 'reviewer', 'admin']
        }
      },
      {
        path: 'policies',
        name: 'PolicyLibrary',
        component: () => import('@/views/PolicyLibrary.vue'),
        meta: {
          title: '政策法规库',
          icon: 'Reading',
          roles: ['declarant', 'reviewer', 'admin']
        }
      },
      {
        path: 'user-management',
        name: 'UserManagement',
        component: () => import('@/views/UserManagement.vue'),
        meta: {
          title: '用户管理',
          icon: 'User',
          roles: ['admin']
        }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: {
          title: '系统设置',
          icon: 'Setting',
          roles: ['admin']
        }
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/Forbidden.vue'),
    meta: { title: '无权限访问', public: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  document.title = to.meta?.title
    ? `${to.meta.title} - 跨境电商综合试验区运营服务中心`
    : '跨境电商综合试验区运营服务中心'

  const userStore = useUserStore()

  if (to.meta?.public) {
    next()
    return
  }

  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta?.roles && Array.isArray(to.meta.roles)) {
    const hasAccess = to.meta.roles.some((role: string) =>
      userStore.hasRole(role as any)
    )
    if (!hasAccess) {
      ElMessage.error('您没有权限访问该页面')
      next({ name: 'Forbidden' })
      return
    }
  }

  next()
})

export default router
