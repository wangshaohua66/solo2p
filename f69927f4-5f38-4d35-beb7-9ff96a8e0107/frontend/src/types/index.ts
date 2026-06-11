export type MemberRole = 'STUDENT' | 'REGULAR' | 'PROFESSIONAL' | 'ADMIN';

export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'WATCHLIST';

export type KilnType = 'EXPERIMENTAL' | 'WORKING' | 'ANNEALING';

export type ScheduleStatus = 'PENDING' | 'FIRING' | 'COOLING' | 'COMPLETED' | 'CANCELLED';

export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export type CurvePhase = 'HEAT_UP' | 'HOLD' | 'COOL_DOWN';

export type IncidentType = 'UNAUTHORIZED_OPEN' | 'TEMPERATURE_ANOMALY' | 'OTHER';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type MaintenanceType = 'ROUTINE' | 'EMERGENCY';

export type MaintenanceStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export type BatchStatus = 'IN_STOCK' | 'CHECKED_OUT' | 'EXPIRED';

export interface CurveSegment {
  phase: CurvePhase;
  targetTemp: number;
  duration: number;
  maxSlope: number;
}

export interface Member {
  id: number;
  username: string;
  realName: string;
  email: string;
  phone: string;
  role: MemberRole;
  status: MemberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MemberRoleConfig {
  id: number;
  role: MemberRole;
  allowedKilnTypes: KilnType[];
  maxAdvanceDays: number;
  maxDurationHours: number;
}

export interface Kiln {
  id: number;
  name: string;
  type: KilnType;
  maxCapacity: number;
  totalFiringCount: number;
  lastMaintenanceDate: string | null;
  heatingElementImpedance: number;
  healthStatus: HealthStatus;
  currentTemperature?: number;
}

export interface FiringCurve {
  id: number;
  name: string;
  segments: CurveSegment[];
  isTemplate: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: number;
  kilnId: number;
  kilnName: string;
  memberId: number;
  memberName: string;
  curveId: number;
  curveName: string;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
  workpieceCount: number;
  coolDownRemaining?: number;
  note?: string;
  createdAt: string;
}

export interface Batch {
  id: number;
  batchNo: string;
  supplierId: number;
  supplierName: string;
  materialName: string;
  quantity: number;
  unit: string;
  expiryDate: string | null;
  oxideComposition: Record<string, number>;
  spectralData?: string;
  status: BatchStatus;
  createdAt: string;
}

export interface Supplier {
  id: number;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
}

export interface KilnOpenRecord {
  id: number;
  kilnId: number;
  kilnName: string;
  scheduleId: number;
  operatorId: number;
  operatorName: string;
  openTime: string;
  temperatureAtOpen: number;
  isViolation: boolean;
  note?: string;
}

export interface Incident {
  id: number;
  kilnOpenRecordId: number | null;
  memberId: number;
  memberName: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

export interface MaintenanceOrder {
  id: number;
  kilnId: number;
  kilnName: string;
  type: MaintenanceType;
  description: string;
  status: MaintenanceStatus;
  scheduledDate: string;
  completedDate: string | null;
  createdAt: string;
}

export interface CostRecord {
  id: number;
  scheduleId: number;
  electricityCost: number;
  materialCost: number;
  laborCost: number;
  totalCost: number;
  costPerWorkpiece: number;
}

export interface WatchlistEntry {
  id: number;
  memberId: number;
  memberName: string;
  reason: string;
  incidentId: number | null;
  watchUntil: string;
  createdAt: string;
}

export interface PageResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface TemperatureReading {
  kilnId: number;
  temperature: number;
  timestamp: string;
}

export interface WSAlert {
  type: 'TEMPERATURE_ANOMALY' | 'UNAUTHORIZED_OPEN' | 'MAINTENANCE_DUE';
  message: string;
}

export interface WSScheduleUpdate {
  scheduleId: number;
  status: string;
  message: string;
}

export interface CostVO {
  electricityCost: number;
  materialCost: number;
  laborCost: number;
  totalCost: number;
  costPerWorkpiece: number;
}

export interface MonthlyReportVO {
  year: number;
  month: number;
  totalElectricityCost: number;
  totalMaterialCost: number;
  totalLaborCost: number;
  totalCost: number;
  firingCount: number;
  schedules: Schedule[];
}

export interface AuthUser {
  id: number;
  username: string;
  realName: string;
  email: string;
  role: MemberRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: AuthUser;
}

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface InventoryWarning {
  id: number;
  batchId: number;
  batchNo: string;
  materialName: string;
  type: 'EXPIRY_SOON' | 'LOW_STOCK' | 'EXPIRED';
  message: string;
}
