import { useMemo } from "react";
import type { BMICategory, BodyFatCategory, BodyMeasurement, Gender, TrainingGoal } from "@/types";

export const calculateBMI = (height: number, weight: number): number => {
  if (!height || !weight || height <= 0) return 0;
  const heightM = height / 100;
  return Number((weight / (heightM * heightM)).toFixed(1));
};

export const getBMICategory = (bmi: number): { category: BMICategory; label: string; color: string } => {
  if (bmi < 18.5) return { category: "underweight", label: "偏瘦", color: "text-brand-cyan" };
  if (bmi < 24) return { category: "normal", label: "正常", color: "text-brand-emerald" };
  if (bmi < 28) return { category: "overweight", label: "偏胖", color: "text-brand-orange" };
  return { category: "obese", label: "肥胖", color: "text-brand-rose" };
};

export const getBodyFatCategory = (
  bodyFatRate: number,
  gender: Gender
): { category: BodyFatCategory; label: string; color: string } => {
  if (!bodyFatRate) return { category: "acceptable", label: "-", color: "text-text-muted" };
  const maleRanges: Record<BodyFatCategory, [number, number]> = {
    essential: [2, 5],
    athlete: [6, 13],
    fitness: [14, 17],
    acceptable: [18, 24],
    obese: [25, 100],
  };
  const femaleRanges: Record<BodyFatCategory, [number, number]> = {
    essential: [10, 13],
    athlete: [14, 20],
    fitness: [21, 24],
    acceptable: [25, 31],
    obese: [32, 100],
  };
  const ranges = gender === "male" ? maleRanges : femaleRanges;
  for (const [cat, [min, max]] of Object.entries(ranges)) {
    if (bodyFatRate >= min && bodyFatRate <= max) {
      const labels: Record<BodyFatCategory, string> = {
        essential: "必需脂肪",
        athlete: "运动员水平",
        fitness: "健身水平",
        acceptable: "可接受",
        obese: "偏高",
      };
      const colors: Record<BodyFatCategory, string> = {
        essential: "text-brand-cyan",
        athlete: "text-brand-emerald",
        fitness: "text-brand-emerald",
        acceptable: "text-text-secondary",
        obese: "text-brand-rose",
      };
      return { category: cat as BodyFatCategory, label: labels[cat as BodyFatCategory], color: colors[cat as BodyFatCategory] };
    }
  }
  return { category: "acceptable", label: "偏高", color: "text-brand-orange" };
};

export const calculateBMR = (weight: number, height: number, age: number, gender: Gender): number => {
  if (gender === "male") {
    return Math.round(88.362 + 13.397 * weight + 4.799 * height - 5.677 * age);
  }
  return Math.round(447.593 + 9.247 * weight + 3.098 * height - 4.330 * age);
};

export const calculateTDEE = (bmr: number, activityLevel: number = 1.55): number => {
  return Math.round(bmr * activityLevel);
};

export const calculateTargetCalories = (tdee: number, goal: TrainingGoal): number => {
  switch (goal) {
    case "muscle":
      return tdee + 300;
    case "fat-loss":
      return tdee - 400;
    case "strength":
      return tdee + 150;
    case "shape":
      return tdee;
    default:
      return tdee;
  }
};

export const calculateMacros = (
  calories: number,
  weight: number,
  goal: TrainingGoal
): { protein: number; carbs: number; fat: number } => {
  const proteinPerKg = goal === "fat-loss" ? 2.2 : goal === "muscle" ? 2.0 : 1.6;
  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  return { protein, carbs: Math.max(0, carbs), fat };
};

export interface BodyMetricsResult {
  bmi: number;
  bmiInfo: ReturnType<typeof getBMICategory>;
  bodyFatInfo?: ReturnType<typeof getBodyFatCategory>;
  bmr: number;
  tdee: number;
  targetCalories: number;
  macros: { protein: number; carbs: number; fat: number };
  latestMeasurement?: BodyMeasurement;
  previousMeasurement?: BodyMeasurement;
  changes?: {
    weight?: number;
    bodyFatRate?: number;
    muscleMass?: number;
    waist?: number;
  };
}

export const useBodyMetrics = (
  height: number,
  weight: number,
  gender: Gender,
  age: number,
  goal: TrainingGoal,
  measurements: BodyMeasurement[] = []
): BodyMetricsResult => {
  return useMemo(() => {
    const bmi = calculateBMI(height, weight);
    const bmiInfo = getBMICategory(bmi);
    const sorted = [...measurements].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latestMeasurement = sorted[0];
    const previousMeasurement = sorted[1];

    const bodyFatInfo = latestMeasurement?.bodyFatRate
      ? getBodyFatCategory(latestMeasurement.bodyFatRate, gender)
      : undefined;

    const bmr = calculateBMR(weight, height, age, gender);
    const tdee = calculateTDEE(bmr);
    const targetCalories = calculateTargetCalories(tdee, goal);
    const macros = calculateMacros(targetCalories, weight, goal);

    const changes =
      latestMeasurement && previousMeasurement
        ? {
            weight: latestMeasurement.weight - previousMeasurement.weight,
            bodyFatRate:
              latestMeasurement.bodyFatRate != null && previousMeasurement.bodyFatRate != null
                ? latestMeasurement.bodyFatRate - previousMeasurement.bodyFatRate
                : undefined,
            muscleMass:
              latestMeasurement.muscleMass != null && previousMeasurement.muscleMass != null
                ? latestMeasurement.muscleMass - previousMeasurement.muscleMass
                : undefined,
            waist:
              latestMeasurement.waist != null && previousMeasurement.waist != null
                ? latestMeasurement.waist - previousMeasurement.waist
                : undefined,
          }
        : undefined;

    return {
      bmi,
      bmiInfo,
      bodyFatInfo,
      bmr,
      tdee,
      targetCalories,
      macros,
      latestMeasurement,
      previousMeasurement,
      changes,
    };
  }, [height, weight, gender, age, goal, measurements]);
};
