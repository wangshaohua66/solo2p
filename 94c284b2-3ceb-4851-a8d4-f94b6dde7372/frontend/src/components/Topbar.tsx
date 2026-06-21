import { Bell, Search, User, LogOut, ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAppStore } from '@/store';
import clsx from 'clsx';

const routeTitles: Record<string, string> = {
  '/': '工作台',
  '/appointments': '预约管理',
  '/patients': '患者档案',
  '/warnings': '预警中心',
  '/statistics': '统计报表',
  '/settings': '系统设置',
};

export default function Topbar() {
  const location = useLocation();
  const { user, pendingWarningCount, logout } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const pathKey = Object.keys(routeTitles).find(
    (k) => (k === '/' ? location.pathname === '/' : location.pathname.startsWith(k)),
  );
  const title = routeTitles[pathKey || '/'] || '';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>首页</span>
        <ChevronDown className="w-4 h-4 -rotate-90" />
        <span className="text-gray-800 font-medium">{title}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="搜索患者、预约..."
            className="pl-9 pr-4 py-2 w-64 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-400 focus:bg-white transition-colors"
          />
        </div>

        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell className="w-5 h-5 text-gray-600" />
          {pendingWarningCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse-badge">
              {pendingWarningCount > 9 ? '9+' : pendingWarningCount}
            </span>
          )}
        </button>

        <div className="relative ml-2">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 p-1.5 pr-3 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="w-4 h-4 text-primary-600" />
            </div>
            <span className="text-sm text-gray-700">{user?.name || '管理员'}</span>
            <ChevronDown className={clsx('w-4 h-4 text-gray-400 transition-transform', menuOpen && 'rotate-180')} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-card-hover border border-gray-100 py-1 animate-fade-in">
              <button className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">个人设置</button>
              <button
                onClick={logout}
                className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> 退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
