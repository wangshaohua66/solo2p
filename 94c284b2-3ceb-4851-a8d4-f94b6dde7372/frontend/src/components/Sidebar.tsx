import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Brain,
} from 'lucide-react';
import { useAppStore } from '@/store';
import clsx from 'clsx';

const navItems = [
  { path: '/', label: '工作台', icon: LayoutDashboard },
  { path: '/appointments', label: '预约管理', icon: Calendar },
  { path: '/patients', label: '患者档案', icon: Users },
  { path: '/warnings', label: '预警中心', icon: AlertTriangle, badge: 'pendingWarningCount' },
  { path: '/referrals', label: '跨站转诊', icon: ArrowLeftRight },
  { path: '/statistics', label: '统计报表', icon: BarChart3 },
  { path: '/settings', label: '系统设置', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar, pendingWarningCount } = useAppStore();

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 z-30 h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-gray-800 whitespace-nowrap">精神卫生中心</span>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
          const showBadge = item.badge === 'pendingWarningCount' && pendingWarningCount > 0;

          return (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              className={clsx('nav-item relative', isActive && 'nav-item-active')}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {showBadge && !sidebarCollapsed && (
                <span className="ml-auto badge bg-danger-100 text-danger-600 animate-pulse-badge">
                  {pendingWarningCount > 99 ? '99+' : pendingWarningCount}
                </span>
              )}
              {showBadge && sidebarCollapsed && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full animate-pulse-badge" />
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <button onClick={toggleSidebar} className="nav-item w-full justify-center" title="折叠/展开">
          {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!sidebarCollapsed && <span>收起菜单</span>}
        </button>
      </div>
    </aside>
  );
}
