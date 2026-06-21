import { Bell, Search, User, AlertCircle, Clock, ChevronDown, Zap } from 'lucide-react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { useEventStore } from '@/store/useEventStore';
import { useEmergencyStore } from '@/store/useEmergencyStore';
import { cn } from '@/utils/helpers';
import { formatDate } from '@/utils/dateUtils';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function TopBar() {
  const { stats } = useDashboardStore();
  const { getPendingApprovals } = useEventStore();
  const { isEmergencyActive, emergencyType, triggerPlan } = useEmergencyStore();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const pendingCount = getPendingApprovals().length;
  const today = new Date();

  const handleEmergencyClick = () => {
    if (!isEmergencyActive) {
      triggerPlan('plan-security');
    }
    navigate('/emergency');
  };

  return (
    <header className="h-16 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-slate-300 text-sm font-medium">
            {formatDate(today, 'yyyy年MM月dd日 EEEE')}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-cyan-400 text-xs font-medium">系统运行正常</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="搜索赛事、资源..."
            className="w-64 pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
        </div>

        {pendingCount > 0 && (
          <button
            onClick={() => navigate('/events')}
            className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors group"
          >
            <Bell className="w-5 h-5 text-amber-400" />
            <span className="text-amber-400 text-sm font-medium hidden sm:inline">
              待办
            </span>
            <span className="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
              {pendingCount + stats.activeAlerts}
            </span>
          </button>
        )}

        {stats.activeAlerts > 0 && (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors"
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm font-medium hidden sm:inline">
              {stats.activeAlerts} 条预警
            </span>
          </button>
        )}

        <button
          onClick={handleEmergencyClick}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all duration-300',
            isEmergencyActive
              ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse'
              : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:shadow-lg hover:shadow-red-500/30 hover:scale-105'
          )}
        >
          <Zap className="w-5 h-5" />
          <span className="hidden sm:inline">
            {isEmergencyActive ? '应急进行中' : '一键应急'}
          </span>
          {isEmergencyActive && emergencyType && (
            <div className="hidden sm:flex items-center gap-1 ml-1 pl-2 border-l border-red-400/30">
              <div className="w-2 h-2 rounded-full bg-white animate-ping" />
            </div>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-slate-200 text-sm font-medium">运营管理员</p>
              <p className="text-slate-500 text-xs">调度中心</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50">
              <button className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                个人中心
              </button>
              <button className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                消息通知
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors">
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
