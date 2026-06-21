import type { Venue, Resource, EventItem, TicketType, EmergencyPlan, Equipment, VipBox, VipBooking, RevenueData, SalesAlert, DashboardStats, VenueStats } from '@/types';

export const venues: Venue[] = [
  {
    id: 'venue-1',
    name: '主体育场',
    type: 'stadium',
    capacity: 60000,
    description: '可容纳6万人的综合性体育场，主要承办足球赛事、大型演唱会等活动',
    location: '东区·体育路1号',
    image: '',
  },
  {
    id: 'venue-2',
    name: '综合体育馆',
    type: 'arena',
    capacity: 12000,
    description: '可容纳1.2万人的室内体育馆，承办篮球、排球、羽毛球等赛事及中小型演出',
    location: '中心区·文化广场',
    image: '',
  },
  {
    id: 'venue-3',
    name: '游泳跳水馆',
    type: 'aquatic_center',
    capacity: 8000,
    description: '可容纳8000人的现代化游泳跳水馆，设有标准泳池、跳水池',
    location: '南区·滨江路',
    image: '',
  },
];

export const resources: Resource[] = [
  { id: 'res-1-1', venueId: 'venue-1', name: '主比赛场地', type: 'main_field', status: 'available', capacity: 60000, conversionTime: 120, position: { x: 50, y: 45, z: 0 }, category: '比赛场地' },
  { id: 'res-1-2', venueId: 'venue-1', name: '训练场A', type: 'training_field', status: 'available', capacity: 500, conversionTime: 30, position: { x: 15, y: 70, z: 0 }, category: '训练场地' },
  { id: 'res-1-3', venueId: 'venue-1', name: '训练场B', type: 'training_field', status: 'maintenance', capacity: 500, conversionTime: 30, position: { x: 85, y: 70, z: 0 }, category: '训练场地' },
  { id: 'res-1-4', venueId: 'venue-1', name: 'VIP包厢区', type: 'vip_box', status: 'available', capacity: 800, conversionTime: 15, position: { x: 50, y: 20, z: 0 }, category: 'VIP设施' },
  { id: 'res-1-5', venueId: 'venue-1', name: '媒体中心', type: 'media_center', status: 'available', capacity: 200, conversionTime: 20, position: { x: 20, y: 25, z: 0 }, category: '媒体设施' },
  { id: 'res-1-6', venueId: 'venue-1', name: '主队休息室', type: 'locker_room', status: 'available', capacity: 50, conversionTime: 10, position: { x: 25, y: 55, z: 0 }, category: '运动员设施' },
  { id: 'res-1-7', venueId: 'venue-1', name: '客队休息室', type: 'locker_room', status: 'available', capacity: 50, conversionTime: 10, position: { x: 75, y: 55, z: 0 }, category: '运动员设施' },
  { id: 'res-1-8', venueId: 'venue-1', name: '主停车场', type: 'parking', status: 'available', capacity: 2000, conversionTime: 5, position: { x: 10, y: 85, z: 0 }, category: '配套设施' },
  { id: 'res-1-9', venueId: 'venue-1', name: '餐饮区', type: 'catering', status: 'available', capacity: 1000, conversionTime: 60, position: { x: 90, y: 85, z: 0 }, category: '配套设施' },
  { id: 'res-1-10', venueId: 'venue-1', name: '主灯光系统', type: 'lighting', status: 'available', capacity: 0, conversionTime: 45, position: { x: 30, y: 30, z: 0 }, category: '设备设施' },
  { id: 'res-1-11', venueId: 'venue-1', name: '音响系统', type: 'audio', status: 'available', capacity: 0, conversionTime: 30, position: { x: 70, y: 30, z: 0 }, category: '设备设施' },
  { id: 'res-1-12', venueId: 'venue-1', name: '大屏幕', type: 'screen', status: 'available', capacity: 0, conversionTime: 20, position: { x: 50, y: 10, z: 0 }, category: '设备设施' },
  
  { id: 'res-2-1', venueId: 'venue-2', name: '主比赛馆', type: 'main_field', status: 'available', capacity: 12000, conversionTime: 90, position: { x: 50, y: 50, z: 0 }, category: '比赛场地' },
  { id: 'res-2-2', venueId: 'venue-2', name: '训练场', type: 'training_field', status: 'available', capacity: 200, conversionTime: 20, position: { x: 20, y: 75, z: 0 }, category: '训练场地' },
  { id: 'res-2-3', venueId: 'venue-2', name: 'VIP包厢', type: 'vip_box', status: 'occupied', capacity: 300, conversionTime: 10, position: { x: 80, y: 25, z: 0 }, category: 'VIP设施' },
  { id: 'res-2-4', venueId: 'venue-2', name: '媒体区', type: 'media_center', status: 'available', capacity: 80, conversionTime: 15, position: { x: 25, y: 25, z: 0 }, category: '媒体设施' },
  { id: 'res-2-5', venueId: 'venue-2', name: '运动员休息室', type: 'locker_room', status: 'available', capacity: 40, conversionTime: 10, position: { x: 15, y: 50, z: 0 }, category: '运动员设施' },
  { id: 'res-2-6', venueId: 'venue-2', name: '地下停车场', type: 'parking', status: 'available', capacity: 800, conversionTime: 5, position: { x: 85, y: 75, z: 0 }, category: '配套设施' },
  { id: 'res-2-7', venueId: 'venue-2', name: '餐饮服务区', type: 'catering', status: 'available', capacity: 500, conversionTime: 45, position: { x: 50, y: 85, z: 0 }, category: '配套设施' },
  { id: 'res-2-8', venueId: 'venue-2', name: '计分牌系统', type: 'scoreboard', status: 'available', capacity: 0, conversionTime: 15, position: { x: 50, y: 15, z: 0 }, category: '设备设施' },
  
  { id: 'res-3-1', venueId: 'venue-3', name: '标准泳池', type: 'main_field', status: 'available', capacity: 4000, conversionTime: 60, position: { x: 40, y: 50, z: 0 }, category: '比赛场地' },
  { id: 'res-3-2', venueId: 'venue-3', name: '跳水池', type: 'main_field', status: 'available', capacity: 2000, conversionTime: 45, position: { x: 75, y: 50, z: 0 }, category: '比赛场地' },
  { id: 'res-3-3', venueId: 'venue-3', name: '热身池', type: 'training_field', status: 'available', capacity: 200, conversionTime: 15, position: { x: 20, y: 75, z: 0 }, category: '训练场地' },
  { id: 'res-3-4', venueId: 'venue-3', name: 'VIP观赛区', type: 'vip_box', status: 'available', capacity: 200, conversionTime: 10, position: { x: 50, y: 20, z: 0 }, category: 'VIP设施' },
  { id: 'res-3-5', venueId: 'venue-3', name: '媒体转播区', type: 'media_center', status: 'available', capacity: 60, conversionTime: 15, position: { x: 30, y: 25, z: 0 }, category: '媒体设施' },
  { id: 'res-3-6', venueId: 'venue-3', name: '运动员休息区', type: 'locker_room', status: 'available', capacity: 60, conversionTime: 10, position: { x: 80, y: 75, z: 0 }, category: '运动员设施' },
  { id: 'res-3-7', venueId: 'venue-3', name: '停车场', type: 'parking', status: 'available', capacity: 600, conversionTime: 5, position: { x: 10, y: 85, z: 0 }, category: '配套设施' },
  { id: 'res-3-8', venueId: 'venue-3', name: '餐饮区', type: 'catering', status: 'available', capacity: 300, conversionTime: 30, position: { x: 90, y: 85, z: 0 }, category: '配套设施' },
];

const generateEvents = (): EventItem[] => {
  const now = new Date();
  const events: EventItem[] = [];
  
  const eventTemplates = [
    { name: '中超联赛 - 主场赛事', type: 'football' as const, duration: 4, venue: 'venue-1', revenue: 3500000, mode: 'sports' as const },
    { name: 'CBA篮球赛 - 主场赛事', type: 'basketball' as const, duration: 3, venue: 'venue-2', revenue: 1800000, mode: 'sports' as const },
    { name: '全国游泳锦标赛', type: 'swimming' as const, duration: 5, venue: 'venue-3', revenue: 2200000, mode: 'sports' as const },
    { name: '世界巡回演唱会', type: 'concert' as const, duration: 2, venue: 'venue-1', revenue: 5800000, mode: 'concert' as const },
    { name: '跨年演唱会', type: 'concert' as const, duration: 1, venue: 'venue-2', revenue: 3200000, mode: 'concert' as const },
    { name: '企业年度盛典', type: 'business' as const, duration: 1, venue: 'venue-2', revenue: 850000, mode: 'concert' as const },
    { name: '行业展览会', type: 'exhibition' as const, duration: 3, venue: 'venue-1', revenue: 1200000, mode: 'concert' as const },
    { name: '青少年足球邀请赛', type: 'football' as const, duration: 2, venue: 'venue-1', revenue: 450000, mode: 'sports' as const },
    { name: '羽毛球公开赛', type: 'basketball' as const, duration: 4, venue: 'venue-2', revenue: 980000, mode: 'sports' as const },
    { name: '跳水明星赛', type: 'swimming' as const, duration: 2, venue: 'venue-3', revenue: 780000, mode: 'sports' as const },
  ];

  for (let i = 0; i < 35; i++) {
    const template = eventTemplates[i % eventTemplates.length];
    const startOffset = Math.floor(Math.random() * 60) - 10;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + startOffset);
    startDate.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + template.duration + Math.floor(Math.random() * 3));

    const statuses: EventItem['status'][] = ['scheduled', 'scheduled', 'scheduled', 'pending_approval', 'approved', 'completed'];
    const status = startDate < now ? (Math.random() > 0.3 ? 'completed' : 'cancelled') : statuses[Math.floor(Math.random() * statuses.length)];

    const venueResources = resources.filter(r => r.venueId === template.venue);
    const requiredResources = venueResources
      .filter(() => Math.random() > 0.3)
      .slice(0, 5)
      .map(r => r.id);

    events.push({
      id: `event-${i + 1}`,
      venueId: template.venue,
      name: `${template.name} ${i > 9 ? `第${i}场` : ''}`,
      type: template.type,
      startDate,
      endDate,
      status,
      organizer: ['赛事运营公司', '文化传媒集团', '体育局', '演唱会主办方'][i % 4],
      expectedRevenue: template.revenue + Math.floor(Math.random() * 500000),
      actualRevenue: status === 'completed' ? template.revenue * (0.8 + Math.random() * 0.3) : undefined,
      requiredResources,
      approvalSteps: [
        {
          id: `approval-${i}-1`,
          eventId: `event-${i + 1}`,
          role: 'dispatcher',
          status: status === 'pending_approval' ? 'pending' : status === 'rejected' ? 'rejected' : 'approved',
          approver: status !== 'pending_approval' ? '张调度' : undefined,
          comment: status === 'rejected' ? '档期冲突，请调整时间' : undefined,
          createdAt: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
          updatedAt: status !== 'pending_approval' ? new Date(startDate.getTime() - 6 * 24 * 60 * 60 * 1000) : undefined,
        },
        {
          id: `approval-${i}-2`,
          eventId: `event-${i + 1}`,
          role: 'manager',
          status: ['approved', 'scheduled', 'completed'].includes(status) ? 'approved' : status === 'rejected' ? 'rejected' : 'pending',
          approver: ['approved', 'scheduled', 'completed'].includes(status) ? '李经理' : undefined,
          createdAt: new Date(startDate.getTime() - 6 * 24 * 60 * 60 * 1000),
          updatedAt: ['approved', 'scheduled', 'completed'].includes(status) ? new Date(startDate.getTime() - 5 * 24 * 60 * 60 * 1000) : undefined,
        },
        {
          id: `approval-${i}-3`,
          eventId: `event-${i + 1}`,
          role: 'finance',
          status: ['scheduled', 'completed'].includes(status) ? 'approved' : status === 'rejected' ? 'rejected' : 'pending',
          approver: ['scheduled', 'completed'].includes(status) ? '王财务' : undefined,
          comment: status === 'rejected' ? '报价需要调整' : undefined,
          createdAt: new Date(startDate.getTime() - 5 * 24 * 60 * 60 * 1000),
          updatedAt: ['scheduled', 'completed'].includes(status) ? new Date(startDate.getTime() - 4 * 24 * 60 * 60 * 1000) : undefined,
        },
      ],
      description: `${template.name}详细信息，包括赛事规则、参赛队伍、观众须知等内容。`,
      audienceCount: status === 'completed' ? Math.floor(Math.random() * 50000 + 10000) : undefined,
      equipmentMode: template.mode,
    });
  }

  return events;
};

export const events: EventItem[] = generateEvents();

export const ticketTypes: TicketType[] = [
  { id: 'ticket-1', eventId: 'event-1', name: 'VIP票', price: 1280, totalCount: 2000, soldCount: 1850, category: 'VIP' },
  { id: 'ticket-2', eventId: 'event-1', name: '一等票', price: 680, totalCount: 8000, soldCount: 7200, category: '一等' },
  { id: 'ticket-3', eventId: 'event-1', name: '二等票', price: 380, totalCount: 15000, soldCount: 14200, category: '二等' },
  { id: 'ticket-4', eventId: 'event-1', name: '三等票', price: 180, totalCount: 35000, soldCount: 28500, category: '三等' },
  { id: 'ticket-5', eventId: 'event-2', name: '内场票', price: 880, totalCount: 1000, soldCount: 950, category: '内场' },
  { id: 'ticket-6', eventId: 'event-2', name: '看台票', price: 380, totalCount: 8000, soldCount: 6800, category: '看台' },
];

export const emergencyPlans: EmergencyPlan[] = [
  {
    id: 'plan-weather',
    type: 'weather',
    name: '恶劣天气应急预案',
    description: '应对暴雨、雷电、台风等恶劣天气突发事件，保障观众和运动员安全',
    icon: 'CloudRain',
    color: '#3B82F6',
    estimatedDuration: 45,
    steps: [
      { id: 'step-1', order: 1, description: '发布天气预警通知', responsibleRole: '运营经理', expectedDuration: 5 },
      { id: 'step-2', order: 2, description: '启动观众疏散程序', responsibleRole: '安保主管', expectedDuration: 15 },
      { id: 'step-3', order: 3, description: '关闭场地设备，检查防水措施', responsibleRole: '设备工程师', expectedDuration: 10 },
      { id: 'step-4', order: 4, description: '安置观众至安全区域', responsibleRole: '赛事协调员', expectedDuration: 10 },
      { id: 'step-5', order: 5, description: '评估是否延期或取消', responsibleRole: '运营经理', expectedDuration: 5 },
    ],
    notificationList: ['运营经理', '安保主管', '赛事协调员', '设备工程师', '医疗站'],
  },
  {
    id: 'plan-equipment',
    type: 'equipment',
    name: '设备故障应急预案',
    description: '应对灯光、音响、屏幕等核心设备故障，确保赛事正常进行',
    icon: 'Wrench',
    color: '#F59E0B',
    estimatedDuration: 30,
    steps: [
      { id: 'step-1', order: 1, description: '故障设备上报并启动备用设备', responsibleRole: '设备工程师', expectedDuration: 3 },
      { id: 'step-2', order: 2, description: '技术团队赶赴现场排查', responsibleRole: '技术主管', expectedDuration: 5 },
      { id: 'step-3', order: 3, description: '评估故障影响范围和修复时间', responsibleRole: '技术主管', expectedDuration: 5 },
      { id: 'step-4', order: 4, description: '向观众发布情况说明', responsibleRole: '赛事协调员', expectedDuration: 2 },
      { id: 'step-5', order: 5, description: '实施修复或更换设备', responsibleRole: '设备工程师', expectedDuration: 15 },
    ],
    notificationList: ['技术主管', '设备工程师', '运营经理', '赛事协调员'],
  },
  {
    id: 'plan-security',
    type: 'security',
    name: '安全事故应急预案',
    description: '应对观众冲突、人员受伤、火灾等安全事故，保障人员生命财产安全',
    icon: 'ShieldAlert',
    color: '#EF4444',
    estimatedDuration: 60,
    steps: [
      { id: 'step-1', order: 1, description: '立即报警并启动安保响应', responsibleRole: '安保主管', expectedDuration: 2 },
      { id: 'step-2', order: 2, description: '医疗急救人员赶赴现场', responsibleRole: '医疗主管', expectedDuration: 3 },
      { id: 'step-3', order: 3, description: '控制现场秩序，划定警戒区域', responsibleRole: '安保主管', expectedDuration: 10 },
      { id: 'step-4', order: 4, description: '启动观众疏散程序', responsibleRole: '安保主管', expectedDuration: 20 },
      { id: 'step-5', order: 5, description: '配合公安消防部门处置', responsibleRole: '运营经理', expectedDuration: 25 },
    ],
    notificationList: ['安保主管', '医疗主管', '运营经理', '赛事协调员', '全体安保人员'],
  },
];

export const equipmentList: Equipment[] = [
  { id: 'equip-1', venueId: 'venue-1', name: '主灯光阵列', category: '灯光系统', status: 'normal', sportsMode: true, concertMode: true, lastCheckDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), location: '场地上方', specification: 'LED 2000W × 48盏' },
  { id: 'equip-2', venueId: 'venue-1', name: '线阵列音响', category: '音响系统', status: 'normal', sportsMode: true, concertMode: true, lastCheckDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), location: '场地两侧', specification: 'JBL VTX 48+16' },
  { id: 'equip-3', venueId: 'venue-1', name: '南北大屏幕', category: '显示系统', status: 'warning', sportsMode: true, concertMode: true, lastCheckDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), location: '南北看台', specification: 'P10 LED 200㎡ × 2' },
  { id: 'equip-4', venueId: 'venue-1', name: '电动升降舞台', category: '舞台设备', status: 'normal', sportsMode: false, concertMode: true, lastCheckDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), location: '场地中央', specification: '20m × 15m 升降舞台' },
  { id: 'equip-5', venueId: 'venue-1', name: '足球记分牌', category: '计分系统', status: 'normal', sportsMode: true, concertMode: false, lastCheckDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), location: '主看台上方', specification: '电子记分牌' },
  { id: 'equip-6', venueId: 'venue-1', name: '观众照明系统', category: '灯光系统', status: 'normal', sportsMode: true, concertMode: true, lastCheckDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), location: '看台区域', specification: '高天棚灯 200盏' },
  { id: 'equip-7', venueId: 'venue-2', name: '篮球架系统', category: '体育器材', status: 'normal', sportsMode: true, concertMode: false, lastCheckDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), location: '场地两端', specification: 'NBA标准电动篮球架' },
  { id: 'equip-8', venueId: 'venue-2', name: '中央显示屏', category: '显示系统', status: 'fault', sportsMode: true, concertMode: true, lastCheckDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), location: '场地中央上方', specification: '四面斗屏 50㎡' },
  { id: 'equip-9', venueId: 'venue-2', name: '专业音响系统', category: '音响系统', status: 'normal', sportsMode: true, concertMode: true, lastCheckDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), location: '场地四周', specification: 'd&b audiotechnik' },
  { id: 'equip-10', venueId: 'venue-3', name: '跳台升降系统', category: '体育器材', status: 'normal', sportsMode: true, concertMode: false, lastCheckDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), location: '跳水池', specification: '1m/3m/5m/7.5m/10m' },
  { id: 'equip-11', venueId: 'venue-3', name: '水下摄像系统', category: '显示系统', status: 'normal', sportsMode: true, concertMode: false, lastCheckDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), location: '泳池两侧', specification: '高清水下摄像机 × 8' },
  { id: 'equip-12', venueId: 'venue-3', name: '池水恒温系统', category: '设备系统', status: 'maintenance', sportsMode: true, concertMode: false, lastCheckDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), location: '设备机房', specification: '恒温26℃ ± 0.5℃' },
];

export const vipBoxes: VipBox[] = Array.from({ length: 36 }, (_, i) => {
  const venueIndex = i < 20 ? 0 : i < 28 ? 1 : 2;
  const venueIds = ['venue-1', 'venue-2', 'venue-3'];
  const levels: VipBox['level'][] = i < 4 ? ['presidential'] as const : i < 12 ? ['premium'] as const : ['standard'] as const;
  const statuses: VipBox['status'][] = ['available', 'available', 'occupied', 'available'];
  
  return {
    id: `vip-box-${i + 1}`,
    venueId: venueIds[venueIndex],
    name: `${venueIndex === 0 ? 'A' : venueIndex === 1 ? 'B' : 'C'}区${(i % 10) + 1}号包厢`,
    level: levels[0],
    capacity: 10 + Math.floor(Math.random() * 20),
    status: statuses[i % 4],
    position: { row: Math.floor(i / 10), col: i % 10 },
    amenities: ['专属休息区', '独立卫生间', '餐饮服务', '专属通道'].filter(() => Math.random() > 0.3),
    price: (levels[0] === 'presidential' ? 50000 : levels[0] === 'premium' ? 30000 : 15000) + Math.floor(Math.random() * 10000),
  };
});

export const vipBookings: VipBooking[] = [
  { id: 'booking-1', boxId: 'vip-box-1', eventId: 'event-1', eventName: '中超联赛 - 主场赛事', customerName: '某科技公司', priority: 'high', status: 'confirmed', createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), confirmedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), amount: 58000 },
  { id: 'booking-2', boxId: 'vip-box-3', eventId: 'event-4', eventName: '世界巡回演唱会', customerName: '某地产集团', priority: 'critical', status: 'locked', lockExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), amount: 68000 },
  { id: 'booking-3', boxId: 'vip-box-5', eventId: 'event-1', eventName: '中超联赛 - 主场赛事', customerName: '某金融机构', priority: 'medium', status: 'pending', createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), amount: 35000, notes: '需要确认是否含餐饮服务' },
  { id: 'booking-4', boxId: 'vip-box-2', eventId: 'event-6', eventName: '企业年度盛典', customerName: '某互联网公司', priority: 'high', status: 'negotiating', createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), amount: 42000, notes: '与演唱会档期冲突，正在协商置换' },
];

const generateRevenueData = (): RevenueData[] => {
  const data: RevenueData[] = [];
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const types: EventItem['type'][] = ['football', 'basketball', 'swimming', 'concert', 'business'];
    const venueIds = ['venue-1', 'venue-2', 'venue-3'];
    
    for (let j = 0; j < 3; j++) {
      if (Math.random() > 0.4) {
        data.push({
          date: dateStr,
          revenue: Math.floor(Math.random() * 5000000 + 200000),
          ticketsSold: Math.floor(Math.random() * 15000 + 1000),
          venueId: venueIds[j % venueIds.length],
          eventType: types[j % types.length],
        });
      }
    }
  }
  
  return data;
};

export const revenueData: RevenueData[] = generateRevenueData();

export const salesAlerts: SalesAlert[] = [
  { id: 'alert-1', eventId: 'event-1', eventName: '中超联赛 - 主场赛事', type: 'spike', severity: 'high', description: '最近24小时销量突增150%，可能存在异常刷单或热门赛事效应', detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), resolved: false },
  { id: 'alert-2', eventId: 'event-4', eventName: '世界巡回演唱会', type: 'drop', severity: 'medium', description: 'VIP票销售率低于预期30%，建议调整营销策略', detectedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), resolved: false },
  { id: 'alert-3', eventId: 'event-2', eventName: 'CBA篮球赛 - 主场赛事', type: 'anomaly', severity: 'low', description: '某时段出现大量退票，需关注是否存在异常', detectedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), resolved: true },
];

export const dashboardStats: DashboardStats = {
  totalRevenue: 128560000,
  revenueChange: 12.5,
  totalEvents: 87,
  eventsChange: 8.2,
  totalTickets: 285600,
  ticketsChange: 15.3,
  venueUtilization: 68.5,
  utilizationChange: 5.8,
  pendingApprovals: 12,
  activeAlerts: 3,
};

export const venueStats: VenueStats[] = [
  { venueId: 'venue-1', venueName: '主体育场', eventsCount: 38, revenue: 78500000, utilization: 72.3, capacity: 60000 },
  { venueId: 'venue-2', venueName: '综合体育馆', eventsCount: 32, revenue: 32400000, utilization: 65.8, capacity: 12000 },
  { venueId: 'venue-3', venueName: '游泳跳水馆', eventsCount: 17, revenue: 17660000, utilization: 58.2, capacity: 8000 },
];

export const eventTypeColors: Record<EventItem['type'], string> = {
  football: '#00FF88',
  basketball: '#00D4FF',
  swimming: '#3B82F6',
  concert: '#FF6B35',
  business: '#A855F7',
  exhibition: '#F59E0B',
};

export const eventTypeNames: Record<EventItem['type'], string> = {
  football: '足球赛事',
  basketball: '篮球赛事',
  swimming: '游泳赛事',
  concert: '演唱会',
  business: '商业活动',
  exhibition: '展览活动',
};

export const statusColors: Record<EventItem['status'], string> = {
  draft: '#6B7280',
  pending_approval: '#F59E0B',
  approved: '#00FF88',
  rejected: '#EF4444',
  scheduled: '#00D4FF',
  completed: '#6B7280',
  cancelled: '#EF4444',
};

export const statusNames: Record<EventItem['status'], string> = {
  draft: '草稿',
  pending_approval: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  scheduled: '已排期',
  completed: '已完成',
  cancelled: '已取消',
};
