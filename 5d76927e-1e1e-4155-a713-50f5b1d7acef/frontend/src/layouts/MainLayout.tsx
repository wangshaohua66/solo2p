import React, { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Badge, Avatar, Dropdown, Drawer } from 'antd'
import {
  HomeOutlined,
  AppstoreOutlined,
  UserOutlined,
  CalendarOutlined,
  EyeOutlined,
  BellOutlined,
  MenuOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { authApi } from '@/api/auth'
import { User } from '@/types'

const { Header, Content, Footer } = Layout

const MainLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<User | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('heritage_token')
    if (token) {
      authApi.getCurrentUser().then((res) => {
        if (res.data) setUser(res.data)
      })
      authApi.getUnreadCount().then((res) => {
        if (res.data) setUnreadCount(res.data)
      })
    }
  }, [])

  const handleLogout = () => {
    authApi.logout()
    navigate('/auth/login')
  }

  const menuItems: MenuProps['items'] = [
    { key: '/', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
    { key: '/heritages', icon: <AppstoreOutlined />, label: <Link to="/heritages">非遗项目</Link> },
    { key: '/booking', icon: <CalendarOutlined />, label: <Link to="/booking">研学预约</Link> },
    { key: '/exhibition', icon: <EyeOutlined />, label: <Link to="/exhibition">数字展厅</Link> },
  ]

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: '个人中心' },
    { key: 'notifications', icon: <BellOutlined />, label: `消息通知 (${unreadCount})` },
    { key: 'settings', icon: <SettingOutlined />, label: '账户设置' },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
  ]

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    switch (key) {
      case 'profile':
        navigate('/profile')
        break
      case 'notifications':
        navigate('/notifications')
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
    <Layout style={{ minHeight: '100vh' }} className="heritage-pattern">
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          borderBottom: '1px solid #2d3a4f',
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: '#c8a96e',
            marginRight: 48,
            whiteSpace: 'nowrap',
          }}
        >
          非遗数字化保护平台
        </div>

        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{
            flex: 1,
            borderBottom: 'none',
            background: 'transparent',
            display: 'none',
          }}
          className="desktop-menu"
        />

        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setMobileOpen(true)}
          style={{ display: 'none', color: '#c8a96e' }}
          className="mobile-menu-btn"
        />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/notifications">
            <Badge count={unreadCount} size="small">
              <Button type="text" icon={<BellOutlined style={{ color: '#c8a96e' }} />} />
            </Badge>
          </Link>

          {user ? (
            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar style={{ backgroundColor: '#c8a96e' }} icon={<UserOutlined />} src={user.avatar} />
                <span style={{ color: '#e8e8e8' }}>{user.realName || user.username}</span>
              </div>
            </Dropdown>
          ) : (
            <Button type="primary" onClick={() => navigate('/auth/login')}>
              登录
            </Button>
          )}
        </div>
      </Header>

      <Drawer
        title="菜单"
        placement="left"
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key)
            setMobileOpen(false)
          }}
          style={{ borderRight: 'none' }}
        />
      </Drawer>

      <Content style={{ padding: '24px', maxWidth: 1440, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </Content>

      <Footer style={{ textAlign: 'center', background: '#0f3460', color: '#a0a0a0', borderTop: '1px solid #2d3a4f' }}>
        非物质文化遗产数字化保护中心 ©{new Date().getFullYear()} 版权所有
      </Footer>

      <style>{`
        @media (min-width: 769px) {
          .desktop-menu { display: flex !important; }
          .mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 768px) {
          .desktop-menu { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </Layout>
  )
}

export default MainLayout
