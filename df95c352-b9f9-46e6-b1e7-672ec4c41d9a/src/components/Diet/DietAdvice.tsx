import { useState, useEffect } from "react";
import {
  UtensilsCrossed,
  Download,
  RefreshCw,
  Plus,
  Trash2,
  Flame,
  Egg,
  Wheat,
  Droplet,
  Clock,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { usePlanStore } from "@/stores/planStore";
import { useMemberStore } from "@/stores/memberStore";
import { getGoalLabel } from "@/hooks/useTrainingVolume";
import { exportDietAdvice } from "@/utils/excelExporter";
import type { Member, DietAdvice as DietAdviceType, DietMeal } from "@/types";
import { cn } from "@/lib/utils";

interface DietAdviceProps {
  member: Member;
}

export default function DietAdvice({ member }: DietAdviceProps) {
  const generateOrUpdateDiet = usePlanStore((s) => s.generateOrUpdateDiet);
  const updateDietAdvice = usePlanStore((s) => s.updateDietAdvice);
  const getDietAdvice = usePlanStore((s) => s.getDietAdvice);
  const [advice, setAdvice] = useState<DietAdviceType | undefined>(getDietAdvice(member.id));

  useEffect(() => {
    const existing = getDietAdvice(member.id);
    if (existing) {
      setAdvice(existing);
    } else {
      const generated = generateOrUpdateDiet(member.id);
      setAdvice(generated);
    }
  }, [member.id]);

  const goalInfo = getGoalLabel(member.goal);

  const macroData = advice
    ? [
        { name: "蛋白质", value: advice.proteinGrams * 4, grams: advice.proteinGrams, color: "#f97316" },
        { name: "碳水", value: advice.carbsGrams * 4, grams: advice.carbsGrams, color: "#22d3ee" },
        { name: "脂肪", value: advice.fatGrams * 9, grams: advice.fatGrams, color: "#a78bfa" },
      ]
    : [];

  const regenerate = () => {
    const generated = generateOrUpdateDiet(member.id);
    setAdvice(generated);
  };

  const updateMeal = (mealId: string, updates: Partial<DietMeal>) => {
    if (!advice) return;
    const newMeals = advice.meals.map((m) => (m.id === mealId ? { ...m, ...updates } : m));
    const updated = { ...advice, meals: newMeals };
    setAdvice(updated);
    updateDietAdvice(member.id, { meals: newMeals });
  };

  const removeMeal = (mealId: string) => {
    if (!advice) return;
    const newMeals = advice.meals.filter((m) => m.id !== mealId);
    setAdvice({ ...advice, meals: newMeals });
    updateDietAdvice(member.id, { meals: newMeals });
  };

  const addMeal = () => {
    if (!advice) return;
    const newMeal: DietMeal = {
      id: `meal-${Date.now()}`,
      name: "加餐",
      time: "15:00",
      foods: ["坚果 30g", "酸奶 150g"],
      calories: 200,
    };
    setAdvice({ ...advice, meals: [...advice.meals, newMeal] });
    updateDietAdvice(member.id, { meals: [...advice.meals, newMeal] });
  };

  if (!advice) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-brand-cyan" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-text-primary">{member.name} 的饮食建议</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            训练目标：<span className={goalInfo.color}>{goalInfo.label}</span> · 更新于 {advice.updatedAt}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={regenerate} className="btn-secondary text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> 重新生成
          </button>
          <button type="button" onClick={() => exportDietAdvice(advice, member)} className="btn-primary text-xs">
            <Download className="h-3.5 w-3.5" /> 导出
          </button>
        </div>
      </div>

      {/* 营养目标概览 */}
      <section className="card p-4">
        <h3 className="section-title mb-3 flex items-center gap-2">
          <Flame className="h-4 w-4 text-brand-orange" /> 每日营养摄入目标
        </h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={macroData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  isAnimationActive={false}
                >
                  {macroData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a20", border: "1px solid #2a2a35", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(_v: number, _n: string, p: { payload?: { grams?: number } }) => [`${p?.payload?.grams}g`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MacroCard icon={Flame} label="总热量" value={advice.dailyCalories} unit="kcal" tone="text-brand-orange" />
              <MacroCard icon={Egg} label="蛋白质" value={advice.proteinGrams} unit="g" tone="text-brand-orange" />
              <MacroCard icon={Wheat} label="碳水" value={advice.carbsGrams} unit="g" tone="text-brand-cyan" />
              <MacroCard icon={Droplet} label="脂肪" value={advice.fatGrams} unit="g" tone="text-brand-violet" />
            </div>
            <div className="mt-3 space-y-2">
              {macroData.map((m) => (
                <div key={m.name} className="flex items-center gap-2">
                  <span className="w-12 text-xs text-text-secondary">{m.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background-elevated">
                    <div className="h-full rounded-full" style={{ width: `${(m.value / advice.dailyCalories) * 100}%`, backgroundColor: m.color }} />
                  </div>
                  <span className="w-20 text-right font-mono text-xs text-text-primary">{Math.round((m.value / advice.dailyCalories) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 分餐安排 */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-brand-cyan" /> 分餐安排
          </h3>
          <button type="button" onClick={addMeal} className="btn-accent text-xs py-1.5">
            <Plus className="h-3.5 w-3.5" /> 添加餐次
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {advice.meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onUpdate={(updates) => updateMeal(meal.id, updates)}
              onRemove={() => removeMeal(meal.id)}
            />
          ))}
        </div>
      </section>

      {/* 饮食建议 */}
      <section className="card p-4">
        <h3 className="section-title mb-3 flex items-center gap-2">
          <Flame className="h-4 w-4 text-brand-emerald" /> 饮食建议
        </h3>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {advice.tips.map((tip, idx) => (
            <li key={idx} className="flex items-start gap-2 rounded-lg border border-border bg-background-soft p-3 text-sm text-text-secondary">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-emerald/20 text-[10px] font-bold text-brand-emerald">
                {idx + 1}
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MacroCard({ icon: Icon, label, value, unit, tone }: { icon: typeof Flame; label: string; value: number; unit: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-background-soft p-3">
      <Icon className={cn("h-4 w-4", tone)} />
      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={cn("font-mono text-lg font-bold", tone)}>
        {value}<span className="ml-0.5 text-xs font-normal text-text-muted">{unit}</span>
      </p>
    </div>
  );
}

function MealCard({ meal, onUpdate, onRemove }: { meal: DietMeal; onUpdate: (updates: Partial<DietMeal>) => void; onRemove: () => void }) {
  return (
    <div className="group rounded-lg border border-border bg-background-soft p-3">
      <div className="flex items-center justify-between">
        <input
          value={meal.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="bg-transparent text-sm font-semibold text-text-primary focus:outline-none"
        />
        <button type="button" onClick={onRemove} className="opacity-0 transition-opacity group-hover:opacity-100">
          <Trash2 className="h-3.5 w-3.5 text-brand-rose hover:text-brand-rose/80" />
        </button>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-text-muted">
        <Clock className="h-3 w-3" />
        <input
          type="time"
          value={meal.time}
          onChange={(e) => onUpdate({ time: e.target.value })}
          className="bg-transparent font-mono text-text-secondary focus:outline-none"
        />
        <span className="ml-auto font-mono text-brand-orange">{meal.calories} kcal</span>
      </div>
      <textarea
        value={meal.foods.join("\n")}
        onChange={(e) => onUpdate({ foods: e.target.value.split("\n").filter(Boolean) })}
        rows={Math.max(2, meal.foods.length)}
        className="mt-2 w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-xs text-text-secondary focus:border-brand-cyan/50 focus:outline-none"
        placeholder="每行一个食物..."
      />
    </div>
  );
}
