export const INCIDENT_TYPE_MAP: Record<number, string> = {
  1: '地震灾害',
  2: '洪涝灾害',
  3: '火灾事故',
  4: '台风灾害',
  5: '干旱灾害',
  6: '滑坡泥石流',
  7: '冰雹灾害',
  8: '霜冻灾害',
  9: '危化品泄漏',
  10: '交通事故',
  99: '其他灾害',
};

export const INCIDENT_LEVEL_MAP: Record<number, string> = {
  1: '特别重大(Ⅰ级)',
  2: '重大(Ⅱ级)',
  3: '较大(Ⅲ级)',
  4: '一般(Ⅳ级)',
};

export const INCIDENT_LEVEL_COLOR: Record<number, string> = {
  1: '#ff4d4f',
  2: '#fa8c16',
  3: '#faad14',
  4: '#52c41a',
};

export const INCIDENT_STATUS_MAP: Record<number, string> = {
  0: '待核实',
  1: '已核实',
  2: '响应中',
  3: '已派单',
  4: '处置中',
  5: '已控制',
  6: '已关闭',
};

export const INCIDENT_STATUS_COLOR: Record<number, string> = {
  0: '#8c8c8c',
  1: '#1890ff',
  2: '#13c2c2',
  3: '#fa8c16',
  4: '#f5222d',
  5: '#52c41a',
  6: '#bfbfbf',
};

export const TEAM_STATUS_MAP: Record<number, string> = {
  1: '待命',
  2: '已派单',
  3: '执行任务',
  4: '返回中',
  5: '维护中',
  9: '不可用',
};

export const TEAM_STATUS_COLOR: Record<number, string> = {
  1: '#52c41a',
  2: '#fa8c16',
  3: '#f5222d',
  4: '#13c2c2',
  5: '#8c8c8c',
  9: '#bfbfbf',
};

export const DISPATCH_STATUS_MAP: Record<number, string> = {
  0: '待审批',
  1: '审批中',
  2: '已批准',
  3: '已驳回',
  4: '已派单',
  5: '执行中',
  6: '已完成',
  7: '已取消',
};

export const DISPATCH_STATUS_COLOR: Record<number, string> = {
  0: '#faad14',
  1: '#1890ff',
  2: '#52c41a',
  3: '#f5222d',
  4: '#fa8c16',
  5: '#13c2c2',
  6: '#8c8c8c',
  7: '#bfbfbf',
};

export const NOTIFICATION_CHANNEL_MAP: Record<number, string> = {
  1: '短信',
  2: 'App推送',
  3: '应急广播',
};

export const NOTIFICATION_STATUS_MAP: Record<number, string> = {
  0: '待发送',
  1: '发送中',
  2: '已发送',
  3: '已送达',
  4: '已读',
  9: '发送失败',
};

export const APPROVAL_STATUS_MAP: Record<number, string> = {
  0: '待处理',
  1: '审批中',
  2: '已通过',
  3: '已驳回',
  4: '自动审批',
};

export const ORGANIZATION_LEVEL_MAP: Record<number, string> = {
  1: '省级',
  2: '市级',
  3: '县级',
};

export const PRIORITY_MAP: Record<number, string> = {
  1: '紧急',
  2: '高',
  3: '中',
  4: '低',
};

export const PRIORITY_COLOR: Record<number, string> = {
  1: '#f5222d',
  2: '#fa8c16',
  3: '#faad14',
  4: '#8c8c8c',
};
