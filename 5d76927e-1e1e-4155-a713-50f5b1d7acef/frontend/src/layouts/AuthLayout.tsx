import React from 'react'
import { Outlet, Navigate } from 'react-router-dom'

const AuthLayout: React.FC = () => {
  const token = localStorage.getItem('heritage_token')

  if (token) {
    return <Navigate to="/" replace />
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: 24,
      }}
      className="heritage-pattern"
    >
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 className="gradient-text" style={{ fontSize: 32, marginBottom: 8 }}>
            非遗数字化保护平台
          </h1>
          <p style={{ color: '#a0a0a0', fontSize: 14 }}>
            Intangible Cultural Heritage Digital Protection Platform
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}

export default AuthLayout
