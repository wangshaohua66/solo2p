import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import MainLayout from '@/layouts/MainLayout'
import AuthLayout from '@/layouts/AuthLayout'
import AdminLayout from '@/layouts/AdminLayout'

const Home = lazy(() => import('@/pages/Home'))
const HeritageList = lazy(() => import('@/pages/HeritageList'))
const HeritageDetail = lazy(() => import('@/pages/HeritageDetail'))
const InheritorProfile = lazy(() => import('@/pages/InheritorProfile'))
const BookingCalendar = lazy(() => import('@/pages/BookingCalendar'))
const Exhibition = lazy(() => import('@/pages/Exhibition'))
const VirtualExhibition = lazy(() => import('@/pages/VirtualExhibition'))
const Login = lazy(() => import('@/pages/Login'))
const Register = lazy(() => import('@/pages/Register'))
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const AdminHeritages = lazy(() => import('@/pages/admin/Heritages'))
const AdminInheritors = lazy(() => import('@/pages/admin/Inheritors'))
const AdminBookings = lazy(() => import('@/pages/admin/Bookings'))
const AdminTraining = lazy(() => import('@/pages/admin/Training'))
const AdminUsers = lazy(() => import('@/pages/admin/Users'))
const AdminReports = lazy(() => import('@/pages/admin/Reports'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const Profile = lazy(() => import('@/pages/Profile'))

const Loading: React.FC = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: '#1a1a2e',
  }}>
    <Spin size="large" />
  </div>
)

const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/auth" element={<AuthLayout />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="" element={<Navigate to="/auth/login" replace />} />
        </Route>

        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="heritages" element={<HeritageList />} />
          <Route path="heritages/:id" element={<HeritageDetail />} />
          <Route path="inheritors/:id" element={<InheritorProfile />} />
          <Route path="booking" element={<BookingCalendar />} />
          <Route path="exhibition" element={<Exhibition />} />
          <Route path="exhibition/virtual" element={<VirtualExhibition />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="heritages" element={<AdminHeritages />} />
          <Route path="inheritors" element={<AdminInheritors />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="training" element={<AdminTraining />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="reports" element={<AdminReports />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default AppRouter
