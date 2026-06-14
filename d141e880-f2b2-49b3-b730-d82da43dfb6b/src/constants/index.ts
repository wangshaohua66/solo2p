import { ArtifactCategory } from '@/types';

export const ARTIFACT_CATEGORIES: ArtifactCategory[] = [
  {
    value: 'pottery',
    label: '陶器',
    children: [
      { value: 'cooking_vessel', label: '炊器' },
      { value: 'storage_vessel', label: '储藏器' },
      { value: 'drinking_vessel', label: '饮器' },
      { value: 'eating_vessel', label: '食器' },
      { value: 'pottery_fragment', label: '陶片' },
    ],
  },
  {
    value: 'bronze',
    label: '铜器',
    children: [
      { value: 'bronze_ritual', label: '礼器' },
      { value: 'bronze_weapon', label: '兵器' },
      { value: 'bronze_tool', label: '工具' },
      { value: 'bronze_ornament', label: '饰件' },
      { value: 'bronze_coin', label: '钱币' },
    ],
  },
  {
    value: 'jade',
    label: '玉器',
    children: [
      { value: 'jade_ritual', label: '礼玉' },
      { value: 'jade_ornament', label: '佩饰' },
      { value: 'jade_burial', label: '葬玉' },
      { value: 'jade_tool', label: '玉工具' },
    ],
  },
  {
    value: 'stone',
    label: '石器',
    children: [
      { value: 'stone_tool', label: '石工具' },
      { value: 'stone_weapon', label: '石兵器' },
      { value: 'stone_ornament', label: '石饰件' },
      { value: 'stone_core', label: '石核' },
      { value: 'stone_flake', label: '石片' },
    ],
  },
  {
    value: 'bone',
    label: '骨器',
    children: [
      { value: 'bone_tool', label: '骨工具' },
      { value: 'bone_ornament', label: '骨饰件' },
      { value: 'bone_arrowhead', label: '骨镞' },
      { value: 'animal_bone', label: '兽骨' },
    ],
  },
  {
    value: 'porcelain',
    label: '瓷器',
    children: [
      { value: 'porcelain_vessel', label: '瓷容器' },
      { value: 'porcelain_fragment', label: '瓷片' },
      { value: 'porcelain_ornament', label: '瓷饰件' },
    ],
  },
  {
    value: 'other',
    label: '其他',
    children: [
      { value: 'wood', label: '木器' },
      { value: 'lacquer', label: '漆器' },
      { value: 'glass', label: '玻璃器' },
      { value: 'gold_silver', label: '金银器' },
      { value: 'unknown', label: '不明' },
    ],
  },
];

export const CONDITION_OPTIONS: { value: string; label: string }[] = [
  { value: '完好', label: '完好' },
  { value: '较好', label: '较好' },
  { value: '一般', label: '一般' },
  { value: '残损', label: '残损' },
  { value: '严重残损', label: '严重残损' },
];

export const SITE_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'planning', label: '规划中' },
  { value: 'excavating', label: '进行中' },
  { value: 'completed', label: '已完成' },
];

export const PERIOD_OPTIONS = [
  { value: '旧石器时代', label: '旧石器时代' },
  { value: '新石器时代', label: '新石器时代' },
  { value: '青铜时代', label: '青铜时代' },
  { value: '铁器时代', label: '铁器时代' },
  { value: '汉代', label: '汉代' },
  { value: '唐代', label: '唐代' },
  { value: '宋代', label: '宋代' },
  { value: '明代', label: '明代' },
  { value: '清代', label: '清代' },
  { value: '近现代', label: '近现代' },
  { value: '未知', label: '待鉴定' },
];

export const SOIL_TYPE_OPTIONS = [
  { value: '粘土', label: '粘土' },
  { value: '砂土', label: '砂土' },
  { value: '壤土', label: '壤土' },
  { value: '粉土', label: '粉土' },
  { value: '淤泥', label: '淤泥' },
  { value: '砾石', label: '砾石' },
  { value: '混合土', label: '混合土' },
];

export const SOIL_COLOR_OPTIONS = [
  { value: '黄褐色', label: '黄褐色' },
  { value: '灰褐色', label: '灰褐色' },
  { value: '红褐色', label: '红褐色' },
  { value: '黑褐色', label: '黑褐色' },
  { value: '灰黄色', label: '灰黄色' },
  { value: '棕褐色', label: '棕褐色' },
  { value: '浅黄色', label: '浅黄色' },
  { value: '深褐色', label: '深褐色' },
  { value: '灰色', label: '灰色' },
  { value: '红色', label: '红色' },
  { value: '黄色', label: '黄色' },
  { value: '棕色', label: '棕色' },
];



export const GRID_STATUS_OPTIONS = [
  { value: 'unexcavated', label: '未发掘' },
  { value: 'excavating', label: '发掘中' },
  { value: 'completed', label: '已完成' },
];

export const USER_ROLE_OPTIONS = [
  { value: 'manager', label: '工地负责人' },
  { value: 'recorder', label: '记录员' },
  { value: 'researcher', label: '研究员' },
];

export const STORAGE_KEYS = {
  SITE_DATA: 'archaeology_site_data',
  ARTIFACT_DATA: 'archaeology_artifact_data',
  USER_PREFERENCES: 'archaeology_user_preferences',
};

export const CANVAS_CONFIG = {
  DEFAULT_SCALE: 1,
  MIN_SCALE: 0.5,
  MAX_SCALE: 3,
  SCALE_STEP: 0.1,
  GRID_PADDING: 20,
  GRID_CELL_PX: 80,
  LONG_PRESS_DURATION: 500,
};

export const LAYOUT_CONFIG = {
  leftPanelWidth: 240,
  rightDrawerWidth: 380,
  topNavbarHeight: 56,
  mobileBreakpoint: 768,
  tabletBreakpoint: 1366,
};

export const ALERT_TYPE_OPTIONS = [
  { value: 'info', label: '信息' },
  { value: 'warning', label: '警告' },
  { value: 'error', label: '错误' },
  { value: 'success', label: '成功' },
];

export const getCategoryLabel = (value: string): string => {
  for (const category of ARTIFACT_CATEGORIES) {
    if (category.value === value) return category.label;
    for (const child of category.children) {
      if (child.value === value) return child.label;
    }
  }
  return value;
};

export const getConditionLabel = (value: string): string => {
  const opt = CONDITION_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : value;
};

export const getPeriodLabel = (value: string): string => {
  return PERIOD_OPTIONS.find((o) => o.value === value)?.label || value;
};

export const getSiteStatusLabel = (value: string): string => {
  return SITE_STATUS_OPTIONS.find((o) => o.value === value)?.label || value;
};

export const getGridStatusLabel = (value: string): string => {
  return GRID_STATUS_OPTIONS.find((o) => o.value === value)?.label || value;
};
