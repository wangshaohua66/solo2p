import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  User,
  Ruler,
  Weight,
  Target,
  Phone,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  ImagePlus,
  Plus,
  Activity,
  Download,
  Dumbbell,
  ClipboardList,
  UtensilsCrossed,
  BarChart3,
} from "lucide-react";
import { useMemberStore } from "@/stores/memberStore";
import { usePlanStore } from "@/stores/planStore";
import { useBodyMetrics } from "@/hooks/useBodyMetrics";
import { calculateAge, validateHeight, validateWeight, validateAge } from "@/utils/validators";
import { formatDate } from "@/utils/dateUtils";
import { getGoalLabel } from "@/hooks/useTrainingVolume";
import { exportMemberReport } from "@/utils/excelExporter";
import type { Member, BodyMeasurement, TrainingGoal, Gender } from "@/types";
import { cn } from "@/lib/utils";

interface MemberProfileProps {
  member: Member;
}

interface MeasurementFormValues {
  date: string;
  weight: number;
  bodyFatRate?: number;
  muscleMass?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  arm?: number;
  thigh?: number;
}

const goalOptions: { value: TrainingGoal; label: string }[] = [
  { value: "muscle", label: "增肌" },
  { value: "fat-loss", label: "减脂" },
  { value: "shape", label: "塑形" },
  { value: "strength", label: "力量" },
  { value: "health", label: "健康" },
];

export default function MemberProfile({ member }: MemberProfileProps) {
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [compareIndex, setCompareIndex] = useState<{ before: number; after: number } | null>(null);
  const updateMember = useMemberStore((s) => s.updateMember);
  const addBodyMeasurement = useMemberStore((s) => s.addBodyMeasurement);
  const getMemberPlans = usePlanStore((s) => s.getMemberPlans);

  const age = calculateAge(member.birthDate);
  const metrics = useBodyMetrics(member.height, member.weight, member.gender, age, member.goal, member.bodyMeasurements);
  const goalInfo = getGoalLabel(member.goal);
  const plans = getMemberPlans(member.id);

  const sortedMeasurements = [...member.bodyMeasurements].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const hasMeasurements = sortedMeasurements.length >= 2;

  return (
    <div className="space-y-5 p-5 animate-fade-in">
      {/* 学员头部信息卡 */}
      <section className="card overflow-hidden">
        <div className="relative h-24 bg-gradient-to-r from-brand-cyan/20 via-brand-violet/10 to-brand-orange/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(34,211,238,0.15),transparent)]" />
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end justify-between">
            <div className="flex items-end gap-4">
              <div
                className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-background-panel bg-gradient-to-br text-2xl font-bold text-white shadow-card",
                  member.gender === "male"
                    ? "from-brand-cyan/70 to-brand-violet/70"
                    : "from-brand-rose/70 to-brand-orange/70"
                )}
              >
                {member.name.charAt(0)}
              </div>
              <div className="pb-1">
                <h2 className="font-display text-xl font-bold text-text-primary">{member.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{member.gender === "male" ? "男" : "女"} · {age}岁</span>
                  <span className="flex items-center gap-1"><Target className="h-3 w-3 text-brand-orange" /><span className={goalInfo.color}>{goalInfo.label}</span></span>
                  {member.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{member.phone}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2 pb-1">
              <button type="button" onClick={() => exportMemberReport(member)} className="btn-secondary text-xs">
                <Download className="h-3.5 w-3.5" /> 导出报告
              </button>
            </div>
          </div>

          {member.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {member.tags.map((tag) => (
                <span key={tag} className="chip-info">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 核心体征指标 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Weight} label="当前体重" value={member.weight} unit="kg" tone="text-brand-cyan" />
        <StatCard icon={Ruler} label="身高" value={member.height} unit="cm" tone="text-brand-violet" />
        <StatCard icon={Activity} label="BMI" value={metrics.bmi} unit="" tone={metrics.bmiInfo.color} sub={metrics.bmiInfo.label} />
        <StatCard icon={Target} label="体脂评级" value={metrics.bodyFatInfo?.label || "-"} unit="" tone={metrics.bodyFatInfo?.color || ""} />
      </section>

      {/* 功能模块快速入口 */}
      <section className="card p-4">
        <h3 className="section-title mb-3">训练服务</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ServiceLink icon={ClipboardList} label="训练计划" sub={`${plans.length}个计划`} tone="from-brand-cyan/15 text-brand-cyan" />
          <ServiceLink icon={Dumbbell} label="训练记录" sub={`${member.trainingRecords.length}次`} tone="from-brand-orange/15 text-brand-orange" />
          <ServiceLink icon={BarChart3} label="数据看板" sub="趋势分析" tone="from-brand-emerald/15 text-brand-emerald" />
          <ServiceLink icon={UtensilsCrossed} label="饮食建议" sub="营养方案" tone="from-brand-violet/15 text-brand-violet" />
        </div>
      </section>

      {/* 体测数据 + 照片对比 */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-title flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-cyan" /> 体测记录
            </h3>
            <button type="button" onClick={() => setShowMeasureForm((v) => !v)} className="btn-accent text-xs py-1.5">
              <Plus className="h-3.5 w-3.5" /> 录入体测
            </button>
          </div>

          {showMeasureForm && (
            <MeasurementForm
              onSubmit={(values) => {
                addBodyMeasurement(member.id, values as Omit<BodyMeasurement, "id">);
                setShowMeasureForm(false);
              }}
              onCancel={() => setShowMeasureForm(false)}
            />
          )}

          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-background-soft text-text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">日期</th>
                  <th className="px-3 py-2 text-right font-medium">体重</th>
                  <th className="px-3 py-2 text-right font-medium">体脂率</th>
                  <th className="px-3 py-2 text-right font-medium">肌肉量</th>
                  <th className="px-3 py-2 text-right font-medium">腰围</th>
                  <th className="px-3 py-2 text-right font-medium">臀围</th>
                </tr>
              </thead>
              <tbody>
                {sortedMeasurements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-text-muted">暂无体测数据，点击"录入体测"开始记录</td>
                  </tr>
                ) : (
                  sortedMeasurements.slice(0, 8).map((m, idx) => {
                    const prev = sortedMeasurements[idx + 1];
                    return (
                      <tr key={m.id} className="border-t border-border hover:bg-background-soft/50">
                        <td className="px-3 py-2 font-mono text-text-secondary">{formatDate(m.date)}</td>
                        <td className="px-3 py-2 text-right font-mono text-text-primary">
                          {m.weight.toFixed(1)}
                          {prev && <Delta value={m.weight - prev.weight} />}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-text-primary">
                          {m.bodyFatRate != null ? `${m.bodyFatRate.toFixed(1)}%` : "-"}
                          {prev && m.bodyFatRate != null && prev.bodyFatRate != null && <Delta value={m.bodyFatRate - prev.bodyFatRate} />}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-text-primary">
                          {m.muscleMass != null ? m.muscleMass.toFixed(1) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-text-primary">
                          {m.waist != null ? m.waist.toFixed(1) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-text-primary">
                          {m.hip != null ? m.hip.toFixed(1) : "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="section-title mb-3 flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-brand-violet" /> 体测照片对比
          </h3>
          {hasMeasurements ? (
            <PhotoCompare
              before={sortedMeasurements[sortedMeasurements.length - 1]}
              after={sortedMeasurements[0]}
            />
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center">
              <ImagePlus className="h-8 w-8 text-text-muted" />
              <p className="text-xs text-text-muted">需至少2次体测记录<br />方可进行照片对比</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, unit, tone, sub }: { icon: typeof Weight; label: string; value: number | string; unit: string; tone: string; sub?: string }) {
  return (
    <div className="card-hover p-3">
      <div className="flex items-center justify-between">
        <Icon className={cn("h-4 w-4", tone)} />
        {sub && <span className={cn("text-[10px]", tone)}>{sub}</span>}
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={cn("mt-0.5 font-mono text-xl font-bold", tone || "text-text-primary")}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-text-muted">{unit}</span>}
      </p>
    </div>
  );
}

function ServiceLink({ icon: Icon, label, sub, tone }: { icon: typeof Weight; label: string; sub: string; tone: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-gradient-to-br p-3 transition-colors hover:border-border-muted", tone)}>
      <Icon className="h-5 w-5" />
      <p className="mt-2 text-sm font-semibold text-text-primary">{label}</p>
      <p className="text-[11px] text-text-muted">{sub}</p>
    </div>
  );
}

function Delta({ value }: { value: number }) {
  if (Math.abs(value) < 0.05) return <Minus className="ml-1 inline h-3 w-3 text-text-muted" />;
  const positive = value > 0;
  return (
    <span className={cn("ml-1 inline-flex items-center text-[10px]", positive ? "text-brand-rose" : "text-brand-emerald")}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}
    </span>
  );
}

function PhotoCompare({ before, after }: { before: BodyMeasurement; after: BodyMeasurement }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[{ label: "之前", m: before }, { label: "最新", m: after }].map(({ label, m }) => (
        <div key={label} className="rounded-lg border border-border bg-background-soft p-2">
          <div className="flex aspect-[3/4] items-center justify-center rounded bg-background-elevated">
            <ImagePlus className="h-8 w-8 text-text-muted" />
          </div>
          <div className="mt-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-text-muted">{label}</span>
              <span className="font-mono text-text-secondary">{formatDate(m.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">体重</span>
              <span className="font-mono text-text-primary">{m.weight.toFixed(1)}kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">体脂</span>
              <span className="font-mono text-text-primary">{m.bodyFatRate != null ? `${m.bodyFatRate.toFixed(1)}%` : "-"}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MeasurementForm({ onSubmit, onCancel }: { onSubmit: (values: MeasurementFormValues) => void; onCancel: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MeasurementFormValues>({
    defaultValues: { date: formatDate(new Date(), "YYYY-MM-DD") },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mb-3 rounded-lg border border-brand-cyan/30 bg-brand-cyan/5 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field label="日期" error={errors.date?.message}>
          <input type="date" {...register("date", { required: "必填" })} className={cn("input py-1.5 text-xs", errors.date && "input-error")} />
        </Field>
        <Field label="体重(kg)" error={errors.weight?.message}>
          <input
            type="number"
            step="0.1"
            {...register("weight", {
              required: "必填",
              valueAsNumber: true,
              validate: (v) => validateWeight(v) || true,
            })}
            className={cn("input py-1.5 text-xs", errors.weight && "input-error")}
          />
        </Field>
        <Field label="体脂率(%)">
          <input type="number" step="0.1" {...register("bodyFatRate", { valueAsNumber: true })} className="input py-1.5 text-xs" />
        </Field>
        <Field label="肌肉量(kg)">
          <input type="number" step="0.1" {...register("muscleMass", { valueAsNumber: true })} className="input py-1.5 text-xs" />
        </Field>
        <Field label="胸围(cm)">
          <input type="number" step="0.1" {...register("chest", { valueAsNumber: true })} className="input py-1.5 text-xs" />
        </Field>
        <Field label="腰围(cm)">
          <input type="number" step="0.1" {...register("waist", { valueAsNumber: true })} className="input py-1.5 text-xs" />
        </Field>
        <Field label="臀围(cm)">
          <input type="number" step="0.1" {...register("hip", { valueAsNumber: true })} className="input py-1.5 text-xs" />
        </Field>
        <Field label="臂围(cm)">
          <input type="number" step="0.1" {...register("arm", { valueAsNumber: true })} className="input py-1.5 text-xs" />
        </Field>
        <Field label="腿围(cm)">
          <input type="number" step="0.1" {...register("thigh", { valueAsNumber: true })} className="input py-1.5 text-xs" />
        </Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost text-xs py-1.5">取消</button>
        <button type="submit" className="btn-primary text-xs py-1.5">保存体测</button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-text-secondary">{label}</span>
      {children}
      {error && <span className="mt-0.5 block text-[10px] text-brand-rose">{error}</span>}
    </label>
  );
}
