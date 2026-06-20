import type { Member, Exercise, TrainingPlan, DietAdvice } from "@/types";

export const generateMockMembers = (count: number = 50): Member[] => {
  const firstNames = ["张", "李", "王", "刘", "陈", "杨", "赵", "黄", "周", "吴", "徐", "孙", "马", "朱", "胡"];
  const lastNames = ["伟", "芳", "娜", "敏", "静", "强", "磊", "军", "洋", "勇", "艳", "杰", "娟", "涛", "明"];
  const goals = ["muscle", "fat-loss", "shape", "strength", "health"] as const;
  const genders = ["male", "female"] as const;
  const tagsPool = ["新手", "进阶", "减脂期", "增肌期", "产后恢复", "肩伤", "膝盖不好", "VIP", "团购", "长期"];

  const members: Member[] = [];
  for (let i = 0; i < count; i++) {
    const gender = genders[i % 2];
    const goal = goals[i % goals.length];
    const height = 155 + Math.floor(Math.random() * 40);
    const weight = 45 + Math.floor(Math.random() * 50);
    const baseDate = new Date();
    baseDate.setFullYear(baseDate.getFullYear() - (18 + Math.floor(Math.random() * 30)));
    baseDate.setMonth(Math.floor(Math.random() * 12));
    baseDate.setDate(1 + Math.floor(Math.random() * 28));

    const measurements = [];
    for (let m = 0; m < 6 + Math.floor(Math.random() * 10); m++) {
      const mDate = new Date();
      mDate.setDate(mDate.getDate() - m * (7 + Math.floor(Math.random() * 7)));
      measurements.push({
        id: `bm-${i}-${m}`,
        date: mDate.toISOString().split("T")[0],
        weight: weight + (gender === "male" ? -5 : 0) + (Math.random() - 0.5) * 6,
        bodyFatRate: 15 + Math.random() * 20,
        muscleMass: 30 + Math.random() * 25,
        chest: 85 + Math.random() * 25,
        waist: 65 + Math.random() * 30,
        hip: 85 + Math.random() * 20,
        arm: 25 + Math.random() * 15,
        thigh: 45 + Math.random() * 20,
        bmi: 0,
      });
    }

    const records = [];
    for (let r = 0; r < 15 + Math.floor(Math.random() * 25); r++) {
      const rDate = new Date();
      rDate.setDate(rDate.getDate() - r * (2 + Math.floor(Math.random() * 4)));
      const exCount = 4 + Math.floor(Math.random() * 5);
      const exercises = [];
      for (let e = 0; e < exCount; e++) {
        const sets = 3 + Math.floor(Math.random() * 2);
        const reps = 8 + Math.floor(Math.random() * 8);
        exercises.push({
          id: `tex-${i}-${r}-${e}`,
          exerciseId: `ex-${(e * 3) % 30}`,
          name: ["卧推", "深蹲", "硬拉", "引体向上", "划船", "肩推", "弯举", "臂屈伸", "卷腹", "平板支撑"][e % 10],
          sets,
          reps,
          weight: 10 + Math.floor(Math.random() * 80),
          completedSets: Math.random() > 0.1 ? sets : sets - 1,
          completedReps: reps,
          rpe: 5 + Math.floor(Math.random() * 5),
        });
      }
      const totalVolume = exercises.reduce(
        (sum, ex) => sum + (ex.completedSets || 0) * (ex.completedReps || 0) * (ex.weight || 0),
        0
      );
      records.push({
        id: `tr-${i}-${r}`,
        date: rDate.toISOString().split("T")[0],
        exercises,
        duration: 45 + Math.floor(Math.random() * 60),
        totalVolume,
        rpe: 6 + Math.floor(Math.random() * 4),
        completed: true,
        notes: Math.random() > 0.7 ? "状态良好" : undefined,
      });
    }

    const memberTags = [];
    const tagCount = 1 + Math.floor(Math.random() * 3);
    for (let t = 0; t < tagCount; t++) {
      const tag = tagsPool[Math.floor(Math.random() * tagsPool.length)];
      if (!memberTags.includes(tag)) memberTags.push(tag);
    }

    members.push({
      id: `member-${i + 1}`,
      name: firstNames[i % firstNames.length] + lastNames[(i * 3) % lastNames.length],
      gender,
      birthDate: baseDate.toISOString().split("T")[0],
      height,
      weight,
      phone: `138${String(10000000 + i).slice(0, 8)}`,
      goal,
      bodyMeasurements: measurements,
      trainingRecords: records,
      createdAt: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 365).toISOString().split("T")[0],
      coachId: "coach-1",
      tags: memberTags,
      notes: Math.random() > 0.6 ? "注意保护腰部" : undefined,
    });
  }
  return members;
};

export const mockExercises: Exercise[] = [
  { id: "ex-1", name: "杠铃卧推", muscleGroup: "chest", equipment: "barbell", difficulty: "intermediate", category: "compound", isCustom: false, description: "平躺在卧推凳上，双手握杠铃置于胸部上方，垂直向上推举至手臂伸直。", tips: ["保持肩胛骨收紧", "下放时控制速度", "肘部约45度角"], videoUrl: "https://example.com/bench-press" },
  { id: "ex-2", name: "哑铃卧推", muscleGroup: "chest", equipment: "dumbbell", difficulty: "beginner", category: "compound", isCustom: false, description: "平躺持哑铃，从胸部两侧向上推举至手臂伸直。", tips: ["手腕保持中立", "下放至与胸平"] },
  { id: "ex-3", name: "上斜哑铃飞鸟", muscleGroup: "chest", equipment: "dumbbell", difficulty: "intermediate", category: "isolation", isCustom: false, description: "上斜凳上持哑铃展开双臂，以弧线轨迹合拢。", tips: ["肘部微屈", "感受胸肌拉伸"] },
  { id: "ex-4", name: "俯卧撑", muscleGroup: "chest", equipment: "bodyweight", difficulty: "beginner", category: "compound", isCustom: false, description: "标准俯卧撑，身体成一直线下降并推起。", tips: ["核心收紧", "不要塌腰"] },
  { id: "ex-5", name: "双杠臂屈伸", muscleGroup: "chest", equipment: "other", difficulty: "intermediate", category: "compound", isCustom: false, description: "双杠支撑身体，下降至胸肌拉伸后推起。", tips: ["身体前倾", "控制下放"] },
  { id: "ex-6", name: "引体向上", muscleGroup: "back", equipment: "other", difficulty: "advanced", category: "compound", isCustom: false, description: "悬挂于单杠，拉起身体至下巴过杠。", tips: ["肩胛先下沉", "感受背部发力"] },
  { id: "ex-7", name: "杠铃划船", muscleGroup: "back", equipment: "barbell", difficulty: "intermediate", category: "compound", isCustom: false, description: "俯身持杠铃，沿大腿方向拉至下腹部。", tips: ["背部平直", "夹肩胛骨"] },
  { id: "ex-8", name: "高位下拉", muscleGroup: "back", equipment: "machine", difficulty: "beginner", category: "compound", isCustom: false, description: "坐姿下拉器械手柄至锁骨位置。", tips: ["挺胸", "手肘向下"] },
  { id: "ex-9", name: "坐姿划船", muscleGroup: "back", equipment: "cable", difficulty: "beginner", category: "compound", isCustom: false, description: "坐姿拉绳索把手至腹部。", tips: ["肩胛后收", "不要耸肩"] },
  { id: "ex-10", name: "哑铃单臂划船", muscleGroup: "back", equipment: "dumbbell", difficulty: "intermediate", category: "isolation", isCustom: false, description: "一手支撑于凳上，另一手划船动作。", tips: ["转肘向上", "顶峰收缩"] },
  { id: "ex-11", name: "杠铃肩推", muscleGroup: "shoulders", equipment: "barbell", difficulty: "intermediate", category: "compound", isCustom: false, description: "站姿或坐姿将杠铃从肩部推至头顶。", tips: ["核心收紧", "不要过度后仰"] },
  { id: "ex-12", name: "哑铃侧平举", muscleGroup: "shoulders", equipment: "dumbbell", difficulty: "beginner", category: "isolation", isCustom: false, description: "持哑铃从身体两侧抬起至与肩平。", tips: ["肘部微屈", "小拇指略高"] },
  { id: "ex-13", name: "哑铃前平举", muscleGroup: "shoulders", equipment: "dumbbell", difficulty: "beginner", category: "isolation", isCustom: false, description: "持哑铃向前抬起至与肩平。", tips: ["交替进行", "不要借力"] },
  { id: "ex-14", name: "反向飞鸟", muscleGroup: "shoulders", equipment: "dumbbell", difficulty: "intermediate", category: "isolation", isCustom: false, description: "俯身持哑铃展开双臂至与背平。", tips: ["肩胛后收", "控制速度"] },
  { id: "ex-15", name: "面拉", muscleGroup: "shoulders", equipment: "cable", difficulty: "beginner", category: "isolation", isCustom: false, description: "拉绳索至面部两侧，外旋肩膀。", tips: ["感受后束收缩", "外旋到位"] },
  { id: "ex-16", name: "杠铃弯举", muscleGroup: "biceps", equipment: "barbell", difficulty: "beginner", category: "isolation", isCustom: false, description: "站姿持杠铃弯举至肩部。", tips: ["大臂固定", "控制下放"] },
  { id: "ex-17", name: "哑铃交替弯举", muscleGroup: "biceps", equipment: "dumbbell", difficulty: "beginner", category: "isolation", isCustom: false, description: "左右手交替弯举哑铃。", tips: ["转腕顶峰", "避免晃动"] },
  { id: "ex-18", name: "锤式弯举", muscleGroup: "biceps", equipment: "dumbbell", difficulty: "beginner", category: "isolation", isCustom: false, description: "中立握法哑铃弯举。", tips: ["锻炼肱肌", "手腕中立"] },
  { id: "ex-19", name: "绳索下压", muscleGroup: "triceps", equipment: "cable", difficulty: "beginner", category: "isolation", isCustom: false, description: "高位绳索把手向下压至手臂伸直。", tips: ["大臂固定", "顶峰停留"] },
  { id: "ex-20", name: "仰卧臂屈伸", muscleGroup: "triceps", equipment: "barbell", difficulty: "intermediate", category: "isolation", isCustom: false, description: "平躺持杠铃于头部上方，屈伸肘部。", tips: ["肘部固定", "保护肘关节"] },
  { id: "ex-21", name: "窄距卧推", muscleGroup: "triceps", equipment: "barbell", difficulty: "intermediate", category: "compound", isCustom: false, description: "窄距杠铃卧推侧重三头肌。", tips: ["双手约肩宽", "肘部贴身"] },
  { id: "ex-22", name: "杠铃深蹲", muscleGroup: "legs", equipment: "barbell", difficulty: "intermediate", category: "compound", isCustom: false, description: "杠铃置于斜方肌，下蹲至大腿平行地面。", tips: ["膝盖方向与脚尖一致", "脊柱中立"] },
  { id: "ex-23", name: "腿举", muscleGroup: "legs", equipment: "machine", difficulty: "beginner", category: "compound", isCustom: false, description: "坐姿蹬腿举器械踏板。", tips: ["膝盖不超伸", "全脚掌发力"] },
  { id: "ex-24", name: "罗马尼亚硬拉", muscleGroup: "legs", equipment: "barbell", difficulty: "intermediate", category: "compound", isCustom: false, description: "直腿或微屈膝持杠铃下放至腘绳肌拉伸。", tips: ["臀部后坐", "感受后链拉伸"] },
  { id: "ex-25", name: "腿屈伸", muscleGroup: "legs", equipment: "machine", difficulty: "beginner", category: "isolation", isCustom: false, description: "坐姿伸展膝关节抬起重量。", tips: ["顶峰收缩", "控制下放"] },
  { id: "ex-26", name: "腿弯举", muscleGroup: "legs", equipment: "machine", difficulty: "beginner", category: "isolation", isCustom: false, description: "俯卧或坐姿弯举小腿。", tips: ["大腿贴垫", "不要借力"] },
  { id: "ex-27", name: "箭步蹲", muscleGroup: "legs", equipment: "bodyweight", difficulty: "beginner", category: "compound", isCustom: false, description: "交替向前跨步下蹲。", tips: ["步幅适中", "前膝不超脚尖"] },
  { id: "ex-28", name: "提踵", muscleGroup: "legs", equipment: "machine", difficulty: "beginner", category: "isolation", isCustom: false, description: "站姿或坐姿踮脚尖。", tips: ["顶峰停留", "充分拉伸"] },
  { id: "ex-29", name: "卷腹", muscleGroup: "core", equipment: "bodyweight", difficulty: "beginner", category: "isolation", isCustom: false, description: "仰卧收缩上半身卷起。", tips: ["下背部贴地", "颈部放松"] },
  { id: "ex-30", name: "平板支撑", muscleGroup: "core", equipment: "bodyweight", difficulty: "beginner", category: "isolation", isCustom: false, description: "前臂与脚趾支撑，身体成一直线。", tips: ["核心收紧", "臀部不要过高"] },
  { id: "ex-31", name: "俄罗斯转体", muscleGroup: "core", equipment: "bodyweight", difficulty: "intermediate", category: "isolation", isCustom: false, description: "坐姿双腿抬起，躯干左右旋转。", tips: ["转体充分", "保持平衡"] },
  { id: "ex-32", name: "悬垂举腿", muscleGroup: "core", equipment: "other", difficulty: "advanced", category: "isolation", isCustom: false, description: "悬挂于单杠，举起双腿至90度。", tips: ["不摇晃", "下腹发力"] },
  { id: "ex-33", name: "跑步机有氧", muscleGroup: "cardio", equipment: "machine", difficulty: "beginner", category: "cardio", isCustom: false, description: "跑步机快走或慢跑。", tips: ["保持心率区间", "热身5分钟"] },
  { id: "ex-34", name: "划船机", muscleGroup: "cardio", equipment: "machine", difficulty: "beginner", category: "cardio", isCustom: false, description: "划船机全身有氧训练。", tips: ["发力顺序腿-腰-臂", "节奏稳定"] },
  { id: "ex-35", name: "椭圆机", muscleGroup: "cardio", equipment: "machine", difficulty: "beginner", category: "cardio", isCustom: false, description: "椭圆机低冲击有氧。", tips: ["全脚掌踩实", "手臂同步发力"] },
  { id: "ex-36", name: "动态拉伸", muscleGroup: "full-body", equipment: "bodyweight", difficulty: "beginner", category: "flexibility", isCustom: false, description: "训练前动态活动关节与肌肉。", tips: ["循序渐进", "各方向活动"] },
  { id: "ex-37", name: "静态拉伸", muscleGroup: "full-body", equipment: "bodyweight", difficulty: "beginner", category: "flexibility", isCustom: false, description: "训练后静态拉伸保持20-30秒。", tips: ["不疼痛为度", "深呼吸"] },
  { id: "ex-38", name: "硬拉", muscleGroup: "back", equipment: "barbell", difficulty: "advanced", category: "compound", isCustom: false, description: "从地面拉起杠铃至身体直立。", tips: ["脊柱中立", "蹬地发力"] },
  { id: "ex-39", name: "壶铃摆动", muscleGroup: "full-body", equipment: "kettlebell", difficulty: "intermediate", category: "compound", isCustom: false, description: "壶铃从双腿间向前摆动至肩高。", tips: ["髋部发力", "手臂像绳子"] },
  { id: "ex-40", name: "弹力带面拉", muscleGroup: "shoulders", equipment: "band", difficulty: "beginner", category: "isolation", isCustom: false, description: "弹力带固定，拉向面部两侧。", tips: ["外旋肩膀", "后束收缩"] },
];

export const generateMockPlans = (members: Member[]): TrainingPlan[] => {
  return members.slice(0, 10).map((member, idx) => {
    const weeks: TrainingPlan["weeks"] = [];
    for (let w = 1; w <= 4; w++) {
      const days: TrainingPlan["weeks"][0]["days"] = [];
      const schedule = idx % 3;
      let activeDays: number[] = [];
      if (schedule === 0) activeDays = [1, 2, 3, 4, 5];
      else if (schedule === 1) activeDays = [1, 3, 5];
      else activeDays = [1, 2, 4, 5];

      for (let d = 0; d < 7; d++) {
        if (activeDays.includes(d)) {
          const dayName = ["胸部训练", "背部训练", "肩部训练", "腿部训练", "手臂训练", "有氧日", "核心训练"][d];
          const baseExs = mockExercises.filter((e) => {
            if (d === 1) return e.muscleGroup === "chest" || e.muscleGroup === "triceps";
            if (d === 2) return e.muscleGroup === "back" || e.muscleGroup === "biceps";
            if (d === 3) return e.muscleGroup === "shoulders";
            if (d === 4) return e.muscleGroup === "legs";
            if (d === 5) return e.muscleGroup === "biceps" || e.muscleGroup === "triceps";
            return false;
          }).slice(0, 4 + (d % 2));

          days.push({
            dayOfWeek: d as 0 | 1 | 2 | 3 | 4 | 5 | 6,
            name: dayName,
            exercises: baseExs.map((ex, ei) => ({
              id: `pe-${idx}-${w}-${d}-${ei}`,
              exerciseId: ex.id,
              name: ex.name,
              sets: 3 + (ei % 2),
              reps: 8 + (ei % 4) * 2,
              weight: 20 + (ei % 6) * 10,
              restSeconds: 60 + (ei % 2) * 30,
            })),
          });
        }
      }
      weeks.push({ weekNumber: w, days });
    }
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 28);
    return {
      id: `plan-${idx + 1}`,
      memberId: member.id,
      name: [`${member.goal === "muscle" ? "增肌" : member.goal === "fat-loss" ? "减脂" : member.goal === "strength" ? "力量" : "塑形"}计划`, "4周进阶计划", "基础力量循环"][idx % 3],
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      weeks,
      isTemplate: idx < 2,
      createdAt: new Date().toISOString().split("T")[0],
    };
  });
};

export const generateDietAdvice = (member: Member): DietAdvice => {
  const bmr = member.gender === "male"
    ? 88.362 + 13.397 * member.weight + 4.799 * member.height - 5.677 * 30
    : 447.593 + 9.247 * member.weight + 3.098 * member.height - 4.330 * 30;

  const activityMultiplier = 1.55;
  let calories = Math.round(bmr * activityMultiplier);
  let protein = Math.round(member.weight * (member.goal === "muscle" ? 2 : member.goal === "fat-loss" ? 2.2 : 1.6));
  let fat = Math.round((calories * 0.25) / 9);
  let carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  if (member.goal === "muscle") calories += 300;
  if (member.goal === "fat-loss") calories -= 400;

  return {
    memberId: member.id,
    goal: member.goal,
    dailyCalories: calories,
    proteinGrams: protein,
    carbsGrams: carbs,
    fatGrams: fat,
    meals: [
      { id: "m1", name: "早餐", time: "07:30", foods: ["燕麦 50g", "鸡蛋 3个", "牛奶 250ml", "香蕉 1根"], calories: Math.round(calories * 0.25) },
      { id: "m2", name: "午餐", time: "12:00", foods: ["糙米饭 150g", "鸡胸肉 200g", "西兰花 200g", "橄榄油 10g"], calories: Math.round(calories * 0.35) },
      { id: "m3", name: "训练前", time: "16:30", foods: ["全麦面包 2片", "花生酱 20g", "苹果 1个"], calories: Math.round(calories * 0.15) },
      { id: "m4", name: "晚餐", time: "19:00", foods: ["红薯 200g", ["三文鱼", "牛肉", "虾"][member.height % 3] + " 180g", "混合蔬菜 250g"], calories: Math.round(calories * 0.25) },
    ],
    tips: [
      "每日饮水2.5-3L",
      "训练前1小时完成训练前餐",
      "训练后30分钟内补充蛋白质",
      "每周允许1次欺骗餐",
      "保证7-8小时睡眠",
      member.goal === "fat-loss" ? "优先保证蛋白质摄入防止肌肉流失" : member.goal === "muscle" ? "碳水在训练日可适当增加" : "保持营养均衡即可",
    ],
    updatedAt: new Date().toISOString().split("T")[0],
  };
};
