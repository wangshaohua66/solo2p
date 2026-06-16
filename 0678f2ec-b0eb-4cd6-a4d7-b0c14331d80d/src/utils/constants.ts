import type { Terminal, StandStatus, VehicleType, ServiceType, AlertLevel, UserRole } from '@/types/apron';

export const AIRPORT_NAME = '江北国际机场';
export const AIRPORT_CODE = 'CKG';

export const SVG_VIEWBOX = {
  width: 1920,
  height: 1080,
};

export const TERMINALS: Terminal[] = ['T1', 'T2', 'T3'];

export const TERMINAL_NAMES: Record<Terminal, string> = {
  T1: 'T1 航站楼',
  T2: 'T2 航站楼',
  T3: 'T3 航站楼',
};

export const STAND_STATUSES: StandStatus[] = ['available', 'occupied', 'in-service', 'maintenance'];

export const STAND_STATUS_LABELS: Record<StandStatus, string> = {
  available: '空闲',
  occupied: '占用',
  'in-service': '保障中',
  maintenance: '故障',
};

export const STAND_STATUS_COLORS: Record<StandStatus, string> = {
  available: '#10b981',
  occupied: '#3b82f6',
  'in-service': '#f59e0b',
  maintenance: '#ef4444',
};

export const VEHICLE_TYPES: VehicleType[] = ['tug', 'fuel', 'water', 'waste', 'stairs'];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  tug: '拖车',
  fuel: '加油车',
  water: '清水车',
  waste: '垃圾车',
  stairs: '客梯车',
};

export const VEHICLE_TYPE_COLORS: Record<VehicleType, string> = {
  tug: '#3b82f6',
  fuel: '#eab308',
  water: '#06b6d4',
  waste: '#8b5cf6',
  stairs: '#ec4899',
};

export const VEHICLE_TYPE_SHAPES: Record<VehicleType, 'square' | 'circle' | 'triangle' | 'diamond'> = {
  tug: 'square',
  fuel: 'circle',
  water: 'triangle',
  waste: 'diamond',
  stairs: 'square',
};

export const SERVICE_TYPES: ServiceType[] = ['towing', 'fueling', 'cleaning', 'catering', 'boarding'];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  towing: '拖车引导',
  fueling: '加油作业',
  cleaning: '清洁作业',
  catering: '餐食补给',
  boarding: '旅客登机',
};

export const SERVICE_TYPE_COLORS: Record<ServiceType, string> = {
  towing: '#3b82f6',
  fueling: '#eab308',
  cleaning: '#06b6d4',
  catering: '#8b5cf6',
  boarding: '#10b981',
};

export const SERVICE_DURATIONS: Record<ServiceType, number> = {
  towing: 10,
  fueling: 25,
  cleaning: 20,
  catering: 15,
  boarding: 30,
};

export const ALERT_LEVELS: AlertLevel[] = ['red', 'orange', 'blue'];

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  red: '紧急',
  orange: '警告',
  blue: '提示',
};

export const ALERT_LEVEL_COLORS: Record<AlertLevel, string> = {
  red: '#ef4444',
  orange: '#f59e0b',
  blue: '#3b82f6',
};

export const USER_ROLES: UserRole[] = ['dispatcher', 'ground-crew', 'supervisor'];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  dispatcher: '机坪调度员',
  'ground-crew': '地勤队长',
  supervisor: '运行主管',
};

export const AIRLINES = [
  { code: 'CA', name: '中国国航', color: '#C8102E' },
  { code: 'MU', name: '东方航空', color: '#003087' },
  { code: 'CZ', name: '南方航空', color: '#00468B' },
  { code: 'HU', name: '海南航空', color: '#E60012' },
  { code: '3U', name: '四川航空', color: '#EA0029' },
  { code: 'ZH', name: '深圳航空', color: '#C8102E' },
  { code: 'MF', name: '厦门航空', color: '#1D428A' },
  { code: 'FM', name: '上海航空', color: '#003087' },
];

export const AIRCRAFT_TYPES = [
  'A320', 'A321', 'A330', 'A350',
  'B737', 'B738', 'B787', 'B777',
];

export const MIN_TURNAROUND_INTERVAL = 45 * 60 * 1000;

export const WIND_CROSSWIND_THRESHOLD = 15;

export const VISIBILITY_THRESHOLD = 800;

export const ZOOM_RANGE = {
  min: 0.5,
  max: 3,
  default: 1,
};

export const RESPONSIVE_BREAKPOINTS = {
  desktop: 1920,
  laptop: 1280,
  tablet: 768,
};

export const SIMULATION_INTERVAL = 1000;

export const MAX_ALERTS = 50;

export const MAX_VEHICLE_TRAIL = 10;
