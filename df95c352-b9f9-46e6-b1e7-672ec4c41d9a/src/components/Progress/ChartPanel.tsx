import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Activity, Dumbbell, Target, TrendingDown, Calendar } from "lucide-react";
import type { Member } from "@/types";
import { useWeeklyVolume, calculateRecordedVolume, getGoalLabel } from "@/hooks/useTrainingVolume";
import { formatDate } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";

interface ChartPanelProps {
  member: Member;
}

type TimeRange = "1m" | "3m" | "6m" | "all";

const rangeDays: Record<TimeRange, number> = {
  "1m": 30,
  "3m": 90,
  "6m": 180,
  all: 9999,
};

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a20",
  border: "1px solid #2a2a35",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f5f5f7",
};

export default function ChartPanel({ member }: ChartPanelProps) {
  const [range, setRange] = useState<TimeRange>("3m");

  const filteredMeasurements = useMemo(() => {
    const cutoff = Date.now() - rangeDays[range] * 24 * 60 * 60 * 1000;
    return [...member.bodyMeasurements]
      .filter((m) => new Date(m.date).getTime() >= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [member.bodyMeasurements, range]);

  const filteredRecords = useMemo(() => {
    const cutoff = Date.now() - rangeDays[range] * 24 * 60 * 60 * 1000;
    return [...member.trainingRecords]
      .filter((r) => new Date(r.date).getTime() >= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [member.trainingRecords, range]);

  const weeklyVolume = useWeeklyVolume(
    filteredRecords.map((r) => ({ date: r.date, totalVolume: r.totalVolume, duration: r.duration })),
    range === "1m" ? 4 : range === "3m" ? 12 : 24
  );

  const bodyMetricsData = useMemo(
    () =>
      filteredMeasurements.map((m) => ({
        date: formatDate(m.date, "MM/DD"),
        体重: Number(m.weight.toFixed(1)),
        体脂率: m.bodyFatRate != null ? Number(m.bodyFatRate.toFixed(1)) : null,
        肌肉量: m.muscleMass != null ? Number(m.muscleMass.toFixed(1)) : null,
      })),
    [filteredMeasurements]
  );

  const circumferenceData = useMemo(
    () =>
      filteredMeasurements
        .filter((m) => m.waist != null || m.hip != null || m.chest != null)
        .map((m) => ({
          date: formatDate(m.date, "MM/DD"),
          腰围: m.waist != null ? Number(m.waist.toFixed(1)) : null,
          臀围: m.hip != null ? Number(m.hip.toFixed(1)) : null,
          胸围: m.chest != null ? Number(m.chest.toFixed(1)) : null,
        })),
    [filteredMeasurements]
  );

  const strengthData = useMemo(() => {
    const exerciseMax: Record<string, { name: string; max: number; count: number }> = {};
    filteredRecords.forEach((r) => {
      r.exercises.forEach((ex) => {
        if (!ex.weight) return;
        const existing = exerciseMax[ex.exerciseId];
        if (!existing) {
          exerciseMax[ex.exerciseId] = { name: ex.name, max: ex.weight, count: 1 };
        } else {
          existing.max = Math.max(existing.max, ex.weight);
          existing.count += 1;
        }
      });
    });
    return Object.values(exerciseMax)
      .sort((a, b) => b.max - a.max)
      .slice(0, 6)
      .map((s) => ({ name: s.name, 重量: s.max }));
  }, [filteredRecords]);

  const goalProgress = useMemo(() => {
    const sessions = filteredRecords.length;
    const completed = filteredRecords.filter((r) => r.completed).length;
    const totalVolume = filteredRecords.reduce((sum, r) => sum + (r.totalVolume || 0), 0);
    const totalDuration = filteredRecords.reduce((sum, r) => sum + (r.duration || 0), 0);
    const weeklyTarget = 3;
    const weeks = range === "1m" ? 4 : range === "3m" ? 12 : range === "6m" ? 24 : 52;
    const expectedSessions = weeklyTarget * weeks;
    const adherenceRate = expectedSessions > 0 ? Math.min(100, Math.round((sessions / expectedSessions) * 100)) : 0;
    const completionRate = sessions > 0 ? Math.round((completed / sessions) * 100) : 0;
    return [
      { name: "训练出勤率", value: adherenceRate, color: "#22d3ee" },
      { name: "完成率", value: completionRate, color: "#10b981" },
      { name: "动作达标", value: Math.min(100, Math.round((strengthData.length / 6) * 100)), color: "#a78bfa" },
    ];
  }, [filteredRecords, strengthData.length, range]);

  const volumeByMuscle = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRecords.forEach((r) => {
      r.exercises.forEach((ex) => {
        const vol = (ex.completedSets || ex.sets) * (ex.completedReps || ex.reps) * (ex.weight || 0);
        const key = ex.name;
        map[key] = (map[key] || 0) + vol;
      });
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, 容量: Math.round(value) }))
      .sort((a, b) => b["容量"] - a["容量"])
      .slice(0, 8);
  }, [filteredRecords]);

  const hasData = filteredMeasurements.length > 0 || filteredRecords.length > 0;

  return (
    <div className="space-y-4 p-5 animate-fade-in">
      {/* 时间范围筛选 */}
      <div className="flex items-center justify-between">
        <h2 className="section-title flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-cyan" /> {member.name} 的数据看板
        </h2>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background-panel p-1">
          <Calendar className="ml-2 mr-1 h-3.5 w-3.5 text-text-muted" />
          {(["1m", "3m", "6m", "all"] as TimeRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                range === r ? "bg-brand-cyan/20 text-brand-cyan" : "text-text-secondary hover:text-text-primary"
              )}
            >
              {r === "1m" ? "近1月" : r === "3m" ? "近3月" : r === "6m" ? "近半年" : "全部"}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="card flex h-64 flex-col items-center justify-center gap-2">
          <TrendingDown className="h-10 w-10 text-text-muted" />
          <p className="text-sm text-text-muted">该时间范围内暂无数据</p>
          <p className="text-xs text-text-muted">尝试切换时间范围或录入新的训练记录</p>
        </div>
      ) : (
        <>
          {/* 概览统计 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard icon={Dumbbell} label="训练次数" value={filteredRecords.length} unit="次" tone="text-brand-cyan" />
            <SummaryCard icon={Activity} label="累计容量" value={Math.round(filteredRecords.reduce((s, r) => s + r.totalVolume, 0))} unit="kg" tone="text-brand-orange" />
            <SummaryCard icon={Target} label="累计时长" value={Math.round(filteredRecords.reduce((s, r) => s + r.duration, 0))} unit="min" tone="text-brand-emerald" />
            <SummaryCard icon={TrendingDown} label="平均RPE" value={filteredRecords.filter(r => r.rpe).length ? (filteredRecords.reduce((s, r) => s + (r.rpe || 0), 0) / filteredRecords.filter(r => r.rpe).length).toFixed(1) : "-"} unit="" tone="text-brand-violet" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* 体脂率/体重趋势 */}
            <ChartCard title="体重与体脂率趋势" icon={Activity}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={bodyMetricsData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="体重" stroke="#22d3ee" strokeWidth={2} fill="url(#weightGrad)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="体脂率" stroke="#f97316" strokeWidth={2} fill="url(#fatGrad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* 围度趋势 */}
            <ChartCard title="围度变化趋势" icon={Activity}>
              {circumferenceData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={circumferenceData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="腰围" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="臀围" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="胸围" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* 训练容量柱状图 */}
            <ChartCard title="每周训练容量" icon={Dumbbell}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weeklyVolume} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toLocaleString()} kg`, "训练容量"]} />
                  <Bar dataKey="volume" name="训练容量" fill="#22d3ee" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* 力量进度 */}
            <ChartCard title="主要动作力量水平" icon={Activity}>
              {strengthData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={strengthData} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} kg`, "最大重量"]} />
                    <Bar dataKey="重量" fill="#f97316" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* 目标达成环形图 */}
            <ChartCard title="目标达成进度" icon={Target}>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={goalProgress}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    isAnimationActive={false}
                  >
                    {goalProgress.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "达成率"]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                {goalProgress.map((g) => (
                  <div key={g.name} className="rounded-md bg-background-soft py-1.5">
                    <p className="font-mono text-lg font-bold" style={{ color: g.color }}>{g.value}%</p>
                    <p className="text-[10px] text-text-muted">{g.name}</p>
                  </div>
                ))}
              </div>
            </ChartCard>

            {/* 各动作容量分布 */}
            <ChartCard title="各动作训练容量分布" icon={Dumbbell}>
              {volumeByMuscle.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={volumeByMuscle} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toLocaleString()} kg`, "累计容量"]} />
                    <Bar dataKey="容量" fill="#a78bfa" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, unit, tone }: { icon: typeof Activity; label: string; value: number | string; unit: string; tone: string }) {
  return (
    <div className="card-hover p-3">
      <div className="flex items-center justify-between">
        <Icon className={cn("h-4 w-4", tone)} />
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={cn("mt-0.5 font-mono text-xl font-bold", tone)}>
        {typeof value === "number" ? value.toLocaleString() : value}
        {unit && <span className="ml-0.5 text-xs font-normal text-text-muted">{unit}</span>}
      </p>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Icon className="h-4 w-4 text-brand-cyan" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center gap-2">
      <Activity className="h-8 w-8 text-text-muted" />
      <p className="text-xs text-text-muted">暂无数据</p>
    </div>
  );
}
