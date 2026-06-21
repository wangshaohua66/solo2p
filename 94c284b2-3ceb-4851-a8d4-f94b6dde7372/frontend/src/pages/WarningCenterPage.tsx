import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Filter,
  Bell,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { mockApi } from '@/api/mock';
import WarningPanel from '@/components/WarningPanel';
import type { Warning } from '@/types';

export default function WarningCenterPage() {
  const { warnings, loadWarnings, warningStats, loadWarningStats, loading } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  useEffect(() => {
    loadWarnings();
    loadWarningStats();
  }, [loadWarnings, loadWarningStats]);

  const filteredWarnings = useMemo(() => {
    return warnings.filter((w) => {
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      if (levelFilter !== 'all' && w.riskLevel !== levelFilter) return false;
      return true;
    });
  }, [warnings, statusFilter, levelFilter]);

  const handleAssign = async (id: string) => {
    await mockApi.assignWarning();
    await loadWarnings();
    await loadWarningStats();
  };

  const handleResolve = async (id: string) => {
    await mockApi.resolveWarning();
    await loadWarnings();
    await loadWarningStats();
  };

  const handleNotify = async (id: string) => {
    await mockApi.notifyWarning();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">预警中心</h1>
          <p className="mt-1 text-sm text-gray-500">实时监控高危患者，自动触发预警与处置</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 bg-gradient-to-br from-danger-50 to-white">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">高危预警</div>
            <div className="w-9 h-9 rounded-lg bg-danger-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-danger-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-danger-600">
              {warningStats?.high || 0}
            </span>
            <span className="text-xs text-gray-400">人</span>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-warning-50 to-white">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">中危预警</div>
            <div className="w-9 h-9 rounded-lg bg-warning-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-warning-600">
              {warningStats?.medium || 0}
            </span>
            <span className="text-xs text-gray-400">人</span>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-green-50 to-white">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">待处理</div>
            <div className="w-9 h-9 rounded-lg bg-danger-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-danger-600 animate-pulse-badge" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-danger-600">
              {warningStats?.pending || 0}
            </span>
            <span className="text-xs text-gray-400">条</span>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-primary-50 to-white">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">已解决</div>
            <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-primary-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-primary-600">
              {warningStats?.resolved || 0}
            </span>
            <span className="text-xs text-gray-400">条</span>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">筛选：</span>
          </div>
          <div className="flex items-center gap-1">
            {[
              { value: 'all', label: '全部状态' },
              { value: 'pending', label: '待处理' },
              { value: 'processing', label: '处理中' },
              { value: 'resolved', label: '已解决' },
            ].map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                  statusFilter === s.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-gray-200 mx-2" />
          <div className="flex items-center gap-1">
            {[
              { value: 'all', label: '全部等级' },
              { value: 'high', label: '高危', color: 'danger' },
              { value: 'medium', label: '中危', color: 'warning' },
              { value: 'low', label: '低危', color: 'secondary' },
            ].map((l) => (
              <button
                key={l.value}
                onClick={() => setLevelFilter(l.value)}
                className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                  levelFilter === l.value
                    ? l.color === 'danger'
                      ? 'bg-danger-600 text-white'
                      : l.color === 'warning'
                      ? 'bg-warning-600 text-white'
                      : l.color === 'secondary'
                      ? 'bg-secondary-600 text-white'
                      : 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="ml-auto text-sm text-gray-500">
            共 <span className="font-medium text-gray-800">{filteredWarnings.length}</span> 条预警
          </div>
        </div>

        {loading.warnings ? (
          <div className="py-12 text-center text-gray-400">加载中...</div>
        ) : filteredWarnings.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Bell className="w-14 h-14 mx-auto mb-3 opacity-30" />
            <div>暂无符合条件的预警记录</div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWarnings
              .sort((a, b) => {
                const order = { pending: 0, processing: 1, resolved: 2 };
                if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
                return b.riskScore - a.riskScore;
              })
              .map((w: Warning) => (
                <WarningPanel
                  key={w.id}
                  warning={w}
                  onAssign={() => handleAssign(w.id)}
                  onResolve={() => handleResolve(w.id)}
                  onNotify={() => handleNotify(w.id)}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
