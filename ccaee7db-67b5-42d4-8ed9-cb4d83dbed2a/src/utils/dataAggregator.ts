import type {
  ChannelData,
  StationData,
  TrendMetric,
  TimeRange,
  SignalStatus,
} from '@/types';

// 信号统计返回值接口
interface SignalStats {
  good: number;
  warning: number;
  error: number;
  total: number;
  avgScore: number;
}

// 机房按城市分组的统计接口
interface CityStationStats {
  total: number;
  online: number;
  alarmed: number;
}

// 机房统计返回值接口
interface StationStats {
  total: number;
  online: number;
  offline: number;
  alarmed: number;
  byCity: Record<string, CityStationStats>;
}

// 趋势数据单个点接口
interface TrendPoint {
  time: number;
  value: number;
  [key: string]: number;
}

// 统计指标返回值接口
interface ValueStats {
  min: number;
  max: number;
  avg: number;
  p95: number;
  stdDev: number;
}

// 安徽省16个地市列表（用于机房按地市分组）
const ANHUI_CITIES = [
  '合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆',
  '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城',
];

// 时间范围→总时长（毫秒）映射
const TIME_RANGE_MS: Record<Exclude<TimeRange, 'custom'>, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

// 时间范围→采样点数（符合LTTB降采样后数量级）
const TIME_RANGE_POINTS: Record<Exclude<TimeRange, 'custom'>, number> = {
  '1h': 3600,
  '6h': 3600,
  '24h': 1440,
  '7d': 10080,
};

// 指标取值范围配置
const METRIC_RANGES: Record<TrendMetric, { min: number; max: number; unit: string }> = {
  signal_score: { min: 75, max: 100, unit: '分' },
  bitrate: { min: 3, max: 6, unit: 'Mbps' },
  packet_loss: { min: 0, max: 5, unit: '%' },
  alarm_frequency: { min: 0, max: 20, unit: '次/小时' },
};

/**
 * 信号质量统计
 * 统计频道数组中 good/warning/error 状态的数量、总数及平均信号评分
 */
export function aggregateSignals(channels: ChannelData[]): SignalStats {
  const stats: SignalStats = {
    good: 0,
    warning: 0,
    error: 0,
    total: channels.length,
    avgScore: 0,
  };

  if (channels.length === 0) return stats;

  let scoreSum = 0;
  const statusCount: Record<SignalStatus, number> = { good: 0, warning: 0, error: 0 };

  channels.forEach((ch) => {
    statusCount[ch.signalStatus] += 1;
    scoreSum += ch.signalScore;
  });

  stats.good = statusCount.good;
  stats.warning = statusCount.warning;
  stats.error = statusCount.error;
  stats.avgScore = Number((scoreSum / channels.length).toFixed(2));

  return stats;
}

/**
 * 机房统计：按16地市分组
 * 返回总数/在线/离线/告警数，以及各地市的统计明细
 */
export function aggregateStations(
  stations: Record<string, StationData>,
): StationStats {
  const stationList = Object.values(stations);
  const result: StationStats = {
    total: stationList.length,
    online: 0,
    offline: 0,
    alarmed: 0,
    byCity: {},
  };

  // 初始化16个地市的空统计
  ANHUI_CITIES.forEach((city) => {
    result.byCity[city] = { total: 0, online: 0, alarmed: 0 };
  });

  stationList.forEach((st) => {
    if (st.online) {
      result.online += 1;
    } else {
      result.offline += 1;
    }
    if (st.alarmCount > 0) {
      result.alarmed += 1;
    }

    // 按城市聚合：先匹配精确城市名，再用字符串包含匹配，最后归到"其他"
    let matchedCity: string | null = null;
    if (result.byCity[st.city]) {
      matchedCity = st.city;
    } else {
      for (const city of ANHUI_CITIES) {
        if (st.city && st.city.includes(city)) {
          matchedCity = city;
          break;
        }
      }
    }
    if (!matchedCity) matchedCity = '合肥'; // 兜底归到合肥

    result.byCity[matchedCity].total += 1;
    if (st.online) result.byCity[matchedCity].online += 1;
    if (st.alarmCount > 0) result.byCity[matchedCity].alarmed += 1;
  });

  return result;
}

// 基于种子的伪随机数（保证同参数下生成的趋势数据稳定，便于图表对比）
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// 简化LTTB降采样算法（Largest Triangle Three Buckets）
// 用于将高密度时序数据降采样到指定数量点，同时保持曲线形状特征
function lttbDownsample(data: TrendPoint[], threshold: number): TrendPoint[] {
  if (data.length <= threshold || threshold <= 2) return data;

  const sampled: TrendPoint[] = [];
  const bucketSize = (data.length - 2) / (threshold - 2);

  sampled.push(data[0]);

  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    const avgRangeEndClamped = Math.min(avgRangeEnd, data.length);
    const avgRangeLength = avgRangeEndClamped - avgRangeStart;

    let avgX = 0;
    let avgY = 0;
    for (let j = avgRangeStart; j < avgRangeEndClamped; j++) {
      avgX += data[j].time;
      avgY += data[j].value;
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;

    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;
    const pointA = data[a];

    let maxArea = -1;
    let maxAreaIndex = a;
    for (let j = rangeOffs; j < rangeTo; j++) {
      const point = data[j];
      const area = Math.abs(
        (pointA.time - avgX) * (point.value - pointA.value) -
        (pointA.time - point.time) * (avgY - pointA.value),
      );
      if (area > maxArea) {
        maxArea = area;
        maxAreaIndex = j;
      }
    }

    sampled.push(data[maxAreaIndex]);
    a = maxAreaIndex;
  }

  sampled.push(data[data.length - 1]);
  return sampled;
}

/**
 * 根据时间范围与指标生成mock时序数据
 * - 1h: 3600点，6h: 3600点，24h: 1440点，7d: 10080点
 * - signal_score范围75-100、bitrate范围3-6Mbps、packet_loss范围0-5%、alarm_frequency范围0-20次/小时
 * - 使用LTTB降采样确保曲线平滑且特征保留
 * - 支持stationIds过滤（相同stationIds种子一致，返回稳定数据）
 */
export function generateTrendData(
  metric: TrendMetric,
  timeRange: TimeRange,
  stationIds?: string[],
): TrendPoint[] {
  const now = Date.now();
  const totalMs =
    timeRange === 'custom' ? TIME_RANGE_MS['24h'] : TIME_RANGE_MS[timeRange];
  const targetPoints =
    timeRange === 'custom' ? TIME_RANGE_POINTS['24h'] : TIME_RANGE_POINTS[timeRange];
  const startTime = now - totalMs;

  // 生成高分辨率原始数据（目标点数的5倍，确保LTTB有足够数据采样）
  const rawCount = targetPoints * 5;
  const stepMs = totalMs / rawCount;
  const { min: rangeMin, max: rangeMax } = METRIC_RANGES[metric];

  // 基于 metric + stationIds 生成稳定种子
  let seed = 0;
  const seedStr = `${metric}-${timeRange}-${(stationIds || []).join(',')}`;
  for (let i = 0; i < seedStr.length; i++) {
    seed = ((seed << 5) - seed) + seedStr.charCodeAt(i);
    seed |= 0;
  }
  const random = seededRandom(Math.abs(seed) + 1);

  // 生成带波动、趋势、周期性的数据
  const raw: TrendPoint[] = [];
  const range = rangeMax - rangeMin;
  const mid = rangeMin + range / 2;

  for (let i = 0; i < rawCount; i++) {
    const t = startTime + i * stepMs;
    const progress = i / rawCount; // 0~1

    // 基础波动（随机噪声，±10%范围）
    const noise = (random() - 0.5) * 2 * range * 0.1;

    // 周期性波动（类似昼夜/小时规律）
    // 使用多个正弦叠加模拟真实业务波动
    const hourlyWave = Math.sin((progress * (totalMs / 3600000)) * Math.PI * 2) * range * 0.08;
    const dailyWave =
      timeRange !== '1h' ? Math.sin(progress * Math.PI * 4) * range * 0.05 : 0;
    const weeklyWave =
      timeRange === '7d' ? Math.sin(progress * Math.PI * 2) * range * 0.03 : 0;

    // 趋势项：缓慢抬升或下降（基于种子决定方向）
    const trendDir = random() > 0.5 ? 1 : -1;
    const trend = trendDir * progress * range * 0.06;

    // 异常尖峰：偶尔出现（约1%概率）
    let spike = 0;
    if (random() < 0.01) {
      const spikeDir = random() > 0.5 ? 1 : -1;
      spike = spikeDir * range * 0.15 * random();
    }

    // 汇总并裁剪到范围内
    let value = mid + noise + hourlyWave + dailyWave + weeklyWave + trend + spike;
    value = Math.max(rangeMin, Math.min(rangeMax, value));

    const point: TrendPoint = {
      time: t,
      value: Number(value.toFixed(metric === 'signal_score' ? 1 : metric === 'bitrate' ? 3 : 2)),
    };

    // 对alarm_frequency添加额外指标维度（按级别统计）
    if (metric === 'alarm_frequency') {
      const v = point.value;
      point.urgent = Number((v * (0.15 + random() * 0.1)).toFixed(1));
      point.important = Number((v * (0.35 + random() * 0.1)).toFixed(1));
      point.general = Number((v * (0.4 + random() * 0.15)).toFixed(1));
    }

    raw.push(point);
  }

  // LTTB降采样到目标点数
  return lttbDownsample(raw, targetPoints);
}

/**
 * 导出CSV文件（支持BOM头中文兼容Excel打开）
 * @param headers 表头数组
 * @param rows 数据行二维数组
 * @param filename 文件名（无需后缀，会自动补.csv）
 */
export function exportToCSV(headers: string[], rows: any[][], filename: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('exportToCSV 仅支持在浏览器环境中调用');
  }

  // 转义单个单元格：处理逗号、换行、双引号
  const escapeCell = (cell: any): string => {
    if (cell === null || cell === undefined) return '';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // 组装CSV内容
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(','));
  rows.forEach((row) => {
    lines.push(row.map(escapeCell).join(','));
  });
  const csvContent = lines.join('\r\n');

  // 添加UTF-8 BOM（\uFEFF）以兼容Excel中文显示
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // 创建下载链接
  const safeFilename = (filename || 'export').replace(/[\\/:*?"<>|]/g, '_');
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${safeFilename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 释放Blob URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 统计指标计算：min/max/avg/p95/标准差
 * 输入空数组时返回全0
 */
export function calculateStats(values: number[]): ValueStats {
  const emptyStats: ValueStats = { min: 0, max: 0, avg: 0, p95: 0, stdDev: 0 };
  if (!values || values.length === 0) return emptyStats;

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const min = sorted[0];
  const max = sorted[n - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = sum / n;

  // P95：线性插值法
  const p95Index = 0.95 * (n - 1);
  const p95Floor = Math.floor(p95Index);
  const p95Ceil = Math.ceil(p95Index);
  const p95Frac = p95Index - p95Floor;
  const p95 =
    p95Floor === p95Ceil
      ? sorted[p95Floor]
      : sorted[p95Floor] + (sorted[p95Ceil] - sorted[p95Floor]) * p95Frac;

  // 标准差（总体标准差，除以n而非n-1）
  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  const round = (v: number, digits = 2): number => Number(v.toFixed(digits));
  return {
    min: round(min),
    max: round(max),
    avg: round(avg),
    p95: round(p95),
    stdDev: round(stdDev),
  };
}

export default {
  aggregateSignals,
  aggregateStations,
  generateTrendData,
  exportToCSV,
  calculateStats,
};
