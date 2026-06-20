import { useMemo, useState } from "react";
import {
  Search,
  Filter,
  Plus,
  Dumbbell,
  PlayCircle,
  X,
  Dumbbell as Logo,
} from "lucide-react";
import { usePlanStore } from "@/stores/planStore";
import { useUIStore } from "@/stores/uiStore";
import {
  getMuscleGroupLabel,
  getEquipmentLabel,
  getDifficultyLabel,
  getMuscleGroupColor,
} from "@/hooks/useTrainingVolume";
import type { Exercise, MuscleGroup, Equipment, Difficulty, ExerciseCategory } from "@/types";
import { cn } from "@/lib/utils";
import AutoSizeList from "@/components/common/AutoSizeList";

const muscleGroups: (MuscleGroup | "all")[] = [
  "all",
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "legs",
  "core",
  "cardio",
  "full-body",
];

const equipments: (Equipment | "all")[] = [
  "all",
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "band",
  "other",
];

const difficulties: (Difficulty | "all")[] = ["all", "beginner", "intermediate", "advanced"];

export default function ExerciseLibrary() {
  const exercises = usePlanStore((s) => s.exercises);
  const addCustomExercise = usePlanStore((s) => s.addCustomExercise);
  const setAddExerciseModalOpen = useUIStore((s) => s.setAddExerciseModalOpen);
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | "all">("all");
  const [equipFilter, setEquipFilter] = useState<Equipment | "all">("all");
  const [diffFilter, setDiffFilter] = useState<Difficulty | "all">("all");
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const filtered = useMemo(() => {
    return exercises.filter((e) => {
      const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
      const matchesMuscle = muscleFilter === "all" || e.muscleGroup === muscleFilter;
      const matchesEquip = equipFilter === "all" || e.equipment === equipFilter;
      const matchesDiff = diffFilter === "all" || e.difficulty === diffFilter;
      return matchesSearch && matchesMuscle && matchesEquip && matchesDiff;
    });
  }, [exercises, search, muscleFilter, equipFilter, diffFilter]);

  return (
    <div className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-text-primary">动作库</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            共 {exercises.length} 个标准动作 · 含视频演示与详细说明
          </p>
        </div>
        <button type="button" onClick={() => setShowAddForm(true)} className="btn-primary text-xs">
          <Plus className="h-3.5 w-3.5" /> 自定义动作
        </button>
      </div>

      {/* 筛选区 */}
      <div className="card mb-4 space-y-3 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索动作名称..."
            className="input pl-9"
          />
        </div>

        <div className="space-y-2">
          <FilterRow label="肌群">
            {muscleGroups.map((g) => (
              <FilterChip key={g} active={muscleFilter === g} onClick={() => setMuscleFilter(g)}>
                {g === "all" ? "全部" : getMuscleGroupLabel(g)}
              </FilterChip>
            ))}
          </FilterRow>
          <FilterRow label="器械">
            {equipments.map((e) => (
              <FilterChip key={e} active={equipFilter === e} onClick={() => setEquipFilter(e)}>
                {e === "all" ? "全部" : getEquipmentLabel(e)}
              </FilterChip>
            ))}
          </FilterRow>
          <FilterRow label="难度">
            {difficulties.map((d) => (
              <FilterChip key={d} active={diffFilter === d} onClick={() => setDiffFilter(d)}>
                {d === "all" ? "全部" : getDifficultyLabel(d).label}
              </FilterChip>
            ))}
          </FilterRow>
        </div>
      </div>

      {/* 动作列表 - 虚拟滚动 */}
      <div className="card flex-1 overflow-hidden p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" /> 筛选结果
          </span>
          <span className="font-mono">{filtered.length} 个动作</span>
        </div>
        <div className="h-[calc(100%-2rem)]">
          <AutoSizeList
            itemCount={filtered.length}
            itemSize={92}
            itemData={{ exercises: filtered, onSelect: setSelected }}
            className="scrollbar-thin"
            emptyState={
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <Dumbbell className="h-10 w-10 text-text-muted" />
                <p className="text-sm text-text-muted">未找到匹配的动作</p>
                <p className="text-xs text-text-muted">尝试调整筛选条件或添加自定义动作</p>
              </div>
            }
          >
            {ExerciseRow}
          </AutoSizeList>
        </div>
      </div>

      {/* 详情抽屉 */}
      {selected && (
        <ExerciseDetail exercise={selected} onClose={() => setSelected(null)} />
      )}

      {/* 自定义动作表单 */}
      {showAddForm && (
        <AddExerciseForm
          onSubmit={(ex) => {
            addCustomExercise(ex);
            setShowAddForm(false);
          }}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}

interface ExerciseRowData {
  exercises: Exercise[];
  onSelect: (ex: Exercise) => void;
}

function ExerciseRow({ index, style, data }: { index: number; style: React.CSSProperties; data: ExerciseRowData }) {
  const ex = data.exercises[index];
  const diffInfo = getDifficultyLabel(ex.difficulty);
  const color = getMuscleGroupColor(ex.muscleGroup);

  return (
    <div style={style} className="px-1">
      <button
        type="button"
        onClick={() => data.onSelect(ex)}
        className="card-hover group flex w-full items-center gap-3 p-2.5 text-left"
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Dumbbell className="h-5 w-5" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-text-primary">{ex.name}</span>
            {ex.isCustom && <span className="chip-warning">自定义</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
            <span style={{ color }}>{getMuscleGroupLabel(ex.muscleGroup)}</span>
            <span className="opacity-40">·</span>
            <span>{getEquipmentLabel(ex.equipment)}</span>
            <span className="opacity-40">·</span>
            <span className={diffInfo.color.replace("chip-", "text-")}>{diffInfo.label}</span>
          </div>
        </div>
        {ex.videoUrl && <PlayCircle className="h-4 w-4 shrink-0 text-text-muted group-hover:text-brand-cyan" />}
      </button>
    </div>
  );
}

function ExerciseDetail({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const diffInfo = getDifficultyLabel(exercise.difficulty);
  const color = getMuscleGroupColor(exercise.muscleGroup);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-border bg-background-panel animate-slide-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-display text-lg font-bold text-text-primary">动作详情</h3>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-thin">
          <div className="flex items-start gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${color}20` }}
            >
              <Logo className="h-7 w-7" style={{ color }} />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-text-primary">{exercise.name}</h4>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="chip-info" style={{ color, backgroundColor: `${color}20` }}>
                  {getMuscleGroupLabel(exercise.muscleGroup)}
                </span>
                <span className="chip-default">{getEquipmentLabel(exercise.equipment)}</span>
                <span className={diffInfo.color}>{diffInfo.label}</span>
                {exercise.isCustom && <span className="chip-warning">自定义</span>}
              </div>
            </div>
          </div>

          {exercise.videoUrl && (
            <a
              href={exercise.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 py-3 text-sm font-medium text-brand-cyan transition-colors hover:bg-brand-cyan/20"
            >
              <PlayCircle className="h-4 w-4" />
              观看动作演示视频
            </a>
          )}

          <div className="mt-5">
            <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">动作说明</h5>
            <p className="text-sm leading-relaxed text-text-secondary">{exercise.description}</p>
          </div>

          <div className="mt-5">
            <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">注意事项</h5>
            <ul className="space-y-2">
              {exercise.tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-cyan" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <InfoBox label="动作类型" value={
              exercise.category === "compound" ? "复合动作" :
              exercise.category === "isolation" ? "孤立动作" :
              exercise.category === "cardio" ? "有氧" : "柔韧性"
            } />
            <InfoBox label="主要肌群" value={getMuscleGroupLabel(exercise.muscleGroup)} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function AddExerciseForm({ onSubmit, onClose }: { onSubmit: (ex: Omit<Exercise, "id" | "isCustom">) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: "",
    muscleGroup: "chest" as MuscleGroup,
    equipment: "dumbbell" as Equipment,
    difficulty: "beginner" as Difficulty,
    category: "isolation" as ExerciseCategory,
    description: "",
    tips: "",
    videoUrl: "",
  });

  const handleSubmit = () => {
    if (!form.name || !form.description) return;
    onSubmit({
      ...form,
      tips: form.tips.split("\n").filter(Boolean),
      videoUrl: form.videoUrl || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-text-primary">添加自定义动作</h3>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <LabeledInput label="动作名称" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="例：单腿罗马尼亚硬拉" />
          <div className="grid grid-cols-2 gap-3">
            <LabeledSelect label="肌群" value={form.muscleGroup} onChange={(v) => setForm({ ...form, muscleGroup: v as MuscleGroup })}
              options={muscleGroups.filter(g => g !== "all").map(g => ({ value: g, label: getMuscleGroupLabel(g) }))} />
            <LabeledSelect label="器械" value={form.equipment} onChange={(v) => setForm({ ...form, equipment: v as Equipment })}
              options={equipments.filter(e => e !== "all").map(e => ({ value: e, label: getEquipmentLabel(e) }))} />
            <LabeledSelect label="难度" value={form.difficulty} onChange={(v) => setForm({ ...form, difficulty: v as Difficulty })}
              options={difficulties.filter(d => d !== "all").map(d => ({ value: d, label: getDifficultyLabel(d).label }))} />
            <LabeledSelect label="类型" value={form.category} onChange={(v) => setForm({ ...form, category: v as ExerciseCategory })}
              options={[
                { value: "compound", label: "复合动作" },
                { value: "isolation", label: "孤立动作" },
                { value: "cardio", label: "有氧" },
                { value: "flexibility", label: "柔韧性" },
              ]} />
          </div>
          <LabeledTextarea label="动作说明" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="详细描述动作执行步骤..." />
          <LabeledTextarea label="注意事项（每行一条）" value={form.tips} onChange={(v) => setForm({ ...form, tips: v })} placeholder="保持核心收紧&#10;控制下放速度" />
          <LabeledInput label="视频链接（可选）" value={form.videoUrl} onChange={(v) => setForm({ ...form, videoUrl: v })} placeholder="https://..." />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">取消</button>
          <button type="button" onClick={handleSubmit} disabled={!form.name || !form.description} className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> 添加动作
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 w-10 shrink-0 text-[11px] text-text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-brand-cyan/20 text-brand-cyan" : "bg-background-elevated text-text-secondary hover:text-text-primary"
      )}
    >
      {children}
    </button>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background-soft p-3">
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-text-secondary">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input text-sm" />
    </label>
  );
}

function LabeledTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-text-secondary">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="input text-sm resize-none" />
    </label>
  );
}

function LabeledSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-text-secondary">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input text-sm">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
