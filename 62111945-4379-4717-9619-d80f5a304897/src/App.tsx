import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Spin } from 'antd'
import { Routes, Route, Navigate } from 'react-router-dom'

import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import { RootState } from './store'
import { UserRole } from './types'

const App = () => {
  const [loading, setLoading] = useState(true)
  const token = useSelector((state: RootState) => state.auth.token)
  const role = useSelector((state: RootState) => state.auth.role)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="系统加载中..." />
      </div>
    )
  }

  if (!token) {
    return <Login />
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/*" element={<MainLayout role={role as UserRole} />} />
    </Routes>
  )
}

export default App
