import { Layout, Button, Dropdown, Avatar, Space, Breadcrumb } from 'antd'
import { MenuUnfoldOutlined, MenuFoldOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store'
import { userApi } from '@/api/user'
import { message } from 'antd'

const { Header } = Layout

const roleMap: Record<string, string> = {
  ADMIN: '系统管理员',
  PROJECT_MANAGER: '项目经理',
  PROFESSIONAL_LEAD: '专业负责人',
  DESIGNER: '设计师',
  CLIENT: '客户',
}

const breadcrumbMap: Record<string, string[]> = {
  '/projects': ['项目管理'],
  '/tasks': ['任务看板'],
  '/reviews': ['校审中心'],
  '/changes': ['变更管理'],
  '/versions': ['版本管理'],
  '/client': ['客户门户'],
}

export default function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const collapsed = useAppStore((state) => state.collapsed)
  const toggleCollapsed = useAppStore((state) => state.toggleCollapsed)
  const user = useAppStore((state) => state.user)
  const currentProject = useAppStore((state) => state.currentProject)
  const logout = useAppStore((state) => state.logout)

  const handleLogout = async () => {
    try {
      await userApi.logout()
    } catch (e) {
    }
    logout()
    message.success('退出成功')
    navigate('/login')
  }

  const getBreadcrumb = () => {
    const basePath = Object.keys(breadcrumbMap).find((p) => location.pathname.startsWith(p))
    const items = basePath ? [...breadcrumbMap[basePath]] : []
    if (location.pathname.startsWith('/projects/') && currentProject) {
      items.push(currentProject.name)
    }
    return items
  }

  const userMenuItems: any[] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: `${user?.name} (${roleMap[user?.role || ''] || ''})`,
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <Header className="app-header">
      <Space>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={toggleCollapsed}
          style={{ fontSize: '16px', width: 64, height: 64 }}
        />
        <Breadcrumb
          items={getBreadcrumb().map((item) => ({ title: item }))}
        />
      </Space>
      <Space>
        {currentProject && (
          <span style={{ color: '#666' }}>
            当前项目：<strong>{currentProject.name}</strong>
          </span>
        )}
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer', padding: '0 8px' }}>
            <Avatar icon={<UserOutlined />} />
            <span>{user?.name}</span>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  )
}
