import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutTemplate, Plus, Copy, Trash2, Search } from "lucide-react";
import { usePlanStore } from "@/stores/planStore";
import { useMemberStore } from "@/stores/memberStore";
import { calculateWeekVolume, getGoalLabel } from "@/hooks/useTrainingVolume";
import { formatDate } from "@/utils/dateUtils";

export default function PlanTemplatesPage() {
  const navigate = useNavigate();
  const plans = usePlanStore((s) => s.plans);
  const createPlan = usePlanStore((s) => s.createPlan);
  const duplicatePlanAsTemplate = usePlanStore((s) => s.duplicatePlanAsTemplate);
  const deletePlan = usePlanStore((s) => s.deletePlan);
  const initPlans = usePlanStore((s) => s.initMockData);
  const members = useMemberStore((s) => s.members);
  const setSelectedMember = useMemberStore((s) => s.setSelectedMember);

  const [search, setSearch] = useState("");

  useEffect(() => {
    initPlans();
  }, [initPlans]);

  const templates = plans.filter((p) => p.isTemplate);
  const filtered = templates.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  const handleApplyTemplate = (templateId: string) => {
    const member = members[0];
    if (!member) {
      alert("请先创建学员");
      return;
    }
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);
    createPlan({
      memberId: member.id,
      name: `${member.name}-${template.name}`,
      startDate: start,
      endDate: end,
      weeks: template.weeks,
      isTemplate: false,
    });
    setSelectedMember(member.id);
    navigate(`/members/${member.id}/plan`);
  };

  return (
    <div className="space-y-4 p-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">计划模板库</h1>
          <p className="mt-1 text-sm text-text-muted">复用训练计划模板，快速为学员编排</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索模板..."
            className="input pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 py-16">
          <LayoutTemplate className="h-12 w-12 text-text-muted" />
          <p className="text-sm text-text-muted">暂无模板，可从现有计划"存为模板"创建</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const weekVolume = t.weeks[0] ? calculateWeekVolume(t.weeks[0]) : 0;
            const totalExercises = t.weeks.reduce(
              (sum, w) => sum + w.days.reduce((s, d) => s + d.exercises.length, 0),
              0
            );
            return (
              <div key={t.id} className="card-hover group flex flex-col p-4">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-violet/15">
                    <LayoutTemplate className="h-5 w-5 text-brand-violet" />
                  </div>
                  <button
                    type="button"
                    onClick={() => deletePlan(t.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4 text-brand-rose hover:text-brand-rose/80" />
                  </button>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-text-primary">{t.name}</h3>
                <p className="mt-1 text-[11px] text-text-muted">
                  {t.weeks.length}周 · {totalExercises}个动作 · 创建于 {formatDate(t.startDate)}
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <span className="text-text-secondary">周容量 <span className="font-mono font-semibold text-brand-orange">{weekVolume.toLocaleString()}kg</span></span>
                </div>
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate(t.id)}
                    className="btn-primary flex-1 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> 应用
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicatePlanAsTemplate(t.id, `${t.name}-副本`)}
                    className="btn-secondary text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" /> 复制
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
