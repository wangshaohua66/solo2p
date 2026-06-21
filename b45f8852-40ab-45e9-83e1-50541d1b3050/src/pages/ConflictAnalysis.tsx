import { useMemo } from 'react';
import { Card, Progress } from 'antd';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  Target,
} from 'lucide-react';
import { usePlanStore } from '@/store/planStore';
import ConflictChecker from '@/components/ConflictChecker';

const ConflictAnalysis = () => {
  const conflicts = usePlanStore((s) => s.conflicts);

  const stats = useMemo(() => {
    const total = conflicts.length;
    const critical = conflicts.filter((c) => c.severity === 'critical').length;
    const warning = conflicts.filter((c) => c.severity === 'warning').length;
    const info = conflicts.filter((c) => c.severity === 'info').length;
    const resolved = conflicts.filter((c) => c.resolved).length;
    const resolveRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, critical, warning, info, resolved, resolveRate };
  }, [conflicts]);

  const StatCard = ({
    icon: Icon,
    label,
    value,
    color,
    bgColor,
    borderColor,
  }: {
    icon: typeof AlertOctagon;
    label: string;
    value: number;
    color: string;
    bgColor: string;
    borderColor: string;
  }) => (
    <Card
      className={`!shadow-sm overflow-hidden card-hover ${borderColor}`}
      styles={{ body: { padding: '20px 24px' } } as any}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-sm text-slate-500 font-medium mb-2`}>{label}</div>
          <div className={`text-3xl font-bold tabular-nums ${color}`}>
            {value}
            <span className="text-base font-normal text-slate-400 ml-1">条</span>
          </div>
        </div>
        <div className={`w-14 h-14 rounded-2xl ${bgColor} flex items-center justify-center`}>
          <Icon size={28} className={color} />
        </div>
      </div>
    </Card>
  );

  return (
    <div className="page-container space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">冲突智能分析</h1>
          <p className="text-sm text-slate-500">自动检测检修计划中的各类冲突，辅助调度决策</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5">
        <StatCard
          icon={AlertOctagon}
          label="严重冲突"
          value={stats.critical}
          color="text-red-600"
          bgColor="bg-red-50"
          borderColor="!border-t-4 !border-t-red-500"
        />
        <StatCard
          icon={AlertTriangle}
          label="一般警告"
          value={stats.warning}
          color="text-amber-600"
          bgColor="bg-amber-50"
          borderColor="!border-t-4 !border-t-amber-500"
        />
        <StatCard
          icon={Info}
          label="提示信息"
          value={stats.info}
          color="text-blue-600"
          bgColor="bg-blue-50"
          borderColor="!border-t-4 !border-t-blue-500"
        />
        <Card
          className="!shadow-sm overflow-hidden card-hover !border-t-4 !border-t-dispatch-500"
          styles={{ body: { padding: '20px 24px' } } as any}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500 font-medium mb-2">冲突总数</div>
              <div className="text-3xl font-bold tabular-nums text-dispatch-700">
                {stats.total}
                <span className="text-base font-normal text-slate-400 ml-1">条</span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-dispatch-50 flex items-center justify-center">
              <Target size={28} className="text-dispatch-600" />
            </div>
          </div>
        </Card>

        <Card
          className="!shadow-sm overflow-hidden card-hover !border-t-4 !border-t-emerald-500"
          styles={{ body: { padding: '20px 24px' } } as any}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-slate-500 font-medium mb-2">已解决</div>
              <div className="text-3xl font-bold tabular-nums text-emerald-600">
                {stats.resolveRate}
                <span className="text-base font-normal text-slate-400 ml-1">%</span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <Progress
                type="circle"
                size={44}
                percent={stats.resolveRate}
                strokeWidth={7}
                format={() => null}
                strokeColor="#10B981"
                trailColor="#D1FAE5"
              />
            </div>
          </div>
        </Card>
      </div>

      <ConflictChecker />
    </div>
  );
};

export default ConflictAnalysis;
