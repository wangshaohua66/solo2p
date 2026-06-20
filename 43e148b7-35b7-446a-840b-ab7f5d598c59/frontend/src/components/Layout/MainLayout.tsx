import { Outlet } from 'react-router-dom'
import { Layout } from 'antd'
import AppSider from './AppSider'
import AppHeader from './AppHeader'
import { useAppStore } from '@/store'

const { Content } = Layout

export default function MainLayout() {
  const collapsed = useAppStore((state: { collapsed: boolean }) => state.collapsed)
  return (
    <Layout className="app-layout">
      <AppSider />
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <AppHeader />
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
