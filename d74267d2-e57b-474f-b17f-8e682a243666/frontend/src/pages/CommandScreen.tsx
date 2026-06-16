import React, { useState, useEffect, useRef } from 'react';
import { Layout, Button, Tooltip, Avatar, Dropdown, MenuProps, message, Space } from 'antd';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  ReloadOutlined,
  BellOutlined,
  DashboardOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useCommandStore } from '@/store/commandStore';
import { getIncidentList, getIncidentStatistics } from '@/api/incident';
import { getTeamList } from '@/api/dispatch';
import { getWarehouseList } from '@/api/inventory';
import { getMyNotifications } from '@/api/notification';
import IncidentList from '@/components/IncidentList';
import MapContainer from '@/components/MapContainer';
import DispatchPanel from '@/components/DispatchPanel';
import InventoryPanel from '@/components/InventoryPanel';
import Timeline from '@/components/Timeline';
import NotificationToast from '@/components/NotificationToast';
import StatisticsBar from '@/components/StatisticsBar';
import { Incident, RescueTeam, Warehouse, Notification as NotificationType } from '@/types';

const { Header } = Layout;

const CommandScreen: React.FC = () => {
  const navigate = useNavigate();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dispatch' | 'inventory'>('dispatch');
  const containerRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const {
    setIncidents,
    setTeams,
    setWarehouses,
    setStatistics,
    setNotifications,
    addNotification,
  } = useCommandStore();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const notifications = await getMyNotifications(1, 5);
      notifications.forEach((n) => addNotification(n));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [incidentsRes, teamsRes, warehousesRes, statsRes, notifRes] = await Promise.all([
        getIncidentList({ pageNum: 1, pageSize: 20, statusIn: '0,1,2,3,4,5' }),
        getTeamList({ pageNum: 1, pageSize: 100 }),
        getWarehouseList({ pageNum: 1, pageSize: 100 }),
        getIncidentStatistics(),
        getMyNotifications(1, 10),
      ]);

      setIncidents(incidentsRes.list as unknown as Incident[]);
      setTeams(teamsRes.list as unknown as RescueTeam[]);
      setWarehouses(warehousesRes.list as unknown as Warehouse[]);
      setStatistics(statsRes);
      setNotifications(notifRes as unknown as NotificationType[]);
    } catch (error) {
      console.error('Failed to load data:', error);
      message.error('数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    message.success('已退出登录');
    navigate('/login', { replace: true });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <div className="app-container" ref={containerRef}>
      <Header
        style={{
          background: 'linear-gradient(to right, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          borderBottom: '1px solid #1e293b',
          padding: '0 16px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>急</span>
          </div>
          <h1
            style={{
              color: '#fff',
              fontSize: 18,
              fontWeight: 600,
              margin: 0,
              background: 'linear-gradient(90deg, #1890ff, #52c41a)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            省级应急管理指挥系统
          </h1>

          <Space style={{ marginLeft: 32 }}>
            <Button
              type="text"
              icon={<DashboardOutlined />}
              onClick={() => navigate('/')}
              style={{
                color: window.location.pathname === '/' ? '#1890ff' : 'rgba(255,255,255,0.65)',
                borderBottom: window.location.pathname === '/' ? '2px solid #1890ff' : 'none',
                borderRadius: 0,
                height: 54,
              }}
            >
              指挥大屏
            </Button>
            <Button
              type="text"
              icon={<BookOutlined />}
              onClick={() => navigate('/review')}
              style={{
                color: window.location.pathname === '/review' ? '#1890ff' : 'rgba(255,255,255,0.65)',
                borderBottom: window.location.pathname === '/review' ? '2px solid #1890ff' : 'none',
                borderRadius: 0,
                height: 54,
              }}
            >
              复盘分析
            </Button>
          </Space>

          <span
            style={{
              color: 'rgba(255, 255, 255, 0.45)',
              fontSize: 12,
              marginLeft: 8,
            }}
          >
            {new Date().toLocaleString('zh-CN')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tooltip title="刷新数据">
            <Button
              type="text"
              icon={<ReloadOutlined spin={loading} />}
              onClick={loadData}
              style={{ color: 'rgba(255, 255, 255, 0.65)' }}
            />
          </Tooltip>

          <Tooltip title="全屏">
            <Button
              type="text"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
              style={{ color: 'rgba(255, 255, 255, 0.65)' }}
            />
          </Tooltip>

          <Tooltip title="消息">
            <Button
              type="text"
              icon={<BellOutlined />}
              style={{ color: 'rgba(255, 255, 255, 0.65)', position: 'relative' }}
            />
          </Tooltip>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 8px',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Avatar
                size={32}
                icon={<UserOutlined />}
                style={{ background: 'linear-gradient(135deg, #1890ff, #096dd9)' }}
              />
              <div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>
                  {user?.realName || '用户'}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                  {user?.roles?.[0]?.name || '管理员'}
                </div>
              </div>
            </div>
          </Dropdown>
        </div>
      </Header>

      <div className="command-layout">
        <div className={`left-panel ${leftCollapsed ? 'collapsed' : ''}`}>
          <div className="panel-header">
            <div className="panel-title">
              <span>灾情事件</span>
            </div>
            <Tooltip title={leftCollapsed ? '展开' : '收起'}>
              <Button
                type="text"
                icon={<MenuFoldOutlined />}
                onClick={() => setLeftCollapsed(true)}
                style={{ color: 'rgba(255, 255, 255, 0.45)' }}
                size="small"
              />
            </Tooltip>
          </div>
          <div className="panel-content">
            <IncidentList />
          </div>
        </div>

        {leftCollapsed && (
          <Tooltip title="展开灾情面板" placement="right">
            <Button
              type="text"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setLeftCollapsed(false)}
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                color: 'rgba(255, 255, 255, 0.45)',
                background: 'rgba(15, 23, 42, 0.9)',
                borderRight: '1px solid #1e293b',
                height: 80,
                borderRadius: '0 4px 4px 0',
              }}
            />
          </Tooltip>
        )}

        <div className="center-panel">
          <StatisticsBar />
          <MapContainer />
          <NotificationToast />
        </div>

        <div className={`right-panel ${rightCollapsed ? 'collapsed' : ''}`}>
          <div className="panel-header">
            <div
              style={{
                display: 'flex',
                gap: 8,
              }}
            >
              <Button
                type={activeTab === 'dispatch' ? 'primary' : 'text'}
                size="small"
                onClick={() => setActiveTab('dispatch')}
                style={{
                  color: activeTab === 'dispatch' ? '#fff' : 'rgba(255, 255, 255, 0.65)',
                  background: activeTab === 'dispatch' ? '#1890ff' : 'transparent',
                  border: 'none',
                }}
              >
                调度方案
              </Button>
              <Button
                type={activeTab === 'inventory' ? 'primary' : 'text'}
                size="small"
                onClick={() => setActiveTab('inventory')}
                style={{
                  color: activeTab === 'inventory' ? '#fff' : 'rgba(255, 255, 255, 0.65)',
                  background: activeTab === 'inventory' ? '#1890ff' : 'transparent',
                  border: 'none',
                }}
              >
                物资调拨
              </Button>
            </div>
            <Tooltip title={rightCollapsed ? '展开' : '收起'}>
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                onClick={() => setRightCollapsed(true)}
                style={{ color: 'rgba(255, 255, 255, 0.45)' }}
                size="small"
              />
            </Tooltip>
          </div>
          <div className="panel-content">
            {activeTab === 'dispatch' ? <DispatchPanel /> : <InventoryPanel />}
          </div>
        </div>

        {rightCollapsed && (
          <Tooltip title="展开调度/物资面板" placement="left">
            <Button
              type="text"
              icon={<MenuFoldOutlined />}
              onClick={() => setRightCollapsed(false)}
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                color: 'rgba(255, 255, 255, 0.45)',
                background: 'rgba(15, 23, 42, 0.9)',
                borderLeft: '1px solid #1e293b',
                height: 80,
                borderRadius: '4px 0 0 4px',
              }}
            />
          </Tooltip>
        )}
      </div>

      <div className={`bottom-panel ${bottomCollapsed ? 'collapsed' : ''}`}>
        <div className="panel-header" style={{ borderBottom: 'none', height: 32, padding: '0 12px' }}>
          <div className="panel-title" style={{ fontSize: 14 }}>
            <span>时间轴回放</span>
          </div>
          <Tooltip title={bottomCollapsed ? '展开' : '收起'}>
            <Button
              type="text"
              onClick={() => setBottomCollapsed(true)}
              style={{ color: 'rgba(255, 255, 255, 0.45)' }}
              size="small"
            >
              收起
            </Button>
          </Tooltip>
        </div>
        <Timeline />
      </div>

      {bottomCollapsed && (
        <Tooltip title="展开时间轴" placement="top">
          <Button
            type="text"
            onClick={() => setBottomCollapsed(false)}
            style={{
              position: 'absolute',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              color: 'rgba(255, 255, 255, 0.45)',
              background: 'rgba(15, 23, 42, 0.9)',
              borderTop: '1px solid #1e293b',
              borderRadius: '4px 4px 0 0',
            }}
          >
            时间轴
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

export default CommandScreen;
