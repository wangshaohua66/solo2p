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
  },

  materialTemplates: {
    'm-001-3': {
      id: 'm-001-3',
      name: '身份证申领登记表',
      formTitle: '居民身份证申领登记表',
      issuingAuthority: '公安局人口管理支队',
      formNumber: 'GA-2024-001',
      fields: [
        { name: '姓名', type: 'text', required: true, width: 'full', example: '张三', placeholder: '请填写真实姓名' },
        { name: '性别', type: 'radio', required: true, width: 'half', options: ['男', '女'], example: '男' },
        { name: '民族', type: 'text', required: true, width: 'half', example: '汉族' },
        { name: '出生日期', type: 'date', required: true, width: 'half', example: '1990-01-15' },
        { name: '公民身份号码', type: 'text', required: true, width: 'half', example: '110101199001151234' },
        { name: '户籍地址', type: 'textarea', required: true, width: 'full', example: '北京市东城区某某街道某某小区1号楼1单元101室' },
        { name: '现居住地址', type: 'textarea', required: true, width: 'full', example: '同上' },
        { name: '联系电话', type: 'text', required: true, width: 'half', example: '138****8000' },
        { name: '申领原因', type: 'select', required: true, width: 'half', options: ['首次申领', '到期换领', '丢失补领', '损坏换领'], example: '到期换领' },
        { name: '申领人签名', type: 'signature', required: true, width: 'full', example: '（手写签名区域）' }
      ],
      notices: [
        '本表请用黑色签字笔填写，字迹要清楚、工整',
        '申请时请携带本人户口簿、原居民身份证（换领时）',
        '未满16周岁公民申请领取居民身份证，由监护人代为申请领取',
        '提交申请后60日内发放居民身份证'
      ]
    },
    'm-002-3': {
      id: 'm-002-3',
      name: '社保卡申领表',
      formTitle: '社会保障卡申领登记表',
      issuingAuthority: '人力资源和社会保障局',
      formNumber: 'SB-2024-003',
      fields: [
        { name: '姓名', type: 'text', required: true, width: 'full', example: '李四', placeholder: '请填写真实姓名' },
        { name: '性别', type: 'radio', required: true, width: 'half', options: ['男', '女'], example: '女' },
        { name: '身份证号', type: 'text', required: true, width: 'half', example: '110101198805205678' },
        { name: '出生日期', type: 'date', required: true, width: 'half', example: '1988-05-20' },
        { name: '民族', type: 'text', required: true, width: 'half', example: '汉族' },
        { name: '户口性质', type: 'select', required: true, width: 'half', options: ['城镇户口', '农业户口'], example: '城镇户口' },
        { name: '参保单位', type: 'text', required: true, width: 'full', example: '北京某某科技有限公司' },
        { name: '联系电话', type: 'text', required: true, width: 'half', example: '139****6666' },
        { name: '通讯地址', type: 'textarea', required: true, width: 'full', example: '北京市海淀区中关村大街1号' },
        { name: '申领人签名', type: 'signature', required: true, width: 'full', example: '（手写签名区域）' }
      ],
      notices: [
        '办理社保卡需本人携带有效身份证件原件',
        '首次申领社保卡免费，补领需缴纳工本费20元',
        '社保卡制作周期约为30个工作日',
        '领取社保卡时请携带本人身份证原件'
      ]
    },
    'm-003-1': {
      id: 'm-003-1',
      name: '登记申请书',
      formTitle: '不动产登记申请书',
      issuingAuthority: '自然资源和规划局不动产登记中心',
      formNumber: 'BD-2024-101',
      fields: [
        { name: '申请事项', type: 'select', required: true, width: 'full', options: ['首次登记', '转移登记', '变更登记', '注销登记', '抵押登记'], example: '首次登记' },
        { name: '申请人姓名/名称', type: 'text', required: true, width: 'full', example: '王五' },
        { name: '证件类型', type: 'select', required: true, width: 'half', options: ['身份证', '营业执照', '组织机构代码证', '护照'], example: '身份证' },
        { name: '证件号码', type: 'text', required: true, width: 'half', example: '110101197512258888' },
        { name: '联系电话', type: 'text', required: true, width: 'half', example: '136****9999' },
        { name: '代理人姓名', type: 'text', required: false, width: 'half', example: '' },
        { name: '不动产坐落', type: 'textarea', required: true, width: 'full', example: '北京市朝阳区建国路88号院5号楼3单元1802室' },
        { name: '不动产类型', type: 'select', required: true, width: 'half', options: ['住宅', '商业', '办公', '工业', '其他'], example: '住宅' },
        { name: '建筑面积(㎡)', type: 'number', required: true, width: 'half', example: '89.56' },
        { name: '申请人签名', type: 'signature', required: true, width: 'full', example: '（手写签名区域）' }
      ],
      notices: [
        '申请人应当对申请材料的真实性负责',
        '共有不动产的，应当由共有人共同申请登记',
        '不动产登记机构应当自受理登记申请之日起30个工作日内办结',
        '申请材料齐全、符合法定形式的，应当予以受理'
      ]
    },
    'm-004-1': {
      id: 'm-004-1',
      name: '公司设立登记申请书',
      formTitle: '公司设立登记申请书',
      issuingAuthority: '市场监督管理局',
      formNumber: 'GS-2024-201',
      fields: [
        { name: '公司名称', type: 'text', required: true, width: 'full', example: '北京某某科技有限公司' },
        { name: '统一社会信用代码', type: 'text', required: false, width: 'full', example: '（系统自动生成）' },
        { name: '公司类型', type: 'select', required: true, width: 'half', options: ['有限责任公司', '股份有限公司', '一人有限责任公司'], example: '有限责任公司' },
        { name: '注册资本(万元)', type: 'number', required: true, width: 'half', example: '500' },
        { name: '法定代表人', type: 'text', required: true, width: 'half', example: '赵六' },
        { name: '联系电话', type: 'text', required: true, width: 'half', example: '137****7777' },
        { name: '经营范围', type: 'textarea', required: true, width: 'full', example: '技术开发、技术咨询、技术服务；计算机系统服务；软件开发；销售计算机、软件及辅助设备。（依法须经批准的项目，经相关部门批准后方可开展经营活动）' },
        { name: '公司住所', type: 'textarea', required: true, width: 'full', example: '北京市昌平区某某产业园A座1001室' },
        { name: '营业期限', type: 'select', required: true, width: 'half', options: ['长期', '10年', '20年', '30年'], example: '长期' },
        { name: '法定代表人签名', type: 'signature', required: true, width: 'full', example: '（手写签名区域）' }
      ],
      notices: [
        '设立有限责任公司，应当由全体股东指定的代表或者共同委托的代理人向公司登记机关申请设立登记',
        '申请材料齐全、符合法定形式的，公司登记机关应当当场予以登记',
        '公司营业执照签发日期为公司成立日期',
        '公司应当如实向登记机关提交材料，并对材料真实性负责'
      ]
    },
    'm-004-2': {
      id: 'm-004-2',
      name: '公司章程',
      formTitle: '有限责任公司章程',
      issuingAuthority: '（公司自行制定）',
      formNumber: 'GS-2024-202',
      fields: [
        { name: '公司名称', type: 'text', required: true, width: 'full', example: '北京某某科技有限公司' },
        { name: '公司住所', type: 'textarea', required: true, width: 'full', example: '北京市昌平区某某产业园A座1001室' },
        { name: '公司经营范围', type: 'textarea', required: true, width: 'full', example: '技术开发、技术咨询、技术服务；计算机系统服务；软件开发。' },
        { name: '公司注册资本', type: 'text', required: true, width: 'half', example: '人民币500万元整' },
        { name: '股东人数', type: 'number', required: true, width: 'half', example: '3' },
        { name: '股东姓名或名称', type: 'textarea', required: true, width: 'full', example: '1. 赵六（出资200万元，占比40%）\\n2. 孙七（出资200万元，占比40%）\\n3. 周八（出资100万元，占比20%）' },
        { name: '公司机构及其产生办法', type: 'textarea', required: true, width: 'full', example: '公司设股东会，由全体股东组成。股东会是公司的权力机构，依照本法行使职权。公司设董事会，成员为3人，由股东会选举产生。' },
        { name: '法定代表人', type: 'text', required: true, width: 'full', example: '公司董事长赵六为公司法定代表人' },
        { name: '全体股东签名', type: 'signature', required: true, width: 'full', example: '（全体股东签名区域）' }
      ],
      notices: [
        '公司章程是公司组织和活动的基本准则，对公司、股东、董事、监事、高级管理人员具有约束力',
        '设立公司必须依法制定公司章程',
        '公司章程修改须经股东会代表三分之二以上表决权的股东通过',
        '建议由专业律师起草或审核公司章程'
      ]
    }
  },

  selfServiceTerminals: (function() {
    const terminals = [];
    const terminalTypes = ['综合业务', '证照打印', '社保查询', '税务办理'];
    for (let i = 1; i <= 6; i++) {
      terminals.push({
        id: `A${i}`,
        name: `自助终端 A${i}`,
        type: terminalTypes[(i - 1) % terminalTypes.length],
        status: Math.random() > 0.3 ? 'available' : (Math.random() > 0.5 ? 'busy' : 'maintenance'),
        currentUser: Math.random() > 0.3 ? null : { name: `用户${i}0${i}`, startTime: Date.now() - Math.floor(Math.random() * 300000) },
        waitQueue: Math.floor(Math.random() * 4),
        estimatedWait: Math.floor(Math.random() * 15) + 5
      });
    }
    return terminals;
  })(),

  waitingAreas: (function() {
    const areas = [];
    const areaNames = ['A区等候区', 'B区等候区', 'C区等候区', 'D区等候区'];
    for (let i = 0; i < 4; i++) {
      const totalSeats = 30 + i * 10;
      const occupiedSeats = Math.floor(totalSeats * (0.4 + Math.random() * 0.4));
      areas.push({
        id: `area-${String.fromCharCode(65 + i)}`,
        name: areaNames[i],
        totalSeats: totalSeats,
        occupiedSeats: occupiedSeats,
        availableSeats: totalSeats - occupiedSeats,
        occupancyRate: Math.round((occupiedSeats / totalSeats) * 100),
        facilities: [
          { id: 1, name: '充电插座', available: Math.floor(Math.random() * 8) + 2 },
          { id: 2, name: '饮用水', available: Math.random() > 0.1 ? true : false },
          { id: 3, name: '阅览书报', available: Math.random() > 0.2 ? true : false }
        ]
      });
    }
    return areas;
  })()
};

window.MockData = MockData;
