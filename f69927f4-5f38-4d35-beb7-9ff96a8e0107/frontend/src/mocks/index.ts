import type {
  Kiln,
  FiringCurve,
  Schedule,
  Batch,
  Supplier,
  Member,
  MemberRoleConfig,
  Incident,
  KilnOpenRecord,
  MaintenanceOrder,
  CostRecord,
  WatchlistEntry,
  AuthUser,
  LoginResponse,
  InventoryWarning,
  MonthlyReportVO,
} from '@/types';

export const mockKilns: Kiln[] = [
  { id: 1, name: '实验窑', type: 'EXPERIMENTAL', maxCapacity: 5, totalFiringCount: 342, lastMaintenanceDate: '2026-05-20', heatingElementImpedance: 12.50, healthStatus: 'HEALTHY', currentTemperature: 520 },
  { id: 2, name: '工作窑', type: 'WORKING', maxCapacity: 15, totalFiringCount: 578, lastMaintenanceDate: '2026-04-15', heatingElementImpedance: 8.30, healthStatus: 'WARNING', currentTemperature: 890 },
  { id: 3, name: '退火窑', type: 'ANNEALING', maxCapacity: 10, totalFiringCount: 215, lastMaintenanceDate: '2026-03-10', heatingElementImpedance: 10.20, healthStatus: 'HEALTHY', currentTemperature: 460 },
];

export const mockCurves: FiringCurve[] = [
  {
    id: 1, name: '基础琉璃烧制曲线', isTemplate: true, createdBy: 1,
    segments: [
      { phase: 'HEAT_UP', targetTemp: 500, duration: 120, maxSlope: 5 },
      { phase: 'HOLD', targetTemp: 500, duration: 60, maxSlope: 0 },
      { phase: 'HEAT_UP', targetTemp: 850, duration: 90, maxSlope: 4 },
      { phase: 'HOLD', targetTemp: 850, duration: 30, maxSlope: 0 },
      { phase: 'COOL_DOWN', targetTemp: 460, duration: 180, maxSlope: 3 },
      { phase: 'HOLD', targetTemp: 460, duration: 60, maxSlope: 0 },
      { phase: 'COOL_DOWN', targetTemp: 50, duration: 300, maxSlope: 2 },
    ],
    createdAt: '2026-01-15T10:00:00', updatedAt: '2026-01-15T10:00:00',
  },
  {
    id: 2, name: '高温硼硅酸盐曲线', isTemplate: true, createdBy: 1,
    segments: [
      { phase: 'HEAT_UP', targetTemp: 600, duration: 150, maxSlope: 5 },
      { phase: 'HOLD', targetTemp: 600, duration: 45, maxSlope: 0 },
      { phase: 'HEAT_UP', targetTemp: 1100, duration: 120, maxSlope: 4 },
      { phase: 'HOLD', targetTemp: 1100, duration: 60, maxSlope: 0 },
      { phase: 'COOL_DOWN', targetTemp: 520, duration: 240, maxSlope: 3 },
      { phase: 'HOLD', targetTemp: 520, duration: 90, maxSlope: 0 },
      { phase: 'COOL_DOWN', targetTemp: 50, duration: 360, maxSlope: 1.5 },
    ],
    createdAt: '2026-02-10T14:30:00', updatedAt: '2026-02-10T14:30:00',
  },
  {
    id: 3, name: '退火慢冷曲线', isTemplate: true, createdBy: 1,
    segments: [
      { phase: 'HEAT_UP', targetTemp: 460, duration: 100, maxSlope: 5 },
      { phase: 'HOLD', targetTemp: 460, duration: 120, maxSlope: 0 },
      { phase: 'COOL_DOWN', targetTemp: 370, duration: 180, maxSlope: 1 },
      { phase: 'COOL_DOWN', targetTemp: 50, duration: 480, maxSlope: 0.8 },
    ],
    createdAt: '2026-03-05T09:00:00', updatedAt: '2026-03-05T09:00:00',
  },
];

const today = new Date();
const fmt = (d: Date) => d.toISOString().slice(0, 19);
const addHours = (d: Date, h: number) => { const r = new Date(d); r.setHours(r.getHours() + h); return r; };

export const mockSchedules: Schedule[] = [
  { id: 1, kilnId: 1, kilnName: '实验窑', memberId: 2, memberName: '李明', curveId: 1, curveName: '基础琉璃烧制曲线', startTime: fmt(today), endTime: fmt(addHours(today, 6)), status: 'FIRING', workpieceCount: 3, note: '琉璃碗实验', createdAt: fmt(today) },
  { id: 2, kilnId: 2, kilnName: '工作窑', memberId: 3, memberName: '王芳', curveId: 2, curveName: '高温硼硅酸盐曲线', startTime: fmt(addHours(today, 1)), endTime: fmt(addHours(today, 9)), status: 'PENDING', workpieceCount: 8, createdAt: fmt(today) },
  { id: 3, kilnId: 3, kilnName: '退火窑', memberId: 4, memberName: '张伟', curveId: 3, curveName: '退火慢冷曲线', startTime: fmt(addHours(today, -4)), endTime: fmt(addHours(today, 4)), status: 'COOLING', workpieceCount: 5, coolDownRemaining: 240, createdAt: fmt(today) },
  { id: 4, kilnId: 1, kilnName: '实验窑', memberId: 5, memberName: '陈静', curveId: 1, curveName: '基础琉璃烧制曲线', startTime: fmt(addHours(today, 7)), endTime: fmt(addHours(today, 13)), status: 'PENDING', workpieceCount: 4, createdAt: fmt(today) },
  { id: 5, kilnId: 2, kilnName: '工作窑', memberId: 6, memberName: '刘洋', curveId: 1, curveName: '基础琉璃烧制曲线', startTime: fmt(addHours(today, 10)), endTime: fmt(addHours(today, 16)), status: 'PENDING', workpieceCount: 12, createdAt: fmt(today) },
];

export const mockSuppliers: Supplier[] = [
  { id: 1, name: '华光玻璃原料有限公司', contactPerson: '赵经理', phone: '021-5555-1234', email: 'zhao@huaguang.com' },
  { id: 2, name: '鑫达化工供应', contactPerson: '钱主管', phone: '010-6666-5678', email: 'qian@xinda.com' },
  { id: 3, name: '博瑞特种材料', contactPerson: '孙总', phone: '0571-7777-9012', email: 'sun@borui.com' },
];

export const mockBatches: Batch[] = [
  { id: 1, batchNo: 'HG-2026-001', supplierId: 1, supplierName: '华光玻璃原料有限公司', materialName: '二氧化硅(SiO₂)', quantity: 50, unit: 'kg', expiryDate: '2027-06-01', oxideComposition: { SiO2: 99.5, Fe2O3: 0.02, Al2O3: 0.3 }, status: 'IN_STOCK', createdAt: '2026-01-20T08:00:00' },
  { id: 2, batchNo: 'HG-2026-002', supplierId: 1, supplierName: '华光玻璃原料有限公司', materialName: '碳酸钠(Na₂CO₃)', quantity: 30, unit: 'kg', expiryDate: '2026-07-15', oxideComposition: { Na2CO3: 99.0, NaCl: 0.5 }, status: 'IN_STOCK', createdAt: '2026-02-05T10:00:00' },
  { id: 3, batchNo: 'XD-2026-001', supplierId: 2, supplierName: '鑫达化工供应', materialName: '硼酸(H₃BO₃)', quantity: 20, unit: 'kg', expiryDate: '2026-06-30', oxideComposition: { H3BO3: 99.8 }, status: 'IN_STOCK', createdAt: '2026-03-10T14:00:00' },
  { id: 4, batchNo: 'BR-2026-001', supplierId: 3, supplierName: '博瑞特种材料', materialName: '氧化铅(PbO)', quantity: 10, unit: 'kg', expiryDate: '2026-06-20', oxideComposition: { PbO: 99.9, Fe2O3: 0.01 }, status: 'IN_STOCK', createdAt: '2026-04-01T09:00:00' },
  { id: 5, batchNo: 'HG-2025-015', supplierId: 1, supplierName: '华光玻璃原料有限公司', materialName: '石灰石(CaCO₃)', quantity: 5, unit: 'kg', expiryDate: '2026-06-15', oxideComposition: { CaCO3: 98.5, MgCO3: 1.0 }, status: 'IN_STOCK', createdAt: '2025-11-20T11:00:00' },
];

export const mockMembers: Member[] = [
  { id: 1, username: 'admin', realName: '系统管理员', email: 'admin@studio.com', phone: '13800000001', role: 'ADMIN', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00' },
  { id: 2, username: 'liming', realName: '李明', email: 'liming@studio.com', phone: '13800000002', role: 'STUDENT', status: 'ACTIVE', createdAt: '2026-01-10T09:00:00', updatedAt: '2026-01-10T09:00:00' },
  { id: 3, username: 'wangfang', realName: '王芳', email: 'wangfang@studio.com', phone: '13800000003', role: 'PROFESSIONAL', status: 'ACTIVE', createdAt: '2026-01-12T10:00:00', updatedAt: '2026-01-12T10:00:00' },
  { id: 4, username: 'zhangwei', realName: '张伟', email: 'zhangwei@studio.com', phone: '13800000004', role: 'REGULAR', status: 'ACTIVE', createdAt: '2026-02-01T08:00:00', updatedAt: '2026-02-01T08:00:00' },
  { id: 5, username: 'chenjing', realName: '陈静', email: 'chenjing@studio.com', phone: '13800000005', role: 'STUDENT', status: 'ACTIVE', createdAt: '2026-02-15T14:00:00', updatedAt: '2026-02-15T14:00:00' },
  { id: 6, username: 'liuyang', realName: '刘洋', email: 'liuyang@studio.com', phone: '13800000006', role: 'REGULAR', status: 'WATCHLIST', createdAt: '2026-03-01T11:00:00', updatedAt: '2026-05-20T16:00:00' },
  { id: 7, username: 'zhaoxin', realName: '赵欣', email: 'zhaoxin@studio.com', phone: '13800000007', role: 'PROFESSIONAL', status: 'ACTIVE', createdAt: '2026-03-10T09:30:00', updatedAt: '2026-03-10T09:30:00' },
];

export const mockRoleConfigs: MemberRoleConfig[] = [
  { id: 1, role: 'STUDENT', allowedKilnTypes: ['EXPERIMENTAL'], maxAdvanceDays: 7, maxDurationHours: 4 },
  { id: 2, role: 'REGULAR', allowedKilnTypes: ['EXPERIMENTAL', 'WORKING'], maxAdvanceDays: 14, maxDurationHours: 8 },
  { id: 3, role: 'PROFESSIONAL', allowedKilnTypes: ['EXPERIMENTAL', 'WORKING', 'ANNEALING'], maxAdvanceDays: 30, maxDurationHours: 12 },
];

export const mockIncidents: Incident[] = [
  { id: 1, kilnOpenRecordId: 1, memberId: 6, memberName: '刘洋', type: 'UNAUTHORIZED_OPEN', severity: 'HIGH', description: '退火窑温度520°C时强行开窑，未达退火温度标准(460°C以下)', resolved: true, createdAt: '2026-05-10T14:30:00', resolvedAt: '2026-05-11T09:00:00' },
  { id: 2, kilnOpenRecordId: null, memberId: 2, memberName: '李明', type: 'TEMPERATURE_ANOMALY', severity: 'MEDIUM', description: '实验窑升温阶段温度异常跳变至950°C，超过设定目标200°C', resolved: true, createdAt: '2026-05-18T10:15:00', resolvedAt: '2026-05-18T11:00:00' },
  { id: 3, kilnOpenRecordId: 2, memberId: 6, memberName: '刘洋', type: 'UNAUTHORIZED_OPEN', severity: 'HIGH', description: '工作窑在冷却阶段(380°C)时违规开窑，导致作品开裂', resolved: false, createdAt: '2026-06-05T16:00:00', resolvedAt: null },
];

export const mockKilnOpenRecords: KilnOpenRecord[] = [
  { id: 1, kilnId: 3, kilnName: '退火窑', scheduleId: 3, operatorId: 6, operatorName: '刘洋', openTime: '2026-05-10T14:30:00', temperatureAtOpen: 520, isViolation: true, note: '未等待退火完成' },
  { id: 2, kilnId: 2, kilnName: '工作窑', scheduleId: 2, operatorId: 6, operatorName: '刘洋', openTime: '2026-06-05T16:00:00', temperatureAtOpen: 380, isViolation: true, note: '冷却阶段违规开窑' },
];

export const mockMaintenanceOrders: MaintenanceOrder[] = [
  { id: 1, kilnId: 2, kilnName: '工作窑', type: 'EMERGENCY', description: '加热元件阻抗偏高，需更换B区加热丝', status: 'PENDING', scheduledDate: '2026-06-15', completedDate: null, createdAt: '2026-06-08T10:00:00' },
  { id: 2, kilnId: 1, kilnName: '实验窑', type: 'ROUTINE', description: '季度例行维护：检查热电偶、密封条、控制系统', status: 'COMPLETED', scheduledDate: '2026-05-20', completedDate: '2026-05-21', createdAt: '2026-05-15T09:00:00' },
  { id: 3, kilnId: 3, kilnName: '退火窑', type: 'ROUTINE', description: '半年维护：清洁炉膛、校准温控系统', status: 'PENDING', scheduledDate: '2026-06-20', completedDate: null, createdAt: '2026-06-01T08:00:00' },
];

export const mockCostRecords: CostRecord[] = [
  { id: 1, scheduleId: 1, electricityCost: 45.6, materialCost: 120.0, laborCost: 80.0, totalCost: 245.6, costPerWorkpiece: 81.87 },
  { id: 2, scheduleId: 2, electricityCost: 89.2, materialCost: 340.0, laborCost: 150.0, totalCost: 579.2, costPerWorkpiece: 72.4 },
  { id: 3, scheduleId: 3, electricityCost: 62.8, materialCost: 95.0, laborCost: 60.0, totalCost: 217.8, costPerWorkpiece: 43.56 },
];

export const mockWatchlist: WatchlistEntry[] = [
  { id: 1, memberId: 6, memberName: '刘洋', reason: '两次违规开窑操作，自动加入观察名单', incidentId: 3, watchUntil: '2026-09-05', createdAt: '2026-06-05T16:30:00' },
];

export const mockAuthUser: AuthUser = {
  id: 1,
  username: 'admin',
  realName: '系统管理员',
  email: 'admin@studio.com',
  role: 'ADMIN',
};

export const mockLoginResponse: LoginResponse = {
  token: 'mock-jwt-token-xxx',
  refreshToken: 'mock-refresh-token-xxx',
  user: mockAuthUser,
};

export const mockWarnings: InventoryWarning[] = [
  { id: 1, batchId: 3, batchNo: 'XD-2026-001', materialName: '硼酸(H₃BO₃)', type: 'EXPIRY_SOON', message: '硼酸将于2026-06-30过期，距到期不足20天' },
  { id: 2, batchId: 4, batchNo: 'BR-2026-001', materialName: '氧化铅(PbO)', type: 'EXPIRY_SOON', message: '氧化铅将于2026-06-20过期，距到期不足10天' },
  { id: 3, batchId: 5, batchNo: 'HG-2025-015', materialName: '石灰石(CaCO₃)', type: 'EXPIRED', message: '石灰石已过期（2026-06-15）' },
];

export const mockMonthlyReport: MonthlyReportVO = {
  year: 2026,
  month: 6,
  totalElectricityCost: 197.6,
  totalMaterialCost: 555.0,
  totalLaborCost: 290.0,
  totalCost: 1042.6,
  firingCount: 3,
  schedules: mockSchedules,
};
