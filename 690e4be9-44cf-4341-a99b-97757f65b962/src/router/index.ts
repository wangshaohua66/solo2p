import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'DispatchBoard',
    component: () => import('@/views/DispatchBoard.vue'),
    meta: { title: '调度看板', icon: 'Monitor' },
  },
  {
    path: '/schedule',
    name: 'ScheduleEditor',
    component: () => import('@/views/ScheduleEditor.vue'),
    meta: { title: '排班编辑', icon: 'Calendar' },
  },
  {
    path: '/driver-schedule',
    name: 'DriverSchedule',
    component: () => import('@/views/DriverSchedule.vue'),
    meta: { title: '司机排班', icon: 'User' },
  },
  {
    path: '/ridership',
    name: 'RidershipAnalysis',
    component: () => import('@/views/RidershipAnalysis.vue'),
    meta: { title: '客流分析', icon: 'TrendCharts' },
  },
  {
    path: '/maintenance',
    name: 'MaintenanceManagement',
    component: () => import('@/views/MaintenanceManagement.vue'),
    meta: { title: '维保管理', icon: 'SetUp' },
  },
  {
    path: '/daily-report',
    name: 'DailyReport',
    component: () => import('@/views/DailyReport.vue'),
    meta: { title: '运营日报', icon: 'Document' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '公交调度'} - 公交智能排班与运营调度系统`
  next()
})

export default router
