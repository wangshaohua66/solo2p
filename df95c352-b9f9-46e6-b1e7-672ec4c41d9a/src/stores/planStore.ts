import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Exercise, TrainingPlan, PlanExercise, PlanDay, PlanWeek, DietAdvice } from "@/types";
import { mockExercises, generateMockPlans, generateDietAdvice } from "@/utils/mockData";
import { useMemberStore } from "./memberStore";

interface PlanState {
  exercises: Exercise[];
  plans: TrainingPlan[];
  dietAdvices: Record<string, DietAdvice>;
  activePlanId: string | null;
  selectedWeek: number;

  initMockData: () => void;

  addCustomExercise: (exercise: Omit<Exercise, "id" | "isCustom">) => void;
  updateExercise: (id: string, updates: Partial<Exercise>) => void;
  deleteExercise: (id: string) => void;

  createPlan: (plan: Omit<TrainingPlan, "id" | "createdAt" | "weeks"> & { weeks?: PlanWeek[] }) => void;
  updatePlan: (id: string, updates: Partial<TrainingPlan>) => void;
  deletePlan: (id: string) => void;
  duplicatePlanAsTemplate: (id: string, name: string) => void;
  applyTemplate: (templateId: string, memberId: string) => void;
  setActivePlan: (id: string | null) => void;
  setSelectedWeek: (week: number) => void;

  addExerciseToDay: (planId: string, weekIndex: number, dayIndex: number, exercise: PlanExercise) => void;
  removeExerciseFromDay: (planId: string, weekIndex: number, dayIndex: number, exerciseId: string) => void;
  updateExerciseInDay: (planId: string, weekIndex: number, dayIndex: number, exerciseId: string, updates: Partial<PlanExercise>) => void;
  reorderExercisesInDay: (planId: string, weekIndex: number, dayIndex: number, fromIndex: number, toIndex: number) => void;
  moveExerciseBetweenDays: (planId: string, weekIndex: number, fromDayIndex: number, toDayIndex: number, exerciseId: string) => void;

  getMemberPlans: (memberId: string) => TrainingPlan[];
  getTemplates: () => TrainingPlan[];
  getActivePlan: () => TrainingPlan | undefined;

  generateOrUpdateDiet: (memberId: string) => DietAdvice;
  updateDietAdvice: (memberId: string, updates: Partial<DietAdvice>) => void;
  getDietAdvice: (memberId: string) => DietAdvice | undefined;
}

const createEmptyWeek = (weekNumber: number): PlanWeek => ({
  weekNumber,
  days: Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    name: "",
    exercises: [],
  })),
});

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      exercises: [],
      plans: [],
      dietAdvices: {},
      activePlanId: null,
      selectedWeek: 1,

      initMockData: () => {
        if (get().exercises.length === 0) {
          const memberStore = useMemberStore.getState();
          set({
            exercises: mockExercises,
            plans: generateMockPlans(memberStore.members.slice(0, 10)),
          });
        }
      },

      addCustomExercise: (exercise) =>
        set((state) => ({
          exercises: [
            ...state.exercises,
            { ...exercise, id: `ex-custom-${Date.now()}`, isCustom: true },
          ],
        })),

      updateExercise: (id, updates) =>
        set((state) => ({
          exercises: state.exercises.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),

      deleteExercise: (id) =>
        set((state) => ({
          exercises: state.exercises.filter((e) => e.id !== id),
        })),

      createPlan: (plan) =>
        set((state) => {
          const weeks = plan.weeks && plan.weeks.length > 0
            ? plan.weeks
            : [createEmptyWeek(1), createEmptyWeek(2), createEmptyWeek(3), createEmptyWeek(4)];
          const newPlan: TrainingPlan = {
            ...plan,
            id: `plan-${Date.now()}`,
            createdAt: new Date().toISOString().split("T")[0],
            weeks,
            isTemplate: plan.isTemplate ?? false,
          };
          return {
            plans: [...state.plans, newPlan],
            activePlanId: newPlan.id,
          };
        }),

      updatePlan: (id, updates) =>
        set((state) => ({
          plans: state.plans.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      deletePlan: (id) =>
        set((state) => ({
          plans: state.plans.filter((p) => p.id !== id),
          activePlanId: state.activePlanId === id ? null : state.activePlanId,
        })),

      duplicatePlanAsTemplate: (id, name) =>
        set((state) => {
          const original = state.plans.find((p) => p.id === id);
          if (!original) return state;
          const template: TrainingPlan = {
            ...original,
            id: `plan-${Date.now()}`,
            name,
            isTemplate: true,
            memberId: "",
            createdAt: new Date().toISOString().split("T")[0],
          };
          return { plans: [...state.plans, template] };
        }),

      applyTemplate: (templateId, memberId) =>
        set((state) => {
          const template = state.plans.find((p) => p.id === templateId);
          if (!template) return state;
          const start = new Date();
          const end = new Date(start);
          end.setDate(end.getDate() + template.weeks.length * 7 - 1);
          const applied: TrainingPlan = {
            ...template,
            id: `plan-${Date.now()}`,
            memberId,
            isTemplate: false,
            name: template.name,
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
            createdAt: new Date().toISOString().split("T")[0],
          };
          return { plans: [...state.plans, applied], activePlanId: applied.id };
        }),

      setActivePlan: (id) => set({ activePlanId: id }),
      setSelectedWeek: (week) => set({ selectedWeek: week }),

      addExerciseToDay: (planId, weekIndex, dayIndex, exercise) =>
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  weeks: p.weeks.map((w, wi) =>
                    wi === weekIndex
                      ? {
                          ...w,
                          days: w.days.map((d, di) =>
                            di === dayIndex ? { ...d, exercises: [...d.exercises, exercise] } : d
                          ),
                        }
                      : w
                  ),
                }
              : p
          ),
        })),

      removeExerciseFromDay: (planId, weekIndex, dayIndex, exerciseId) =>
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  weeks: p.weeks.map((w, wi) =>
                    wi === weekIndex
                      ? {
                          ...w,
                          days: w.days.map((d, di) =>
                            di === dayIndex
                              ? { ...d, exercises: d.exercises.filter((e) => e.id !== exerciseId) }
                              : d
                          ),
                        }
                      : w
                  ),
                }
              : p
          ),
        })),

      updateExerciseInDay: (planId, weekIndex, dayIndex, exerciseId, updates) =>
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  weeks: p.weeks.map((w, wi) =>
                    wi === weekIndex
                      ? {
                          ...w,
                          days: w.days.map((d, di) =>
                            di === dayIndex
                              ? {
                                  ...d,
                                  exercises: d.exercises.map((e) =>
                                    e.id === exerciseId ? { ...e, ...updates } : e
                                  ),
                                }
                              : d
                          ),
                        }
                      : w
                  ),
                }
              : p
          ),
        })),

      reorderExercisesInDay: (planId, weekIndex, dayIndex, fromIndex, toIndex) =>
        set((state) => ({
          plans: state.plans.map((p) => {
            if (p.id !== planId) return p;
            const newWeeks = [...p.weeks];
            const week = { ...newWeeks[weekIndex] };
            const days = [...week.days];
            const day = { ...days[dayIndex] };
            const exercises = [...day.exercises];
            const [removed] = exercises.splice(fromIndex, 1);
            exercises.splice(toIndex, 0, removed);
            day.exercises = exercises;
            days[dayIndex] = day;
            week.days = days;
            newWeeks[weekIndex] = week;
            return { ...p, weeks: newWeeks };
          }),
        })),

      moveExerciseBetweenDays: (planId, weekIndex, fromDayIndex, toDayIndex, exerciseId) =>
        set((state) => ({
          plans: state.plans.map((p) => {
            if (p.id !== planId) return p;
            const newWeeks = [...p.weeks];
            const week = { ...newWeeks[weekIndex] };
            const days = [...week.days];
            const fromDay = { ...days[fromDayIndex] };
            const toDay = { ...days[toDayIndex] };
            const exercise = fromDay.exercises.find((e) => e.id === exerciseId);
            if (!exercise) return p;
            fromDay.exercises = fromDay.exercises.filter((e) => e.id !== exerciseId);
            toDay.exercises = [...toDay.exercises, exercise];
            days[fromDayIndex] = fromDay;
            days[toDayIndex] = toDay;
            week.days = days;
            newWeeks[weekIndex] = week;
            return { ...p, weeks: newWeeks };
          }),
        })),

      getMemberPlans: (memberId) => get().plans.filter((p) => p.memberId === memberId && !p.isTemplate),
      getTemplates: () => get().plans.filter((p) => p.isTemplate),
      getActivePlan: () => get().plans.find((p) => p.id === get().activePlanId),

      generateOrUpdateDiet: (memberId) => {
        const member = useMemberStore.getState().getMember(memberId);
        if (!member) {
          return {
            memberId,
            goal: "health",
            dailyCalories: 2000,
            proteinGrams: 100,
            carbsGrams: 200,
            fatGrams: 60,
            meals: [],
            tips: [],
            updatedAt: new Date().toISOString().split("T")[0],
          } as DietAdvice;
        }
        const advice = generateDietAdvice(member);
        set((state) => ({
          dietAdvices: { ...state.dietAdvices, [memberId]: advice },
        }));
        return advice;
      },

      updateDietAdvice: (memberId, updates) =>
        set((state) => {
          const existing = state.dietAdvices[memberId];
          if (!existing) return state;
          return {
            dietAdvices: {
              ...state.dietAdvices,
              [memberId]: { ...existing, ...updates, updatedAt: new Date().toISOString().split("T")[0] },
            },
          };
        }),

      getDietAdvice: (memberId) => get().dietAdvices[memberId],
    }),
    {
      name: "fitcoach-plans",
      partialize: (state) => ({
        exercises: state.exercises,
        plans: state.plans,
        dietAdvices: state.dietAdvices,
      }),
    }
  )
);
