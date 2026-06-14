export const SOIL_COLORS: Record<string, string> = {
  '黄褐色': '#D4A574',
  '灰褐色': '#8B7355',
  '红褐色': '#B87333',
  '黑褐色': '#4A3728',
  '灰黄色': '#C4A66B',
  '棕褐色': '#8B4513',
  '浅黄色': '#F5DEB3',
  '深褐色': '#5C4033',
  '灰色': '#808080',
  '红色': '#CD5C5C',
  '黄色': '#DAA520',
  '棕色': '#A0522D',
};

export const getSoilColor = (soilColor: string): string => {
  return SOIL_COLORS[soilColor] || '#A0826D';
};

export const getSoilColorWithOpacity = (soilColor: string, opacity: number = 0.8): string => {
  const hexColor = getSoilColor(soilColor);
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const STRATA_PERIOD_COLORS: Record<string, string> = {
  '旧石器时代': '#8B4513',
  '新石器时代': '#CD853F',
  '青铜时代': '#B8860B',
  '铁器时代': '#6B4423',
  '汉代': '#DC143C',
  '唐代': '#FF6347',
  '宋代': '#4682B4',
  '明代': '#708090',
  '清代': '#556B2F',
  '近现代': '#2F4F4F',
  '未知': '#808080',
};

export const getPeriodColor = (period: string): string => {
  return STRATA_PERIOD_COLORS[period] || '#808080';
};

export const GRID_STATUS_COLORS = {
  unexcavated: '#E8E4DF',
  excavating: '#D4AF37',
  completed: '#8B4513',
};

export const getGridStatusColor = (status: string): string => {
  return GRID_STATUS_COLORS[status as keyof typeof GRID_STATUS_COLORS] || '#E8E4DF';
};

export const PROGRESS_COLORS = {
  good: '#228B22',
  warning: '#DAA520',
  danger: '#DC2626',
};

export const getProgressColor = (progress: number, isOverdue: boolean): string => {
  if (isOverdue) return PROGRESS_COLORS.danger;
  if (progress >= 80) return PROGRESS_COLORS.good;
  if (progress >= 50) return PROGRESS_COLORS.warning;
  return PROGRESS_COLORS.danger;
};

export const THEME_COLORS = {
  background: '#F5F2ED',
  primary: '#8B4513',
  secondary: '#D4AF37',
  accent: '#5C4033',
  text: '#2D2A26',
  textLight: '#6B6B6B',
  border: '#D4CFC7',
  success: '#228B22',
  warning: '#DAA520',
  danger: '#DC2626',
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

export const generateGradient = (color: string, intensity: number = 0.3): string => {
  const { r, g, b } = hexToRgb(color);
  return `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.1) 0%, rgba(${r}, ${g}, ${b}, 0.3) 100%)`;
};

export const SITE_STATUS_LABELS: Record<string, string> = {
  planning: '规划中',
  excavating: '进行中',
  completed: '已完成',
};

export const SITE_STATUS_COLORS: Record<string, string> = {
  planning: 'blue',
  excavating: 'green',
  completed: 'default',
};

export const getSiteStatusLabel = (status: string): string => {
  return SITE_STATUS_LABELS[status] || status;
};

export const getSiteStatusColor = (status: string): string => {
  return SITE_STATUS_COLORS[status] || 'default';
};
