import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAppSelector } from '@/store/hooks'
import MainLayout from '@/layouts/MainLayout'
import Login from '@/pages/Login'
import PerformanceCalendar from '@/pages/performance/Calendar'
import PerformanceApplication from '@/pages/performance/Application'
import PerformanceApproval from '@/pages/performance/Approval'
import SeatConfig from '@/pages/venue/SeatConfig'
import SeatSelector from '@/pages/sales/SeatSelector'
import OrderDetail from '@/pages/sales/OrderDetail'
import DeviceManagement from '@/pages/device/Management'
import DeviceSchedule from '@/pages/device/Schedule'
import SalesStats from '@/pages/settlement/SalesStats'
import SettlementList from '@/pages/settlement/SettlementList'
import UserManagement from '@/pages/system/UserManagement'
import NotFound from '@/pages/NotFound'

function RequireAuth({ children, allowedRoles }: { children: JSX.Element; allowedRoles?: string[] }) {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)

  useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = '/login'
    }
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/performance/calendar" replace /> },
      {
        path: 'performance/calendar',
        element: <PerformanceCalendar />
      },
      {
        path: 'performance/application',
        element: <PerformanceApplication />
      },
      {
        path: 'performance/approval',
        element: (
          <RequireAuth allowedRoles={['venue_admin']}>
            <PerformanceApproval />
          </RequireAuth>
        )
      },
      {
        path: 'venue/seat-config',
        element: (
          <RequireAuth allowedRoles={['venue_admin']}>
            <SeatConfig />
          </RequireAuth>
        )
      },
      {
        path: 'sales/select/:performanceId',
        element: <SeatSelector />
      },
      {
        path: 'sales/order/:orderId',
        element: <OrderDetail />
      },
      {
        path: 'device/management',
        element: (
          <RequireAuth allowedRoles={['venue_admin']}>
            <DeviceManagement />
          </RequireAuth>
        )
      },
      {
        path: 'device/schedule',
        element: (
          <RequireAuth allowedRoles={['venue_admin']}>
            <DeviceSchedule />
          </RequireAuth>
        )
      },
      {
        path: 'settlement/stats',
        element: (
          <RequireAuth allowedRoles={['venue_admin', 'finance', 'organizer']}>
            <SalesStats />
          </RequireAuth>
        )
      },
      {
        path: 'settlement/list',
        element: (
          <RequireAuth allowedRoles={['venue_admin', 'finance', 'organizer']}>
            <SettlementList />
          </RequireAuth>
        )
      },
      {
        path: 'system/users',
        element: (
          <RequireAuth allowedRoles={['venue_admin']}>
            <UserManagement />
          </RequireAuth>
        )
      }
    ]
  },
  {
    path: '*',
    element: <NotFound />
  }
])
