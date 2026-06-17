import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate, useMatch } from 'react-router-dom'
import { Layout, Menu, theme, Avatar, Dropdown, Badge, Drawer, Button } from 'antd'
import {
  CalendarOutlined,
  FileAddOutlined,
  CheckCircleOutlined,
  TableOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  ScheduleOutlined,
  BarChartOutlined,
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuOutlined,
  BellOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { logout } from '@/store/authSlice'
import { UserRole } from '@/types'

const { Header, Sider, Content } = Layout

type MenuItem = Exclude<MenuProps['items'], undefined>[number]

const menuItems = (role: UserRole): MenuProps['items'] => {
  const performanceChildren: MenuItem[] = [
    { key: '/performance/calendar', icon: <CalendarOutlined />, label: '演出日历' },
    { key: '/performance/application', icon: <FileAddOutlined />, label: '演出申请' }
  ]

  if (role === UserRole.VENUE_ADMIN) {
    performanceChildren.push({
      key: '/performance/approval',
      icon: <CheckCircleOutlined />,
      label: '演出审批'
    })
  }

  const items: MenuProps['items'] = [
    {
      key: 'performance',
      icon: <CalendarOutlined />,
      label: '演出管理',
      children: performanceChildren
    }
  ]

  if (role === UserRole.VENUE_ADMIN) {
    items.push(
      {
        key: 'venue',
        icon: <TableOutlined />,
        label: '座位配置',
        children: [{ key: '/venue/seat-config', icon: <TableOutlined />, label: '座位图配置' }]
      },
      {
        key: 'device',
        icon: <ToolOutlined />,
        label: '设备调度',
        children: [
          { key: '/device/management', icon: <ToolOutlined />, label: '设备管理' },
          { key: '/device/schedule', icon: <ScheduleOutlined />, label: '设备甘特图' }
        ]
      }
    )
  }

  items.push({
    key: 'settlement',
    icon: <BarChartOutlined />,
    label: '票房统计',
    children: [
      { key: '/settlement/stats', icon: <BarChartOutlined />, label: '销售统计' },
      { key: '/settlement/list', icon: <FileTextOutlined />, label: '结算单' }
    ]
  })

  if (role === UserRole.VENUE_ADMIN) {
    items.push({
      key: 'system',
      icon: <TeamOutlined />,
      label: '系统设置',
      children: [{ key: '/system/users', icon: <TeamOutlined />, label: '用户管理' }]
    })
  }

  return items
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken()

  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((state) => state.auth)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const getSelectedKeys = () => {
    const path = location.pathname
    if (path.startsWith('/performance')) return [path]
    if (path.startsWith('/venue')) return [path]
    if (path.startsWith('/device')) return [path]
    if (path.startsWith('/settlement')) return [path]
    if (path.startsWith('/system')) return [path]
    return []
  }

  const getOpenKeys = () => {
    const path = location.pathname
    if (path.startsWith('/performance')) return ['performance']
    if (path.startsWith('/venue')) return ['venue']
    if (path.startsWith('/device')) return ['device']
    if (path.startsWith('/settlement')) return ['settlement']
    if (path.startsWith('/system')) return ['system']
    return []
  }

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
    if (isMobile) setMobileOpen(false)
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心'
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ]

  const roleLabels: Record<UserRole, string> = {
    [UserRole.VENUE_ADMIN]: '场馆管理员',
    [UserRole.ORGANIZER]: '演出主办方',
    [UserRole.FINANCE]: '财务人员',
    [UserRole.AUDIENCE]: '观众'
  }

  const menuContent = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={getSelectedKeys()}
      defaultOpenKeys={getOpenKeys()}
      items={user ? menuItems(user.role) : []}
      onClick={handleMenuClick}
    />
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile ? (
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={240}>
          <div
            style={{
              height: 64,
              margin: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: collapsed ? 14 : 18,
              fontWeight: 600,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 8
            }}
          >
            {collapsed ? '演艺' : '演艺票务系统'}
          </div>
          {menuContent}
        </Sider>
      ) : (
        <Drawer
          title="导航菜单"
          placement="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          width={240}
          styles={{ body: { padding: 0 } }}
        >
          {menuContent}
        </Drawer>
      )}
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {isMobile && (
              <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileOpen(true)} />
            )}
            <span style={{ fontSize: 16, fontWeight: 500 }}>
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Badge count={3} size="small">
              <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer'
                }}
              >
                <Avatar icon={<UserOutlined />} src={undefined} />
                <div style={{ display: isMobile ? 'none' : 'block' }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{user?.name || '用户'}</div>
                  <div style={{ fontSize: 12, color: '#909399' }}>
                    {user ? roleLabels[user.role] : ''}
                  </div>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 'calc(100vh - 160px)',
              background: colorBgContainer,
              borderRadius: borderRadiusLG
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
