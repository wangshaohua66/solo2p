import { NavLink, useLocation } from 'react-router-dom';
import { 
  Calendar, 
  Map, 
  FileText, 
  LayoutDashboard, 
  AlertTriangle, 
  Settings,
  Cpu,
  Crown,
  ChevronLeft,
  ChevronRight,
  Building2
} from 'lucide-react';
import { useVenueStore } from '@/store/useVenueStore';
import { cn } from '@/utils/helpers';
import { useState } from 'react';

const navItems = [
  { path: '/schedule', label: '档期看板', icon: Calendar },
  { path: '/resources', label: '资源拓扑', icon: Map },
  { path: '/events', label: '赛事管理', icon: FileText },
  { path: '/dashboard', label: '运营仪表盘', icon: LayoutDashboard },
  { path: '/emergency', label: '应急管理', icon: AlertTriangle },
  { path: '/equipment', label: '设备管理', icon: Cpu },
  { path: '/vip-boxes', label: 'VIP包厢', icon: Crown },
];

export function Sidebar() {
  const location = useLocation();
  const { venues, selectedVenueId, setSelectedVenueId } = useVenueStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'h-screen bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-white font-bold text-lg tracking-wide">场馆智管</h1>
              <p className="text-slate-400 text-xs">运营调度平台</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-b border-slate-700/50">
        {!collapsed && (
          <p className="text-xs text-slate-500 mb-2 px-2">选择场馆</p>
        )}
        <div className="space-y-1">
          {venues.map((venue) => (
            <button
              key={venue.id}
              onClick={() => setSelectedVenueId(venue.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-left',
                selectedVenueId === venue.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              )}
              title={venue.name}
            >
              <div
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  selectedVenueId === venue.id ? 'bg-cyan-400' : 'bg-slate-600'
                )}
              />
              {!collapsed && (
                <span className="text-sm truncate">{venue.name}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="text-xs text-slate-500 mb-2 px-2">功能模块</p>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
                          (item.path !== '/schedule' && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              )}
              title={item.label}
            >
              <Icon className={cn(
                'w-5 h-5 flex-shrink-0 transition-colors',
                isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'
              )} />
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-700/50">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <Settings className="w-5 h-5" />
              <span className="text-sm">设置</span>
              <ChevronLeft className="w-5 h-5 ml-auto" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
