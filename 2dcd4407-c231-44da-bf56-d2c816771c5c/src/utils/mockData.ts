import dayjs from 'dayjs';
import type { Schedule, Venue, Contract, ContractTemplate, FinanceRecord, DepositRecord, User, Booth, ServiceProvider, ServiceOrder, TodoItem, SystemAlert, AnalyticsData } from '../types';

const venueNames = ['1号展厅', '2号展厅', '3号展厅', '4号展厅', '5号展厅', '6号展厅', 'M1会议室', 'M2会议室', 'M3会议室', '多功能厅'];
const venueTypes: Venue['type'][] = ['exhibition_hall', 'exhibition_hall', 'exhibition_hall', 'exhibition_hall', 'exhibition_hall', 'exhibition_hall', 'meeting_room', 'meeting_room', 'meeting_room', 'multi_function'];

const exhibitionNames = [
  '国际智能家居博览会', '中国国际进口博览会', '国际汽车工业展览会',
  '国际医疗器械博览会', '国际服装服饰博览会', '国际电子消费博览会',
  '国际食品饮料博览会', '国际建材装饰博览会', '国际人工智能展览会',
  '国际新能源汽车展览会', '国际文化创意产业博览会', '国际旅游产业博览会'
];

const organizerNames = ['上海展览集团', '北京会展服务有限公司', '广州国际会展中心', '深圳会展集团', '成都会展有限公司'];
const exhibitorNames = ['华为技术有限公司', '阿里巴巴集团', '腾讯科技', '字节跳动', '小米科技', '京东集团', '美的集团', '格力电器'];
const providerNames = ['诚信搭建有限公司', '快捷物流服务', '美味餐饮管理', '安保护卫服务', '专业清洁服务', '设备租赁有限公司'];

const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = <T>(arr: T[]): T => arr[random(0, arr.length - 1)];
const randomDate = (startDay: number, endDay: number) => dayjs().add(random(startDay, endDay), 'day').format('YYYY-MM-DD');
const randomDateTime = (startDay: number, endDay: number) => dayjs().add(random(startDay, endDay), 'day').format('YYYY-MM-DD HH:mm:ss');

export const generateMockVenues = (): Venue[] => {
  return venueNames.map((name, index) => ({
    id: `venue-${index + 1}`,
    name,
    type: venueTypes[index],
    area: venueTypes[index] === 'exhibition_hall' ? random(8000, 15000) : random(100, 500),
    capacity: venueTypes[index] === 'exhibition_hall' ? random(5000, 10000) : random(50, 300),
    floor: random(1, 3),
    facilities: {
      wifi: true,
      power: true,
      water: venueTypes[index] !== 'meeting_room',
      airConditioning: true,
      elevator: true,
    },
    description: `${name}设施齐全，适合各类展览和会议活动。`,
    createdAt: '2024-01-01T00:00:00Z',
  }));
};

export const generateMockSchedules = (count: number): Schedule[] => {
  const venues = generateMockVenues();
  const statuses: Schedule['status'][] = ['pending', 'approved', 'locked', 'ongoing', 'completed', 'cancelled'];
  const types = ['消费类', '科技类', '医疗类', '文化类', '工业类', '食品类'];
  
  return Array.from({ length: count }, (_, i) => {
    const startDate = dayjs('2026-01-01').add(i * 5, 'day');
    const duration = random(3, 7);
    const endDate = startDate.add(duration, 'day');
    const selectedVenues = venues.slice(0, random(1, 3));
    
    return {
      id: `sch-${1000 + i}`,
      exhibitionName: randomItem(exhibitionNames) + ` (第${random(1, 20)}届)`,
      organizerId: `org-${random(1, 5)}`,
      organizerName: randomItem(organizerNames),
      venueIds: selectedVenues.map(v => v.id),
      venues: selectedVenues,
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
      setupStartDate: startDate.subtract(2, 'day').format('YYYY-MM-DD'),
      teardownEndDate: endDate.add(1, 'day').format('YYYY-MM-DD'),
      status: i < 10 ? 'ongoing' : i < 30 ? 'completed' : randomItem(statuses),
      exhibitionType: randomItem(types),
      expectedVisitors: random(5000, 50000),
      actualVisitors: i < 30 ? random(5000, 50000) : undefined,
      description: '这是一个国际性的专业展览，汇聚行业内顶尖企业。',
      createdAt: startDate.subtract(60, 'day').toISOString(),
      updatedAt: startDate.subtract(30, 'day').toISOString(),
    };
  });
};

export const generateMockContracts = (count: number): Contract[] => {
  const schedules = generateMockSchedules(count);
  const statuses: Contract['status'][] = ['draft', 'reviewing', 'approved', 'signed', 'archived', 'rejected'];
  
  return Array.from({ length: count }, (_, i) => {
    const schedule = schedules[i];
    const amount = random(100000, 1000000);
    const depositRate = random(20, 50);
    
    return {
      id: `ctr-${2000 + i}`,
      scheduleId: schedule.id,
      scheduleName: schedule.exhibitionName,
      partyA: '市级国际会展中心',
      partyB: schedule.organizerName || randomItem(organizerNames),
      partyBContact: '张经理 138****8888',
      templateId: `tpl-${random(1, 3)}`,
      templateName: '展览场地租赁合同',
      amount,
      depositRate,
      depositAmount: Math.round(amount * depositRate / 100),
      status: i < 5 ? 'signed' : i < 15 ? 'approved' : i < 25 ? 'reviewing' : randomItem(statuses),
      currentStep: i < 5 ? 5 : i < 15 ? 4 : i < 25 ? random(1, 3) : 0,
      approvalFlow: [
        { id: '1', name: '业务审核', approverId: 'usr-1', approverName: '李经理', status: i >= 5 ? 'approved' : 'pending', comment: '', order: 1, approvedAt: i >= 5 ? randomDateTime(-100, -50) : undefined },
        { id: '2', name: '财务审核', approverId: 'usr-2', approverName: '王会计', status: i >= 10 ? 'approved' : 'pending', comment: '', order: 2, approvedAt: i >= 10 ? randomDateTime(-90, -40) : undefined },
        { id: '3', name: '法务审核', approverId: 'usr-3', approverName: '赵律师', status: i >= 15 ? 'approved' : 'pending', comment: '', order: 3, approvedAt: i >= 15 ? randomDateTime(-80, -30) : undefined },
        { id: '4', name: '总经理审批', approverId: 'usr-4', approverName: '孙总', status: i >= 20 ? 'approved' : 'pending', comment: '', order: 4, approvedAt: i >= 20 ? randomDateTime(-70, -20) : undefined },
      ],
      content: '根据《中华人民共和国合同法》及相关法律法规，甲乙双方本着平等、自愿、公平的原则，就展览场地租赁事宜达成如下协议...',
      signedUrl: i < 5 ? `/contracts/${2000 + i}/signed.pdf` : undefined,
      archiveNo: i < 5 ? `AR-2026-${1000 + i}` : undefined,
      createdAt: randomDateTime(-120, -60),
      updatedAt: randomDateTime(-60, -1),
    };
  });
};

export const generateMockTemplates = (): ContractTemplate[] => [
  { id: 'tpl-1', name: '展览场地租赁合同', type: 'lease', content: '标准展览场地租赁合同模板...', defaultDepositRate: 30, isDefault: true, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'tpl-2', name: '展位销售合同', type: 'sales', content: '展位销售标准合同模板...', defaultDepositRate: 50, isDefault: false, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'tpl-3', name: '服务外包合同', type: 'service', content: '服务外包标准合同模板...', defaultDepositRate: 20, isDefault: false, createdAt: '2024-01-01T00:00:00Z' },
];

export const generateMockFinanceRecords = (count: number): FinanceRecord[] => {
  const schedules = generateMockSchedules(Math.ceil(count / 4));
  const types: FinanceRecord['type'][] = ['income', 'expense', 'deposit', 'refund'];
  const methods: FinanceRecord['paymentMethod'][] = ['bank_transfer', 'alipay', 'wechat', 'check'];
  const statuses: FinanceRecord['status'][] = ['pending', 'confirmed', 'cancelled'];
  
  return Array.from({ length: count }, (_, i) => {
    const schedule = schedules[i % schedules.length];
    const type = randomItem(types);
    
    return {
      id: `fin-${3000 + i}`,
      contractId: `ctr-${2000 + (i % 50)}`,
      contractName: `${schedule.exhibitionName}-${type === 'income' ? '场地租金' : type === 'deposit' ? '押金' : type === 'expense' ? '服务费' : '退款'}`,
      scheduleId: schedule.id,
      scheduleName: schedule.exhibitionName,
      type,
      amount: type === 'expense' ? random(5000, 50000) : random(10000, 500000),
      paymentMethod: randomItem(methods),
      invoiceNo: i % 3 === 0 ? `INV-${20260000 + i}` : undefined,
      invoiceDate: i % 3 === 0 ? randomDate(-60, -1) : undefined,
      status: i < 150 ? 'confirmed' : randomItem(statuses),
      remark: '',
      recordedAt: randomDateTime(-180, -1),
      confirmedAt: i < 150 ? randomDateTime(-170, -1) : undefined,
      operatorId: 'usr-finance',
      operatorName: '王会计',
      createdAt: randomDateTime(-180, -1),
    };
  });
};

export const generateMockDeposits = (count: number): DepositRecord[] => {
  const schedules = generateMockSchedules(count);
  
  return Array.from({ length: count }, (_, i) => {
    const schedule = schedules[i];
    const amount = random(50000, 300000);
    const received = i < 20 ? amount : random(0, amount);
    const refunded = i < 10 ? random(0, amount) : 0;
    
    return {
      id: `dep-${4000 + i}`,
      contractId: `ctr-${2000 + i}`,
      scheduleId: schedule.id,
      amount,
      receivedAmount: received,
      refundableAmount: amount,
      refundedAmount: refunded,
      status: refunded >= amount ? 'refunded' : received >= amount ? 'full' : received > 0 ? 'partial' : 'pending',
      dueDate: schedule.startDate ? dayjs(schedule.startDate).subtract(10, 'day').format('YYYY-MM-DD') : randomDate(10, 30),
      refundDate: refunded > 0 ? randomDate(-30, -1) : undefined,
      createdAt: randomDateTime(-180, -1),
    };
  });
};

export const generateMockUser = (): User => ({
  id: 'usr-1',
  username: 'admin',
  realName: '系统管理员',
  role: 'admin',
  email: 'admin@exhibition.com',
  phone: '13800138000',
  company: '市级国际会展中心',
  permissions: {
    schedule: true,
    contract: true,
    finance: true,
    booth: true,
    provider: true,
    visitor: true,
    analytics: true,
    system: true,
  },
  avatar: '',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

export const generateMockBooths = (venueId: string, count: number): Booth[] => {
  const statuses: Booth['status'][] = ['available', 'reserved', 'sold', 'occupied'];
  const zones: Booth['zone'][] = ['A', 'B', 'C', 'D', 'E'];
  
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / 10);
    const col = i % 10;
    
    return {
      id: `booth-${5000 + i}`,
      venueId,
      boothNo: `${zones[row % 5]}${String(col + 1).padStart(2, '0')}`,
      area: random(9, 36),
      basePrice: random(5000, 30000),
      zone: zones[row % 5],
      positionX: col * 80 + 50,
      positionY: row * 60 + 50,
      width: 70,
      height: 50,
      status: randomItem(statuses),
      exhibitorId: i % 4 !== 0 ? `exh-${random(1, 20)}` : undefined,
      exhibitorName: i % 4 !== 0 ? randomItem(exhibitorNames) : undefined,
      facilities: ['标准电源', '照明', '地毯'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
  });
};

export const generateMockProviders = (count: number): ServiceProvider[] => {
  const types: ServiceProvider['serviceType'][] = ['construction', 'logistics', 'catering', 'cleaning', 'security', 'equipment'];
  const statuses: ServiceProvider['status'][] = ['approved', 'pending', 'expired'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `prv-${6000 + i}`,
    companyName: providerNames[i % providerNames.length] + ` ${i + 1}`,
    contactPerson: `${randomItem(['张', '李', '王', '刘', '陈'])}${randomItem(['经理', '主管', '专员'])}`,
    contactPhone: `138${String(random(10000000, 99999999))}`,
    email: `contact${i}@provider.com`,
    serviceType: types[i % types.length],
    qualificationCert: `CERT-${2024}${String(i).padStart(4, '0')}`,
    qualificationExpiry: randomDate(30, 365),
    businessLicense: `LIC-${String(i).padStart(6, '0')}`,
    status: i < count * 0.8 ? 'approved' : randomItem(statuses),
    rating: 3 + Math.random() * 2,
    reviewCount: random(10, 200),
    quoteRange: { min: random(1000, 5000), max: random(10000, 50000) },
    description: '专业服务团队，经验丰富，信誉良好。',
    createdAt: randomDateTime(-365, -30),
  }));
};

export const generateMockServiceOrders = (count: number): ServiceOrder[] => {
  const schedules = generateMockSchedules(Math.ceil(count / 2));
  const providers = generateMockProviders(10);
  const types: ServiceOrder['serviceType'][] = ['construction', 'logistics', 'catering', 'cleaning', 'security', 'equipment'];
  const statuses: ServiceOrder['status'][] = ['pending', 'assigned', 'accepted', 'in_progress', 'completed'];
  
  return Array.from({ length: count }, (_, i) => {
    const schedule = schedules[i % schedules.length];
    const provider = providers[i % providers.length];
    
    return {
      id: `ord-${7000 + i}`,
      scheduleId: schedule.id,
      scheduleName: schedule.exhibitionName,
      providerId: provider.id,
      providerName: provider.companyName,
      serviceType: types[i % types.length],
      description: `${schedule.exhibitionName}需要${provider.serviceType === 'construction' ? '展位搭建' : provider.serviceType === 'logistics' ? '货物运输' : provider.serviceType === 'catering' ? '餐饮服务' : '现场服务'}`,
      location: `${schedule.venues?.[0]?.name || '1号展厅'}`,
      contactPerson: '现场负责人',
      contactPhone: `139${String(random(10000000, 99999999))}`,
      scheduledTime: randomDateTime(-10, 30),
      estimatedDuration: random(2, 24),
      quotedAmount: random(2000, 20000),
      actualAmount: i < count * 0.6 ? random(2000, 20000) : undefined,
      status: i < count * 0.5 ? 'completed' : randomItem(statuses),
      rating: i < count * 0.4 ? random(3, 5) : undefined,
      review: i < count * 0.4 ? (random(1, 5) >= 4 ? '服务质量很好，按时完成' : '服务一般') : undefined,
      createdAt: randomDateTime(-30, -1),
      acceptedAt: i >= count * 0.2 ? randomDateTime(-25, -1) : undefined,
      completedAt: i < count * 0.5 ? randomDateTime(-20, -1) : undefined,
    };
  });
};

export const generateMockTodos = (): TodoItem[] => {
  const schedules = generateMockSchedules(10);
  
  return [
    { id: 'todo-1', type: 'schedule_approval', title: '档期审批', description: `${schedules[0].exhibitionName} 待审批`, priority: 'high', relatedId: schedules[0].id, relatedType: 'schedule', deadline: randomDate(1, 3), createdAt: randomDateTime(-2, -1) },
    { id: 'todo-2', type: 'contract_sign', title: '合同签署', description: `${schedules[1].exhibitionName} 合同待签署`, priority: 'high', relatedId: 'ctr-2001', relatedType: 'contract', deadline: randomDate(2, 5), createdAt: randomDateTime(-3, -2) },
    { id: 'todo-3', type: 'service_order', title: '服务派单', description: '展位搭建服务待派单', priority: 'medium', relatedId: 'ord-7001', relatedType: 'service_order', deadline: randomDate(3, 7), createdAt: randomDateTime(-1, 0) },
    { id: 'todo-4', type: 'payment_due', title: '款项催收', description: `${schedules[2].exhibitionName} 款项待收`, priority: 'high', relatedId: 'fin-3003', relatedType: 'finance', deadline: randomDate(5, 10), createdAt: randomDateTime(-5, -3) },
    { id: 'todo-5', type: 'qualification_expiry', title: '资质到期提醒', description: '诚信搭建有限公司 资质即将到期', priority: 'high', relatedId: 'prv-6001', relatedType: 'provider', deadline: randomDate(10, 20), createdAt: randomDateTime(-10, -5) },
  ];
};

export const generateMockAlerts = (): SystemAlert[] => [
  { id: 'alert-1', type: 'schedule_conflict', level: 'error', title: '档期冲突预警', message: '2026年3月15日-20日 1号、2号展厅存在档期冲突', relatedId: 'sch-1005', read: false, createdAt: randomDateTime(-1, 0) },
  { id: 'alert-2', type: 'qualification_expiry', level: 'warning', title: '服务商资质即将到期', message: '共有3家服务商资质将在30天内到期', read: false, createdAt: randomDateTime(-2, -1) },
  { id: 'alert-3', type: 'contract_overdue', level: 'warning', title: '合同逾期提醒', message: '有5份合同已超签署期限', read: true, createdAt: randomDateTime(-5, -3) },
  { id: 'alert-4', type: 'payment_overdue', level: 'error', title: '款项逾期', message: '有2笔款项已超付款期限', read: false, createdAt: randomDateTime(-3, -2) },
];

export const generateMockAnalytics = (): AnalyticsData => {
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
  
  return {
    totalVisitors: 1250000,
    totalRevenue: 85600000,
    scheduleUtilization: 0.85,
    boothUtilization: 0.92,
    visitorTrend: Array.from({ length: 30 }, (_, i) => ({
      date: dayjs().subtract(29 - i, 'day').format('YYYY-MM-DD'),
      count: random(5000, 20000),
    })),
    revenueTrend: months.map(m => ({ month: m, amount: random(10000000, 20000000) })),
    exhibitorDistribution: [
      { type: '科技电子', count: 156 },
      { type: '医疗健康', count: 89 },
      { type: '服装纺织', count: 124 },
      { type: '食品饮料', count: 98 },
      { type: '建材家居', count: 112 },
      { type: '文化创意', count: 76 },
    ],
    visitorSource: [
      { source: '官网预约', count: 450000 },
      { source: '微信公众号', count: 380000 },
      { source: '合作伙伴', count: 220000 },
      { source: '现场注册', count: 200000 },
    ],
    topExhibitors: exhibitorNames.slice(0, 5).map(name => ({ name, visitors: random(50000, 100000) })),
    scheduleUtilizationByMonth: months.map(m => ({ month: m, rate: 0.7 + Math.random() * 0.25 })),
  };
};
