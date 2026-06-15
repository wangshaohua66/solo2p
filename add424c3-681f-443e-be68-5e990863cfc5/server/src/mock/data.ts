import {
  User,
  RoadSection,
  ConstructionTeam,
  Disorder,
  WorkOrder,
  TrackPoint,
  CoverageStats,
  AcceptanceRecord,
  UserRole,
  DisorderType,
  Severity,
  DisorderStatus,
  WorkOrderStatus
} from '@/types';

export const mockUsers: User[] = [
  {
    id: 'user-001',
    username: 'inspector01',
    name: '张巡查',
    role: 'inspector' as UserRole,
    phone: '13800138001',
    avatar: '',
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 'user-002',
    username: 'manager01',
    name: '李经理',
    role: 'manager' as UserRole,
    phone: '13800138002',
    avatar: '',
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 'user-003',
    username: 'foreman01',
    name: '王工头',
    role: 'foreman' as UserRole,
    phone: '13800138003',
    avatar: '',
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 'user-004',
    username: 'acceptor01',
    name: '赵验收',
    role: 'acceptor' as UserRole,
    phone: '13800138004',
    avatar: '',
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 'user-005',
    username: 'admin01',
    name: '孙管理员',
    role: 'admin' as UserRole,
    phone: '13800138005',
    avatar: '',
    createdAt: '2024-01-01T00:00:00.000Z'
  }
];

export const mockRoadSections: RoadSection[] = [
  {
    id: 'road-001',
    name: '京福线',
    code: 'G104',
    startPoint: '北京永定门',
    endPoint: '福州',
    length: 2420,
    direction: '南北向',
    region: '华北-华东',
    level: '国道'
  },
  {
    id: 'road-002',
    name: '山深线',
    code: 'G205',
    startPoint: '山海关',
    endPoint: '深圳',
    length: 3009,
    direction: '南北向',
    region: '华北-华东-华南',
    level: '国道'
  },
  {
    id: 'road-003',
    name: '沪霍线',
    code: 'G312',
    startPoint: '上海',
    endPoint: '霍尔果斯',
    length: 4967,
    direction: '东西向',
    region: '华东-华中-西北',
    level: '国道'
  },
  {
    id: 'road-004',
    name: '京珠线',
    code: 'G106',
    startPoint: '北京',
    endPoint: '广州',
    length: 2476,
    direction: '南北向',
    region: '华北-华中-华南',
    level: '国道'
  },
  {
    id: 'road-005',
    name: '荣兰线',
    code: 'G309',
    startPoint: '荣成',
    endPoint: '兰州',
    length: 2208,
    direction: '东西向',
    region: '华东-华北-西北',
    level: '国道'
  }
];

export const mockConstructionTeams: ConstructionTeam[] = [
  {
    id: 'team-001',
    name: '第一维修队',
    leaderName: '陈队',
    leaderPhone: '13900139001',
    memberCount: 8,
    skills: ['crack', 'pothole', 'rutting'] as DisorderType[],
    status: 'idle'
  },
  {
    id: 'team-002',
    name: '第二维修队',
    leaderName: '刘队',
    leaderPhone: '13900139002',
    memberCount: 6,
    skills: ['bridge_jump', 'rutting', 'other'] as DisorderType[],
    status: 'working',
    currentWorkOrderId: 'wo-002'
  },
  {
    id: 'team-003',
    name: '应急抢修队',
    leaderName: '周队',
    leaderPhone: '13900139003',
    memberCount: 12,
    skills: ['crack', 'pothole', 'bridge_jump', 'rutting', 'other'] as DisorderType[],
    status: 'idle'
  }
];

export const mockDisorders: Disorder[] = [
  {
    id: 'dis-001',
    type: 'pothole',
    severity: 'severe',
    description: '路面出现直径约50cm的坑槽，深度约10cm，影响行车安全',
    location: {
      lat: 39.9042,
      lng: 116.4074,
      address: '北京市东城区长安街',
      roadSectionId: 'road-001',
      mileage: 'K12+500'
    },
    images: ['/images/dis001_1.jpg', '/images/dis001_2.jpg'],
    reporterId: 'user-001',
    reporterName: '张巡查',
    status: 'repairing',
    workOrderId: 'wo-001',
    gradedBy: 'user-002',
    gradedAt: '2024-06-10T10:30:00.000Z',
    createdAt: '2024-06-10T09:15:00.000Z',
    updatedAt: '2024-06-12T14:00:00.000Z'
  },
  {
    id: 'dis-002',
    type: 'crack',
    severity: 'moderate',
    description: '纵向裂缝，长度约3米，宽度约5mm',
    location: {
      lat: 39.9142,
      lng: 116.4174,
      address: '北京市朝阳区建国路',
      roadSectionId: 'road-002',
      mileage: 'K8+200'
    },
    images: ['/images/dis002_1.jpg'],
    reporterId: 'user-001',
    reporterName: '张巡查',
    status: 'assigned',
    workOrderId: 'wo-002',
    gradedBy: 'user-002',
    gradedAt: '2024-06-11T09:00:00.000Z',
    createdAt: '2024-06-11T08:30:00.000Z',
    updatedAt: '2024-06-11T10:00:00.000Z'
  },
  {
    id: 'dis-003',
    type: 'bridge_jump',
    severity: 'critical',
    description: '桥头跳车严重，高差约8cm，车辆通过时颠簸明显',
    location: {
      lat: 39.9242,
      lng: 116.4274,
      address: '北京市通州区京哈高速桥',
      roadSectionId: 'road-003',
      mileage: 'K25+800'
    },
    images: ['/images/dis003_1.jpg', '/images/dis003_2.jpg', '/images/dis003_3.jpg'],
    reporterId: 'user-001',
    reporterName: '张巡查',
    status: 'accepting',
    workOrderId: 'wo-003',
    gradedBy: 'user-002',
    gradedAt: '2024-06-08T11:00:00.000Z',
    createdAt: '2024-06-08T10:00:00.000Z',
    updatedAt: '2024-06-13T16:30:00.000Z'
  },
  {
    id: 'dis-004',
    type: 'rutting',
    severity: 'mild',
    description: '车辙痕迹，深度约2cm，主要在行车道',
    location: {
      lat: 39.9342,
      lng: 116.4374,
      address: '北京市丰台区南三环',
      roadSectionId: 'road-001',
      mileage: 'K18+300'
    },
    images: ['/images/dis004_1.jpg'],
    reporterId: 'user-001',
    reporterName: '张巡查',
    status: 'closed',
    workOrderId: 'wo-004',
    gradedBy: 'user-002',
    gradedAt: '2024-06-05T14:00:00.000Z',
    createdAt: '2024-06-05T13:00:00.000Z',
    updatedAt: '2024-06-09T10:00:00.000Z'
  },
  {
    id: 'dis-005',
    type: 'pothole',
    severity: 'critical',
    description: '大面积坑槽群，约2平方米范围，深度15cm',
    location: {
      lat: 39.9442,
      lng: 116.4474,
      address: '北京市海淀区西直门',
      roadSectionId: 'road-004',
      mileage: 'K5+600'
    },
    images: ['/images/dis005_1.jpg', '/images/dis005_2.jpg'],
    reporterId: 'user-001',
    reporterName: '张巡查',
    status: 'assigned',
    workOrderId: 'wo-005',
    gradedBy: 'user-002',
    gradedAt: '2024-06-12T16:00:00.000Z',
    createdAt: '2024-06-12T15:00:00.000Z',
    updatedAt: '2024-06-12T17:30:00.000Z'
  },
  {
    id: 'dis-006',
    type: 'crack',
    severity: 'severe',
    description: '网状裂缝，面积约1.5平方米，裂缝宽度约8mm',
    location: {
      lat: 39.9542,
      lng: 116.4574,
      address: '北京市石景山区石景山',
      roadSectionId: 'road-005',
      mileage: 'K15+400'
    },
    images: ['/images/dis006_1.jpg'],
    reporterId: 'user-001',
    reporterName: '张巡查',
    status: 'graded',
    gradedBy: 'user-002',
    gradedAt: '2024-06-13T09:30:00.000Z',
    createdAt: '2024-06-13T08:45:00.000Z',
    updatedAt: '2024-06-13T09:30:00.000Z'
  },
  {
    id: 'dis-007',
    type: 'other',
    severity: 'moderate',
    description: '路面泛油，表面光滑，雨天易打滑',
    location: {
      lat: 39.9642,
      lng: 116.4674,
      address: '北京市昌平区回龙观',
      roadSectionId: 'road-002',
      mileage: 'K32+100'
    },
    images: ['/images/dis007_1.jpg'],
    reporterId: 'user-001',
    reporterName: '张巡查',
    status: 'reported',
    createdAt: '2024-06-13T14:00:00.000Z',
    updatedAt: '2024-06-13T14:00:00.000Z'
  },
  {
    id: 'dis-008',
    type: 'bridge_jump',
    severity: 'severe',
    description: '桥台沉降引起跳车，高差约5cm',
    location: {
      lat: 39.9742,
      lng: 116.4774,
      address: '北京市大兴区南六环桥',
      roadSectionId: 'road-003',
      mileage: 'K48+900'
    },
    images: ['/images/dis008_1.jpg', '/images/dis008_2.jpg'],
    reporterId: 'user-001',
    reporterName: '张巡查',
    status: 'repairing',
    workOrderId: 'wo-006',
    gradedBy: 'user-002',
    gradedAt: '2024-06-10T11:00:00.000Z',
    createdAt: '2024-06-10T10:00:00.000Z',
    updatedAt: '2024-06-13T09:00:00.000Z'
  },
  {
    id: 'dis-009',
    type: 'rutting',
    severity: 'severe',
    description: '严重车辙，深度约5cm，沿行车道纵向分布约20米',
    location: {
      lat: 39.9842,
      lng: 116.4874,
      address: '北京市顺义区机场高速',
      roadSectionId: 'road-001',
      mileage: 'K56+700'
    },
    images: ['/images/dis009_1.jpg'],
    reporterId: 'user-001',
    reporterName: '张巡查',
    status: 'reported',
    createdAt: '2024-06-14T09:00:00.000Z',
    updatedAt: '2024-06-14T09:00:00.000Z'
  },
  {
    id: 'dis-010',
    type: 'pothole',
    severity: 'moderate',
    description: '单个坑槽，直径约30cm，深度约6cm',
    location: {
      lat: 39.9942,
      lng: 116.4974,
      address: '北京市房山区良乡',
      roadSectionId: 'road-004',
      mileage: 'K22+300'
    },
    images: ['/images/dis010_1.jpg'],
    reporterId: 'user-001',
    reporterName: '张巡查',
    status: 'graded',
    gradedBy: 'user-002',
    gradedAt: '2024-06-14T11:00:00.000Z',
    createdAt: '2024-06-14T10:00:00.000Z',
    updatedAt: '2024-06-14T11:00:00.000Z'
  }
];

export const mockWorkOrders: WorkOrder[] = [
  {
    id: 'wo-001',
    disorderId: 'dis-001',
    title: 'G104 K12+500 坑槽维修',
    description: '路面坑槽维修，需铺设沥青混合料',
    teamId: 'team-001',
    teamName: '第一维修队',
    assigneeId: 'user-003',
    assigneeName: '王工头',
    status: 'repairing',
    priority: 'high',
    estimatedHours: 8,
    materials: [
      { name: 'AC-13沥青混合料', quantity: 2, unit: '吨' },
      { name: '乳化沥青', quantity: 50, unit: 'kg' }
    ],
    createdAt: '2024-06-10T11:00:00.000Z',
    updatedAt: '2024-06-12T14:00:00.000Z',
    deadline: '2024-06-15T00:00:00.000Z'
  },
  {
    id: 'wo-002',
    disorderId: 'dis-002',
    title: 'G205 K8+200 裂缝灌缝',
    description: '纵向裂缝处理，采用灌缝胶密封',
    teamId: 'team-002',
    teamName: '第二维修队',
    assigneeId: 'user-003',
    assigneeName: '王工头',
    status: 'assigned',
    priority: 'medium',
    estimatedHours: 4,
    materials: [
      { name: '灌缝胶', quantity: 20, unit: 'kg' }
    ],
    createdAt: '2024-06-11T10:30:00.000Z',
    updatedAt: '2024-06-11T10:30:00.000Z',
    deadline: '2024-06-18T00:00:00.000Z'
  },
  {
    id: 'wo-003',
    disorderId: 'dis-003',
    title: 'G312 K25+800 桥头跳车处理',
    description: '桥头搭板更换及路面顺接',
    teamId: 'team-003',
    teamName: '应急抢修队',
    assigneeId: 'user-003',
    assigneeName: '王工头',
    status: 'accepting',
    priority: 'urgent',
    estimatedHours: 24,
    actualHours: 22,
    materials: [
      { name: 'C30混凝土', quantity: 5, unit: '方' },
      { name: '钢筋', quantity: 200, unit: 'kg' },
      { name: 'AC-13沥青混合料', quantity: 3, unit: '吨' }
    ],
    repairImages: ['/images/wo003_repair1.jpg', '/images/wo003_repair2.jpg'],
    repairDescription: '已完成桥头搭板更换，路面顺接平顺，高差控制在1cm以内',
    createdAt: '2024-06-08T12:00:00.000Z',
    updatedAt: '2024-06-13T16:30:00.000Z',
    deadline: '2024-06-12T00:00:00.000Z'
  },
  {
    id: 'wo-004',
    disorderId: 'dis-004',
    title: 'G104 K18+300 车辙处理',
    description: '轻微车辙，采用微表处处理',
    teamId: 'team-001',
    teamName: '第一维修队',
    assigneeId: 'user-003',
    assigneeName: '王工头',
    status: 'closed',
    priority: 'low',
    estimatedHours: 6,
    actualHours: 5,
    materials: [
      { name: '微表处混合料', quantity: 3, unit: '吨' }
    ],
    repairImages: ['/images/wo004_repair1.jpg'],
    repairDescription: '已完成微表处施工，路面平整',
    acceptanceResult: 'pass',
    acceptanceRemark: '施工质量合格，符合验收标准',
    acceptedBy: 'user-004',
    acceptedAt: '2024-06-09T10:00:00.000Z',
    createdAt: '2024-06-05T15:00:00.000Z',
    updatedAt: '2024-06-09T10:00:00.000Z',
    deadline: '2024-06-10T00:00:00.000Z'
  },
  {
    id: 'wo-005',
    disorderId: 'dis-005',
    title: 'G106 K5+600 坑槽群应急抢修',
    description: '大面积坑槽应急抢修，需立即处理',
    teamId: 'team-003',
    teamName: '应急抢修队',
    assigneeId: 'user-003',
    assigneeName: '王工头',
    status: 'assigned',
    priority: 'urgent',
    estimatedHours: 12,
    materials: [
      { name: '冷补沥青混合料', quantity: 5, unit: '吨' },
      { name: '乳化沥青', quantity: 100, unit: 'kg' }
    ],
    createdAt: '2024-06-12T18:00:00.000Z',
    updatedAt: '2024-06-12T18:00:00.000Z',
    deadline: '2024-06-13T00:00:00.000Z'
  },
  {
    id: 'wo-006',
    disorderId: 'dis-008',
    title: 'G312 K48+900 桥头沉降处理',
    description: '桥台沉降维修，注浆加固',
    teamId: 'team-002',
    teamName: '第二维修队',
    assigneeId: 'user-003',
    assigneeName: '王工头',
    status: 'repairing',
    priority: 'high',
    estimatedHours: 16,
    materials: [
      { name: '水泥注浆料', quantity: 2, unit: '吨' },
      { name: 'AC-13沥青混合料', quantity: 2, unit: '吨' }
    ],
    createdAt: '2024-06-10T12:00:00.000Z',
    updatedAt: '2024-06-13T09:00:00.000Z',
    deadline: '2024-06-16T00:00:00.000Z'
  },
  {
    id: 'wo-007',
    disorderId: 'dis-006',
    title: 'G309 K15+400 网状裂缝处理',
    description: '大面积网状裂缝，采用铣刨重铺',
    teamId: 'team-001',
    teamName: '第一维修队',
    assigneeId: 'user-003',
    assigneeName: '王工头',
    status: 'pending',
    priority: 'high',
    estimatedHours: 12,
    materials: [
      { name: 'AC-13沥青混合料', quantity: 4, unit: '吨' },
      { name: '粘层油', quantity: 80, unit: 'kg' }
    ],
    createdAt: '2024-06-13T10:00:00.000Z',
    updatedAt: '2024-06-13T10:00:00.000Z',
    deadline: '2024-06-17T00:00:00.000Z'
  },
  {
    id: 'wo-008',
    disorderId: 'dis-010',
    title: 'G106 K22+300 坑槽维修',
    description: '单个坑槽修补',
    teamId: 'team-001',
    teamName: '第一维修队',
    assigneeId: 'user-003',
    assigneeName: '王工头',
    status: 'rejected',
    priority: 'medium',
    estimatedHours: 3,
    materials: [
      { name: '冷补沥青混合料', quantity: 0.5, unit: '吨' }
    ],
    acceptanceResult: 'fail',
    acceptanceRemark: '修补后路面平整度不达标，需重新处理',
    acceptedBy: 'user-004',
    acceptedAt: '2024-06-14T15:00:00.000Z',
    createdAt: '2024-06-14T11:30:00.000Z',
    updatedAt: '2024-06-14T15:00:00.000Z',
    deadline: '2024-06-19T00:00:00.000Z'
  }
];

const baseTime = Date.now();
export const mockTrackPoints: TrackPoint[] = Array.from({ length: 50 }, (_, i) => ({
  id: `tp-${String(i + 1).padStart(3, '0')}`,
  inspectorId: 'user-001',
  inspectorName: '张巡查',
  lat: 39.9042 + (Math.random() - 0.5) * 0.1,
  lng: 116.4074 + (Math.random() - 0.5) * 0.1,
  timestamp: new Date(baseTime - (50 - i) * 60000).toISOString(),
  speed: Math.random() * 40 + 10,
  accuracy: Math.random() * 10 + 2
}));

export const mockCoverageStats: CoverageStats[] = [
  {
    date: '2024-06-14',
    inspectorId: 'user-001',
    inspectorName: '张巡查',
    roadSectionIds: ['road-001', 'road-002'],
    totalMileage: 45.6,
    effectiveMileage: 38.2,
    repeatedMileage: 7.4,
    workHours: 7.5,
    pointCount: 280
  },
  {
    date: '2024-06-13',
    inspectorId: 'user-001',
    inspectorName: '张巡查',
    roadSectionIds: ['road-003', 'road-004'],
    totalMileage: 52.3,
    effectiveMileage: 48.1,
    repeatedMileage: 4.2,
    workHours: 8.0,
    pointCount: 310
  }
];

export const mockAcceptanceRecords: AcceptanceRecord[] = [
  {
    id: 'ar-001',
    workOrderId: 'wo-004',
    disorderId: 'dis-004',
    acceptorId: 'user-004',
    acceptorName: '赵验收',
    result: 'pass',
    remark: '施工质量合格，路面平整，符合道路养护规范',
    images: ['/images/ar001_1.jpg', '/images/ar001_2.jpg'],
    createdAt: '2024-06-09T10:00:00.000Z'
  },
  {
    id: 'ar-002',
    workOrderId: 'wo-008',
    disorderId: 'dis-010',
    acceptorId: 'user-004',
    acceptorName: '赵验收',
    result: 'fail',
    remark: '修补后路面平整度超标，坑槽边缘处理不到位，需返工',
    images: ['/images/ar002_1.jpg'],
    createdAt: '2024-06-14T15:00:00.000Z'
  }
];
