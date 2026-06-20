import type { Member, TrainingPlan, DietAdvice } from "@/types";
import { getWeekdayName } from "./dateUtils";
import { getGoalLabel } from "@/hooks/useTrainingVolume";

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
  rows.push([`性别：${member.gender === "male" ? "男" : "女"}`, `身高：${member.height}cm`, `当前体重：${member.weight}kg`]);
  rows.push([`训练目标：${getGoalLabel(member.goal).label}`, `入队日期：${member.createdAt}`]);
  if (member.phone) rows.push([`联系电话：${member.phone}`]);
  if (member.tags.length) rows.push([`标签：${member.tags.join("、")}`]);
  if (member.notes) rows.push([`教练备注：${member.notes}`]);
  rows.push([]);

  rows.push(["体测记录"]);
  rows.push([
    "日期",
    "体重(kg)",
    "体脂率(%)",
    "肌肉量(kg)",
    "胸围(cm)",
    "腰围(cm)",
    "臀围(cm)",
    "臂围(cm)",
    "腿围(cm)",
  ]);
  const sortedMeasurements = [...member.bodyMeasurements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  sortedMeasurements.forEach((m) => {
    rows.push([
      m.date,
      m.weight.toFixed(1),
      m.bodyFatRate != null ? m.bodyFatRate.toFixed(1) : "-",
      m.muscleMass != null ? m.muscleMass.toFixed(1) : "-",
      m.chest != null ? m.chest.toFixed(1) : "-",
      m.waist != null ? m.waist.toFixed(1) : "-",
      m.hip != null ? m.hip.toFixed(1) : "-",
      m.arm != null ? m.arm.toFixed(1) : "-",
      m.thigh != null ? m.thigh.toFixed(1) : "-",
    ]);
  });
  rows.push([]);

  if (member.trainingRecords.length > 0) {
    rows.push(["训练记录"]);
    rows.push([
      "日期",
      "动作",
      "组数",
      "次数",
      "重量(kg)",
      "完成组数",
      "完成次数",
      "RPE",
      "完成状态",
      "训练时长(分钟)",
      "备注",
    ]);
    const sortedRecords = [...member.trainingRecords].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    sortedRecords.forEach((r) => {
      if (r.exercises.length === 0) {
        rows.push([
          r.date,
          "-",
          "-",
          "-",
          "-",
          "-",
          "-",
          r.rpe ?? "-",
          r.completed ? "已完成" : "未完成",
          r.duration,
          r.notes || "",
        ]);
        return;
      }
      r.exercises.forEach((ex, idx) => {
        rows.push([
          idx === 0 ? r.date : "",
          ex.name,
          ex.sets,
          ex.reps,
          ex.weight ?? "-",
          ex.completedSets ?? "-",
          ex.completedReps ?? "-",
          idx === 0 ? (r.rpe ?? "-") : "",
          idx === 0 ? (r.completed ? "已完成" : "未完成") : "",
          idx === 0 ? r.duration : "",
          idx === 0 ? (r.notes || "") : "",
        ]);
      });
    });
    rows.push([]);

    rows.push(["训练统计汇总"]);
    const totalSessions = member.trainingRecords.length;
    const completedSessions = member.trainingRecords.filter((r) => r.completed).length;
    const totalVolume = member.trainingRecords.reduce((sum, r) => sum + (r.totalVolume || 0), 0);
    const totalDuration = member.trainingRecords.reduce((sum, r) => sum + (r.duration || 0), 0);
    const avgRPE =
      member.trainingRecords.filter((r) => r.rpe != null).length > 0
        ? (
            member.trainingRecords.reduce((sum, r) => sum + (r.rpe || 0), 0) /
            member.trainingRecords.filter((r) => r.rpe != null).length
          ).toFixed(1)
        : "-";
    rows.push(["总训练次数", totalSessions]);
    rows.push(["完成次数", completedSessions]);
    rows.push(["完成率(%)", totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : "0"]);
    rows.push(["累计训练容量(kg)", totalVolume]);
    rows.push(["累计训练时长(分钟)", totalDuration]);
    rows.push(["平均RPE评分", avgRPE]);
  }

  const csv = toCSV(rows);
  triggerDownload(csv, `${member.name}_训练档案报告.csv`);
};

export const exportMembersBatch = (members: Member[]) => {
  const rows: (string | number)[][] = [];
  rows.push([
    "姓名",
    "性别",
    "出生日期",
    "身高(cm)",
    "体重(kg)",
    "训练目标",
    "电话",
    "标签",
    "入队日期",
    "体测次数",
    "训练次数",
    "备注",
  ]);
  members.forEach((m) => {
    rows.push([
      m.name,
      m.gender === "male" ? "男" : "女",
      m.birthDate,
      m.height,
      m.weight,
      getGoalLabel(m.goal).label,
      m.phone || "",
      m.tags.join("、"),
      m.createdAt,
      m.bodyMeasurements.length,
      m.trainingRecords.length,
      m.notes || "",
    ]);
  });
  const csv = toCSV(rows);
  triggerDownload(csv, `学员名单_${new Date().toISOString().split("T")[0]}.csv`);
};
