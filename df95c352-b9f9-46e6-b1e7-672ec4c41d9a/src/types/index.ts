export type Gender = "male" | "female";

export type TrainingGoal =
  | "muscle"
  | "fat-loss"
  | "shape"
  | "strength"
  | "health";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "legs"
  | "core"
  | "cardio"
  | "full-body";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "band"
  | "other";

export type ExerciseCategory =
  | "compound"
  | "isolation"
  | "cardio"
  | "flexibility";

export interface BodyMeasurement {
  id: string;
  date: string;
  weight: number;
  bodyFatRate?: number;
  muscleMass?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  arm?: number;
  thigh?: number;
  bmi?: number;
  photos?: string[];
}

export interface TrainingExerciseRecord {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  completedSets?: number;
  completedReps?: number;
  rpe?: number;
}

export interface TrainingRecord {
  id: string;
  date: string;
  planId?: string;
  exercises: TrainingExerciseRecord[];
  duration: number;
  totalVolume: number;
  rpe?: number;
  completed: boolean;
  notes?: string;
}

export interface Member {
  id: string;
  name: string;
  avatar?: string;
  gender: Gender;
  birthDate: string;
  height: number;
  weight: number;
  phone?: string;
  goal: TrainingGoal;
  bodyMeasurements: BodyMeasurement[];
  trainingRecords: TrainingRecord[];
  createdAt: string;
  coachId: string;
  tags: string[];
  notes?: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  difficulty: Difficulty;
  description: string;
  tips: string[];
  videoUrl?: string;
  isCustom: boolean;
  category: ExerciseCategory;
}

export interface PlanExercise {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  restSeconds: number;
  notes?: string;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface PlanDay {
  dayOfWeek: DayOfWeek;
  name?: string;
  exercises: PlanExercise[];
}

export interface PlanWeek {
  weekNumber: number;
  days: PlanDay[];
}

export interface TrainingPlan {
  id: string;
  memberId: string;
  name: string;
  startDate: string;
  endDate: string;
  weeks: PlanWeek[];
  isTemplate: boolean;
  createdAt: string;
}

export interface DietAdvice {
  memberId: string;
  goal: TrainingGoal;
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  meals: DietMeal[];
  tips: string[];
  updatedAt: string;
}

export interface DietMeal {
  id: string;
  name: string;
  time: string;
  foods: string[];
  calories: number;
}

export type BMICategory = "underweight" | "normal" | "overweight" | "obese";

export type BodyFatCategory =
  | "essential"
  | "athlete"
  | "fitness"
  | "acceptable"
  | "obese";
