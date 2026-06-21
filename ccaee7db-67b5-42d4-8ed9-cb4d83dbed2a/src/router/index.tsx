import React from 'react';
import {
  createBrowserRouter,
  Navigate,
  RouteObject,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { Result, Button, message } from 'antd';
import {
  DashboardOutlined,
  VideoCameraOutlined,
  BellOutlined,
  HistoryOutlined,
  LineChartOutlined,
  TeamOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useDutyStore } from '@/stores/dutyStore';
import { AppLayout } from '@/components/layout';
import Dashboard from '@/pages/Dashboard';
import MonitorPanel from '@/components/MonitorPanel';
import AlarmCenter from '@/components/AlarmCenter';
import AlarmHistory from '@/pages/AlarmHistory';
import TrendChart from '@/components/TrendChart';
import DutySchedule from '@/components/DutySchedule';
import StationDetail from '@/pages/StationDetail';
import Settings from '@/pages/Settings';

// 路由元信息接口
export interface RouteMeta {
  title: string;
  icon: React.ReactNode;
  requiresAuth: boolean;
  permission?: string;
}

// 扩展RouteObject，添加meta字段
export interface AppRouteObject extends Omit<RouteObject, 'children'> {
  meta?: RouteMeta;
  children?: AppRouteObject[];
}

// 模拟登录用户数据
const MOCK_USER = {
  id: 'u001',
  name: '李建国',
  role: 'operator',
  avatar:
    'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=%E4%B8%AD%E5%B9%B4%E7%94%B7%E6%80%A7%E5%A4%B4%E5%83%8F%20%E4%B8%93%E4%B8%9A%E6%81%AC%E7%9A%84%E7%94%B5%E8%A7%86%E5%8F%B0%E5%91%98%E5%B7%A5%20%E8%93%9D%E8%89%B2%E8%A1%AC%E8%A1%AB&image_size=square',
  phone: '13800000001',
  permissions: ['monitor:view', 'alarm:handle', 'duty:handover'],
};

// 权限守卫组件
const AuthGuard: React.FC<{ children: React.ReactNode; permission?: string }> = ({
  children,
  permission,
}) => {
  const { currentUser } = useDutyStore();
  const navigate = useNavigate();
  const location = useLocation();

  // 处理模拟登录
  const handleMockLogin = () => {
    useDutyStore.setState({ currentUser: MOCK_USER });
    message.success('模拟登录成功');
    navigate(location.pathname, { replace: true });
  };

  // 未登录状态
  if (!currentUser) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#f0f2f5',
        }}
      >
        <Result
          status="warning"
          title="401"
          subTitle="您尚未登录或登录状态已过期，请先登录后再访问。"
          extra={
            <Button type="primary" onClick={handleMockLogin}>
              模拟登录
            </Button>
          }
        />
      </div>
    );
  }

  // 权限校验
  if (permission && currentUser.permissions && !currentUser.permissions.includes(permission)) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#f0f2f5',
        }}
      >
        <Result
          status="403"
          title="403"
          subTitle="您没有权限访问该页面，请联系管理员申请权限。"
          extra={
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              返回首页
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
};

// 路由配置表
export const routes: AppRouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        ),
        meta: {
          title: '监控总览',
          icon: <DashboardOutlined />,
          requiresAuth: true,
        },
      },
      {
        path: 'monitor',
        element: (
          <AuthGuard>
            <MonitorPanel />
          </AuthGuard>
        ),
        meta: {
          title: '多画面监控墙',
          icon: <VideoCameraOutlined />,
          requiresAuth: true,
          permission: 'monitor:view',
        },
      },
      {
        path: 'alarm-center',
        element: (
          <AuthGuard>
            <AlarmCenter />
          </AuthGuard>
        ),
        meta: {
          title: '告警中心',
          icon: <BellOutlined />,
          requiresAuth: true,
          permission: 'alarm:handle',
        },
      },
      {
        path: 'alarm-history',
        element: (
          <AuthGuard>
            <AlarmHistory />
          </AuthGuard>
        ),
        meta: {
          title: '告警历史',
          icon: <HistoryOutlined />,
          requiresAuth: true,
        },
      },
      {
        path: 'trend',
        element: (
          <AuthGuard>
            <TrendChart />
          </AuthGuard>
        ),
        meta: {
          title: '历史趋势',
          icon: <LineChartOutlined />,
          requiresAuth: true,
        },
      },
      {
        path: 'duty',
        element: (
          <AuthGuard>
            <DutySchedule />
          </AuthGuard>
        ),
        meta: {
          title: '值班排班管理',
          icon: <TeamOutlined />,
          requiresAuth: true,
          permission: 'duty:handover',
        },
      },
      {
        path: 'station/:stationId',
        element: (
          <AuthGuard>
            <StationDetail />
          </AuthGuard>
        ),
        meta: {
          title: '机房详情',
          icon: <SettingOutlined />,
          requiresAuth: true,
        },
      },
      {
        path: 'settings',
        element: (
          <AuthGuard>
            <Settings />
          </AuthGuard>
        ),
        meta: {
          title: '系统设置',
          icon: <SettingOutlined />,
          requiresAuth: true,
        },
      },
      {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
];

// 创建路由实例
export const router = createBrowserRouter(routes as RouteObject[]);
