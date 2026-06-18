const MockData = {
  currentUser: {
    id: 'U001',
    name: '张明华',
    role: '实验室管理员',
    roleKey: 'admin',
    department: '质量管理部',
    avatar: 'ZM'
  },

  menuConfig: [
    { group: '工作台', roleKeys: ['admin', 'auditor', 'technician', 'sample_admin', 'customer'], items: [
      { key: 'dashboard', icon: '📊', text: '数据概览', badge: null },
      { key: 'todo', icon: '📋', text: '我的待办', badge: 8 }
    ]},
    { group: '业务管理', roleKeys: ['admin', 'auditor', 'technician', 'sample_admin'], items: [
      { key: 'samples', icon: '📦', text: '样品管理', badge: null, roleKeys: ['admin', 'sample_admin', 'technician'] },
      { key: 'tasks', icon: '📝', text: '检测任务', badge: 12, roleKeys: ['admin', 'technician', 'auditor'] },
      { key: 'reports', icon: '📄', text: '报告证书', badge: null, roleKeys: ['admin', 'auditor'] },
      { key: 'customers', icon: '🏢', text: '客户服务', badge: null, roleKeys: ['admin', 'customer'] }
    ]},
    { group: '资源管理', roleKeys: ['admin', 'auditor', 'technician'], items: [
      { key: 'lab', icon: '🔬', text: '实验室资源', badge: null },
      { key: 'trace', icon: '🔍', text: '数据追溯', badge: null }
    ]},
    { group: '统计分析', roleKeys: ['admin', 'auditor'], items: [
      { key: 'analytics', icon: '📈', text: '统计报表', badge: null }
    ]}
  ],

  roles: {
    admin:     { name: '实验室管理员',   desc: '全部权限' },
    auditor:   { name: '报告审核员',     desc: '报告审核、证书签发' },
    technician:{ name: '实验室技术员',   desc: '检测任务执行、原始记录录入' },
    sample_admin: { name: '样品管理员', desc: '样品接收、登记、流转' },
    customer:  { name: '企业客户',       desc: '申请检测、进度查询、报告下载' }
  },

  productCategories: [
    { code: 'EE',  name: '电子电器' },
    { code: 'ME',  name: '机械装备' },
    { code: 'BM',  name: '建材家具' },
    { code: 'AU',  name: '汽车零部件' },
    { code: 'FC',  name: '食品接触' },
    { code: 'TX',  name: '纺织服装' },
    { code: 'TW',  name: '玩具文具' },
    { code: 'MD',  name: '医疗器械' }
  ],

  notifications: [
    { id: 1, title: '任务超期预警', content: '检测任务T-2026-0342即将超期', time: '5分钟前', read: false, type: 'warning' },
    { id: 2, title: '证书到期提醒', content: 'CE认证证书CERT-2025-0156还有30天到期', time: '1小时前', read: false, type: 'info' },
    { id: 3, title: '样品接收通知', content: '新到样品SP-2026-0891已登记待分配', time: '2小时前', read: true, type: 'success' },
    { id: 4, title: '报告审核通过', content: '检测报告RPT-2026-0421已签发', time: '昨天', read: true, type: 'success' }
  ],

  stats: {
    todaySamples: 128,
    totalTasks: 342,
    pendingReports: 56,
    expiringCerts: 23,
    monthlyData: [
      { month: '1月', samples: 980, tasks: 920, revenue: 2850000 },
      { month: '2月', samples: 820, tasks: 790, revenue: 2420000 },
      { month: '3月', samples: 1100, tasks: 1050, revenue: 3180000 },
      { month: '4月', samples: 1050, tasks: 1010, revenue: 3020000 },
      { month: '5月', samples: 1200, tasks: 1160, revenue: 3450000 },
      { month: '6月', samples: 1280, tasks: 1240, revenue: 3680000 }
    ],
    categoryData: [
      { name: '电子电器', value: 35, color: '#2563eb' },
      { name: '机械装备', value: 25, color: '#10b981' },
      { name: '建材家具', value: 18, color: '#f59e0b' },
      { name: '汽车零部件', value: 12, color: '#ef4444' },
      { name: '食品接触', value: 10, color: '#06b6d4' },
      { name: '纺织服装', value: 8,  color: '#8b5cf6' },
      { name: '玩具文具', value: 7,  color: '#ec4899' },
      { name: '医疗器械', value: 6,  color: '#14b8a6' }
    ],
    cycleData: [
      { range: '1-3天', count: 120, percent: 35 },
      { range: '4-7天', count: 156, percent: 45 },
      { range: '8-15天', count: 48, percent: 14 },
      { range: '15天以上', count: 18, percent: 6 }
    ]
  },

  samples: [
    { id: 'SP-2026-0891', name: '智能断路器', code: 'TZN-2026-001', company: '上海正泰电器有限公司', category: '电子电器', certType: 'CCC', status: 'testing', receiver: '李娟', receiveDate: '2026-06-15', amount: 3, expireDate: '2026-12-15', priority: 'high' },
    { id: 'SP-2026-0890', name: '工业减速器', code: 'JSC-2026-045', company: '杭州前进齿轮箱集团', category: '机械装备', certType: 'CE', status: 'registered', receiver: '王建国', receiveDate: '2026-06-15', amount: 2, expireDate: '2026-12-15', priority: 'medium' },
    { id: 'SP-2026-0889', name: '实木复合地板', code: 'DB-2026-128', company: '德尔未来科技控股', category: '建材家具', certType: 'ISO', status: 'certified', receiver: '李娟', receiveDate: '2026-06-14', amount: 5, expireDate: '2026-12-14', priority: 'normal' },
    { id: 'SP-2026-0888', name: '汽车座椅总成', code: 'ZY-2026-067', company: '浙江天成自控股份', category: '汽车零部件', certType: 'CCC', status: 'reported', receiver: '陈明', receiveDate: '2026-06-14', amount: 4, expireDate: '2026-12-14', priority: 'high' },
    { id: 'SP-2026-0887', name: '食品级不锈钢容器', code: 'BX-2026-033', company: '苏泊尔集团有限公司', category: '食品接触', certType: 'CE', status: 'received', receiver: '李娟', receiveDate: '2026-06-13', amount: 6, expireDate: '2026-12-13', priority: 'normal' },
    { id: 'SP-2026-0886', name: '光伏逆变器', code: 'GF-2026-089', company: '阳光电源股份有限公司', category: '电子电器', certType: 'CE', status: 'testing', receiver: '王建国', receiveDate: '2026-06-13', amount: 2, expireDate: '2026-12-13', priority: 'high' },
    { id: 'SP-2026-0885', name: '液压挖掘机', code: 'WJ-2026-012', company: '三一重工股份有限公司', category: '机械装备', certType: 'CE', status: 'archived', receiver: '陈明', receiveDate: '2026-06-12', amount: 1, expireDate: '2026-06-12', priority: 'medium' },
    { id: 'SP-2026-0884', name: '儿童学习桌椅', code: 'ZY-2026-044', company: '两平米智能科技', category: '建材家具', certType: 'CCC', status: 'testing', receiver: '李娟', receiveDate: '2026-06-12', amount: 2, expireDate: '2026-12-12', priority: 'medium' },
    { id: 'SP-2026-0883', name: '纯棉儿童T恤', code: 'FZ-2026-067', company: '浙江森马服饰股份', category: '纺织服装', certType: 'CCC', status: 'registered', receiver: '王建国', receiveDate: '2026-06-11', amount: 8, expireDate: '2026-12-11', priority: 'normal' },
    { id: 'SP-2026-0882', name: '益智积木玩具', code: 'WJ-2026-035', company: '广东邦宝益智玩具', category: '玩具文具', certType: 'CCC', status: 'testing', receiver: '陈明', receiveDate: '2026-06-11', amount: 4, expireDate: '2026-12-11', priority: 'high' },
    { id: 'SP-2026-0881', name: '电子血压计', code: 'YL-2026-011', company: '鱼跃医疗设备股份', category: '医疗器械', certType: 'ISO', status: 'received', receiver: '李娟', receiveDate: '2026-06-10', amount: 3, expireDate: '2026-12-10', priority: 'high' }
  ],

  sampleTimeline: [
    { status: 'success', time: '2026-06-15 09:30:00', title: '样品接收完成', desc: '样品管理员李娟完成样品接收，共3件样品，状态良好' },
    { status: 'success', time: '2026-06-15 10:15:00', title: '样品登记入库', desc: '分配追溯码SP-2026-0891，生成标签并张贴至样品' },
    { status: 'primary', time: '2026-06-15 14:00:00', title: '检测任务分配', desc: '系统自动分配给电气实验室技术员张伟，设备编号EE-LAB-003' },
    { status: 'warning', time: '2026-06-16 08:30:00', title: '检测进行中', desc: '正在进行介电强度测试，已完成3/5项检测项目' },
    { status: '', time: '预计2026-06-18', title: '预计完成检测', desc: '' }
  ],

  tasks: {
    pending: [
      { id: 'T-2026-0342', title: '智能断路器CCC认证检测', sample: 'SP-2026-0891', assignee: '张伟', priority: 'high', deadline: '2026-06-20', progress: 0, tags: ['CCC', '电气安全'] },
      { id: 'T-2026-0341', title: '食品级不锈钢溶出试验', sample: 'SP-2026-0887', assignee: '刘晓燕', priority: 'normal', deadline: '2026-06-22', progress: 0, tags: ['CE', '食品接触'] },
      { id: 'T-2026-0340', title: '实木复合地板甲醛释放量', sample: 'SP-2026-0889', assignee: '王芳', priority: 'medium', deadline: '2026-06-21', progress: 0, tags: ['ISO', '建材'] }
    ],
    inProgress: [
      { id: 'T-2026-0339', title: '光伏逆变器CE电磁兼容', sample: 'SP-2026-0886', assignee: '张伟', priority: 'high', deadline: '2026-06-19', progress: 65, tags: ['CE', 'EMC'] },
      { id: 'T-2026-0338', title: '儿童桌椅结构安全测试', sample: 'SP-2026-0884', assignee: '赵强', priority: 'medium', deadline: '2026-06-21', progress: 40, tags: ['CCC', '家具'] },
      { id: 'T-2026-0337', title: '工业减速器负载测试', sample: 'SP-2026-0890', assignee: '李明', priority: 'normal', deadline: '2026-06-23', progress: 25, tags: ['CE', '机械'] }
    ],
    review: [
      { id: 'T-2026-0336', title: '汽车座椅阻燃性能测试', sample: 'SP-2026-0888', assignee: '赵强', priority: 'high', deadline: '2026-06-17', progress: 90, tags: ['CCC', '汽车'] }
    ],
    completed: [
      { id: 'T-2026-0335', title: '挖掘机CE噪声排放测试', sample: 'SP-2026-0885', assignee: '李明', priority: 'medium', deadline: '2026-06-15', progress: 100, tags: ['CE', '机械'] },
      { id: 'T-2026-0334', title: '断路器温升试验', sample: 'SP-2026-0880', assignee: '张伟', priority: 'normal', deadline: '2026-06-14', progress: 100, tags: ['CCC', '电气'] }
    ]
  },

  reports: [
    { id: 'RPT-2026-0421', title: '智能断路器CCC认证检测报告', sample: 'SP-2026-0875', company: '上海正泰电器有限公司', certType: 'CCC', status: 'issued', author: '报告审核组', createDate: '2026-06-12', version: 'V1.0', pages: 28 },
    { id: 'RPT-2026-0420', title: '液压挖掘机CE认证检测报告', sample: 'SP-2026-0885', company: '三一重工股份有限公司', certType: 'CE', status: 'draft', author: '王芳', createDate: '2026-06-14', version: 'V0.8', pages: 45 },
    { id: 'RPT-2026-0419', title: '食品级不锈钢卫生检测报告', sample: 'SP-2026-0866', company: '苏泊尔集团有限公司', certType: 'CE', status: 'reviewing', author: '刘晓燕', createDate: '2026-06-13', version: 'V1.0', pages: 16 },
    { id: 'RPT-2026-0418', title: '实木复合地板ISO检测报告', sample: 'SP-2026-0858', company: '德尔未来科技控股', certType: 'ISO', status: 'issued', author: '王芳', createDate: '2026-06-10', version: 'V1.2', pages: 22 },
    { id: 'RPT-2026-0417', title: '汽车座椅CCC认证报告', sample: 'SP-2026-0888', company: '浙江天成自控股份', certType: 'CCC', status: 'reviewing', author: '赵强', createDate: '2026-06-14', version: 'V0.9', pages: 35 }
  ],

  certificates: [
    { id: 'CERT-2026-0156', certNo: '2026010901856789', company: '上海正泰电器有限公司', product: '智能断路器', certType: 'CCC', status: 'valid', issueDate: '2025-06-18', expireDate: '2026-07-18', standard: 'GB 14048.2-2020' },
    { id: 'CERT-2026-0155', certNo: 'CE/2026/E/003421', company: '三一重工股份有限公司', product: '液压挖掘机', certType: 'CE', status: 'valid', issueDate: '2025-08-20', expireDate: '2028-08-20', standard: 'EN ISO 12100:2010' },
    { id: 'CERT-2026-0154', certNo: 'ISO9001-Q-2026-0234', company: '德尔未来科技控股', product: '实木复合地板', certType: 'ISO', status: 'expiring', issueDate: '2023-07-15', expireDate: '2026-07-15', standard: 'ISO 9001:2015' },
    { id: 'CERT-2026-0153', certNo: '2026011101923456', company: '浙江天成自控股份', product: '汽车座椅', certType: 'CCC', status: 'valid', issueDate: '2026-01-10', expireDate: '2031-01-10', standard: 'GB 8410-2006' },
    { id: 'CERT-2026-0152', certNo: 'CE/2026/F/002189', company: '苏泊尔集团有限公司', product: '食品接触不锈钢', certType: 'CE', status: 'expired', issueDate: '2023-06-01', expireDate: '2026-06-01', standard: 'EU 1935/2004/EC' }
  ],

  customers: [
    { id: 'C001', name: '上海正泰电器有限公司', contact: '陈经理', phone: '13812345678', creditCode: '91310000MA1FL0XX1X', category: '电子电器', certCount: 128, totalOrders: 256, level: 'A' },
    { id: 'C002', name: '三一重工股份有限公司', contact: '李主任', phone: '13987654321', creditCode: '91430000717079XX1X', category: '机械装备', certCount: 86, totalOrders: 168, level: 'A' },
    { id: 'C003', name: '苏泊尔集团有限公司', contact: '王总', phone: '13700001234', creditCode: '913310007195XXXXX1', category: '食品接触', certCount: 52, totalOrders: 98, level: 'B' },
    { id: 'C004', name: '德尔未来科技控股', contact: '张工', phone: '13655556666', creditCode: '91320500678XXXX1X', category: '建材家具', certCount: 41, totalOrders: 76, level: 'B' },
    { id: 'C005', name: '浙江天成自控股份', contact: '刘经理', phone: '13588889999', creditCode: '91330000704XXXX1X', category: '汽车零部件', certCount: 35, totalOrders: 62, level: 'B' },
    { id: 'C006', name: '阳光电源股份有限公司', contact: '赵总监', phone: '13477778888', creditCode: '91340100719XXXX1X', category: '电子电器', certCount: 28, totalOrders: 54, level: 'C' },
    { id: 'C007', name: '浙江森马服饰股份', contact: '周经理', phone: '13366665555', creditCode: '91330000712XXXX1X', category: '纺织服装', certCount: 22, totalOrders: 45, level: 'B' },
    { id: 'C008', name: '广东邦宝益智玩具', contact: '陈总', phone: '13255554444', creditCode: '91440000721XXXX1X', category: '玩具文具', certCount: 18, totalOrders: 36, level: 'C' },
    { id: 'C009', name: '鱼跃医疗设备股份', contact: '吴工', phone: '13144443333', creditCode: '91320000704XXXX1X', category: '医疗器械', certCount: 30, totalOrders: 58, level: 'A' }
  ],

  applications: [
    { id: 'AP-2026-0912', company: '上海正泰电器有限公司', product: '剩余电流动作断路器', certType: 'CCC', submitDate: '2026-06-17', status: 'pending', amount: 5 },
    { id: 'AP-2026-0911', company: '杭州前进齿轮箱集团', product: '风电齿轮箱', certType: 'CE', submitDate: '2026-06-16', status: 'approved', amount: 2 },
    { id: 'AP-2026-0910', company: '两平米智能科技', product: '儿童学习桌套装', certType: 'CCC', submitDate: '2026-06-16', status: 'processing', amount: 3 },
    { id: 'AP-2026-0909', company: '阳光电源股份有限公司', product: '储能变流器', certType: 'CE', submitDate: '2026-06-15', status: 'completed', amount: 2 }
  ],

  equipments: [
    { id: 'EQ-001', name: '高低温交变试验箱', code: 'GDW-1000', lab: '环境实验室', status: 'running', lastCal: '2026-04-15', nextCal: '2026-10-15', load: 72 },
    { id: 'EQ-002', name: '电磁兼容测试系统', code: 'EMC-500', lab: 'EMC实验室', status: 'running', lastCal: '2026-03-10', nextCal: '2026-09-10', load: 85 },
    { id: 'EQ-003', name: '万能材料试验机', code: 'WDW-100', lab: '力学实验室', status: 'maintenance', lastCal: '2026-05-20', nextCal: '2026-11-20', load: 0 },
    { id: 'EQ-004', name: '盐雾试验箱', code: 'YWX-250', lab: '腐蚀实验室', status: 'running', lastCal: '2026-02-28', nextCal: '2026-08-28', load: 45 },
    { id: 'EQ-005', name: 'ICP光谱分析仪', code: 'ICP-7000', lab: '化学实验室', status: 'running', lastCal: '2026-05-01', nextCal: '2026-11-01', load: 60 }
  ],

  technicians: [
    { id: 'T01', name: '张伟', lab: '电气实验室', title: '高级工程师', skills: ['CCC认证', '电磁兼容', '电气安全'], certs: 5, status: 'busy', workload: 85 },
    { id: 'T02', name: '刘晓燕', lab: '化学实验室', title: '工程师', skills: ['食品接触', '重金属检测', 'RoHS'], certs: 3, status: 'normal', workload: 60 },
    { id: 'T03', name: '李明', lab: '机械实验室', title: '高级工程师', skills: ['机械强度', '噪声测试', 'CE认证'], certs: 4, status: 'busy', workload: 78 },
    { id: 'T04', name: '王芳', lab: '建材实验室', title: '工程师', skills: ['建材检测', '甲醛释放', '阻燃测试'], certs: 3, status: 'normal', workload: 55 },
    { id: 'T05', name: '赵强', lab: '汽车零部件实验室', title: '工程师', skills: ['汽车安全', '阻燃测试', 'CCC认证'], certs: 4, status: 'normal', workload: 68 }
  ],

  auditLogs: [
    { id: 'LOG-001', operator: '张明华', action: '样品登记', target: 'SP-2026-0891', time: '2026-06-15 10:15:00', ip: '192.168.1.101', detail: '新增样品登记记录，追溯码SP-2026-0891' },
    { id: 'LOG-002', operator: '张伟', action: '检测数据录入', target: 'T-2026-0339', time: '2026-06-16 09:30:00', ip: '192.168.1.105', detail: '录入光伏逆变器EMC测试数据第3组' },
    { id: 'LOG-003', operator: '审核组', action: '报告审核通过', target: 'RPT-2026-0421', time: '2026-06-16 14:20:00', ip: '192.168.1.120', detail: '报告RPT-2026-0421审核通过，已签发' },
    { id: 'LOG-004', operator: '系统', action: '证书到期提醒', target: 'CERT-2026-0154', time: '2026-06-16 00:00:00', ip: 'SYSTEM', detail: 'ISO证书距到期还有30天，已发送提醒' }
  ],

  reportAnnotations: {
    'RPT-2026-0420': [
      { id: 'A001', page: 3, x: 15, y: 42, type: 'comment', color: '#f59e0b', content: '第3.2节判定标准请引用最新版GB 4706.1-2020', annotator: '李主任', time: '2026-06-15 09:20' },
      { id: 'A002', page: 7, x: 55, y: 28, type: 'highlight', color: '#ef4444', content: '此处温升测试结果65K，超标5K，请重新核查原始记录', annotator: '王审核', time: '2026-06-15 11:45' },
      { id: 'A003', page: 12, x: 30, y: 60, type: 'comment', color: '#2563eb', content: '建议补充EMC辐射骚扰测试的频率范围说明', annotator: '赵专家', time: '2026-06-15 14:30' }
    ]
  },

  labTrainings: [
    { id: 'TR-001', name: 'GB 4706.1-2020家用和类似用途电器安全', date: '2026-05-20', participants: 12, hours: 8, status: 'completed' },
    { id: 'TR-002', name: '电磁兼容测试规范与设备操作', date: '2026-06-10', participants: 8, hours: 6, status: 'completed' },
    { id: 'TR-003', name: '新版ISO 17025实验室管理体系', date: '2026-06-25', participants: 15, hours: 12, status: 'planned' }
  ],

  labCapabilities: [
    { id: 'CAP-001', code: 'EE-001', name: '电子电器安全检测', standard: 'GB 4706系列', scope: '家用、工业电器', status: 'active', accreditor: 'CNAS' },
    { id: 'CAP-002', code: 'EMC-001', name: '电磁兼容检测', standard: 'GB/T 17626系列', scope: '30MHz-6GHz', status: 'active', accreditor: 'CNAS' },
    { id: 'CAP-003', code: 'MD-001', name: '医疗器械生物相容性', standard: 'GB/T 16886系列', scope: '细胞毒性、致敏、刺激', status: 'active', accreditor: 'CNAS' },
    { id: 'CAP-004', code: 'TX-001', name: '纺织品有害物质检测', standard: 'GB 18401-2010', scope: '甲醛、pH、可分解致癌芳香胺', status: 'active', accreditor: 'CNAS' },
    { id: 'CAP-005', code: 'TW-001', name: '玩具安全检测', standard: 'GB 6675系列', scope: '机械物理、燃烧、化学迁移', status: 'pending', accreditor: '扩项中' }
  ],

  getSamples() {
    return this.samples;
  },

  getSampleById(id) {
    return this.samples.find(s => s.id === id);
  },

  getTasks() {
    return this.tasks;
  },

  getReports() {
    return this.reports;
  },

  getCertificates() {
    return this.certificates;
  },

  getCustomers() {
    return this.customers;
  }
};
