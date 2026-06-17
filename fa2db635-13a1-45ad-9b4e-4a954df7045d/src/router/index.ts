import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/layout/AppLayout.vue'
import PortalLayout from '@/components/layout/PortalLayout.vue'
import LoginView from '@/views/login/LoginView.vue'
import SupplierLoginView from '@/views/login/SupplierLoginView.vue'
import DashboardView from '@/views/dashboard/DashboardView.vue'
import ScheduleView from '@/views/schedule/ScheduleView.vue'
import WeddingListView from '@/views/weddings/WeddingListView.vue'
import WeddingCreateView from '@/views/weddings/WeddingCreateView.vue'
import WeddingDetailView from '@/views/weddings/WeddingDetailView.vue'
import PackageListView from '@/views/packages/PackageListView.vue'
import PricingView from '@/views/pricing/PricingView.vue'
import ContractListView from '@/views/contracts/ContractListView.vue'
import ContractSignView from '@/views/contracts/ContractSignView.vue'
import FollowupView from '@/views/followup/FollowupView.vue'
import FinanceView from '@/views/finance/FinanceView.vue'
import ReportsView from '@/views/reports/ReportsView.vue'
import SettingsView from '@/views/settings/SettingsView.vue'
import PortalDashboardView from '@/views/portal/PortalDashboardView.vue'
import PortalOrdersView from '@/views/portal/PortalOrdersView.vue'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  { path: '/supplier-login', name: 'supplier-login', component: SupplierLoginView, meta: { public: true } },
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: 'dashboard', name: 'dashboard', component: DashboardView },
      { path: 'schedule', name: 'schedule', component: ScheduleView },
      { path: 'weddings', name: 'weddings', component: WeddingListView },
      { path: 'weddings/create', name: 'wedding-create', component: WeddingCreateView },
      { path: 'weddings/:id', name: 'wedding-detail', component: WeddingDetailView },
      { path: 'packages', name: 'packages', component: PackageListView },
      { path: 'pricing', name: 'pricing', component: PricingView },
      { path: 'contracts', name: 'contracts', component: ContractListView },
      { path: 'contracts/:id', name: 'contract-sign', component: ContractSignView },
      { path: 'followup', name: 'followup', component: FollowupView },
      { path: 'finance', name: 'finance', component: FinanceView },
      { path: 'reports', name: 'reports', component: ReportsView },
      { path: 'settings', name: 'settings', component: SettingsView },
    ],
  },
  {
    path: '/portal',
    component: PortalLayout,
    children: [
      { path: 'dashboard', name: 'portal-dashboard', component: PortalDashboardView },
      { path: 'orders', name: 'portal-orders', component: PortalOrdersView },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.public) return true
  if (!auth.isLoggedIn) {
    return to.path.startsWith('/portal') ? { name: 'supplier-login' } : { name: 'login' }
  }
  if (to.path.startsWith('/portal') && !auth.isSupplier) {
    return { name: 'dashboard' }
  }
  if (!to.path.startsWith('/portal') && auth.isSupplier) {
    return { name: 'portal-dashboard' }
  }
  return true
})

export default router
