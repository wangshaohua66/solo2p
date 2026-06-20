export const validateHeight = (height: number): string | null => {
  if (!height) return "请输入身高";
  if (height < 100 || height > 250) return "身高应在100-250cm之间";
  return null;
};

export const validateWeight = (weight: number): string | null => {
  if (!weight) return "请输入体重";
  if (weight < 20 || weight > 300) return "体重应在20-300kg之间";
  return null;
};

export const validateAge = (birthDate: string): string | null => {
  if (!birthDate) return "请选择出生日期";
  const age = calculateAge(birthDate);
  if (age < 10 || age > 100) return "年龄应在10-100岁之间";
  return null;
};

export const validateSets = (sets: number): string | null => {
  if (sets == null) return "请输入组数";
  if (sets < 1 || sets > 20) return "组数应在1-20之间";
  return null;
};

export const validateReps = (reps: number): string | null => {
  if (reps == null) return "请输入次数";
  if (reps < 1 || reps > 100) return "次数应在1-100之间";
  return null;
};

export const validateWeightLoad = (weight: number): string | null => {
  if (weight != null && (weight < 0 || weight > 500)) {
    return "重量应在0-500kg之间";
  }
  return null;
};

export const validateRestSeconds = (seconds: number): string | null => {
  if (seconds == null) return "请输入休息时长";
  if (seconds < 10 || seconds > 600) return "休息时长应在10-600秒之间";
  return null;
};

export const validateRPE = (rpe: number): string | null => {
  if (rpe != null && (rpe < 1 || rpe > 10)) {
    return "RPE评分应在1-10之间";
  }
  return null;
};

export const calculateAge = (birthDate: string): number => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const validatePhone = (phone: string): string | null => {
  if (!phone) return null;
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) return "请输入有效的手机号码";
  return null;
};
