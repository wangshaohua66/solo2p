import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Copy,
  Clock,
  Dumbbell,
  X,
  Search,
  Library,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { usePlanStore } from "@/stores/planStore";
import { useUIStore } from "@/stores/uiStore";
import {
  calculateDayVolume,
  calculateDayDuration,
  calculateExerciseVolume,
  getMuscleGroupLabel,
  getMuscleGroupColor,
} from "@/hooks/useTrainingVolume";
import { getWeekdayName, formatDate, toDateInputValue } from "@/utils/dateUtils";
import { exportTrainingPlan } from "@/utils/excelExporter";
import type { TrainingPlan, PlanExercise, PlanDay, DayOfWeek, Member } from "@/types";
import { cn } from "@/lib/utils";

interface TrainingPlanEditorProps {
  member: Member;
}

interface DraggableExerciseProps {
  exercise: PlanExercise;
  planId: string;
  weekIndex: number;
  dayIndex: number;
  onRemove: () => void;
  onUpdate: (updates: Partial<PlanExercise>) => void;
}

interface DayCardProps {
  day: PlanDay;
  dayIndex: number;
  planId: string;
  weekIndex: number;
  onRemoveExercise: (exerciseId: string) => void;
  onUpdateExercise: (exerciseId: string, updates: Partial<PlanExercise>) => void;
  onAddClick: () => void;
}

export default function TrainingPlanEditor({ member }: TrainingPlanEditorProps) {
  const plans = usePlanStore((s) => s.plans);
  const exercises = usePlanStore((s) => s.exercises);
  const activePlanId = usePlanStore((s) => s.activePlanId);
  const setActivePlan = usePlanStore((s) => s.setActivePlan);
  const createPlan = usePlanStore((s) => s.createPlan);
  const addExerciseToDay = usePlanStore((s) => s.addExerciseToDay);
  const removeExerciseFromDay = usePlanStore((s) => s.removeExerciseFromDay);
  const updateExerciseInDay = usePlanStore((s) => s.updateExerciseInDay);
  const moveExerciseBetweenDays = usePlanStore((s) => s.moveExerciseBetweenDays);
  const reorderExercisesInDay = usePlanStore((s) => s.reorderExercisesInDay);
  const duplicatePlanAsTemplate = usePlanStore((s) => s.duplicatePlanAsTemplate);
  const setExercisePickerOpen = useUIStore((s) => s.setExercisePickerOpen);

  const memberPlans = useMemo(
    () => plans.filter((p) => p.memberId === member.id && !p.isTemplate),
    [plans, member.id]
  );

  const activePlan = useMemo(() => {
    const byId = memberPlans.find((p) => p.id === activePlanId);
    return byId || memberPlans[0];
  }, [memberPlans, activePlanId]);

  const [weekIndex, setWeekIndex] = useState(0);
  const [pickerDayIndex, setPickerDayIndex] = useState<number | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ exercise: PlanExercise; planId: string; weekIndex: number; dayIndex: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const ensurePlan = () => {
    if (!activePlan) {
      const start = toDateInputValue();
      const end = toDateInputValue(new Date(Date.now() + 28 * 24 * 60 * 60 * 1000));
      createPlan({
        memberId: member.id,
        name: `${member.name}的训练计划`,
        startDate: start,
        endDate: end,
        isTemplate: false,
      });
    }
  };

  const currentWeek = activePlan?.weeks[weekIndex];
  const weekVolume = currentWeek ? currentWeek.days.reduce((sum, d) => sum + calculateDayVolume(d.exercises), 0) : 0;
  const weekDuration = currentWeek ? currentWeek.days.reduce((sum, d) => sum + calculateDayDuration(d.exercises), 0) : 0;

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { exercise: PlanExercise; planId: string; weekIndex: number; dayIndex: number };
    if (data) setActiveDrag(data);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDrag(null);
    if (!over || !activePlan || !currentWeek) return;

    const activeData = active.data.current as { exercise: PlanExercise; planId: string; weekIndex: number; dayIndex: number } | undefined;
    const overData = over.data.current as { type: string; dayIndex: number; exerciseId?: string } | undefined;

    if (!activeData) return;

    const fromDayIndex = activeData.dayIndex;
    const toDayIndex = overData?.dayIndex ?? fromDayIndex;

    if (fromDayIndex === toDayIndex) {
      if (overData?.type === "exercise" && overData.exerciseId) {
        const fromExIndex = currentWeek.days[fromDayIndex].exercises.findIndex((e) => e.id === activeData.exercise.id);
        const toExIndex = currentWeek.days[toDayIndex].exercises.findIndex((e) => e.id === overData.exerciseId);
        if (fromExIndex !== -1 && toExIndex !== -1 && fromExIndex !== toExIndex) {
          reorderExercisesInDay(activePlan.id, weekIndex, fromDayIndex, fromExIndex, toExIndex);
        }
      }
    } else {
      moveExerciseBetweenDays(activePlan.id, weekIndex, fromDayIndex, toDayIndex, activeData.exercise.id);
    }
  };

  const handleAddExercise = (dayIndex: number) => {
    ensurePlan();
    setPickerDayIndex(dayIndex);
    setExercisePickerOpen(true);
  };

  const handlePickExercise = (exerciseId: string) => {
    if (!activePlan || pickerDayIndex === null) return;
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const newPlanExercise: PlanExercise = {
      id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      exerciseId: ex.id,
      name: ex.name,
      sets: 3,
      reps: 10,
      weight: 0,
      restSeconds: 60,
    };
    addExerciseToDay(activePlan.id, weekIndex, pickerDayIndex, newPlanExercise);
    setPickerDayIndex(null);
    setExercisePickerOpen(false);
  };

  return (
    <div className="flex h-full flex-col p-5">
      {/* 计划工具栏 */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-brand-cyan" />
            <div>
              <h2 className="font-display text-lg font-bold text-text-primary">
                {activePlan ? activePlan.name : "暂无训练计划"}
              </h2>
              <p className="text-xs text-text-muted">
                {activePlan ? `${formatDate(activePlan.startDate)} 至 ${formatDate(activePlan.endDate)}` : "点击下方创建计划开始编排"}
              </p>
            </div>
          </div>
          {activePlan && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => duplicatePlanAsTemplate(activePlan.id, `${activePlan.name}-模板`)} className="btn-secondary text-xs">
                <Save className="h-3.5 w-3.5" /> 存为模板
              </button>
              <button type="button" onClick={() => exportTrainingPlan(activePlan, member)} className="btn-secondary text-xs">
                <Copy className="h-3.5 w-3.5" /> 导出CSV
              </button>
            </div>
          )}
        </div>

        {memberPlans.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            {memberPlans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePlan(p.id)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  p.id === activePlan?.id ? "bg-brand-cyan/20 text-brand-cyan" : "bg-background-elevated text-text-secondary hover:text-text-primary"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {!activePlan ? (
        <div className="card flex flex-1 flex-col items-center justify-center gap-3">
          <Dumbbell className="h-12 w-12 text-text-muted" />
          <p className="text-sm text-text-muted">该学员暂无训练计划</p>
          <button type="button" onClick={ensurePlan} className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> 创建训练计划
          </button>
        </div>
      ) : (
        <>
          {/* 周切换 + 统计 */}
          <div className="card mb-4 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekIndex((w) => Math.max(0, w - 1))}
                  disabled={weekIndex === 0}
                  className="btn-ghost p-1.5 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[5rem] text-center text-sm font-semibold text-text-primary">第 {weekIndex + 1} 周</span>
                <button
                  type="button"
                  onClick={() => setWeekIndex((w) => Math.min(activePlan.weeks.length - 1, w + 1))}
                  disabled={weekIndex >= activePlan.weeks.length - 1}
                  className="btn-ghost p-1.5 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <Dumbbell className="h-3.5 w-3.5 text-brand-orange" />
                  周容量 <span className="font-mono font-semibold text-brand-orange">{weekVolume.toLocaleString()}kg</span>
                </span>
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <Clock className="h-3.5 w-3.5 text-brand-cyan" />
                  预估 <span className="font-mono font-semibold text-brand-cyan">{weekDuration}min</span>
                </span>
              </div>
            </div>
          </div>

          {/* 周视图网格 */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
              {currentWeek?.days.map((day, dayIndex) => (
                <DayCard
                  key={day.dayOfWeek}
                  day={day}
                  dayIndex={dayIndex}
                  planId={activePlan.id}
                  weekIndex={weekIndex}
                  onRemoveExercise={(exerciseId) => removeExerciseFromDay(activePlan.id, weekIndex, dayIndex, exerciseId)}
                  onUpdateExercise={(exerciseId, updates) => updateExerciseInDay(activePlan.id, weekIndex, dayIndex, exerciseId, updates)}
                  onAddClick={() => handleAddExercise(dayIndex)}
                />
              ))}
            </div>

            <DragOverlay>
              {activeDrag ? (
                <div className="card cursor-grabbing border-brand-cyan/40 p-2 shadow-glow">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5 text-brand-cyan" />
                    <span className="text-xs font-medium text-text-primary">{activeDrag.exercise.name}</span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {/* 动作选择器 */}
      <ExercisePickerModal
        open={pickerDayIndex !== null}
        onPick={handlePickExercise}
        onClose={() => { setPickerDayIndex(null); setExercisePickerOpen(false); }}
      />
    </div>
  );
}

function DraggableExercise({ exercise, onRemove, onUpdate }: DraggableExerciseProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: exercise.id,
    data: { exercise },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  const volume = calculateExerciseVolume(exercise.sets, exercise.reps, exercise.weight || 0);
  const color = "#22d3ee";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border border-border bg-background-soft p-2 transition-shadow hover:border-border-muted",
        isDragging && "shadow-glow"
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none text-text-muted hover:text-brand-cyan active:cursor-grabbing"
          aria-label="拖拽排序"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-xs font-medium text-text-primary">{exercise.name}</span>
            <button type="button" onClick={onRemove} className="opacity-0 transition-opacity group-hover:opacity-100">
              <Trash2 className="h-3 w-3 text-brand-rose hover:text-brand-rose/80" />
            </button>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            <NumInput label="组" value={exercise.sets} onChange={(v) => onUpdate({ sets: v })} />
            <NumInput label="次" value={exercise.reps} onChange={(v) => onUpdate({ reps: v })} />
            <NumInput label="kg" value={exercise.weight || 0} onChange={(v) => onUpdate({ weight: v })} />
            <NumInput label="秒" value={exercise.restSeconds} onChange={(v) => onUpdate({ restSeconds: v })} />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px]">
            <span className="text-text-muted">容量</span>
            <span className="font-mono font-semibold" style={{ color }}>{volume}kg</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DayCard({ day, dayIndex, planId, weekIndex, onRemoveExercise, onUpdateExercise, onAddClick }: DayCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayIndex}`,
    data: { type: "day", dayIndex },
  });

  const volume = calculateDayVolume(day.exercises);
  const duration = calculateDayDuration(day.exercises);
  const isToday = new Date().getDay() === day.dayOfWeek;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-background-panel transition-colors",
        isOver ? "border-brand-cyan/60 bg-brand-cyan/5 shadow-glow" : "border-border",
        isToday && "ring-1 ring-brand-cyan/30"
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">{getWeekdayName(day.dayOfWeek)}</p>
          {day.name && <p className="text-[10px] text-text-muted">{day.name}</p>}
        </div>
        {day.exercises.length > 0 && (
          <div className="text-right text-[10px] text-text-muted">
            <p className="font-mono text-brand-orange">{volume}kg</p>
            <p className="font-mono">{duration}min</p>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2 scrollbar-thin" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {day.exercises.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 py-6 text-center">
            <Dumbbell className="h-6 w-6 text-text-muted" />
            <p className="text-[10px] text-text-muted">休息日</p>
          </div>
        ) : (
          day.exercises.map((ex) => (
            <DraggableExercise
              key={ex.id}
              exercise={ex}
              planId={planId}
              weekIndex={weekIndex}
              dayIndex={dayIndex}
              onRemove={() => onRemoveExercise(ex.id)}
              onUpdate={(updates) => onUpdateExercise(ex.id, updates)}
            />
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onAddClick}
        className="border-t border-border px-3 py-2 text-xs text-text-muted transition-colors hover:bg-background-elevated hover:text-brand-cyan"
      >
        <Plus className="mr-1 inline h-3 w-3" /> 添加动作
      </button>
    </div>
  );
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[9px] text-text-muted">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded border border-border bg-background px-1 py-0.5 text-center font-mono text-[11px] text-text-primary focus:border-brand-cyan/50 focus:outline-none"
      />
    </label>
  );
}

function ExercisePickerModal({ open, onPick, onClose }: { open: boolean; onPick: (exerciseId: string) => void; onClose: () => void }) {
  const exercises = usePlanStore((s) => s.exercises);
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return exercises.filter((e) => {
      const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
      const matchesMuscle = muscleFilter === "all" || e.muscleGroup === muscleFilter;
      return matchesSearch && matchesMuscle;
    });
  }, [exercises, search, muscleFilter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="card flex h-[80vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-brand-cyan" />
            <h3 className="font-display text-lg font-bold text-text-primary">从动作库选择</h3>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border p-3">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索动作..."
              className="input pl-9"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["all", "chest", "back", "shoulders", "biceps", "triceps", "legs", "core"].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setMuscleFilter(g)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  muscleFilter === g ? "bg-brand-cyan/20 text-brand-cyan" : "bg-background-elevated text-text-secondary hover:text-text-primary"
                )}
              >
                {g === "all" ? "全部肌群" : getMuscleGroupLabel(g)}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {filtered.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => onPick(ex.id)}
                className="card-hover flex items-center gap-2.5 p-2.5 text-left"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${getMuscleGroupColor(ex.muscleGroup)}20` }}
                >
                  <Dumbbell className="h-4 w-4" style={{ color: getMuscleGroupColor(ex.muscleGroup) }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-text-primary">{ex.name}</p>
                  <p className="text-[10px] text-text-muted">{getMuscleGroupLabel(ex.muscleGroup)}</p>
                </div>
                <Plus className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <Search className="h-8 w-8 text-text-muted" />
              <p className="text-xs text-text-muted">未找到匹配动作</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
