import { useMemo } from "react";
import type { PlanExercise, TrainingExerciseRecord, PlanDay, PlanWeek } from "@/types";

export const calculateExerciseVolume = (
  sets: number,
  reps: number,
  weight: number = 0
): number => {
  return Math.round(sets * reps * weight);
};

export const calculateExerciseDuration = (
  sets: number,
  reps: number,
  restSeconds: number = 60,
  repSeconds: number = 3
): number => {
  const workSeconds = sets * reps * repSeconds;
  const restSecondsTotal = Math.max(0, sets - 1) * restSeconds;
  return Math.round((workSeconds + restSecondsTotal) / 60);
};

export const calculateDayVolume = (exercises: PlanExercise[]): number => {
  return exercises.reduce(
    (sum, ex) => sum + calculateExerciseVolume(ex.sets, ex.reps, ex.weight || 0),
    0
  );
};

export const calculateDayDuration = (exercises: PlanExercise[]): number => {
  return exercises.reduce((sum, ex) => sum + calculateExerciseDuration(ex.sets, ex.reps, ex.restSeconds), 0);
};

export const calculateWeekVolume = (week: PlanWeek): number => {
  return week.days.reduce((sum, day) => sum + calculateDayVolume(day.exercises), 0);
};

export const calculateRecordedVolume = (
  exercises: TrainingExerciseRecord[]
): number => {
  return exercises.reduce(
    (sum, ex) =>
      sum +
      calculateExerciseVolume(
        ex.completedSets || ex.sets,
        ex.completedReps || ex.reps,
        ex.weight || 0
      ),
    0
  );
};

export interface WeeklyVolumeData {
  date: string;
  volume: number;
  duration: number;
  sessions: number;
}

export const useWeeklyVolume = (
  records: { date: string; totalVolume: number; duration: number }[],
  weeks: number = 8
): WeeklyVolumeData[] => {
  return useMemo(() => {
    const result: WeeklyVolumeData[] = [];
    const today = new Date();
    for (let w = weeks - 1; w >= 0; w--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekRecords = records.filter((r) => {
        const d = new Date(r.date);
        return d >= weekStart && d <= weekEnd;
      });

      result.push({
        date: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        volume: weekRecords.reduce((sum, r) => sum + (r.totalVolume || 0), 0),
        duration: weekRecords.reduce((sum, r) => sum + (r.duration || 0), 0),
        sessions: weekRecords.length,
      });
    }
    return result;
  }, [records, weeks]);
};

export const getMuscleGroupColor = (muscleGroup: string): string => {
  const colors: Record<string, string> = {
    chest: "#f97316",
    back: "#22d3ee",
    shoulders: "#a78bfa",
    biceps: "#f43f5e",
    triceps: "#f59e0b",
    legs: "#10b981",
    core: "#eab308",
    cardio: "#ec4899",
    "full-body": "#8b5cf6",
  };
  return colors[muscleGroup] || "#71717a";
};

export const getDifficultyLabel = (difficulty: string): { label: string; color: string } => {
  const map: Record<string, { label: string; color: string }> = {
    beginner: { label: "初级", color: "chip-success" },
    intermediate: { label: "中级", color: "chip-warning" },
    advanced: { label: "高级", color: "chip-error" },
  };
  return map[difficulty] || { label: difficulty, color: "chip-default" };
};

export const getGoalLabel = (goal: string): { label: string; color: string } => {
  const map: Record<string, { label: string; color: string }> = {
    muscle: { label: "增肌", color: "chip-warning" },
    "fat-loss": { label: "减脂", color: "chip-error" },
    shape: { label: "塑形", color: "chip-info" },
    strength: { label: "力量", color: "chip-success" },
    health: { label: "健康", color: "chip-default" },
  };
  return map[goal] || { label: goal, color: "chip-default" };
};

export const getMuscleGroupLabel = (group: string): string => {
  const map: Record<string, string> = {
    chest: "胸部",
    back: "背部",
    shoulders: "肩部",
    biceps: "肱二头肌",
    triceps: "肱三头肌",
    legs: "腿部",
    core: "核心",
    cardio: "有氧",
    "full-body": "全身",
  };
  return map[group] || group;
};

export const getEquipmentLabel = (equipment: string): string => {
  const map: Record<string, string> = {
    barbell: "杠铃",
    dumbbell: "哑铃",
    machine: "器械",
    cable: "绳索",
    bodyweight: "自重",
    kettlebell: "壶铃",
    band: "弹力带",
    other: "其他",
  };
  return map[equipment] || equipment;
};
