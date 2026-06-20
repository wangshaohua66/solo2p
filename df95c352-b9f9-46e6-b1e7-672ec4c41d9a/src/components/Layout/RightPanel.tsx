import { PanelRightClose, BarChart3, StickyNote, History, X } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useMemberStore } from "@/stores/memberStore";
import { useBodyMetrics } from "@/hooks/useBodyMetrics";
import { calculateAge } from "@/utils/validators";
import { getGoalLabel } from "@/hooks/useTrainingVolume";
import { formatDate } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";

export default function RightPanel() {
  const open = useUIStore((s) => s.rightPanelOpen);
  const content = useUIStore((s) => s.rightPanelContent);
  const setRightPanelContent = useUIStore((s) => s.setRightPanelContent);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const selectedMemberId = useMemberStore((s) => s.selectedMemberId);
  const member = useMemberStore((s) => (s.selectedMemberId ? s.members.find((m) => m.id === s.selectedMemberId) : undefined));

  if (!open || !member) {
    return null;
  }

  const age = calculateAge(member.birthDate);
  const metrics = useBodyMetrics(member.height, member.weight, member.gender, age, member.goal, member.bodyMeasurements);

  const tabs = [
    { key: "stats" as const, label: "体征", icon: BarChart3 },
    { key: "notes" as const, label: "备注", icon: StickyNote },
    { key: "history" as const, label: "历史", icon: History },
  ];

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-background-panel animate-slide-right">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <PanelRightClose className="h-4 w-4 text-brand-cyan" />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">数据面板</span>
        </div>
        <button
          type="button"
          onClick={toggleRightPanel}
          className="btn-ghost p-1"
          aria-label="关闭面板"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1 border-b border-border px-3 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setRightPanelContent(tab.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              content === tab.key
                ? "bg-brand-cyan/15 text-brand-cyan"
                : "text-text-secondary hover:bg-background-elevated hover:text-text-primary"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
        {content === "stats" && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-lg border border-border bg-background-soft p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-text-muted">核心指标</p>
              <div className="grid grid-cols-2 gap-3">
                <MetricItem label="BMI" value={metrics.bmi.toString()} unit="" tone={metrics.bmiInfo.color} />
                <MetricItem label="体脂评级" value={metrics.bodyFatInfo?.label || "-"} unit="" tone={metrics.bodyFatInfo?.color || ""} />
                <MetricItem label="基础代谢" value={String(metrics.bmr)} unit="kcal" />
                <MetricItem label="每日消耗" value={String(metrics.tdee)} unit="kcal" />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background-soft p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-text-muted">营养目标</p>
              <div className="space-y-2">
                <MacroBar label="蛋白质" value={metrics.macros.protein} color="bg-brand-orange" unit="g" />
                <MacroBar label="碳水" value={metrics.macros.carbs} color="bg-brand-cyan" unit="g" />
                <MacroBar label="脂肪" value={metrics.macros.fat} color="bg-brand-violet" unit="g" />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                <span className="text-text-muted">每日总热量</span>
                <span className="font-mono font-semibold text-brand-cyan">{metrics.targetCalories} kcal</span>
              </div>
            </div>

            {metrics.changes && (
              <div className="rounded-lg border border-border bg-background-soft p-3">
                <p className="mb-2 text-[11px] uppercase tracking-wider text-text-muted">较上次变化</p>
                <div className="space-y-1.5 text-xs">
                  <ChangeRow label="体重" value={metrics.changes.weight} unit="kg" />
                  <ChangeRow label="体脂率" value={metrics.changes.bodyFatRate} unit="%" />
                  <ChangeRow label="肌肉量" value={metrics.changes.muscleMass} unit="kg" />
                  <ChangeRow label="腰围" value={metrics.changes.waist} unit="cm" />
                </div>
              </div>
            )}
          </div>
        )}

        {content === "notes" && (
          <div className="animate-fade-in space-y-3">
            <div className="rounded-lg border border-border bg-background-soft p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-text-muted">教练备注</p>
              <p className="text-sm leading-relaxed text-text-secondary">
                {member.notes || "暂无备注信息"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background-soft p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-text-muted">标签</p>
              <div className="flex flex-wrap gap-1.5">
                {member.tags.length === 0 ? (
                  <span className="text-xs text-text-muted">暂无标签</span>
                ) : (
                  member.tags.map((tag) => (
                    <span key={tag} className="chip-info">{tag}</span>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background-soft p-3 text-xs text-text-secondary">
              <div className="flex justify-between py-0.5">
                <span className="text-text-muted">入队日期</span>
                <span className="font-mono">{formatDate(member.createdAt)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-text-muted">联系电话</span>
                <span className="font-mono">{member.phone || "-"}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-text-muted">训练目标</span>
                <span className={getGoalLabel(member.goal).color}>{getGoalLabel(member.goal).label}</span>
              </div>
            </div>
          </div>
        )}

        {content === "history" && (
          <div className="animate-fade-in space-y-2">
            <p className="mb-1 text-[11px] uppercase tracking-wider text-text-muted">最近训练</p>
            {member.trainingRecords.length === 0 ? (
              <p className="py-6 text-center text-xs text-text-muted">暂无训练记录</p>
            ) : (
              member.trainingRecords.slice(0, 15).map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-background-soft p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-primary">{formatDate(r.date)}</span>
                    <span className={cn("text-[10px]", r.completed ? "text-brand-emerald" : "text-text-muted")}>
                      {r.completed ? "已完成" : "未完成"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-text-muted">
                    <span className="font-mono">{r.duration}min</span>
                    <span className="font-mono">{(r.totalVolume / 1000).toFixed(1)}t</span>
                    {r.rpe != null && <span className="font-mono">RPE {r.rpe}</span>}
                    <span>{r.exercises.length}动作</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function MetricItem({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={cn("mt-0.5 font-mono text-lg font-semibold", tone || "text-text-primary")}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-normal text-text-muted">{unit}</span>}
      </p>
    </div>
  );
}

function MacroBar({ label, value, color, unit }: { label: string; value: number; color: string; unit: string }) {
  const max = Math.max(value, 1);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="font-mono text-text-primary">{value}{unit}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background-elevated">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
      </div>
    </div>
  );
}

function ChangeRow({ label, value, unit }: { label: string; value?: number; unit: string }) {
  if (value == null) return null;
  const positive = value > 0;
  const zero = Math.abs(value) < 0.05;
  const color = zero ? "text-text-muted" : positive ? "text-brand-rose" : "text-brand-emerald";
  const arrow = zero ? "→" : positive ? "↑" : "↓";
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={cn("font-mono", color)}>
        {arrow} {Math.abs(value).toFixed(1)}{unit}
      </span>
    </div>
  );
}
