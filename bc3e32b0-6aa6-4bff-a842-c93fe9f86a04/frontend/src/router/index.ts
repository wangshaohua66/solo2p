import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { layout: 'auth', requiresAuth: false, title: '登录' }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/Register.vue'),
    meta: { layout: 'auth', requiresAuth: false, title: '注册' }
  },
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true, title: '工作台', icon: 'Odometer' }
  },
  {
    path: '/members',
    name: 'Members',
    component: () => import('@/views/member/MemberList.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'instructor'], title: '会员管理', icon: 'User' }
  },
  {
    path: '/members/:id',
    name: 'MemberDetail',
    component: () => import('@/views/member/MemberDetail.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'instructor'], title: '会员详情' }
  },
  {
    path: '/kiln',
    name: 'KilnSchedule',
    component: () => import('@/views/Studio/KilnSchedule.vue'),
    meta: { requiresAuth: true, title: '窑炉排程', icon: 'Flame' }
  },
  {
    path: '/glaze-recipes',
    name: 'GlazeRecipes',
    component: () => import('@/views/GlazeRecipe/GlazeRecipeList.vue'),
    meta: { requiresAuth: true, title: '釉料配方', icon: 'MagicStick' }
  },
  {
    path: '/glaze-recipes/:id',
    name: 'GlazeRecipeDetail',
    component: () => import('@/views/GlazeRecipe/GlazeRecipeDetail.vue'),
    meta: { requiresAuth: true, title: '配方详情' }
  },
  {
    path: '/pieces',
    name: 'PieceArchive',
    component: () => import('@/views/Studio/PieceArchive.vue'),
    meta: { requiresAuth: true, title: '作品档案', icon: 'Picture' }
  },
  {
    path: '/pieces/:id',
    name: 'PieceDetail',
    component: () => import('@/views/Studio/PieceDetail.vue'),
    meta: { requiresAuth: true, title: '作品详情' }
  },
  {
    path: '/courses',
    name: 'Courses',
    component: () => import('@/views/Course/CourseList.vue'),
    meta: { requiresAuth: true, title: '课程中心', icon: 'Reading' }
  },
  {
    path: '/courses/:id',
    name: 'CourseDetail',
    component: () => import('@/views/Course/CourseDetail.vue'),
    meta: { requiresAuth: true, title: '课程详情' }
  },
  {
    path: '/studio',
    name: 'StudioBooking',
    component: () => import('@/views/Studio/StudioBooking.vue'),
    meta: { requiresAuth: true, title: '自由创作', icon: 'Tickets' }
  },
  {
    path: '/sales',
    name: 'Sales',
    component: () => import('@/views/Sales/SalesList.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'instructor'], title: '作品销售', icon: 'ShoppingBag' }
  },
  {
    path: '/sales/custom-orders',
    name: 'CustomOrders',
    component: () => import('@/views/Sales/CustomOrderList.vue'),
    meta: { requiresAuth: true, title: '定制委托', icon: 'Document' }
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('@/views/Inventory/MaterialList.vue'),
    meta: { requiresAuth: true, roles: ['admin'], title: '原料库存', icon: 'Box' }
  },
  {
    path: '/inventory/alerts',
    name: 'InventoryAlerts',
    component: () => import('@/views/Inventory/AlertList.vue'),
    meta: { requiresAuth: true, roles: ['admin'], title: '库存预警' }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/Profile.vue'),
    meta: { requiresAuth: true, title: '个人中心', icon: 'UserFilled' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const title = to.meta.title as string
  if (title) {
    document.title = `${title} - 陶艺工坊管理系统`
  }

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
    return
  }

  if (to.meta.roles && authStore.user) {
    const roles = to.meta.roles as string[]
    if (!roles.includes(authStore.user.role)) {
      next('/dashboard')
      return
    }
  }

  if (authStore.isLoggedIn && (to.path === '/login' || to.path === '/register')) {
    next('/dashboard')
    return
  }

  next()
})

export default router
