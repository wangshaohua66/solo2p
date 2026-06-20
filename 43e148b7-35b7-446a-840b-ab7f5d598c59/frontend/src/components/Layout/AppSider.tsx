import { Layout, Menu } from 'antd'
import {
  ProjectOutlined,
  UnorderedListOutlined,
  AuditOutlined,
  EditOutlined,
  FileDoneOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store'
import { UserRole } from '@/types'

const { Sider } = Layout

export default function AppSider() {
  const navigate = useNavigate()
  const location = useLocation()
  const collapsed = useAppStore((state) => state.collapsed)
  const user = useAppStore((state) => state.user)

  const menuItems = [
    {
      key: '/projects',
      icon: <ProjectOutlined />,
      label: '项目管理',
      roles: ['ADMIN', 'PROJECT_MANAGER', 'PROFESSIONAL_LEAD', 'DESIGNER', 'CLIENT'] as UserRole[],
    },
    {
      key: '/tasks',
      icon: <UnorderedListOutlined />,
      label: '任务看板',
      roles: ['ADMIN', 'PROJECT_MANAGER', 'PROFESSIONAL_LEAD', 'DESIGNER'] as UserRole[],
    },
    {
      key: '/reviews',
      icon: <AuditOutlined />,
      label: '校审中心',
      roles: ['ADMIN', 'PROJECT_MANAGER', 'PROFESSIONAL_LEAD', 'DESIGNER'] as UserRole[],
    },
    {
      key: '/changes',
      icon: <EditOutlined />,
      label: '变更管理',
      roles: ['ADMIN', 'PROJECT_MANAGER', 'PROFESSIONAL_LEAD', 'DESIGNER', 'CLIENT'] as UserRole[],
    },
    {
      key: '/versions',
      icon: <FileDoneOutlined />,
      label: '版本管理',
      roles: ['ADMIN', 'PROJECT_MANAGER', 'PROFESSIONAL_LEAD', 'DESIGNER'] as UserRole[],
    },
    {
      key: '/client',
      icon: <CustomerServiceOutlined />,
      label: '客户门户',
      roles: ['ADMIN', 'PROJECT_MANAGER', 'CLIENT'] as UserRole[],
    },
  ]

  const filteredItems = menuItems.filter((item) => user && item.roles.includes(user.role))

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      className="app-sider"
      width={200}
    >
      <div className="app-logo">
        {collapsed ? '设' : '设计院协同系统'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname.startsWith('/projects/') ? '/projects' : location.pathname]}
        items={filteredItems}
        onClick={handleMenuClick}
      />
    </Sider>
  )
}
