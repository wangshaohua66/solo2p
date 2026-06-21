import { useEffect, Suspense } from 'react';
import {
  Outlet,
  useLocation,
  useNavigate,
  NavLink,
} from 'react-router-dom';
import {
  Breadcrumb,
  Input,
  Badge,
  Dropdown,
  Avatar,
  Tabs,
  Skeleton,
  MenuProps,
  ConfigProvider,
} from 'antd';
import {
  Search,
  Bell,
  CalendarDays,
  Network,
  AlertTriangle,
  BarChart3,
  History,
  ChevronRight,
  User,
  LogOut,
  Settings,
} from 'lucide-react';
import Sidebar from './Sidebar';
import { useUIStore } from '@/store/uiStore';
import { usePlanStore } from '@/store/planStore';
import { useEquipmentStore } from '@/store/equipmentStore';
import { cn } from '@/lib/utils';

interface TabItem {
  key: string;
  path: string;
  label: string;
  icon: React.ReactNode;
}

const tabItems: TabItem[] = [
  {
    key: 'plan',
    path: '/plan',
    label: '计划调度',
    icon: <CalendarDays size={16} />,
  },
  {
    key: 'topology',
    path: '/topology',
    label: '电网拓扑',
    icon: <Network size={16} />,
  },
  {
    key: 'conflict',
    path: '/conflict',
    label: '冲突分析',
    icon: <AlertTriangle size={16} />,
  },
  {
    key: 'statistics',
    path: '/statistics',
    label: '统计报表',
    icon: <BarChart3 size={16} />,
  },
  {
    key: 'history',
    path: '/history',
    label: '历史查询',
    icon: <History size={16} />,
  },
];

const pathBreadcrumbMap: Record<string, string[]> = {
  '/plan': ['首页', '计划调度'],
  '/topology': ['首页', '电网拓扑'],
  '/conflict': ['首页', '冲突分析'],
  '/statistics': ['首页', '统计报表'],
  '/history': ['首页', '历史查询'],
};

const SkeletonFallback: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {Array.from({ length: 6 }).map((_, idx) => (
      <div
        key={idx}
        className="bg-white rounded-xl shadow-card p-5 space-y-4"
      >
        <Skeleton.Button active size="small" shape="round" style={{ width: 120 }} />
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
        <div className="flex gap-2 pt-2">
          <Skeleton.Button active size="small" shape="round" style={{ width: 80 }} />
          <Skeleton.Button active size="small" shape="round" style={{ width: 80 }} />
        </div>
      </div>
    ))}
  </div>
);

const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarMode, sidebarCollapsed, activeTabKey, setActiveTab, initResizeListener } =
    useUIStore();
  const { initTasks } = usePlanStore();
  const { initData } = useEquipmentStore();

  useEffect(() => {
    const cleanup = initResizeListener();
    initTasks();
    initData();
    return cleanup;
  }, [initResizeListener, initTasks, initData]);

  useEffect(() => {
    const pathToKey: Record<string, string> = {
      '/plan': 'plan',
      '/topology': 'topology',
      '/conflict': 'conflict',
      '/statistics': 'statistics',
      '/history': 'history',
    };
    const key = pathToKey[location.pathname];
    if (key && key !== activeTabKey) {
      setActiveTab(key);
    }
  }, [location.pathname, activeTabKey, setActiveTab]);

  const isTopMode = sidebarMode === 'top';
  const isIconMode = sidebarMode === 'icon';
  const sidebarWidth = isIconMode || sidebarCollapsed ? 64 : 240;

  const breadcrumbItems =
    pathBreadcrumbMap[location.pathname] || ['首页', '未知页面'];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <User size={16} />,
      label: '个人中心',
    },
    {
      key: 'settings',
      icon: <Settings size={16} />,
      label: '账户设置',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogOut size={16} />,
      label: '退出登录',
      danger: true,
    },
  ];

  const handleTabsChange = (key: string) => {
    const target = tabItems.find((t) => t.key === key);
    if (target) {
      navigate(target.path);
    }
  };

  const renderHeader = () => {
    if (isTopMode) return null;

    return (
      <header
        className={cn(
          'h-16 flex items-center justify-between px-6',
          'bg-white border-b border-slate-200/80 sticky top-0 z-30'
        )}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Breadcrumb
            separator={<ChevronRight size={14} className="text-slate-400" />}
            className="flex-shrink-0"
            items={breadcrumbItems.map((item, idx) => ({
              title: (
                <span
                  className={cn(
                    'text-sm',
                    idx === breadcrumbItems.length - 1
                      ? 'text-dispatch-700 font-semibold'
                      : 'text-slate-500'
                  )}
                >
                  {item}
                </span>
              ),
            }))}
          />

          <div className="flex-1 max-w-md ml-6">
            <Input
              placeholder="搜索计划、设备、任务..."
              prefix={
                <Search size={16} className="text-slate-400" />
              }
              size="middle"
              allowClear
              className="!rounded-lg"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4">
          <Badge count={5} size="small" offset={[-2, 2]}>
            <button
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                'text-slate-600 hover:bg-slate-100 hover:text-dispatch-600 transition-colors'
              )}
              title="通知"
            >
              <Bell size={20} />
            </button>
          </Badge>

          <Dropdown
            menu={{ items: userMenuItems }}
            placement="bottomRight"
            trigger={['click']}
            arrow
          >
            <div className="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
              <Avatar
                size={34}
                className="!bg-gradient-to-br !from-dispatch-400 !to-dispatch-600 !text-white !font-semibold"
              >
                张
              </Avatar>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium text-slate-800 leading-tight">
                  张工
                </div>
                <div className="text-xs text-slate-500 leading-tight">
                  系统管理员
                </div>
              </div>
            </div>
          </Dropdown>
        </div>
      </header>
    );
  };

  const renderTopNav = () => {
    if (!isTopMode) return null;

    return (
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-dispatch-400 to-dispatch-600 flex items-center justify-center shadow-lg shadow-dispatch-500/30 flex-shrink-0">
              <ChevronRight size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-dispatch-800 font-bold text-base leading-tight">
                电网检修计划管理系统
              </span>
              <span className="text-slate-500 text-xs leading-tight">
                Power Grid Maintenance Plan System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block w-64">
              <Input
                placeholder="搜索..."
                prefix={<Search size={16} className="text-slate-400" />}
                size="small"
                allowClear
                className="!rounded-lg"
              />
            </div>

            <Badge count={5} size="small" offset={[-2, 2]}>
              <button
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center',
                  'text-slate-600 hover:bg-slate-100 hover:text-dispatch-600 transition-colors'
                )}
              >
                <Bell size={18} />
              </button>
            </Badge>

            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={['click']}
              arrow
            >
              <Avatar
                size={32}
                className="!bg-gradient-to-br !from-dispatch-400 !to-dispatch-600 !text-white !font-semibold !cursor-pointer"
              >
                张
              </Avatar>
            </Dropdown>
          </div>
        </div>

        <ConfigProvider
          theme={{
            components: {
              Tabs: {
                horizontalItemPadding: '16px 20px',
                titleFontSize: 14,
              },
            },
          }}
        >
          <div className="px-6 border-t border-slate-100">
            <Tabs
              activeKey={activeTabKey}
              onChange={handleTabsChange}
              size="large"
              tabBarStyle={{ marginBottom: 0, minHeight: 48 }}
              items={tabItems.map((item) => ({
                key: item.key,
                label: (
                  <NavLink
                    to={item.path}
                    className="flex items-center gap-2 h-full"
                  >
                    <span className="flex items-center justify-center">
                      {item.icon}
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                ),
              }))}
            />
          </div>
        </ConfigProvider>
      </header>
    );
  };

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {!isTopMode && (
        <div
          className="flex-shrink-0 transition-all duration-300 ease-in-out"
          style={{ width: `${sidebarWidth}px` }}
        >
          <Sidebar />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {renderTopNav()}
        {renderHeader()}

        <main
          className={cn(
            'flex-1 overflow-auto scrollbar-thin',
            isTopMode ? 'p-6' : 'p-6'
          )}
        >
          <Suspense fallback={<SkeletonFallback />}>
            <div className="min-h-full">
              {isTopMode ? (
                <Outlet />
              ) : (
                <div className="bg-white rounded-2xl shadow-card min-h-full overflow-hidden">
                  <Outlet />
                </div>
              )}
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
