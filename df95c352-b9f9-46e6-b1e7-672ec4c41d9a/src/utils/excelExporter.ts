import type { Member, TrainingPlan, DietAdvice, BodyMeasurement, TrainingRecord } from "@/types";
import { getWeekdayName } from "./dateUtils";
import { getGoalLabel, getMuscleGroupLabel } from "@/hooks/useTrainingVolume";

const toCSV = (rows: (string | number)[][]): string => {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? "");
          if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    )
    .join("\n");
};

const triggerDownload = (content: string, filename: string, mimeType: string = "text/csv;charset=utf-8;") => {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportTrainingPlan = (plan: TrainingPlan, member?: Member) => {
  const rows: (string | number)[][] = [];
  rows.push([`训练计划：${plan.name}`]);
  if (member) {
    rows.push([`学员：${member.name}`, `目标：${getGoalLabel(member.goal).label}`]);
  }
  rows.push([`周期：${plan.startDate} 至 ${plan.endDate}`]);
  rows.push([]);

  plan.weeks.forEach((week) => {
    rows.push([`第 ${week.weekNumber} 周`]);
    rows.push(["日期", "训练内容", "动作", "组数", "次数", "重量(kg)", "休息(秒)", "备注"]);

    week.days.forEach((day) => {
      if (day.exercises.length === 0) return;
      const dayTitle = `${getWeekdayName(day.dayOfWeek)}${day.name ? ` - ${day.name}` : ""}`;
      day.exercises.forEach((ex, idx) => {
        rows.push([
          idx === 0 ? dayTitle : "",
          idx === 0 ? day.name || "" : "",
          ex.name,
          ex.sets,
          ex.reps,
          ex.weight ?? "-",
          ex.restSeconds,
          ex.notes || "",
        ]);
      });
    });
    rows.push([]);
  });

  const csv = toCSV(rows);
  triggerDownload(csv, `${plan.name}_训练计划.csv`);
};

export const exportDietAdvice = (advice: DietAdvice, member: Member) => {
  const rows: (string | number)[][] = [];
  rows.push([`${member.name} 的饮食建议`]);
  rows.push([`训练目标：${getGoalLabel(advice.goal).label}`]);
  rows.push([`更新日期：${advice.updatedAt}`]);
  rows.push([]);

  rows.push(["每日营养摄入目标"]);
  rows.push(["总热量(kcal)", "蛋白质(g)", "碳水化合物(g)", "脂肪(g)"]);
  rows.push([advice.dailyCalories, advice.proteinGrams, advice.carbsGrams, advice.fatGrams]);
  rows.push([]);

  rows.push(["分餐安排"]);
  rows.push(["餐次", "时间", "食物", "预估热量(kcal)"]);
  advice.meals.forEach((meal) => {
    rows.push([meal.name, meal.time, meal.foods.join(" + "), meal.calories]);
  });
  rows.push([]);

  rows.push(["饮食建议"]);
  advice.tips.forEach((tip, idx) => {
    rows.push([`${idx + 1}. ${tip}`]);
  });

  const csv = toCSV(rows);
  triggerDownload(csv, `${member.name}_饮食建议.csv`);
};

export const exportMemberReport = (member: Member) => {
  const rows: (string | number)[][] = [];
  rows.push([`${member.name} 训练档案报告`]);
  rows.push([`性别：${member.gender === "male" ? "男" : "女"}`, `身高：${member.height}cm`, `初始体重：${member.weight}kg`]);
  rows.push([`训练目标：${getGoalLabel(member.goal).label}`, `入队日期：${member.createdAt}`]);
  if (member.tags.length) rows.push([`标签：${member.tags.join("、")}`]);
  rows.push([]);

  rows.push(["体测记录"]);
  rows.push(["日期", "体重(kg)", "体脂率(%)", "肌肉量(kg)", "胸围(cm)", "腰围(cm)", "臀围(cm)", "臂围(cm)", "腿围(cm)"]);
  member.bodyMeasurements.forEach((m) => {
    rows.push([
      m.date,
      m.weight.toFixed(1),
      m.bodyFatRate?.toFixed(1) ?? "-",
      m.muscleMass?.toFixed(1) ?? "-",
      m.chest?.toFixed(1)