import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import MainLayout from '@/layouts/MainLayout'
import Login from '@/pages/Login'
import DeviceList from '@/pages/DeviceList'
import InspectionBoard from '@/pages/InspectionBoard'
import HazardList from '@/pages/HazardList'
import Statistics from '@/pages/Statistics'
import SystemSettings from '@/pages/SystemSettings'

const { Content } = Layout

function App() {
  const { token, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          token ? (
            <MainLayout />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<Navigate to="/devices" replace />} />
        <Route path="devices" element={<DeviceList />} />
        <Route path="inspections" element={<InspectionBoard />} />
        <Route path="hazards" element={<HazardList />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="settings" element={<SystemSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
