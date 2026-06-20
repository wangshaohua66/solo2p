import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

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
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '工作台', icon: 'DataLine' }
      },
      {
        path: 'topics',
        name: 'Topics',
        component: () => import('@/views/content/TopicPlanning.vue'),
        meta: { title: '选题策划', icon: 'EditPen' }
      },
      {
        path: 'topics/:id',
        name: 'TopicDetail',
        component: () => import('@/views/content/TopicDetail.vue'),
        meta: { title: '选题详情', hidden: true }
      },
      {
        path: 'materials',
        name: 'Materials',
        component: () => import('@/views/material/MaterialLibrary.vue'),
        meta: { title: '素材资源库', icon: 'Folder' }
      },
      {
        path: 'workflow',
        name: 'Workflow',
        component: () => import('@/views/workflow/ReviewProcess.vue'),
        meta: { title: '审核流程', icon: 'CircleCheck' }
      },
      {
        path: 'schedule',
        name: 'Schedule',
        component: () => import('@/views/schedule/ScheduleBoard.vue'),
        meta: { title: '播出排期', icon: 'Calendar' }
      },
      {
        path: 'copyright',
        name: 'Copyright',
        component: () => import('@/views/copyright/CopyrightManagement.vue'),
        meta: { title: '版权管理', icon: 'Lock' }
      },
      {
        path: 'statistics',
        name: 'Statistics',
        component: () => import('@/views/statistics/WorkloadStats.vue'),
        meta: { title: '工作量统计', icon: 'Histogram' }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: { title: '个人中心', icon: 'User' }
      }
    ]
  },
  {
    path: '/mobile',
    component: () => import('@/layouts/MobileLayout.vue'),
    meta: { requiresAuth: true, isMobile: true },
    children: [
      {
        path: 'home',
        name: 'MobileHome',
        component: () => import('@/views/mobile/MobileHome.vue'),
        meta: { title: '首页', icon: 'HomeFilled' }
      },
      {
        path: 'tasks',
        name: 'MobileTasks',
        component: () => import('@/views/mobile/MobileTasks.vue'),
        meta: { title: '任务', icon: 'List' }
      },
      {
        path: 'upload',
        name: 'MobileUpload',
        component: () => import('@/views/mobile/MobileUpload.vue'),
        meta: { title: '上传', icon: 'Upload' }
      },
      {
        path: 'notifications',
        name: 'MobileNotifications',
        component: () => import('@/views/mobile/MobileNotifications.vue'),
        meta: { title: '通知', icon: 'Bell' }
      },
      {
        path: 'profile',
        name: 'MobileProfile',
        component: () => import('@/views/mobile/MobileProfile.vue'),
        meta: { title: '我的', icon: 'User' }
      }
    ]
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
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach((to, _from, next) => {
  const userStore = useUserStore()
  let isMobile = window.innerWidth < 768
  
  if (to.query.force_pc === '1') {
    isMobile = false
  }
  if (to.query.force_mobile === '1') {
    isMobile = true
  }
  
  document.title = to.meta.title ? `${to.meta.title} - 媒体内容生产管理系统` : '媒体内容生产管理系统'
  
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }
  
  if (isMobile && to.meta.requiresAuth && !to.meta.isMobile && to.path !== '/login') {
    next({ path: '/mobile/home' })
    return
  }
  
  if (!isMobile && to.meta.isMobile && to.path.startsWith('/mobile')) {
    next({ path: '/' })
    return
  }
  
  next()
})

export default router
