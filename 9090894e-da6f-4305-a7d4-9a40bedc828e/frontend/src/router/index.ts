import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const routes: RouteRecordRaw[] = [
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
        meta: { title: '数据看板', icon: 'DataAnalysis' }
      },
      {
        path: 'declarations',
        name: 'DeclarationList',
        component: () => import('@/views/DeclarationList.vue'),
        meta: { title: '申报清单', icon: 'Document' }
      },
      {
        path: 'declarations/:id',
        name: 'DeclarationDetail',
        component: () => import('@/views/DeclarationDetail.vue'),
        meta: { title: '申报详情', icon: 'Document' }
      },
      {
        path: 'hs-search',
        name: 'HSSearch',
        component: () => import('@/views/HSSearch.vue'),
        meta: { title: 'HS编码检索', icon: 'Search' }
      },
      {
        path: 'tax-calculator',
        name: 'TaxCalculator',
        component: () => import('@/views/TaxCalculator.vue'),
        meta: { title: '退税计算器', icon: 'Calculator' }
      },
      {
        path: 'exceptions',
        name: 'ExceptionList',
        component: () => import('@/views/ExceptionList.vue'),
        meta: { title: '通关异常', icon: 'Warning' }
      },
      {
        path: 'policies',
        name: 'PolicyLibrary',
        component: () => import('@/views/PolicyLibrary.vue'),
        meta: { title: '政策法规库', icon: 'Reading' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { title: '系统设置', icon: 'Setting' }
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
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
  next()
})

export default router
