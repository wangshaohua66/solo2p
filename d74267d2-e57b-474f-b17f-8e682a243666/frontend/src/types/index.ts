export enum IncidentType {
  EARTHQUAKE = 1,
  FLOOD = 2,
  FIRE = 3,
  TYPHOON = 4,
  DROUGHT = 5,
  LANDSLIDE = 6,
  HAIL = 7,
  FROST = 8,
  HAZARD_MATERIAL = 9,
  TRAFFIC_ACCIDENT = 10,
  OTHER = 99,
}

export enum IncidentLevel {
  I = 1,
  II = 2,
  III = 3,
  IV = 4,
}

export enum IncidentStatus {
  PENDING = 0,
  VERIFIED = 1,
  RESPONDING = 2,
  DISPATCHED = 3,
  HANDLING = 4,
  CONTROLLED = 5,
  CLOSED = 6,
}

export enum TeamStatus {
  AVAILABLE = 1,
  DISPATCHED = 2,
  ON_TASK = 3,
  RETURNING = 4,
  MAINTENANCE = 5,
  UNAVAILABLE = 9,
}

export enum DispatchStatus {
  PENDING = 0,
  APPROVING = 1,
  APPROVED = 2,
  REJECTED = 3,
  DISPATCHED = 4,
  IN_PROGRESS = 5,
  COMPLETED = 6,
  CANCELLED = 7,
}

export enum NotificationChannel {
  SMS = 1,
  APP_PUSH = 2,
  BROADCAST = 3,
}

export enum NotificationStatus {
  PENDING = 0,
  SENDING = 1,
  SENT = 2,
  DELIVERED = 3,
  READ = 4,
  FAILED = 9,
}

export enum ApprovalStatus {
  PENDING = 0,
  APPROVING = 1,
  APPROVED = 2,
  REJECTED = 3,
  AUTO_APPROVED = 4,
}

export interface GeoPoint {
  lng: number;
  lat: number;
}

export interface Incident {
  id: number;
  incidentNo: string;
  type: IncidentType;
  level: IncidentLevel;
  status: IncidentStatus;
  title: string;
  description: string;
  location: string;
  locationPoint: GeoPoint;
  regionCode: string;
  organizationId: number;
  affectedArea: number;
  affectedPopulation: number;
  estimatedLoss: number;
  casualties: number;
  injured: number;
  missing: number;
  trapped: number;
  sourceType: string;
  weatherCondition: string;
  terrainCondition: string;
  occurredAt: string;
  reportedAt: string;
  respondedAt: string;
  controlledAt: string;
  closedAt: string;
  createdAt: string;
}

export interface RescueTeam {
  id: number;
  teamCode: string;
  teamName: string;
  teamType: string;
  teamSize: number;
  organizationId: number;
  regionCode: string;
  address: string;
  locationPoint: GeoPoint;
  leaderName: string;
  leaderPhone: string;
  status: TeamStatus;
  currentTaskCount: number;
  equipment: string;
  capabilities: string;
  responseRadius: number;
  averageArrivalTime: number;
}

export interface DispatchPlan {
  id: number;
  dispatchNo: string;
  incidentId: number;
  incidentNo: string;
  title: string;
  status: DispatchStatus;
  priority: number;
  requiredLevel: number;
  estimatedDistance: number;
  estimatedDuration: number;
  estimatedArrivalTime: string;
  taskDescription: string;
  dangerWarning: string;
  currentApprovalId: number;
  createdAt: string;
  assignments: TeamAssignment[];
}

export interface TeamAssignment {
  id: number;
  dispatchPlanId: number;
  teamId: number;
  teamName: string;
  assignmentRole: string;
  teamCount: number;
  assignedAt: string;
  departedAt: string;
  arrivedAt: string;
  completedAt: string;
  status: string;
  conflictInfo: string;
  taskDetail: string;
}

export interface Warehouse {
  id: number;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: number;
  organizationId: number;
  regionCode: string;
  address: string;
  locationPoint: GeoPoint;
  managerName: string;
  managerPhone: string;
  capacity: number;
  usedCapacity: number;
  status: number;
}

export interface Material {
  id: number;
  materialCode: string;
  materialName: string;
  category: string;
  specification: string;
  unit: string;
  unitPrice: number;
}

export interface InventoryStock {
  id: number;
  warehouseId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  quantity: number;
  lockedQuantity: number;
  availableQuantity: number;
  warningThreshold: number;
}

export interface StockLock {
  id: number;
  lockNo: string;
  incidentId: number;
  dispatchPlanId: number;
  warehouseId: number;
  materialId: number;
  lockQuantity: number;
  estimatedCost: number;
  lockExpireAt: string;
  status: number;
  lockReason: string;
}

export interface AllocationRoute {
  warehouseId: number;
  warehouseName: string;
  materialId: number;
  materialName: string;
  allocateQuantity: number;
  distance: number;
  estimatedDuration: number;
  cost: number;
  routePath: GeoPoint[];
}

export interface AllocationRouteResult {
  incidentId: number;
  dispatchPlanId: number;
  totalDistance: number;
  totalEstimatedDuration: number;
  totalCost: number;
  routes: AllocationRoute[];
}

export interface Notification {
  id: number;
  notificationNo: string;
  incidentId: number;
  dispatchPlanId: number;
  title: string;
  content: string;
  summary: string;
  channel: NotificationChannel;
  targetType: string;
  targetCount: number;
  successCount: number;
  failCount: number;
  readCount: number;
  status: NotificationStatus;
  priority: number;
  regionCode: string;
  incidentLevel: number;
  scheduledAt: string;
  sentAt: string;
  createdAt: string;
}

export interface NotificationReceipt {
  id: number;
  notificationId: number;
  recipientId: number;
  recipientName: string;
  recipientPhone: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt: string;
  deliveredAt: string;
  readAt: string;
}

export interface User {
  id: number;
  username: string;
  realName: string;
  phone: string;
  email: string;
  avatar: string;
  organizationId: number;
  regionCode: string;
  status: number;
  roles: Role[];
  permissions: Permission[];
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description: string;
  dataScope: number;
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  resource: string;
  action: string;
}

export interface Organization {
  id: number;
  code: string;
  name: string;
  level: number;
  parentId: number;
  parentPath: string;
  regionCode: string;
  leader: string;
  phone: string;
  address: string;
  status: number;
  children?: Organization[];
}

export interface PageResult<T> {
  list: T[];
  total: number;
  pageNum: number;
  pageSize: number;
  pages: number;
}

export interface Result<T> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

export interface TimelineEvent {
  id: string;
  time: string;
  type: string;
  title: string;
  description: string;
  incidentId?: number;
  color?: string;
}

export interface MapPoint {
  id: string;
  type: 'incident' | 'team' | 'warehouse' | 'route';
  position: GeoPoint;
  name: string;
  status?: string;
  level?: number;
  data?: Incident | RescueTeam | Warehouse;
}

export interface IncidentStatistics {
  total: number;
  level1: number;
  level2: number;
  level3: number;
  level4: number;
  pending: number;
  responding: number;
  handling: number;
  closed: number;
}

export interface IncidentArchive {
  id: number;
  incidentId: number;
  archiveNo: string;
  archiveType: string;
  archiveStatus: number;
  archivedBy: number;
  archivedAt: string;
  archiveRemark: string;
  createdAt: string;
}

export interface IncidentReviewReport {
  id: number;
  reportNo: string;
  incidentId: number;
  archiveId: number;
  title: string;
  reportType: string;
  incidentSummary: string;
  responseProcess: string;
  timelinessAnalysis: string;
  resourceUtilization: string;
  existingProblems: string;
  improvementMeasures: string;
  lessonsLearned: string;
  responseDuration: number;
  dispatchCount: number;
  teamCount: number;
  materialCount: number;
  casualtyCount: number;
  affectedCount: number;
  lossEstimate: number;
  efficiencyScore: number;
  timelinessScore: number;
  resourceScore: number;
  overallScore: number;
  status: number;
  generatedBy: number;
  generatedAt: string;
  reviewedBy: number;
  reviewedAt: string;
  createdAt: string;
}

export interface IncidentHistoryCase {
  id: number;
  caseNo: string;
  incidentId: number;
  reportId: number;
  caseTitle: string;
  caseType: string;
  incidentType: number;
  incidentLevel: number;
  regionCode: string;
  location: string;
  locationPoint: GeoPoint;
  occurredAt: string;
  endedAt: string;
  durationHours: number;
  description: string;
  keyMeasures: string;
  mainExperiences: string;
  lessonsLearned: string;
  responseEfficiency: string;
  resourceAllocation: string;
  affectedPopulation: number;
  casualtyCount: number;
  directLoss: number;
  overallRating: number;
  tags: string;
  isClassic: boolean;
  status: number;
  createdAt: string;
}

export interface IncidentCaseComparison {
  id: number;
  comparisonNo: string;
  sourceIncidentId: number;
  targetCaseId: number;
  similarity: number;
  comparisonMetrics: string;
  differences: string;
  similarities: string;
  suggestions: string;
  comparisonResult: string;
  status: number;
  createdAt: string;
  targetCase?: IncidentHistoryCase;
}
