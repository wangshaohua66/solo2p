import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false, title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard'
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '进度看板' }
      },
      {
        path: 'projects',
        name: 'Projects',
        component: () => import('@/views/ProjectListView.vue'),
        meta: { title: '项目列表' }
      },
      {
        path: 'projects/:id',
        name: 'ProjectDetail',
        component: () => import('@/views/ProjectDetailView.vue'),
        meta: { title: '项目详情' }
      },
      {
        path: 'review/:documentId',
        name: 'Review',
        component: () => import('@/views/ReviewView.vue'),
        meta: { title: '图纸审阅' }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/ProfileView.vue'),
        meta: { title: '个人中心' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0 }
  }
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  if (to.meta?.title) {
    document.title = `${to.meta.title} - 建筑图纸协同审阅平台`
  }

  if (to.meta?.requiresAuth === false) {
    if (authStore.isAuthenticated && to.name === 'Login') {
      return next('/')
    }
    return next()
  }

  if (!authStore.isAuthenticated) {
    return next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }

  if (!authStore.user) {
    try {
      await authStore.fetchCurrentUser()
    } catch {
      return next({
        path: '/login',
        query: { redirect: to.fullPath }
      })
    }
  }

  next()
})

export default router
