const MockData = {
  categories: [
    { id: 'citizen', name: '个人办事', icon: 'fa-user' },
    { id: 'business', name: '企业办事', icon: 'fa-building' },
    { id: 'social', name: '社会保障', icon: 'fa-heart' },
    { id: 'house', name: '住房服务', icon: 'fa-home' },
    { id: 'traffic', name: '交通出行', icon: 'fa-car' },
    { id: 'education', name: '教育服务', icon: 'fa-graduation-cap' }
  ],

  serviceItems: [
    {
      id: 'item-001',
      name: '身份证办理',
      category: 'citizen',
      description: '首次申领、换领、补领居民身份证',
      estimatedTime: 15,
      keywords: ['身份证', '证件', '身份']
    },
    {
      id: 'item-002',
      name: '社保卡申领',
      category: 'social',
      description: '社会保障卡的申请与领取',
      estimatedTime: 20,
      keywords: ['社保', '社保卡', '保险']
    },
    {
      id: 'item-003',
      name: '不动产权证办理',
      category: 'house',
      description: '房屋所有权证书办理与变更',
      estimatedTime: 30,
      keywords: ['房产', '不动产', '房产证']
    },
    {
      id: 'item-004',
      name: '营业执照办理',
      category: 'business',
      description: '工商营业执照注册、变更、注销',
      estimatedTime: 25,
      keywords: ['工商', '营业执照', '注册']
    },
    {
      id: 'item-005',
      name: '驾驶证换证',
      category: 'traffic',
      description: '机动车驾驶证期满换证',
      estimatedTime: 15,
      keywords: ['驾照', '驾驶证', '换证']
    },
    {
      id: 'item-006',
      name: '户口迁移',
      category: 'citizen',
      description: '市内户口迁移、投靠落户',
      estimatedTime: 20,
      keywords: ['户口', '迁移', '落户']
    },
    {
      id: 'item-007',
      name: '养老保险缴纳',
      category: 'social',
      description: '城乡居民养老保险参保与缴费',
      estimatedTime: 10,
      keywords: ['养老', '保险', '缴费']
    },
    {
      id: 'item-008',
      name: '子女入学登记',
      category: 'education',
      description: '义务教育阶段入学报名登记',
      estimatedTime: 25,
      keywords: ['入学', '上学', '报名']
    },
    {
      id: 'item-009',
      name: '公积金提取',
      category: 'house',
      description: '住房公积金提取申请',
      estimatedTime: 20,
      keywords: ['公积金', '提取', '住房']
    },
    {
      id: 'item-010',
      name: '税务登记',
      category: 'business',
      description: '企业税务登记、税种认定',
      estimatedTime: 30,
      keywords: ['税务', '办税', '登记']
    }
  ],

  materials: {
    'item-001': [
      { id: 'm-001-1', name: '居民户口簿', required: true, hasTemplate: false },
      { id: 'm-001-2', name: '近期免冠照片', required: true, hasTemplate: false },
      { id: 'm-001-3', name: '身份证申领登记表', required: true, hasTemplate: true },
      { id: 'm-001-4', name: '原居民身份证（换领）', required: false, hasTemplate: false }
    ],
    'item-002': [
      { id: 'm-002-1', name: '本人有效身份证件', required: true, hasTemplate: false },
      { id: 'm-002-2', name: '户口本', required: true, hasTemplate: false },
      { id: 'm-002-3', name: '社保卡申领表', required: true, hasTemplate: true },
      { id: 'm-002-4', name: '电子照片', required: true, hasTemplate: false }
    ],
    'item-003': [
      { id: 'm-003-1', name: '登记申请书', required: true, hasTemplate: true },
      { id: 'm-003-2', name: '申请人身份证明', required: true, hasTemplate: false },
      { id: 'm-003-3', name: '房屋所有权证', required: true, hasTemplate: false },
      { id: 'm-003-4', name: '土地使用权证', required: true, hasTemplate: false },
      { id: 'm-003-5', name: '完税凭证', required: true, hasTemplate: false }
    ],
    'item-004': [
      { id: 'm-004-1', name: '公司设立登记申请书', required: true, hasTemplate: true },
      { id: 'm-004-2', name: '公司章程', required: true, hasTemplate: true },
      { id: 'm-004-3', name: '股东身份证明', required: true, hasTemplate: false },
      { id: 'm-004-4', name: '注册资本证明', required: true, hasTemplate: false },
      { id: 'm-004-5', name: '经营场所证明', required: true, hasTemplate: false }
    ]
  },

  windows: (function() {
    const windows = [];
    for (let i = 1; i <= 12; i++) {
      windows.push({
        id: `window-c-${i.toString().padStart(2, '0')}`,
        name: `综合窗口 ${i}`,
        type: 'comprehensive',
        status: Math.random() > 0.2 ? 'busy' : 'idle',
        currentNumber: `A${Math.floor(Math.random() * 200).toString().padStart(3, '0')}`,
        queueLength: Math.floor(Math.random() * 15) + 1,
        averageWaitTime: Math.floor(Math.random() * 30) + 10
      });
    }
    const specialNames = ['社保', '不动产', '工商', '税务', '公安', '公积金', '教育', '交通'];
    for (let i = 0; i < 8; i++) {
      windows.push({
        id: `window-s-${(i + 1).toString().padStart(2, '0')}`,
        name: `${specialNames[i]}窗口`,
        type: 'specialized',
        status: Math.random() > 0.2 ? 'busy' : 'idle',
        currentNumber: `B${Math.floor(Math.random() * 200).toString().padStart(3, '0')}`,
        queueLength: Math.floor(Math.random() * 20) + 1,
        averageWaitTime: Math.floor(Math.random() * 40) + 15
      });
    }
    return windows;
  })(),

  generateQueueNumber(type = 'A') {
    const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${type}${num}`;
  },

  generateAppointmentCode() {
    return 'YY' + Date.now().toString().slice(-8);
  },

  progressStatuses: [
    { id: 'submitted', name: '已提交', icon: 'fa-file-alt' },
    { id: 'accepted', name: '受理中', icon: 'fa-spinner fa-spin' },
    { id: 'reviewing', name: '审核中', icon: 'fa-search' },
    { id: 'approved', name: '审批通过', icon: 'fa-check-circle' },
    { id: 'completed', name: '已办结', icon: 'fa-flag-checkered' }
  ],

  satisfactionHistory: [
    {
      id: 'e-001',
      itemName: '身份证办理',
      window: '综合窗口 3',
      rating: 5,
      comment: '办事效率很高，工作人员态度也很好！',
      createTime: Date.now() - 86400000 * 2
    },
    {
      id: 'e-002',
      itemName: '社保卡申领',
      window: '社保窗口',
      rating: 4,
      comment: '整体满意，就是排队时间有点长。',
      createTime: Date.now() - 86400000 * 5
    }
  ],

  dashboardData: {
    todayVisitors: 2856,
    avgSatisfaction: 4.7,
    avgHandleTime: 18.5,
    windowsLoad: [
      { name: '综合窗口', load: 85, count: 12 },
      { name: '社保窗口', load: 92, count: 1 },
      { name: '不动产窗口', load: 88, count: 1 },
      { name: '工商窗口', load: 76, count: 1 },
      { name: '税务窗口', load: 95, count: 1 },
      { name: '公安窗口', load: 82, count: 1 },
      { name: '公积金窗口', load: 70, count: 1 },
      { name: '教育窗口', load: 65, count: 1 },
      { name: '交通窗口', load: 78, count: 1 }
    ],
    visitorTrend: [
      { time: '09:00', count: 180 },
      { time: '10:00', count: 320 },
      { time: '11:00', count: 450 },
      { time: '12:00', count: 280 },
      { time: '13:00', count: 250 },
      { time: '14:00', count: 420 },
      { time: '15:00', count: 480 },
      { time: '16:00', count: 380 },
      { time: '17:00', count: 96 }
    ],
    satisfactionTrend: [
      { date: '06-13', score: 4.5 },
      { date: '06-14', score: 4.6 },
      { date: '06-15', score: 4.8 },
      { date: '06-16', score: 4.7 },
      { date: '06-17', score: 4.6 },
      { date: '06-18', score: 4.9 },
      { date: '06-19', score: 4.7 }
    ]
  },

  staffMembers: [
    { id: 'staff-001', name: '张三', employeeNo: 'GZ001', windowId: 'window-c-01' },
    { id: 'staff-002', name: '李四', employeeNo: 'GZ002', windowId: 'window-c-02' },
    { id: 'staff-003', name: '王五', employeeNo: 'GZ003', windowId: 'window-s-01' },
    { id: 'staff-004', name: '赵六', employeeNo: 'GZ004', windowId: 'window-s-02' }
  ],

  selfServiceSteps: [
    {
      id: 'auth',
      name: '身份认证',
      icon: 'fa-id-card',
      description: '请将身份证放置在读卡区，或输入身份证号码进行身份验证'
    },
    {
      id: 'select',
      name: '选择业务',
      icon: 'fa-list-ul',
      description: '请从列表中选择需要办理的业务事项'
    },
    {
      id: 'upload',
      name: '材料上传',
      icon: 'fa-cloud-upload-alt',
      description: '请将所需材料放置在扫描区域进行上传，或选择已上传的电子材料'
    },
    {
      id: 'confirm',
      name: '信息确认',
      icon: 'fa-check-square',
      description: '请仔细核对填写的信息是否准确无误'
    },
    {
      id: 'signature',
      name: '电子签名',
      icon: 'fa-pen',
      description: '请在下方签名区域进行电子签名确认'
    },
    {
      id: 'complete',
      name: '办理完成',
      icon: 'fa-check-circle',
      description: '业务已提交成功，请领取办理凭证'
    }
  ],

  intentMap: {
    '我要办身份证': 'item-001',
    '办身份证': 'item-001',
    '身份证到期了': 'item-001',
    '身份证丢了': 'item-001',
    '申领社保卡': 'item-002',
    '办社保卡': 'item-002',
    '社保': 'item-002',
    '房产证': 'item-003',
    '不动产': 'item-003',
    '办营业执照': 'item-004',
    '开公司': 'item-004',
    '工商注册': 'item-004',
    '驾照到期': 'item-005',
    '换驾驶证': 'item-005',
    '迁户口': 'item-006',
    '户口迁移': 'item-006',
    '养老保险': 'item-007',
    '交社保': 'item-007',
    '孩子上学': 'item-008',
    '入学报名': 'item-008',
    '提取公积金': 'item-009',
    '公积金': 'item-009',
    '税务登记': 'item-010',
    '办税': 'item-010'
  }
};

window.MockData = MockData;
