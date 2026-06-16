import { createRouter, createWebHistory, type RouteRecordRaw, type NavigationGuardNext, type RouteLocationNormalized } from 'vue-router'
import NProgress from 'nprogress'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import type { UserRole } from '@/types'

NProgress.configure({ showSpinner: false })

const Layout = () => import('@/layouts/DefaultLayout.vue')
const Login = () => import('@/views/Login.vue')
const Dashboard = () => import('@/views/Dashboard.vue')
const RealtimeMap = () => import('@/views/parking/RealtimeMap.vue')
const ParkingRecords = () => import('@/views/parking/ParkingRecords.vue')
const StationList = () => import('@/views/charging/StationList.vue')
const ChargingReservations = () => import('@/views/charging/Reservations.vue')
const ChargingSessions = () => import('@/views/charging/Sessions.vue')
const PaymentCenter = () => import('@/views/billing/PaymentCenter.vue')
const OrderList = () => import('@/views/billing/OrderList.vue')
const BillingRules = () => import('@/views/billing/Rules.vue')
const WorkOrders = () => import('@/views/admin/WorkOrders.vue')
const ReportViolation = () => import('@/views/admin/ReportViolation.vue')
const UserManagement = () => import('@/views/admin/UserManagement.vue')
const Profile = () => import('@/views/user/Profile.vue')
const NotFound = () => import('@/views/error/404.vue')
const Forbidden = () => import('@/views/error/403.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { title: '登录', public: true }
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: Forbidden,
    meta: { title: '无权限', public: true }
  },
  {
    path: '/404',
    name: 'NotFound',
    component: NotFound,
    meta: { title: '页面不存在', public: true }
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: Dashboard,
        meta: {
          title: '运营看板',
          icon: 'DataAnalysis',
          roles: ['SuperAdmin', 'ParkOperator', 'ParkingAdmin', 'ChargingOps'] as UserRole[]
        }
      },
      {
        path: 'parking',
        name: 'Parking',
        redirect: '/parking/map',
        meta: { title: '停车管理', icon: 'Parking' },
        children: [
          {
            path: 'map',
            name: 'ParkingMap',
            component: RealtimeMap,
            meta: {
              title: '实时车位地图',
              icon: 'Map',
              roles: ['SuperAdmin', 'ParkOperator', 'ParkingAdmin', 'ChargingOps', 'CarOwner'] as UserRole[]
            }
          },
          {
            path: 'records',
            name: 'ParkingRecords',
            component: ParkingRecords,
            meta: {
              title: '停车记录',
              icon: 'Tickets',
              roles: ['SuperAdmin', 'ParkOperator', 'ParkingAdmin', 'CarOwner'] as UserRole[]
            }
          }
        ]
      },
      {
        path: 'charging',
        name: 'Charging',
        redirect: '/charging/stations',
        meta: { title: '充电管理', icon: 'Lightning' },
        children: [
          {
            path: 'stations',
            name: 'ChargingStations',
            component: StationList,
            meta: {
              title: '充电桩列表',
              icon: 'Connection',
              roles: ['SuperAdmin', 'ParkOperator', 'ChargingOps', 'CarOwner'] as UserRole[]
            }
          },
          {
            path: 'reservations',
            name: 'ChargingReservations',
            component: ChargingReservations,
            meta: {
              title: '预约记录',
              icon: 'Calendar',
              roles: ['SuperAdmin', 'ParkOperator', 'ChargingOps', 'CarOwner'] as UserRole[]
            }
          },
          {
            path: 'sessions',
            name: 'ChargingSessions',
            component: ChargingSessions,
            meta: {
              title: '充电会话',
              icon: 'MagicStick',
              roles: ['SuperAdmin', 'ParkOperator', 'ChargingOps', 'CarOwner'] as UserRole[]
            }
          }
        ]
      },
      {
        path: 'billing',
        name: 'Billing',
        redirect: '/billing/payment',
        meta: { title: '计费与支付', icon: 'Wallet' },
        children: [
          {
            path: 'payment',
            name: 'PaymentCenter',
            component: PaymentCenter,
            meta: {
              title: '支付中心',
              icon: 'CreditCard',
              roles: ['SuperAdmin', 'ParkOperator', 'ParkingAdmin', 'ChargingOps', 'CarOwner'] as UserRole[]
            }
          },
          {
            path: 'orders',
            name: 'OrderList',
            component: OrderList,
            meta: {
              title: '订单列表',
              icon: 'List',
              roles: ['SuperAdmin', 'ParkOperator', 'ParkingAdmin', 'ChargingOps', 'CarOwner'] as UserRole[]
            }
          },
          {
            path: 'rules',
            name: 'BillingRules',
            component: BillingRules,
            meta: {
              title: '计费规则',
              icon: 'Setting',
              roles: ['SuperAdmin', 'ParkOperator'] as UserRole[]
            }
          }
        ]
      },
      {
        path: 'admin',
        name: 'Admin',
        redirect: '/admin/work-orders',
        meta: { title: '运营管理', icon: 'Tools' },
        children: [
          {
            path: 'work-orders',
            name: 'WorkOrders',
            component: WorkOrders,
            meta: {
              title: '工单管理',
              icon: 'Document',
              roles: ['SuperAdmin', 'ParkOperator', 'ParkingAdmin', 'ChargingOps'] as UserRole[]
            }
          },
          {
            path: 'report',
            name: 'ReportViolation',
            component: ReportViolation,
            meta: {
              title: '违停举报',
              icon: 'Warning',
              roles: ['SuperAdmin', 'ParkOperator', 'ParkingAdmin', 'ChargingOps', 'CarOwner'] as UserRole[]
            }
          },
          {
            path: 'users',
            name: 'UserManagement',
            component: UserManagement,
            meta: {
              title: '用户管理',
              icon: 'User',
              roles: ['SuperAdmin', 'ParkOperator'] as UserRole[]
            }
          }
        ]
      },
      {
        path: 'profile',
        name: 'Profile',
        component: Profile,
        meta: {
          title: '个人中心',
          icon: 'Avatar',
          hidden: true,
          roles: ['SuperAdmin', 'ParkOperator', 'ParkingAdmin', 'ChargingOps', 'CarOwner'] as UserRole[]
        }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_PATH),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach((to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
  NProgress.start()
  const authStore = useAuthStore()
  document.title = `${to.meta.title || import.meta.env.VITE_APP_TITLE} - ${import.meta.env.VITE_APP_TITLE}`

  if (to.meta.public) {
    if (to.path === '/login' && authStore.isAuthenticated) {
      next('/dashboard')
    } else {
      next()
    }
    return
  }

  if (!authStore.isAuthenticated) {
    ElMessage.warning('请先登录')
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  const requiredRoles = to.meta.roles as UserRole[] | undefined
  if (requiredRoles && requiredRoles.length > 0) {
    if (!authStore.hasAnyRole(requiredRoles)) {
      ElMessage.error('您没有访问该页面的权限')
      next('/403')
      return
    }
  }

  next()
})

router.afterEach(() => {
  NProgress.done()
})

router.onError(() => {
  NProgress.done()
})

export default router

export function filterRoutesByRole(routes: RouteRecordRaw[], role: UserRole): RouteRecordRaw[] {
  return routes
    .filter(route => {
      if (route.meta?.hidden) return false
      if (!route.meta?.roles) return true
      return (route.meta.roles as UserRole[]).includes(role)
    })
    .map(route => ({
      ...route,
      children: route.children ? filterRoutesByRole(route.children, role) : undefined
    }))
}
