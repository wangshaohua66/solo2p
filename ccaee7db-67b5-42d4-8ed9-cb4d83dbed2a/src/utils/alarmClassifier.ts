import type { AlarmLevel, AlarmType, AlarmItem } from '@/types';

// classifyAlarm入参接口
interface ClassifyAlarmInput {
  type: AlarmType;
  content?: string;
  signalScore?: number;
}

// 基础告警类型到级别的映射规则
const BASE_LEVEL_MAP: Record<AlarmType, AlarmLevel> = {
  signal_loss: 'urgent',       // 信号中断 → 紧急
  black_frame: 'urgent',       // 黑场 → 紧急
  device_offline: 'urgent',    // 设备离线 → 紧急
  static_frame: 'important',   // 静帧 → 重要
  bitrate_error: 'important',  // 码率异常 → 重要
  audio_loss: 'general',       // 音频丢失 → 一般
};

// 内容关键词加权升级规则（匹配到任意关键词即升级一级）
const UPGRADE_KEYWORDS: Record<AlarmLevel, string[]> = {
  urgent: [],
  important: ['主节目', '卫视', '央视一套', 'CCTV-1', '高清频道', '春晚', '直播'],
  general: ['广播级', '传输链路', '卫星信号', '核心设备', 'HD', '4K'],
};

// 告警类型中文描述映射
const ALARM_TYPE_TEXT: Record<AlarmType, string> = {
  signal_loss: '信号中断',
  black_frame: '黑场告警',
  static_frame: '静帧告警',
  audio_loss: '音频丢失',
  bitrate_error: '码率异常',
  device_offline: '设备离线',
};

// 告警级别升级：general→important→urgent
function upgradeLevel(level: AlarmLevel): AlarmLevel {
  if (level === 'general') return 'important';
  if (level === 'important') return 'urgent';
  return 'urgent';
}

// 判断内容是否命中关键词列表
function hasKeyword(content: string, keywords: string[]): boolean {
  if (!content) return false;
  return keywords.some((kw) => content.includes(kw));
}

/**
 * 根据告警类型+内容映射三级告警级别
 * 规则：
 *   1. 基础映射：信号中断/黑场/设备离线=urgent；静帧/码率异常=important；音频丢失=general
 *   2. 内容关键词升级：匹配到高优先级关键词（如"卫视""直播""4K"等）时提升一级
 *   3. 信号评分降级兜底：signalScore<50时urgent，50-75时important，>75保持原级别（若原级别更高则取更高）
 */
export function classifyAlarm(alarm: ClassifyAlarmInput): AlarmLevel {
  const { type, content = '', signalScore } = alarm;

  // 步骤1：获取基础级别
  let level: AlarmLevel = BASE_LEVEL_MAP[type];

  // 步骤2：内容关键词升级
  const upgradeKeywordsForLevel = level === 'general'
    ? UPGRADE_KEYWORDS.general
    : level === 'important'
    ? UPGRADE_KEYWORDS.important
    : [];

  if (upgradeKeywordsForLevel.length > 0 && hasKeyword(content, upgradeKeywordsForLevel)) {
    level = upgradeLevel(level);
  }

  // 步骤3：信号评分兜底（取两者中更高级别）
  if (typeof signalScore === 'number') {
    let scoreLevel: AlarmLevel;
    if (signalScore < 50) {
      scoreLevel = 'urgent';
    } else if (signalScore < 75) {
      scoreLevel = 'important';
    } else {
      scoreLevel = 'general';
    }
    // 取更高级别（urgent > important > general）
    const levelRank: Record<AlarmLevel, number> = { urgent: 3, important: 2, general: 1 };
    if (levelRank[scoreLevel] > levelRank[level]) {
      level = scoreLevel;
    }
  }

  return level;
}

/**
 * 判断两告警是否应合并
 * 条件：
 *   1. 同机房（stationId相同）
 *   2. 同频道（channelId相同）
 *   3. 同类型（type相同）
 *   4. 时间窗口内：两告警timestamp差 ≤ timeWindowMs（默认5分钟）
 */
export function shouldMerge(
  alarm1: AlarmItem,
  alarm2: AlarmItem,
  timeWindowMs: number = 5 * 60 * 1000,
): boolean {
  if (alarm1.id === alarm2.id) return false;
  if (alarm1.stationId !== alarm2.stationId) return false;
  if (alarm1.channelId !== alarm2.channelId) return false;
  if (alarm1.type !== alarm2.type) return false;
  const timeDiff = Math.abs(alarm1.timestamp - alarm2.timestamp);
  return timeDiff <= timeWindowMs;
}

// 聚合返回值接口
interface GroupedAlarms {
  byStation: Record<string, AlarmItem[]>;
  byLevel: Record<AlarmLevel, AlarmItem[]>;
  byType: Record<AlarmType, AlarmItem[]>;
}

/**
 * 三级聚合：机房→级别→告警类型
 *   - byStation: 按机房ID分组（stationId → AlarmItem[]）
 *   - byLevel: 按告警级别分组（urgent/important/general → AlarmItem[]）
 *   - byType: 按告警类型分组（signal_loss/black_frame/... → AlarmItem[]）
 * 返回结果内的数组均按timestamp降序排列（最新在前）
 */
export function groupAlarms(alarms: AlarmItem[]): GroupedAlarms {
  const byStation: Record<string, AlarmItem[]> = {};
  const byLevel: Record<AlarmLevel, AlarmItem[]> = {
    urgent: [],
    important: [],
    general: [],
  };
  const byType: Record<AlarmType, AlarmItem[]> = {
    signal_loss: [],
    black_frame: [],
    static_frame: [],
    audio_loss: [],
    bitrate_error: [],
    device_offline: [],
  };

  const sorted = [...alarms].sort((a, b) => b.timestamp - a.timestamp);

  sorted.forEach((alarm) => {
    // 按机房聚合
    if (!byStation[alarm.stationId]) {
      byStation[alarm.stationId] = [];
    }
    byStation[alarm.stationId].push(alarm);

    // 按级别聚合
    byLevel[alarm.level].push(alarm);

    // 按类型聚合
    byType[alarm.type].push(alarm);
  });

  return { byStation, byLevel, byType };
}

/**
 * 生成人类可读的告警标题
 * 格式：【{告警类型中文}】{台站名称} - {频道名称}
 */
export function generateAlarmTitle(
  type: AlarmType,
  stationName: string,
  channelName: string,
): string {
  const typeText = ALARM_TYPE_TEXT[type] || '未知告警';
  const station = stationName || '未知台站';
  const channel = channelName || '未知频道';
  return `【${typeText}】${station} - ${channel}`;
}

export default {
  classifyAlarm,
  shouldMerge,
  groupAlarms,
  generateAlarmTitle,
};
