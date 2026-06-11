import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Badge, Button, Breadcrumb } from 'antd';
import {
  Calendar,
  TrendingUp,
  Package,
  Users,
  BarChart3,
  Wrench,
  AlertTriangle,
  Settings,
  Flame,
  Bell,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Sider, Header, Content } = Layout;

const NAV_ITEMS = [
  { key: '/schedule', icon: Calendar, label: '窑炉排程' },
  { key: '/curves', icon: TrendingUp, label: '温度曲线' },
  { key: '/inventory', icon: Package, label: '原料库存' },
  { key: '/members', icon: Users, label: '会员管理' },
  { key: '/reports', icon: BarChart3, label: '成本报表' },
  { key: '/equipment', icon: Wrench, label: '设备档案' },
  { key: '/incidents', icon: AlertTriangle, label: '事故追溯' },
  { key: '/settings', icon: Settings, label: '系统设置' },
];

const BREADCRUMB_MAP: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.key, item.label]),
);

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth < 1440);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const selectedKey = '/' + location.pathname.split('/').filter(Boolean)[0];

  const breadcrumbItems = [
    { title: '首页' },
    ...(selectedKey && selectedKey !== '/'
      ? [{ title: BREADCRUMB_MAP[selectedKey] || '' }]
      : []),
  ];

  return (
    <Layout className="app-layout" style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        collapsedWidth={80}
        style={{
          background: '#2D2D2D',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '0' : '0 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Flame
            size={28}
            color="#E8602C"
            style={{ flexShrink: 0 }}
          />
          {!collapsed && (
            <span
              style={{
                color: '#fff',
                fontSize: 18,
                fontWeight: 600,
                marginLeft: 12,
                whiteSpace: 'nowrap',
              }}
            >
              玻璃工坊
            </span>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
          style={{
            background: 'transparent',
            borderRight: 'none',
          }}
          items={NAV_ITEMS.map((item) => ({
            key: item.key,
            icon: <item.icon size={18} />,
            label: item.label,
          }))}
        />
      </Sider>

      <Layout
        style={{
          marginLeft: collapsed ? 80 : 240,
          transition: 'margin-left 0.2s',
          background: '#F7F5F2',
        }}
      >
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <Breadcrumb items={breadcrumbItems} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Badge count={3} size="small">
              <Bell size={20} color="#2D2D2D" style={{ cursor: 'pointer' }} />
            </Badge>
            <Avatar
              style={{
                backgroundColor: '#E8602C',
                cursor: 'pointer',
              }}
            >
              管
            </Avatar>
          </div>
        </Header>

        <Content
          style={{
            padding: 24,
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
