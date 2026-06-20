import type { SystemUser, Role, PermissionNode, NotificationTemplate } from '@/types/settings'
import { dayjs } from '@/utils/date'

export const mockUsers: SystemUser[] = [
  {
    id: 'U001',
    username: 'admin',
    name: '超级管理员',
    role: 'admin',
    department: '信息中心',
    phone: '13800000001',
    email: 'admin@funeral.com',
    status: 'active',
    createTime: '2024-01-01 00:00',
    lastLoginTime: dayjs().format('YYYY-MM-DD HH:mm'),
    remark: '拥有系统所有权限'
  },
  {
    id: 'U002',
    username: 'zhangfu',
    name: '张福',
    role: 'funeral_attendant',
    department: '殡仪服务部',
    phone: '13800000002',
    email: 'zhangfu@funeral.com',
    status: 'active',
    createTime: '2024-02-10 09:30',
    lastLoginTime: dayjs().subtract(2, 'hour').format('YYYY-MM-DD HH:mm')
  },
  {
    id: 'U003',
    username: 'lirong',
    name: '李荣',
    role: 'embalmer',
    department: '防腐整容科',
    phone: '13800000003',
    status: 'active',
    createTime: '2024-02-15 10:00',
    lastLoginTime: dayjs().subtract(4, 'hour').format('YYYY-MM-DD HH:mm')
  },
  {
    id: 'U004',
    username: 'wanghua',
    name: '王华',
    role: 'cremator',
    department: '火化车间',
    phone: '13800000004',
    status: 'active',
    createTime: '2024-03-01 08:00',
    lastLoginTime: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm')
  },
  {
    id: 'U005',
    username: 'chenli',
    name: '陈丽',
    role: 'ritualist',
    department: '礼仪服务部',
    phone: '13800000005',
    email: 'chenli@funeral.com',
    status: 'active',
    createTime: '2024-03-15 14:00',
    lastLoginTime: dayjs().subtract(3, 'hour').format('YYYY-MM-DD HH:mm')
  },
  {
    id: 'U006',
    username: 'zhaoqiang',
    name: '赵强',
    role: 'cemetery_manager',
    department: '墓园管理部',
    phone: '13800000006',
    status: 'active',
    createTime: '2024-04-01 09:00',
    lastLoginTime: dayjs().subtract(5, 'hour').format('YYYY-MM-DD HH:mm')
  },
  {
    id: 'U007',
    username: 'sunming',
    name: '孙明',
    role: 'funeral_attendant',
    department: '殡仪服务部',
    phone: '13800000007',
    status: 'inactive',
    createTime: '2024-05-10 10:00',
    lastLoginTime: dayjs().subtract(10, 'day').format('YYYY-MM-DD HH:mm'),
    remark: '已调离'
  },
  {
    id: 'U008',
    username: 'zhouyu',
    name: '周宇',
    role: 'dispatch',
    department: '调度中心',
    phone: '13800000008',
    status: 'active',
    createTime: '2024-05-20 11:30',
    lastLoginTime: dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm')
  }
]

export const mockRoles: Role[] = [
  {
    id: 'R001',
    code: 'admin',
    name: '系统管理员',
    description: '拥有系统全部权限，负责系统配置与维护',
    permissions: ['all'],
    createTime: '2024-01-01 00:00',
    status: 'active'
  },
  {
    id: 'R002',
    code: 'funeral_attendant',
    name: '殡仪服务员',
    description: '负责遗体登记、服务咨询、费用结算等殡仪接待工作',
    permissions: [
      'business:remains:view', 'business:remains:create', 'business:remains:edit',
      'business:service:view', 'business:service:select',
      'billing:view', 'billing:create', 'billing:edit', 'billing:pay',
      'report:basic:view'
    ],
    createTime: '2024-01-10 09:00',
    status: 'active'
  },
  {
    id: 'R003',
    code: 'embalmer',
    name: '防腐整容师',
    description: '负责遗体防腐、冷藏、整容化妆等技术工作',
    permissions: [
      'business:remains:view', 'business:remains:edit',
      'business:cosmetic:view', 'business:cosmetic:edit',
      'business:refrigeration:view', 'business:refrigeration:edit'
    ],
    createTime: '2024-01-10 09:00',
    status: 'active'
  },
  {
    id: 'R004',
    code: 'cremator',
    name: '火化工',
    description: '负责火化炉操作、火化流程执行、骨灰收集等',
    permissions: [
      'business:remains:view',
      'business:cremation:view', 'business:cremation:edit',
      'report:cremation:view'
    ],
    createTime: '2024-01-10 09:00',
    status: 'active'
  },
  {
    id: 'R005',
    code: 'ritualist',
    name: '礼仪师',
    description: '负责告别仪式策划、厅室布置、仪式主持等',
    permissions: [
      'business:remains:view',
      'business:farewell:view', 'business:farewell:edit',
      'dispatch:hall:view', 'dispatch:hall:book'
    ],
    createTime: '2024-01-10 09:00',
    status: 'active'
  },
  {
    id: 'R006',
    code: 'cemetery_manager',
    name: '墓园管理员',
    description: '负责墓位销售、安葬服务、墓园维护管理等',
    permissions: [
      'cemetery:plot:view', 'cemetery:plot:edit', 'cemetery:plot:sell',
      'cemetery:burial:view', 'cemetery:burial:edit',
      'report:cemetery:view'
    ],
    createTime: '2024-01-10 09:00',
    status: 'active'
  },
  {
    id: 'R007',
    code: 'finance',
    name: '财务人员',
    description: '负责费用结算审核、发票管理、财务报表等',
    permissions: [
      'billing:view', 'billing:audit', 'billing:refund',
      'billing:invoice:view', 'billing:invoice:create',
      'report:finance:view', 'report:finance:export'
    ],
    createTime: '2024-01-15 10:00',
    status: 'active'
  }
]

export const mockPermissionTree: PermissionNode[] = [
  {
    id: 'P-BIZ',
    code: 'business',
    name: '业务管理',
    module: 'business',
    type: 'module',
    icon: 'Document',
    children: [
      {
        id: 'P-BIZ-REMAINS',
        code: 'business:remains',
        name: '遗体管理',
        module: 'business',
        parentId: 'P-BIZ',
        type: 'menu',
        children: [
          { id: 'P-BIZ-REMAINS-V', code: 'business:remains:view', name: '查看', module: 'business', parentId: 'P-BIZ-REMAINS', type: 'action' },
          { id: 'P-BIZ-REMAINS-C', code: 'business:remains:create', name: '新增登记', module: 'business', parentId: 'P-BIZ-REMAINS', type: 'action' },
          { id: 'P-BIZ-REMAINS-E', code: 'business:remains:edit', name: '编辑', module: 'business', parentId: 'P-BIZ-REMAINS', type: 'action' },
          { id: 'P-BIZ-REMAINS-D', code: 'business:remains:delete', name: '删除', module: 'business', parentId: 'P-BIZ-REMAINS', type: 'action' }
        ]
      },
      {
        id: 'P-BIZ-REF',
        code: 'business:refrigeration',
        name: '冷藏管理',
        module: 'business',
        parentId: 'P-BIZ',
        type: 'menu',
        children: [
          { id: 'P-BIZ-REF-V', code: 'business:refrigeration:view', name: '查看', module: 'business', parentId: 'P-BIZ-REF', type: 'action' },
          { id: 'P-BIZ-REF-E', code: 'business:refrigeration:edit', name: '出入库', module: 'business', parentId: 'P-BIZ-REF', type: 'action' }
        ]
      },
      {
        id: 'P-BIZ-COS',
        code: 'business:cosmetic',
        name: '整容管理',
        module: 'business',
        parentId: 'P-BIZ',
        type: 'menu',
        children: [
          { id: 'P-BIZ-COS-V', code: 'business:cosmetic:view', name: '查看', module: 'business', parentId: 'P-BIZ-COS', type: 'action' },
          { id: 'P-BIZ-COS-E', code: 'business:cosmetic:edit', name: '录入结果', module: 'business', parentId: 'P-BIZ-COS', type: 'action' }
        ]
      },
      {
        id: 'P-BIZ-FARE',
        code: 'business:farewell',
        name: '告别管理',
        module: 'business',
        parentId: 'P-BIZ',
        type: 'menu',
        children: [
          { id: 'P-BIZ-FARE-V', code: 'business:farewell:view', name: '查看', module: 'business', parentId: 'P-BIZ-FARE', type: 'action' },
          { id: 'P-BIZ-FARE-E', code: 'business:farewell:edit', name: '仪式安排', module: 'business', parentId: 'P-BIZ-FARE', type: 'action' }
        ]
      },
      {
        id: 'P-BIZ-CREM',
        code: 'business:cremation',
        name: '火化管理',
        module: 'business',
        parentId: 'P-BIZ',
        type: 'menu',
        children: [
          { id: 'P-BIZ-CREM-V', code: 'business:cremation:view', name: '查看', module: 'business', parentId: 'P-BIZ-CREM', type: 'action' },
          { id: 'P-BIZ-CREM-E', code: 'business:cremation:edit', name: '火化登记', module: 'business', parentId: 'P-BIZ-CREM', type: 'action' }
        ]
      },
      {
        id: 'P-BIZ-SVC',
        code: 'business:service',
        name: '服务项目',
        module: 'business',
        parentId: 'P-BIZ',
        type: 'menu',
        children: [
          { id: 'P-BIZ-SVC-V', code: 'business:service:view', name: '查看', module: 'business', parentId: 'P-BIZ-SVC', type: 'action' },
          { id: 'P-BIZ-SVC-S', code: 'business:service:select', name: '选用', module: 'business', parentId: 'P-BIZ-SVC', type: 'action' }
        ]
      }
    ]
  },
  {
    id: 'P-DIS',
    code: 'dispatch',
    name: '调度中心',
    module: 'dispatch',
    type: 'module',
    icon: 'Van',
    children: [
      {
        id: 'P-DIS-VEH',
        code: 'dispatch:vehicle',
        name: '车辆调度',
        module: 'dispatch',
        parentId: 'P-DIS',
        type: 'menu',
        children: [
          { id: 'P-DIS-VEH-V', code: 'dispatch:vehicle:view', name: '查看', module: 'dispatch', parentId: 'P-DIS-VEH', type: 'action' },
          { id: 'P-DIS-VEH-D', code: 'dispatch:vehicle:dispatch', name: '派车', module: 'dispatch', parentId: 'P-DIS-VEH', type: 'action' }
        ]
      },
      {
        id: 'P-DIS-HALL',
        code: 'dispatch:hall',
        name: '厅室调度',
        module: 'dispatch',
        parentId: 'P-DIS',
        type: 'menu',
        children: [
          { id: 'P-DIS-HALL-V', code: 'dispatch:hall:view', name: '查看', module: 'dispatch', parentId: 'P-DIS-HALL', type: 'action' },
          { id: 'P-DIS-HALL-B', code: 'dispatch:hall:book', name: '预约', module: 'dispatch', parentId: 'P-DIS-HALL', type: 'action' }
        ]
      }
    ]
  },
  {
    id: 'P-CEM',
    code: 'cemetery',
    name: '墓园管理',
    module: 'cemetery',
    type: 'module',
    icon: 'House',
    children: [
      {
        id: 'P-CEM-PLOT',
        code: 'cemetery:plot',
        name: '墓位管理',
        module: 'cemetery',
        parentId: 'P-CEM',
        type: 'menu',
        children: [
          { id: 'P-CEM-PLOT-V', code: 'cemetery:plot:view', name: '查看', module: 'cemetery', parentId: 'P-CEM-PLOT', type: 'action' },
          { id: 'P-CEM-PLOT-E', code: 'cemetery:plot:edit', name: '编辑', module: 'cemetery', parentId: 'P-CEM-PLOT', type: 'action' },
          { id: 'P-CEM-PLOT-S', code: 'cemetery:plot:sell', name: '销售', module: 'cemetery', parentId: 'P-CEM-PLOT', type: 'action' }
        ]
      },
      {
        id: 'P-CEM-BUR',
        code: 'cemetery:burial',
        name: '安葬服务',
        module: 'cemetery',
        parentId: 'P-CEM',
        type: 'menu',
        children: [
          { id: 'P-CEM-BUR-V', code: 'cemetery:burial:view', name: '查看', module: 'cemetery', parentId: 'P-CEM-BUR', type: 'action' },
          { id: 'P-CEM-BUR-E', code: 'cemetery:burial:edit', name: '登记', module: 'cemetery', parentId: 'P-CEM-BUR', type: 'action' }
        ]
      }
    ]
  },
  {
    id: 'P-REP',
    code: 'report',
    name: '统计报表',
    module: 'report',
    type: 'module',
    icon: 'DataLine',
    children: [
      {
        id: 'P-REP-BASIC',
        code: 'report:basic',
        name: '基础统计',
        module: 'report',
        parentId: 'P-REP',
        type: 'menu',
        children: [
          { id: 'P-REP-BASIC-V', code: 'report:basic:view', name: '查看', module: 'report', parentId: 'P-REP-BASIC', type: 'action' }
        ]
      },
      {
        id: 'P-REP-FIN',
        code: 'report:finance',
        name: '财务报表',
        module: 'report',
        parentId: 'P-REP',
        type: 'menu',
        children: [
          { id: 'P-REP-FIN-V', code: 'report:finance:view', name: '查看', module: 'report', parentId: 'P-REP-FIN', type: 'action' },
          { id: 'P-REP-FIN-E', code: 'report:finance:export', name: '导出', module: 'report', parentId: 'P-REP-FIN', type: 'action' }
        ]
      },
      {
        id: 'P-REP-CREM',
        code: 'report:cremation',
        name: '火化统计',
        module: 'report',
        parentId: 'P-REP',
        type: 'menu',
        children: [
          { id: 'P-REP-CREM-V', code: 'report:cremation:view', name: '查看', module: 'report', parentId: 'P-REP-CREM', type: 'action' }
        ]
      },
      {
        id: 'P-REP-CEM',
        code: 'report:cemetery',
        name: '墓园统计',
        module: 'report',
        parentId: 'P-REP',
        type: 'menu',
        children: [
          { id: 'P-REP-CEM-V', code: 'report:cemetery:view', name: '查看', module: 'report', parentId: 'P-REP-CEM', type: 'action' }
        ]
      }
    ]
  },
  {
    id: 'P-SYS',
    code: 'system',
    name: '系统设置',
    module: 'system',
    type: 'module',
    icon: 'Setting',
    children: [
      {
        id: 'P-SYS-USER',
        code: 'system:user',
        name: '用户管理',
        module: 'system',
        parentId: 'P-SYS',
        type: 'menu',
        children: [
          { id: 'P-SYS-USER-V', code: 'system:user:view', name: '查看', module: 'system', parentId: 'P-SYS-USER', type: 'action' },
          { id: 'P-SYS-USER-C', code: 'system:user:create', name: '新增', module: 'system', parentId: 'P-SYS-USER', type: 'action' },
          { id: 'P-SYS-USER-E', code: 'system:user:edit', name: '编辑', module: 'system', parentId: 'P-SYS-USER', type: 'action' },
          { id: 'P-SYS-USER-S', code: 'system:user:status', name: '启停用', module: 'system', parentId: 'P-SYS-USER', type: 'action' }
        ]
      },
      {
        id: 'P-SYS-ROLE',
        code: 'system:role',
        name: '角色权限',
        module: 'system',
        parentId: 'P-SYS',
        type: 'menu',
        children: [
          { id: 'P-SYS-ROLE-V', code: 'system:role:view', name: '查看', module: 'system', parentId: 'P-SYS-ROLE', type: 'action' },
          { id: 'P-SYS-ROLE-E', code: 'system:role:edit', name: '配置', module: 'system', parentId: 'P-SYS-ROLE', type: 'action' }
        ]
      },
      {
        id: 'P-SYS-SVC',
        code: 'system:service',
        name: '服务项目',
        module: 'system',
        parentId: 'P-SYS',
        type: 'menu',
        children: [
          { id: 'P-SYS-SVC-V', code: 'system:service:view', name: '查看', module: 'system', parentId: 'P-SYS-SVC', type: 'action' },
          { id: 'P-SYS-SVC-E', code: 'system:service:edit', name: '编辑', module: 'system', parentId: 'P-SYS-SVC', type: 'action' }
        ]
      },
      {
        id: 'P-SYS-PRICE',
        code: 'system:price',
        name: '价格标准',
        module: 'system',
        parentId: 'P-SYS',
        type: 'menu',
        children: [
          { id: 'P-SYS-PRICE-V', code: 'system:price:view', name: '查看', module: 'system', parentId: 'P-SYS-PRICE', type: 'action' },
          { id: 'P-SYS-PRICE-E', code: 'system:price:edit', name: '编辑', module: 'system', parentId: 'P-SYS-PRICE', type: 'action' }
        ]
      },
      {
        id: 'P-SYS-NOTICE',
        code: 'system:notification',
        name: '通知配置',
        module: 'system',
        parentId: 'P-SYS',
        type: 'menu',
        children: [
          { id: 'P-SYS-NOTICE-V', code: 'system:notification:view', name: '查看', module: 'system', parentId: 'P-SYS-NOTICE', type: 'action' },
          { id: 'P-SYS-NOTICE-E', code: 'system:notification:edit', name: '编辑', module: 'system', parentId: 'P-SYS-NOTICE', type: 'action' }
        ]
      }
    ]
  }
]

export const mockNotificationTemplates: NotificationTemplate[] = [
  {
    id: 'NT001',
    type: 'sms',
    scene: 'remains_register',
    sceneLabel: '遗体登记确认',
    title: '遗体登记确认通知',
    content: '尊敬的{customerName}家属，您好！{deceasedName}的遗体登记已完成，登记单号：{registerNo}。如需服务可联系：{contactPhone}。【{funeralHome}】',
    variables: ['customerName', 'deceasedName', 'registerNo', 'contactPhone', 'funeralHome'],
    enabled: true,
    updateTime: '2026-05-10 14:30'
  },
  {
    id: 'NT002',
    type: 'sms',
    scene: 'farewell_reminder',
    sceneLabel: '告别仪式提醒',
    title: '告别仪式提醒通知',
    content: '尊敬的家属您好！{deceasedName}告别仪式将于{time}在{hallName}举行，请提前15分钟到场。联系电话：{contactPhone}。',
    variables: ['deceasedName', 'time', 'hallName', 'contactPhone'],
    enabled: true,
    updateTime: '2026-05-12 09:20'
  },
  {
    id: 'NT003',
    type: 'sms',
    scene: 'payment_complete',
    sceneLabel: '缴费完成通知',
    title: '费用结算完成通知',
    content: '尊敬的{customerName}家属，{deceasedName}的费用已结清，账单号：{billNo}，金额：¥{amount}。电子发票：{invoiceUrl}。',
    variables: ['customerName', 'deceasedName', 'billNo', 'amount', 'invoiceUrl'],
    enabled: true,
    updateTime: '2026-05-15 11:00'
  },
  {
    id: 'NT004',
    type: 'wechat',
    scene: 'remains_arrived',
    sceneLabel: '遗体到馆通知',
    title: '遗体已安全到馆',
    content: '尊敬的家属，{deceasedName}的遗体已于{time}安全到达{funeralHome}，目前状态：{status}。如需查询详情请进入小程序。',
    variables: ['deceasedName', 'time', 'funeralHome', 'status'],
    enabled: true,
    updateTime: '2026-05-18 16:45'
  },
  {
    id: 'NT005',
    type: 'wechat',
    scene: 'cremation_complete',
    sceneLabel: '火化完成通知',
    title: '火化完成通知',
    content: '{deceasedName}已于{time}完成火化，家属可携带相关证件到{location}领取骨灰。工作人员：{staffName} {staffPhone}。',
    variables: ['deceasedName', 'time', 'location', 'staffName', 'staffPhone'],
    enabled: true,
    updateTime: '2026-05-20 10:30'
  },
  {
    id: 'NT006',
    type: 'wechat',
    scene: 'memorial_reminder',
    sceneLabel: '祭扫提醒',
    title: '祭扫提醒通知',
    content: '尊敬的家属，{date}是{deceasedName}的{anniversaryType}，{funeralHome}提供祭扫服务预约，请提前安排。',
    variables: ['date', 'deceasedName', 'anniversaryType', 'funeralHome'],
    enabled: false,
    updateTime: '2026-04-01 08:00'
  },
  {
    id: 'NT007',
    type: 'email',
    scene: 'invoice_send',
    sceneLabel: '电子发票邮件',
    title: '{funeralHome} - 电子发票 {invoiceNo}',
    content: '尊敬的{customerName}：\n\n您好！附件是{deceasedName}殡葬服务的电子发票，发票号：{invoiceNo}，金额：¥{amount}。\n\n如有疑问请联系：{contactPhone}\n\n此致\n{funeralHome}',
    variables: ['customerName', 'deceasedName', 'invoiceNo', 'amount', 'contactPhone', 'funeralHome'],
    enabled: true,
    updateTime: '2026-05-22 13:15'
  },
  {
    id: 'NT008',
    type: 'email',
    scene: 'monthly_report',
    sceneLabel: '月度报表邮件',
    title: '{month} 月度运营报表',
    content: '各位领导：\n\n附件是{month}月度运营报表，包含业务量、财务、满意度等关键指标。\n\n如有疑问请联系信息中心。\n\n信息中心\n{generateTime}',
    variables: ['month', 'generateTime'],
    enabled: true,
    updateTime: '2026-06-01 09:00'
  }
]
