import { TrendingUp, TrendingDown, Clock, Gauge, Timer, ListTodo } from 'lucide-react';
import { Progress } from 'antd';
import { useMemo } from 'react';
import { usePlanSelector } from '@/store/planStore';

const mockChanges = {
  taskCountChange: -5.2,
  outageHoursChange: 12.8,
  outageRateChange: -1.5,
  avgDurationChange: 3.6,
};

const ChangeBadge = ({ value }: { value: number }) => {
  const isUp = value > 0;
  const color = isUp ? 'text-red-500' : 'text-green-600';
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon size={12} />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  topBorderColor: string;
  iconBg: string;
  iconColor: string;
  IconComponent: React.ComponentType<any>;
  changeValue?: number;
  showProgress?: boolean;
  progressValue?: number;
}

const KPICard = ({
  title,
  value,
  unit,
  topBorderColor,
  iconBg,
  iconColor,
  IconComponent,
  changeValue,
  showProgress,
  progressValue,
}: KPICardProps) => (
  <div
    className="card-hover relative bg-white rounded-xl overflow-hidden cursor-default"
    style={{ borderTop: `4px solid ${topBorderColor}` }}
  >
    <div className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
        </div>
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}
        >
          <IconComponent size={20} className={iconColor} />
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-800 tabular-nums">
            {value}
          </span>
          {unit && (
            <span className="text-sm text-slate-500 font-medium">{unit}</span>
          )}
        </div>
        {changeValue !== undefined && !showProgress && (
          <ChangeBadge value={changeValue} />
        )}
      </div>

      {showProgress && progressValue !== undefined && (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1">
            <Progress
              type="circle"
              size={56}
              strokeWidth={8}
              percent={progressValue}
              format={() => null}
              strokeColor={topBorderColor}
              trailColor="#e2e8f0"
            />
          </div>
          {changeValue !== undefined && (
            <ChangeBadge value={changeValue} />
          )}
        </div>
      )}
    </div>
  </div>
);

const KPICards = () => {
  const tasks = usePlanSelector((state) => state.tasks);

  const kpi = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthTasks = tasks.filter((t) => {
      const taskDate = new Date(t.startTime);
      return taskDate.getMonth() === currentMonth && taskDate.getFullYear() === currentYear;
    });

    const taskCount = thisMonthTasks.length;
    const totalOutageHours = thisMonthTasks.reduce((sum, t) => sum + t.outageDurationH, 0);
    const outageRate = (totalOutageHours / 8760) * 100;
    const avgDuration = taskCount > 0 ? totalOutageHours / taskCount : 0;

    return {
      taskCount,
      totalOutageHours,
      outageRate,
      avgDuration,
    };
  }, [tasks]);

  return (
    <div className="grid grid-cols-4 gap-5">
      <KPICard
        title="本月检修任务数"
        value={kpi.taskCount}
        unit="项"
        topBorderColor="#3B82F6"
        iconBg="bg-blue-50"
        iconColor="text-blue-500"
        IconComponent={ListTodo}
        changeValue={mockChanges.taskCountChange}
      />

      <KPICard
        title="总停电时长"
        value={kpi.totalOutageHours.toFixed(1)}
        unit="小时"
        topBorderColor="#EF4444"
        iconBg="bg-red-50"
        iconColor="text-red-500"
        IconComponent={Clock}
        changeValue={mockChanges.outageHoursChange}
      />

      <KPICard
        title="设备停电率"
        value={kpi.outageRate.toFixed(2)}
        unit="%"
        topBorderColor="#F59E0B"
        iconBg="bg-amber-50"
        iconColor="text-amber-500"
        IconComponent={Gauge}
        changeValue={mockChanges.outageRateChange}
        showProgress
        progressValue={Math.min(kpi.outageRate * 10, 100)}
      />

      <KPICard
        title="平均检修时长"
        value={kpi.avgDuration.toFixed(1)}
        unit="小时/项"
        topBorderColor="#10B981"
        iconBg="bg-emerald-50"
        iconColor="text-emerald-500"
        IconComponent={Timer}
        changeValue={mockChanges.avgDurationChange}
      />
    </div>
  );
};

export default KPICards;
