import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/projects'
  },
  {
    path: '/projects',
    name: 'ProjectList',
    component: () => import('@/views/ProjectList.vue'),
    meta: { title: '项目列表', requiresAuth: false }
  },
  {
    path: '/editor/:projectId',
    name: 'StepEditor',
    component: () => import('@/views/StepEditor.vue'),
    meta: { title: '步骤编辑', requiresAuth: false },
    props: true
  },
  {
    path: '/relations',
    name: 'RelationView',
    component: () => import('@/views/RelationView.vue'),
    meta: { title: '关联图谱', requiresAuth: false }
  },
  {
    path: '/showcase/:projectId',
    name: 'PublicShowcase',
    component: () => import('@/views/PublicShowcase.vue'),
    meta: { title: '公众展示', requiresAuth: false },
    props: true
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/projects'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '非遗技艺系统'} - 非遗技艺可视化编辑与展示系统`
  next()
})

export default router
