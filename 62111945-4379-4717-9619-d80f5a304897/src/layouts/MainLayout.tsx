import { useState, useEffect } from 'react'
import { Layout, Menu, Dropdown, Avatar, Badge, Button, Space, Breadcrumb } from 'antd'
import {
  HomeOutlined,
  CalendarOutlined,
  ShopOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  BarChartOutlined,
  BellOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyOutlined,
  UserAddOutlined,
  SwapOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '@/store'
import { logout, setRole } from '@/store/slices/authSlice'
import { UserRole } from '@/types'
import type { MenuProps } from 'antd'

import Home from '@/pages/Home'
import RecruitmentList from '@/pages/recruitment/List'
import RecruitmentDetail from '@/pages/recruitment/Detail'
import RecruitmentCreate from '@/pages/recruitment/Create'
import JobList from '@/pages/job/List'
import JobDetail from '@/pages/job/Detail'
import JobManage from '@/pages/job/Manage'
import ResumeList from '@/pages/resume/List'
import ResumeDetail from '@/pages/resume/Detail'
import ApplicationList from '@/pages/resume/Applications'
import InterviewList from '@/pages/interview/List'
import InterviewRoom from '@/pages/interview/Room'
import Dashboard from '@/pages/dashboard/Dashboard'
import MessageCenter from '@/pages/message/Index'
import Settings from '@/pages/settings/Index'

import './MainLayout.css'

const { Header, Sider, Content } = Layout

interface MainLayoutProps {
  role: UserRole
}

const MainLayout = ({ role }: MainLayoutProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const [collapsed, setCollapsed] = useState(false)
  const userInfo = useSelector((state: RootState) => state.auth.userInfo)
  const messageCount = useSelector((state: RootState) => state.app.messageCount)

  const getMenuItems = (): MenuProps['items'] => {
    const baseItems: MenuProps['items'] = [
      {
        key: '/home',
        icon: <HomeOutlined />,
        label: '首页'
      },
      {
        key: '/recruitment',
        icon: <CalendarOutlined />,
        label: '招聘会'
      },
      {
        key: '/jobs',
        icon: <ShopOutlined />,
        label: '职位招聘'
      }
    ]

    if (role === UserRole.JOBSEEKER) {
      return [
        ...baseItems,
        {
          key: '/resume',
          icon: <FileTextOutlined />,
          label: '我的简历'
        },
        {
          key: '/applications',
          icon: <FileTextOutlined />,
          label: '投递记录'
        },
        {
          key: '/interviews',
          icon: <VideoCameraOutlined />,
          label: '面试安排'
        }
      ]
    }

    if (role === UserRole.ENTERPRISE) {
      return [
        ...baseItems,
        {
          key: '/job-manage',
          icon: <ShopOutlined />,
          label: '岗位管理'
        },
        {
          key: '/interviews',
          icon: <VideoCameraOutlined />,
          label: '面试管理'
        }
      ]
    }

    if (role === UserRole.ADMIN) {
      return [
        ...baseItems,
        {
          key: '/dashboard',
          icon: <BarChartOutlined />,
          label: '数据看板'
        },
        {
          key: '/recruitment/create',
          icon: <CalendarOutlined />,
          label: '创建招聘会'
        }
      ]
    }

    return baseItems
  }

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const handleRoleSwitch = (newRole: UserRole) => {
    dispatch(setRole(newRole))
    navigate('/home')
  }

  const roleMenuItems: MenuProps['items'] = [
    {
      key: UserRole.JOBSEEKER,
      icon: <UserAddOutlined />,
      label: '求职者端'
    },
    {
      key: UserRole.ENTERPRISE,
      icon: <ShopOutlined />,
      label: '企业端'
    },
    {
      key: UserRole.ADMIN,
      icon: <SafetyOutlined />,
      label: '管理员端'
    }
  ]

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心'
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '账号设置',
      onClick: () => navigate('/settings')
    },
    {
      type: 'divider' as const
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ]

  const getRoleName = (r: UserRole) => {
    switch (r) {
      case UserRole.ADMIN: return '管理员'
      case UserRole.ENTERPRISE: return '企业HR'
      case UserRole.JOBSEEKER: return '求职者'
      default: return ''
    }
  }

  const getBreadcrumb = () => {
    const pathMap: Record<string, string> = {
      '/home': '首页',
      '/recruitment': '招聘会',
      '/recruitment/create': '创建招聘会',
      '/jobs': '职位招聘',
      '/job-manage': '岗位管理',
      '/resume': '我的简历',
      '/applications': '投递记录',
      '/interviews': '面试安排',
      '/dashboard': '数据看板',
      '/messages': '消息中心',
      '/settings': '账号设置'
    }
    
    const pathname = location.pathname
    const crumbs = [{ title: '首页', href: '/home' }]
    
    if (pathname !== '/home' && pathMap[pathname]) {
      crumbs.push({ title: pathMap[pathname] })
    }
    
    if (pathname.startsWith('/recruitment/') && pathname !== '/recruitment/create') {
      crumbs.push({ title: '招聘会详情' })
    }
    
    if (pathname.startsWith('/jobs/') && pathname !== '/jobs') {
      crumbs.push({ title: '职位详情' })
    }
    
    return crumbs
  }

  const selectedKey = (() => {
    if (location.pathname.startsWith('/recruitment/') && location.pathname !== '/recruitment/create') {
      return '/recruitment'
    }
    if (location.pathname.startsWith('/jobs/')) {
      return '/jobs'
    }
    if (location.pathname.startsWith('/resume/')) {
      return '/resume'
    }
    return location.pathname
  })()

  return (
    <Layout className="main-layout">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="layout-sider"
        width={220}
      >
        <div className="logo">
          {collapsed ? '人才' : '人才市场服务平台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={getMenuItems()}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header className="layout-header">
          <div className="header-left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="collapse-btn"
            />
            <Breadcrumb items={getBreadcrumb()} className="breadcrumb" />
          </div>
          <div className="header-right">
            <Space size="middle">
              <Dropdown menu={{ items: roleMenuItems, onClick: ({ key }) => handleRoleSwitch(key as UserRole) }}>
                <Button className="role-switch-btn" icon={<SwapOutlined />}>
                  {getRoleName(role)}端
                </Button>
              </Dropdown>
              <Badge count={messageCount} offset={[-2, 2]}>
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  className="message-btn"
                  onClick={() => navigate('/messages')}
                />
              </Badge>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Space className="user-info">
                  <Avatar icon={<UserOutlined />} src={userInfo?.avatar} />
                  <span className="username">{userInfo?.name || '用户'}</span>
                </Space>
              </Dropdown>
            </Space>
          </div>
        </Header>
        <Content className="layout-content">
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/recruitment" element={<RecruitmentList />} />
            <Route path="/recruitment/:id" element={<RecruitmentDetail />} />
            <Route path="/recruitment/create" element={<RecruitmentCreate />} />
            <Route path="/jobs" element={<JobList />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/job-manage" element={<JobManage />} />
            <Route path="/resume" element={<ResumeList />} />
            <Route path="/resume/:id" element={<ResumeDetail />} />
            <Route path="/applications" element={<ApplicationList />} />
            <Route path="/interviews" element={<InterviewList />} />
            <Route path="/interviews/:id" element={<InterviewRoom />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/messages" element={<MessageCenter />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
