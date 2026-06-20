import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Dumbbell,
  Activity,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  ArrowUpRight,
  Flame,
  Award,
} from "lucide-react";
import { useMemberStore } from "@/stores/memberStore";
import { usePlanStore } from "@/stores/planStore";
import { useUIStore } from "@/stores/uiStore";
import { getGoalLabel } from "@/hooks/useTrainingVolume";
import { formatDate, isToday } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const navigate = useNavigate();
  const members = useMemberStore((s) => s.members);
  const initMembers = useMemberStore((s) => s.initMockData);
  const setSelectedMember = useMemberStore((s) => s.setSelectedMember);
  const setRightPanelContent = useUIStore((s) => s.setRightPanelContent);
  const plans = usePlanStore((s) => s.plans);
  const initPlans = usePlanStore((s) => s.initMockData);

  useEffect(() => {
    initMembers();
    initPlans();
  }, [initMembers, initPlans]);

  const stats = useMemo(() => {
    const totalMembers = members.length;
    const totalSessions = members.reduce((sum, m) => sum + m.trainingRecords.length, 0);
    const todaySessions = members.reduce(
      (sum, m) => sum + m.trainingRecords.filter((r) => isToday(r.date)).length,
      0
    );
    const totalVolume = members.reduce(
      (sum, m) => sum + m.trainingRecords.reduce((s, r) => s + (r.totalVolume || 0), 0),
      0
    );
    const goalDistribution = members.reduce<Record<string, number>>((acc, m) => {
      acc[m.goal] = (acc[m.goal] || 0) + 1;
      return acc;
    }, {});
    return { totalMembers, totalSessions, todaySessions, totalVolume, goalDistribution };
  }, [members]);

  const recentMembers = useMemo(() => {
    return [...members]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [members]);

  const topPerformers = useMemo(() => {
    return [...members]
      .map((m) => ({
        member: m,
        sessions: m.trainingRecords.length,
        volume: m.trainingRecords.reduce((s, r) => s + (r.totalVolume || 0), 0),
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);
  }, [members]);

  const handleSelectMember = (id: string) => {
    setSelectedMember(id);
    setRightPanelContent("stats");
    navigate(`/members/${id}`);
  };

  const goalColors: Record<string, string> = {
    muscle: "#f97316",
    "fat-loss": "#f43f5e",
    shape: "#22d3ee",
    strength: "#10b981",
    health: "#a78bfa",
  };

  return (
    <div className="space-y-5 p-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">训练概览</h1>
        <p className="mt-1 text-sm text-text-muted">管理 {stats.totalMembers} 名学员的训练进度与数据</p>
      </div>

      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="在册学员"
          value={stats.totalMembers}
          unit="人"
          tone="text-brand-cyan"
          trend={`+${recentMembers.length}近期新增`}
        />
        <StatCard
          icon={Dumbbell}
          label="累计训练"
          value={stats.totalSessions}
          unit="次"
          tone="text-brand-orange"
          trend={`今日 ${stats.todaySessions} 次`}
        />
        <StatCard
          icon={Activity}
          label="累计容量"
          value={(stats.totalVolume / 1000).toFixed(1)}
          unit="吨"
          tone="text-brand-emerald"
          trend="持续增长"
        />
        <StatCard
          icon={Target}
          label="活跃计划"
          value={plans.filter((p) => !p.isTemplate).length}
          unit="个"
          tone="text-brand-violet"
          trend={`${plans.filter((p) => p.isTemplate).length}个模板`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 训练目标分布 */}
        <section className="card p-4 lg:col-span-1">
          <h3 className="section-title mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-cyan" /> 训练目标分布
          </h3>
          <div className="space-y-2.5">
            {Object.entries(stats.goalDistribution).map(([goal, count]) => {
              const info = getGoalLabel(goal);
              const pct = stats.totalMembers > 0 ? (count / stats.totalMembers) * 100 : 0;
              return (
                <div key={goal}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className={info.color}>{info.label}</span>
                    <span className="font-mono text-text-secondary">{count}人 · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-background-elevated">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: goalColors[goal] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 训练排行榜 */}
        <section className="card p-4 lg:col-span-2">
          <h3 className="section-title mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-brand-orange" /> 训练容量榜
          </h3>
          <div className="space-y-1.5">
            {topPerformers.map((p, idx) => (
              <button
                key={p.member.id}
                type="button"
                onClick={() => handleSelectMember(p.member.id)}
                className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-border-muted hover:bg-background-elevated"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    idx === 0 ? "bg-brand-orange/20 text-brand-orange" : idx === 1 ? "bg-text-muted/20 text-text-secondary" : idx === 2 ? "bg-brand-orange/10 text-brand-orange/70" : "bg-background-elevated text-text-muted"
                  )}
                >
                  {idx + 1}
                </span>
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white",
                    p.member.gender === "male" ? "from-brand-cyan/60 to-brand-violet/60" : "from-brand-rose/60 to-brand-orange/60"
                  )}
                >
                  {p.member.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{p.member.name}</p>
                  <p className="text-[11px] text-text-muted">{p.sessions}次训练 · {getGoalLabel(p.member.goal).label}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-brand-orange">{(p.volume / 1000).toFixed(1)}t</p>
                  <ArrowUpRight className="ml-auto h-3 w-3 text-text-muted group-hover:text-brand-cyan" />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* 近期新增学员 */}
      <section className="card p-4">
        <h3 className="section-title mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-brand-cyan" /> 近期入队学员
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {recentMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelectMember(m.id)}
              className="card-hover flex items-center gap-3 p-3 text-left"
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white",
                  m.gender === "male" ? "from-brand-cyan/60 to-brand-violet/60" : "from-brand-rose/60 to-brand-orange/60"
                )}
              >
                {m.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{m.name}</p>
                <p className="text-[11px] text-text-muted">
                  {formatDate(m.createdAt)} · {getGoalLabel(m.goal).label}
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-text-muted" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  tone,
  trend,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  unit: string;
  tone: string;
  trend: string;
}) {
  return (
    <div className="card-hover relative overflow-hidden p-4">
      <div className="flex items-start justify-between">
        <Icon className={cn("h-5 w-5", tone)} />
        <TrendingUp className="h-3.5 w-3.5 text-brand-emerald" />
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl font-bold", tone)}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-text-muted">{unit}</span>}
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-text-muted">
        <Flame className="h-3 w-3" />
        {trend}
      </p>
    </div>
  );
}
