import React, { useState, useEffect, useMemo } from 'react';
import {
  Layout,
  Menu,
  Breadcrumb,
  Avatar,
  Dropdown,
  Button,
  Space,
  Badge,
  Tooltip,
  Typography,
  message,
  Modal,
} from 'antd';
import {
  DashboardOutlined,
  BellOutlined,
  HistoryOutlined,
  TeamOutlined,
  SettingOutlined,
  LogoutOutlined,
  SwapOutlined,
  WifiOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  MonitorOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Outlet, useNavigate, useLocation, matchRoutes } from 'react-router-dom';
import dayjs from 'dayjs';
import { useMonitorStore } from '@/stores/monitorStore';
import { useDutyStore } from '@/stores/dutyStore';
import { routes, AppRouteObject } from '@/router';

const { Sider, Header, Content, Footer } = Layout;
const { Text, Title } = Typography;

// 班次中文映射
const SHIFT_MAP: Record<string, string> = {
  morning: '早班 (08:00-16:00)',
  afternoon: '中班 (16:00-24:00)',
  night: '夜班 (00:00-08:00)',
};

// 侧边栏菜单项类型
interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  children?: MenuItem[];
}

// 全局布局组件
const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 从store订阅状态
  const { summary, alarms, websocketConnected } = useMonitorStore();
  const { currentUser, currentShift, createHandover } = useDutyStore();

  // 当前时间
  const [currentTime, setCurrentTime] = useState(dayjs());

  // 侧边栏折叠状态
  const [collapsed, setCollapsed] = useState(false);

  // 交接班模态框
  const [handoverModalVisible, setHandoverModalVisible] = useState(false);

  // 每秒更新当前时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 紧急告警数量
  const urgentAlarmCount = useMemo(() => {
    return alarms.filter((a) => a.level === 'urgent' && !a.ack).length;
  }, [alarms]);

  // 面包屑导航匹配
  const breadcrumbItems = useMemo(() => {
    const matched = matchRoutes(routes as any, location.pathname);
    if (!matched) return [{ title: '首页' }];

    const items: Array<{ title: React.ReactNode; path?: string }> = [];
    matched.forEach((match) => {
      const route = match.route as AppRouteObject;
      if (route.meta?.title) {
        items.push({
          title: route.meta.title,
        });
      }
    });
    if (items.length === 0) {
      items.unshift({ title: '首页' });
    }
    return items;
  }, [location.pathname]);

  // 当前选中的菜单项key
  const selectedMenuKey = useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) return 'dashboard';
    if (pathParts[0] === 'station') return 'dashboard';
    return pathParts[0];
  }, [location.pathname]);

  // 侧边栏菜单配置（5个一级菜单）
  const menuItems: MenuProps['items'] = [
    {
      key: 'monitor-group',
      icon: <DashboardOutlined />,
      label: '监控总览',
      children: [
        {
          key: 'dashboard',
          label: '监控总览',
        },
        {
          key: 'monitor',
          label: '多画面监控墙',
        },
      ],
    },
    {
      key: 'alarm-group',
      icon: <BellOutlined />,
      label: '告警中心',
      children: [
        {
          key: 'alarm-center',
          label: '实时告警中心',
        },
        {
          key: 'alarm-history',
          label: '告警历史记录',
        },
      ],
    },
    {
      key: 'trend-group',
      icon: <HistoryOutlined />,
      label: '历史查询',
      children: [
        {
          key: 'trend',
          label: '历史趋势分析',
        },
      ],
    },
    {
      key: 'duty-group',
      icon: <TeamOutlined />,
      label: '值班管理',
      children: [
        {
          key: 'duty',
          label: '值班排班管理',
        },
      ],
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
  ];

  // 菜单点击处理
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(`/${key}`);
  };

  // 退出登录
  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出登录',
      content: '您确定要退出当前账号吗？',
      okText: '确定退出',
      cancelText: '取消',
      onOk: () => {
        useDutyStore.setState({ currentUser: null as any });
        message.success('已退出登录');
        navigate('/login', { replace: true });
      },
    });
  };

  // 交接班处理
  const handleHandover = () => {
    try {
      createHandover();
      setHandoverModalVisible(true);
      message.info('交接班功能开发中...');
    } catch (error: any) {
      message.error(error.message || '创建交接班记录失败');
    }
  };

  // 用户下拉菜单
  const userMenuItems: MenuProps['items'] = currentUser
    ? [
        {
          key: 'profile',
          icon: <Avatar src={currentUser.avatar} size="small" />,
          label: (
            <Space>
              <span>{currentUser.name}</span>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {currentUser.role === 'operator' ? '值班操作员' : currentUser.role}
              </Text>
            </Space>
          ),
          disabled: true,
        },
        { type: 'divider' as const },
        {
          key: 'handover',
          icon: <SwapOutlined />,
          label: '交接班',
          onClick: handleHandover,
        },
        {
          key: 'logout',
          icon: <LogoutOutlined />,
          label: '退出登录',
          onClick: handleLogout,
        },
      ]
    : [];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 左侧深色侧边栏 */}
      <Sider
        width={200}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        style={{
          background: '#001529',
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
        }}
      >
        {/* Logo区域 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '0 8px' : '0 16px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <MonitorOutlined
            style={{
              fontSize: collapsed ? 24 : 28,
              color: '#1890ff',
            }}
          />
          {!collapsed && (
            <Title
              level={4}
              style={{
                color: '#fff',
                margin: 0,
                marginLeft: 12,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              广电监控系统
            </Title>
          )}
        </div>

        {/* 侧边栏菜单 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedMenuKey]}
          defaultOpenKeys={['monitor-group', 'alarm-group', 'trend-group', 'duty-group']}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            borderRight: 0,
            marginTop: 16,
          }}
        />
      </Sider>

      {/* 右侧主内容区域 */}
      <Layout
        style={{
          marginLeft: collapsed ? 80 : 200,
          transition: 'margin-left 0.2s',
        }}
      >
        {/* 顶部Header */}
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            boxShadow: '0 1px 4px rgba(0, 21, 41, 0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 9,
            height: 'auto',
            lineHeight: 'normal',
          }}
        >
          {/* 紧急告警横幅 */}
          {urgentAlarmCount > 0 && (
            <div
              style={{
                background: 'linear-gradient(90deg, #ff4d4f, #ff7875, #ff4d4f)',
                backgroundSize: '200% 100%',
                animation: 'urgentBlink 1.5s ease-in-out infinite',
                color: '#fff',
                padding: '8px 16px',
                margin: '0 -24px 12px -24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/alarm-center')}
            >
              <WarningOutlined style={{ marginRight: 8, fontSize: 18 }} />
              当前有 {urgentAlarmCount} 条紧急告警待处理，请及时查看！
              <Badge
                count={urgentAlarmCount}
                style={{ marginLeft: 12, backgroundColor: '#fff', color: '#ff4d4f' }}
              />
            </div>
          )}

          {/* Header主内容 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              height: 52,
            }}
          >
            {/* 左侧：面包屑 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Breadcrumb items={breadcrumbItems} />
            </div>

            {/* 右侧：时间 + 用户 */}
            <Space size={24}>
              {/* 当前时间 */}
              <Tooltip title={currentTime.format('YYYY-MM-DD dddd')}>
                <Space>
                  <ThunderboltOutlined style={{ color: '#1890ff' }} />
                  <Text strong style={{ fontSize: 16 }}>
                    {currentTime.format('YYYY-MM-DD HH:mm:ss')}
                  </Text>
                </Space>
              </Tooltip>

              {/* 告警提示 */}
              <Badge count={summary.currentAlarms} size="small" offset={[-2, 2]}>
                <Tooltip title={`当前告警：${summary.currentAlarms} 条`}>
                  <Button
                    type="text"
                    icon={<BellOutlined style={{ fontSize: 18 }} />}
                    onClick={() => navigate('/alarm-center')}
                  />
                </Tooltip>
              </Badge>

              {/* 用户信息下拉菜单 */}
              {currentUser && (
                <Dropdown
                  menu={{ items: userMenuItems }}
                  placement="bottomRight"
                  trigger={['click']}
                >
                  <Space
                    style={{
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: 4,
                    }}
                    onClick={(e) => e.preventDefault()}
                  >
                    <Avatar src={currentUser.avatar} size="default" />
                    <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>{currentUser.name}</span>
                  </Space>
                </Dropdown>
              )}
            </Space>
          </div>
        </Header>

        {/* 主内容区域 */}
        <Content
          style={{
            background: '#f0f2f5',
            padding: 24,
            minHeight: 'calc(100vh - 64px - 40px)',
          }}
        >
          <Outlet />
        </Content>

        {/* 底部状态栏 */}
        <Footer
          style={{
            padding: '8px 24px',
            background: '#fff',
            borderTop: '1px solid #f0f0f0',
            height: 40,
            lineHeight: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
          }}
        >
          <Space size={24}>
            {/* WebSocket连接状态 */}
            <Space size={4}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: websocketConnected ? '#52c41a' : '#ff4d4f',
                  boxShadow: websocketConnected
                    ? '0 0 6px #52c41a'
                    : '0 0 6px #ff4d4f',
                }}
              />
              <Text type={websocketConnected ? 'success' : 'danger'}>
                {websocketConnected ? 'WebSocket已连接' : 'WebSocket已断开'}
              </Text>
            </Space>

            {/* 当前布局信息 */}
            <Space size={4}>
              <MonitorOutlined />
              <Text type="secondary">
                监控布局：{summary.totalStations} 机房 / {summary.onlineStations} 在线 / {summary.totalChannels} 频道
              </Text>
            </Space>
          </Space>

          <Space size={24}>
            {/* 当前班次信息 */}
            {currentShift && (
              <Space size={4}>
                <TeamOutlined />
                <Text type="secondary">
                  当前班次：{SHIFT_MAP[currentShift.shift]}（剩余 {currentShift.hoursRemaining.toFixed(1)} 小时）
                </Text>
              </Space>
            )}
            <Text type="secondary">
              © {dayjs().year()} 广播电视监控系统 v1.0
            </Text>
          </Space>
        </Footer>
      </Layout>

      {/* 交接班确认模态框（占位） */}
      <Modal
        title="交接班确认"
        open={handoverModalVisible}
        onCancel={() => setHandoverModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setHandoverModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="confirm"
            type="primary"
            onClick={() => {
              message.success('交接班功能开发中');
              setHandoverModalVisible(false);
            }}
          >
            确认交接班
          </Button>,
        ]}
      >
        <p>详细的交接班表单功能正在开发中...</p>
      </Modal>

      {/* 紧急告警闪烁动画样式 */}
      <style>{`
        @keyframes urgentBlink {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </Layout>
  );
};

export default AppLayout;
