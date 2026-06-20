import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/transcript'
  },
  {
    path: '/transcript',
    name: 'Transcript',
    component: () => import('@/views/LiveTranscript.vue'),
    meta: { title: '实时笔录' }
  },
  {
    path: '/evidence',
    name: 'Evidence',
    component: () => import('@/views/EvidenceManager.vue'),
    meta: { title: '证据管理' }
  },
  {
    path: '/annotation',
    name: 'Annotation',
    component: () => import('@/views/AnnotationPanel.vue'),
    meta: { title: '多方标注' }
  },
  {
    path: '/timeline',
    name: 'Timeline',
    component: () => import('@/views/TimelineView.vue'),
    meta: { title: '时间轴' }
  },
  {
    path: '/export',
    name: 'Export',
    component: () => import('@/views/ExportCenter.vue'),
    meta: { title: '导出归档' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '智慧法庭系统'} - 智慧法庭庭审管理系统`
  next()
})

export default router
