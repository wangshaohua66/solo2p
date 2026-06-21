import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  Network,
  AlertTriangle,
  BarChart3,
  History,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { Tooltip } from 'antd';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

interface NavItem {
  key: string;
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    key: 'plan',
    path: '/plan',
    label: '计划调度',
    icon: <CalendarDays size={20} />,
  },
  {
    key: 'topology',
    path: '/topology',
    label: '电网拓扑',
    icon: <Network size={20} />,
  },
  {
    key: 'conflict',
    path: '/conflict',
    label: '冲突分析',
    icon: <AlertTriangle size={20} />,
  },
  {
    key: 'statistics',
    path: '/statistics',
    label: '统计报表',
    icon: <BarChart3 size={20} />,
  },
  {
    key: 'history',
    path: '/history',
    label: '历史查询',
    icon: <History size={20} />,
  },
];

const Sidebar: React.FC = () => {
  const { sidebarMode, sidebarCollapsed, toggleSidebar } = useUIStore();

  if (sidebarMode === 'top') {
    return null;
  }

  const isIconMode = sidebarMode === 'icon';
  const isCollapsed = sidebarCollapsed && !isIconMode;
  const width = isIconMode || isCollapsed ? 64 : 240;

  return (
    <aside
      className={cn(
        'h-screen flex flex-col overflow-hidden transition-all duration-300 ease-in-out',
        'bg-gradient-to-b from-dispatch-950 via-dispatch-900 to-dispatch-950'
      )}
      style={{ width: `${width}px` }}
    >
      <div
        className={cn(
          'flex items-center gap-3 py-5 px-4 border-b border-white/10',
          isIconMode || isCollapsed ? 'justify-center px-2' : ''
        )}
      >
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-dispatch-400 to-dispatch-600 flex items-center justify-center shadow-lg shadow-dispatch-500/30 flex-shrink-0">
          <Menu size={20} className="text-white" />
        </div>
        {(isIconMode || isCollapsed) ? null : (
          <div className="flex flex-col overflow-hidden">
            <span className="text-white font-bold text-base leading-tight whitespace-nowrap">
              电网检修计划
            </span>
            <span className="text-dispatch-300 text-xs whitespace-nowrap">
              管理系统
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 overflow-y-auto scrollbar-thin">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const linkContent = ({ isActive }: { isActive: boolean }) => (
              <Tooltip
                title={isIconMode || isCollapsed ? item.label : ''}
                placement="right"
                mouseEnterDelay={0.2}
              >
                <div
                  className={cn(
                    'flex items-center gap-3 h-11 rounded-lg relative transition-all duration-200',
                    isIconMode || isCollapsed ? 'justify-center px-0' : 'px-3',
                    isActive
                      ? 'bg-white text-dispatch-600 shadow-md shadow-black/10'
                      : 'text-dispatch-100 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {isActive && !isIconMode && !isCollapsed && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-dispatch-500" />
                  )}
                  <span className={cn(
                    'flex items-center justify-center flex-shrink-0',
                    isActive ? '' : ''
                  )}>
                    {item.icon}
                  </span>
                  {isIconMode || isCollapsed ? null : (
                    <span className="text-sm font-medium whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </div>
              </Tooltip>
            );

            return (
              <li key={item.key}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'block transition-transform duration-200',
                      isActive ? 'scale-[1.01]' : 'hover:translate-x-0.5'
                    )
                  }
                >
                  {({ isActive }) => linkContent({ isActive })}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-2 py-3 space-y-2">
        {isIconMode || isCollapsed ? null : (
          <button
            className={cn(
              'w-full flex items-center gap-3 h-10 px-3 rounded-lg',
              'text-dispatch-100 hover:bg-white/10 hover:text-white transition-colors'
            )}
          >
            <Bell size={18} />
            <span className="text-sm font-medium">通知中心</span>
          </button>
        )}
        {isIconMode || isCollapsed ? null : (
          <button
            className={cn(
              'w-full flex items-center gap-3 h-10 px-3 rounded-lg',
              'text-dispatch-100 hover:bg-white/10 hover:text-white transition-colors'
            )}
          >
            <Settings size={18} />
            <span className="text-sm font-medium">系统设置</span>
          </button>
        )}

        <div
          className={cn(
            'flex items-center border-t border-white/5 pt-3 mt-2',
            isIconMode || isCollapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <Tooltip
            title={isIconMode || isCollapsed ? '张工 · 系统管理员' : ''}
            placement="right"
          >
            <div
              className={cn(
                'w-9 h-9 rounded-full bg-gradient-to-br from-dispatch-400 to-dispatch-600',
                'flex items-center justify-center text-white font-semibold text-sm flex-shrink-0'
              )}
            >
              张
            </div>
          </Tooltip>
          {isIconMode || isCollapsed ? null : (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                张工
              </div>
              <div className="text-xs text-dispatch-300 truncate">
                系统管理员
              </div>
            </div>
          )}
          {!isIconMode && (
            <button
              onClick={toggleSidebar}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded-md',
                'text-dispatch-200 hover:bg-white/10 hover:text-white transition-colors flex-shrink-0'
              )}
              title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              {isCollapsed ? (
                <ChevronRight size={16} />
              ) : (
                <ChevronLeft size={16} />
              )}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
