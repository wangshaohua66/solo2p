import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const Layout = () => import('@/layout/BasicLayout.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '数据看板', icon: 'Odometer' }
      },
      {
        path: 'product',
        name: 'ProductManagement',
        component: () => import('@/views/ProductManagement.vue'),
        meta: { title: '商品管理', icon: 'Goods' }
      },
      {
        path: 'order',
        name: 'OrderProcessing',
        component: () => import('@/views/OrderProcessing.vue'),
        meta: { title: '订单管理', icon: 'List' }
      },
      {
        path: 'delivery',
        name: 'DeliveryDashboard',
        component: () => import('@/views/DeliveryDashboard.vue'),
        meta: { title: '配送调度', icon: 'Van' }
      },
      {
        path: 'settlement',
        name: 'SettlementCenter',
        component: () => import('@/views/SettlementCenter.vue'),
        meta: { title: '结算中心', icon: 'Money' }
      },
      {
        path: 'data-analysis',
        name: 'DataAnalysis',
        component: () => import('@/views/DataAnalysis.vue'),
        meta: { title: '数据分析', icon: 'TrendCharts' }
      },
      {
        path: 'community',
        name: 'CommunityManagement',
        component: () => import('@/views/CommunityManagement.vue'),
        meta: { title: '小区管理', icon: 'Location' }
      },
      {
        path: 'supplier',
        name: 'SupplierManagement',
        component: () => import('@/views/SupplierManagement.vue'),
        meta: { title: '供应商管理', icon: 'Connection' }
      },
      {
        path: 'user',
        name: 'UserManagement',
        component: () => import('@/views/UserManagement.vue'),
        meta: { title: '用户管理', icon: 'User' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
