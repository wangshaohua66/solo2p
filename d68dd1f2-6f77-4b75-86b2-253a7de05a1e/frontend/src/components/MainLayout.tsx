import React, { useState } from 'react';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Button,
  Badge,
  Drawer,
  theme,
  Tooltip,
  Space
} from 'antd';
import {
  DashboardOutlined,
  InboxOutlined,
  OrderedListOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  TeamOutlined,
  SettingOutlined,
  BulbOutlined,
  BulbFilled,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  BellOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { isMobile } from '@/utils/device';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  {
    key: '/intake',
    icon: <InboxOutlined />,
    label: '进店登记',
    badge: true
  },
  {
    key: '/work-orders',
    icon: <OrderedListOutlined />,
    label: '工单管理'
  },
  {
    key: '/parts',
    icon: <ShoppingOutlined />,
    label: '配件库存'
  },
  {
    key: '/movements',
    icon: <ClockCircleOutlined />,
    label: '机芯知识库'
  },
  {
    key: '/customers',
    icon: <TeamOutlined />,
    label: '客户管理'
  },
  {
    key: '/warranty',
    icon: <SafetyCertificateOutlined />,
    label: '质保追踪'
  },
  {
    key: '/reports',
    icon: <FileTextOutlined />,
    label: '报告中心'
  }
];

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const {
    sidebarCollapsed,
    toggleSidebar,
    themeMode,
    toggleTheme,
    setSidebarCollapsed
  } = useUIStore();
  const { token } = theme.useToken();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedKeys = [location.pathname.startsWith('/work-orders/') ? '/work-orders' : location.pathname];
  const openKeys = [];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    if (isMobile()) {
      setDrawerOpen(false);
    }
  };

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人设置' },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout();
        navigate('/login');
      }
    }
  ];

  const sidebarWidth = sidebarCollapsed ? 80 : 240;

  const SidebarContent = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: sidebarCollapsed ? 8 : 16,
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div
          style={{
            color: '#fff',
            fontSize: sidebarCollapsed ? 20 : 18,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden'
          }}
        >
          {sidebarCollapsed ? '⌚' : '⌚ 钟表匠工作室'}
        </div>
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={selectedKeys}
        defaultOpenKeys={openKeys}
        onClick={handleMenuClick}
        items={menuItems.map((item) => ({
          key: item.key,
          icon: item.icon,
          label: (
            <span>
              {item.label}
              {item.badge && (
                <Badge
                  dot
                  status="processing"
                  style={{ marginLeft: 8 }}
                />
              )}
            </span>
          )
        }))}
        style={{
          flex: 1,
          borderRight: 0,
          paddingTop: 8
        }}
        inlineCollapsed={sidebarCollapsed}
      />

      <div
        style={{
          padding: 12,
          borderTop: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        {!sidebarCollapsed && (
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            v1.0.0
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile() ? (
        <Sider
          trigger={null}
          collapsible
          collapsed={sidebarCollapsed}
          width={240}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'sticky',
            top: 0,
            left: 0,
            transition: 'all 200ms ease'
          }}
        >
          {SidebarContent}
        </Sider>
      ) : (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={240}
          styles={{ body: { padding: 0, background: '#001529' } }}
          maskClosable
        >
          {SidebarContent}
        </Drawer>
      )}

      <Layout>
        <Header
          style={{
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}
        >
          <Space size="middle">
            <Button
              type="text"
              icon={isMobile() ? <MenuUnfoldOutlined /> : sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() =>
                isMobile() ? setDrawerOpen(true) : toggleSidebar()
              }
              style={{ fontSize: '16px', width: 48, height: 48 }}
            />
          </Space>

          <Space size="large">
            <Tooltip title={themeMode === 'light' ? '切换深色模式' : '切换浅色模式'}>
              <Button
                type="text"
                icon={themeMode === 'light' ? <BulbOutlined /> : <BulbFilled />}
                onClick={toggleTheme}
                style={{ fontSize: '16px', width: 40, height: 40 }}
              />
            </Tooltip>

            <Tooltip title="消息通知">
              <Badge count={3} size="small">
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  style={{ fontSize: '16px', width: 40, height: 40 }}
                />
              </Badge>
            </Tooltip>

            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              arrow
            >
              <Space
                style={{ cursor: 'pointer', padding: '0 8px' }}
                size="middle"
              >
                <Avatar
                  style={{ backgroundColor: token.colorPrimary }}
                  icon={<UserOutlined />}
                />
                <span
                  style={{
                    fontWeight: 500,
                    color: token.colorText
                  }}
                  className="desktop-only"
                >
                  {user?.realName || user?.username}
                </span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: 0,
            padding: '16px 24px 24px',
            background: token.colorBgLayout,
            minHeight: 'calc(100vh - 64px)'
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
