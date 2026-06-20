import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Badge, Typography } from 'antd';
import {
  DashboardOutlined,
  SoundOutlined,
  DollarCircleOutlined,
  AlertOutlined,
  LogoutOutlined,
  UserOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout } from '@/store/appSlice';
import { UserRoleNames } from '@/types';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { user, notifications } = useAppSelector((s) => s.app);

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '数据看板' },
    { key: '/works', icon: <SoundOutlined />, label: '作品管理' },
    { key: '/royalty', icon: <DollarCircleOutlined />, label: '版税结算' },
    { key: '/monitor', icon: <AlertOutlined />, label: '盗版监控' },
  ];

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  const userMenu = {
    items: [
      { key: 'info', icon: <UserOutlined />, label: `${user?.real_name || '用户'} (${UserRoleNames[user?.role || 'artist']})`, disabled: true },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
    ],
  };

  const logoText = collapsed ? 'L' : 'LabelOps';

  return (
    <Layout style={{ minHeight: '100vh' }} className="app-shell">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        style={{
          borderRight: '1px solid #2A2312',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #2A2312',
            marginBottom: 16,
          }}
        >
          <span className="gold-gradient-text" style={{ fontSize: collapsed ? 24 : 22, fontWeight: 800, letterSpacing: 2 }}>
            {logoText}
          </span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 'none' }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 0,
            right: 0,
            padding: '0 16px',
          }}
        >
          <Text type="secondary" style={{ fontSize: 11, opacity: 0.5 }}>
            v1.0.0 © LabelOps Music
          </Text>
        </div>
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#151208',
            borderBottom: '1px solid #2A2312',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, color: '#D4AF37' }}
            />
            <div>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#E8D8A0' }}>
                {menuItems.find((m) => m.key === location.pathname)?.label || '控制台'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Dropdown
              menu={{
                items: (notifications && notifications.length > 0)
                  ? notifications.map((n, idx) => ({
                      key: idx,
                      label: n.message,
                    }))
                  : [{ key: 'empty', label: '暂无通知', disabled: true }],
              }}
              placement="bottomRight"
            >
              <Badge count={notifications?.length || 0} size="small" offset={[-2, 4]}>
                <Button type="text" style={{ color: '#D4AF37' }}>
                  <BellOutlined style={{ fontSize: 18 }} />
                </Button>
              </Badge>
            </Dropdown>
            <Dropdown menu={userMenu} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <Avatar style={{ background: 'linear-gradient(135deg, #D4AF37, #8B6914)', fontWeight: 600 }}>
                  {(user?.real_name || 'U').charAt(0)}
                </Avatar>
                <div style={{ lineHeight: 1.2 }} className="hide-on-tablet">
                  <div style={{ fontSize: 13, color: '#E8D8A0', fontWeight: 500 }}>{user?.real_name || '用户'}</div>
                  <div style={{ fontSize: 11, color: '#8B7A4A' }}>{UserRoleNames[user?.role || 'artist']}</div>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content
          style={{
            margin: 0,
            padding: 20,
            background: '#0F0D06',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
