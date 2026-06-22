import { Layout, Menu, Avatar, Dropdown, Badge } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  CalendarOutlined,
  FileTextOutlined,
  UserOutlined,
  ShoppingCartOutlined,
  BarChartOutlined,
  BellOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import './MainLayout.scss'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '首页' },
  { key: '/appointment', icon: <CalendarOutlined />, label: '预约管理' },
  { key: '/medical', icon: <FileTextOutlined />, label: '诊疗中心' },
  { key: '/patients', icon: <UserOutlined />, label: '患者档案' },
  { key: '/consumable', icon: <ShoppingCartOutlined />, label: '耗材管理' },
  { key: '/statistics', icon: <BarChartOutlined />, label: '数据统计' },
]

function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人中心' },
    { key: 'settings', icon: <SettingOutlined />, label: '设置' },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      navigate('/login')
    }
  }

  return (
    <Layout className="main-layout">
      <Sider width={220} className="layout-sider">
        <div className="logo">
          <span className="logo-text">口腔医疗管理</span>
        </div>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header className="layout-header">
          <div className="header-left">
            <span className="page-title">
              {menuItems.find(item => item.key === location.pathname)?.label || '首页'}
            </span>
          </div>
          <div className="header-right">
            <Badge count={5} size="small">
              <BellOutlined className="header-icon" />
            </Badge>
            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
              <div className="user-info">
                <Avatar size="small" icon={<UserOutlined />} />
                <span className="username">张医生</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="layout-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
