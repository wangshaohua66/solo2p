import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Market',
    component: () => import('@/pages/MarketPage.vue'),
  },
  {
    path: '/trade/:id',
    name: 'Trade',
    component: () => import('@/pages/TradePage.vue'),
  },
  {
    path: '/assets',
    name: 'MyAssets',
    component: () => import('@/pages/AssetsPage.vue'),
  },
  {
    path: '/assets/:id',
    name: 'AssetDetail',
    component: () => import('@/pages/AssetDetailPage.vue'),
  },
  {
    path: '/creator',
    name: 'CreatorHome',
    component: () => import('@/pages/CreatorPage.vue'),
  },
  {
    path: '/creator/publish',
    name: 'PublishWizard',
    component: () => import('@/pages/PublishPage.vue'),
  },
  {
    path: '/creator/management',
    name: 'PublishManagement',
    component: () => import('@/pages/PublishManagementPage.vue'),
  },
  {
    path: '/creator/royalty',
    name: 'RoyaltyEarnings',
    component: () => import('@/pages/RoyaltyPage.vue'),
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('@/pages/StatisticsPage.vue'),
  },
  {
    path: '/risk',
    name: 'RiskManagement',
    component: () => import('@/pages/RiskManagementPage.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
