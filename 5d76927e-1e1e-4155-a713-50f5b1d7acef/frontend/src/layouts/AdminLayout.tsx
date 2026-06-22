import React, { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Avatar, Dropdown } from 'antd'
import {
  DashboardOutlined,
  AppstoreOutlined,
  UserOutlined,
  CalendarOutlined,
  TeamOutlined,
  FileTextOutlined,
  SolutionOutlined,
  LogoutOutlined,
  SettingOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { authApi } from '@/api/auth'
import { User, UserRole } from '@/types'

const { Header, Sider, Content } = Layout

const AdminLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('heritage_token')
    if (!token) {
      navigate('/auth/login')
      return
    }
    authApi.getCurrentUser().then((res) => {
      if (res.data) {
        setUser(res.data)
        const isAdmin = res.data.roles?.some(
          (r) => r === UserRole.ADMIN || r === UserRole.STAFF
        )
        if (!isAdmin) {
          navigate('/')
        }
      }
    })
  }, [navigate])

  const handleLogout = () => {
    authApi.logout()
    navigate('/auth/login')
  }

  const menuItems: MenuProps['items'] = [
    { key: '/admin', icon: <DashboardOutlined />, label: <Link to="/admin">数据概览</Link> },
    { key: '/admin/heritages', icon: <AppstoreOutlined />, label: <Link to="/admin/heritages">非遗项目管理</Link> },
    { key: '/admin/inheritors', icon: <UserOutlined />, label: <Link to="/admin/inheritors">传承人管理</Link> },
    { key: '/admin/bookings', icon: <CalendarOutlined />, label: <Link to="/admin/bookings">研学预约管理</Link> },
    { key: '/admin/training', icon: <SolutionOutlined />, label: <Link to="/admin/training">传承培养管理</Link> },
    { key: '/admin/users', icon: <TeamOutlined />, label: <Link to="/admin/users">用户管理</Link> },
    { key: '/admin/reports', icon: <FileTextOutlined />, label: <Link to="/admin/reports">统计报表</Link> },
  ]

  const userMenuItems: MenuProps['items'] = [
    { key: 'home', icon: <AppstoreOutlined />, label: '返回前台' },
    { key: 'settings', icon: <SettingOutlined />, label: '账户设置' },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
  ]

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    switch (key) {
      case 'home':
        navigate('/')
        break
      case 'settings':
        navigate('/profile')
        break
      case 'logout':
        handleLogout()
        break
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#c8a96e',
            fontSize: collapsed ? 14 : 16,
            fontWeight: 600,
            borderBottom: '1px solid #2d3a4f',
            padding: '0 16px',
          }}
        >
          {collapsed ? '非遗' : '非遗管理后台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ borderRight: 'none' }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #2d3a4f',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, width: 64, height: 64, color: '#c8a96e' }}
          />
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link to="/notifications">
              <Button type="text" icon={<BellOutlined style={{ color: '#c8a96e' }} />} />
            </Link>
            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar style={{ backgroundColor: '#c8a96e' }} icon={<UserOutlined />} src={user?.avatar} />
                <span style={{ color: '#e8e8e8' }}>{user?.realName || user?.username}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ padding: 24, background: '#1a1a2e', minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AdminLayout
