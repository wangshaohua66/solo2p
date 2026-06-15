import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getStatsOverview, getStatsTrend, type StatsOverview, type StatsTrendPoint } from '@/services/api';
import { useDisorderStore } from '@/stores/disorderStore';
import { AlertTriangle, ClipboardCheck, MapPin, TrendingUp, Wrench, Clock } from 'lucide-react';
import { DisorderStatus, DisorderType, Severity } from '@/types';
import styles from './StatisticsPage.module.css';

export default function StatisticsPage() {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [trendData, setTrendData] = useState<StatsTrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const { disorders } = useDisorderStore();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [overviewData, trend] = await Promise.all([
        getStatsOverview(),
        getStatsTrend({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          type: 'disorder'
        })
      ]);
      setOverview(overviewData);
      setTrendData(trend);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['发现病害', '修复病害'],
      bottom: 0,
      textStyle: { color: '#7f8c8d', fontSize: 12 }
    },
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: trendData.map((d) => d.date),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#7f8c8d', fontSize: 12 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f1f3f5' } },
      axisLabel: { color: '#7f8c8d', fontSize: 12 }
    },
    series: [
      {
        name: '发现病害',
        data: trendData.map((d) => d.discovered),
        type: 'line',
        smooth: true,
        lineStyle: { color: '#3498db', width: 3 },
        itemStyle: { color: '#3498db' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(52, 152, 219, 0.3)' },
              { offset: 1, color: 'rgba(52, 152, 219, 0.02)' }
            ]
          }
        }
      },
      {
        name: '修复病害',
        data: trendData.map((d) => d.repaired),
        type: 'line',
        smooth: true,
        lineStyle: { color: '#27ae60', width: 3 },
        itemStyle: { color: '#27ae60' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(39, 174, 96, 0.3)' },
              { offset: 1, color: 'rgba(39, 174, 96, 0.02)' }
            ]
          }
        }
      }
    ]
  };

  const pieData = [
    { value: overview?.pendingDisorders || 0, name: '待处理', itemStyle: { color: '#f39c12' } },
    { value: overview?.processingDisorders || 0, name: '处理中', itemStyle: { color: '#3498db' } },
    { value: overview?.completedDisorders || 0, name: '已完成', itemStyle: { color: '#27ae60' } }
  ];

  const statusOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, left: 'center', textStyle: { color: '#7f8c8d', fontSize: 12 } },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#2c3e50' }
        },
        data: pieData
      }
    ]
  };

  const stats = [
    {
      label: '病害总数',
      value: overview?.totalDisorders || 0,
      icon: AlertTriangle,
      color: '#e74c3c',
      isWarning: (overview?.totalDisorders || 0) > 50
    },
    {
      label: '待处理',
      value: overview?.pendingDisorders || 0,
      icon: ClipboardCheck,
      color: '#f39c12',
      isWarning: (overview?.pendingDisorders || 0) > 20
    },
    {
      label: '工单总数',
      value: overview?.totalWorkOrders || 0,
      icon: Wrench,
      color: '#3498db',
      isWarning: false
    },
    {
      label: '平均修复时长',
      value: `${overview?.avgRepairHours || 0}h`,
      icon: Clock,
      color: '#8e44ad',
      isWarning: (overview?.avgRepairHours || 0) > 48
    },
    {
      label: '今日覆盖率',
      value: `${((overview?.todayCoverage || 0) * 100).toFixed(1)}%`,
      icon: MapPin,
      color: '#27ae60',
      isWarning: false
    },
    {
      label: '本周覆盖率',
      value: `${((overview?.weekCoverage || 0) * 100).toFixed(1)}%`,
      icon: TrendingUp,
      color: '#1a5276',
      isWarning: false
    }
  ];

  const getDisorderTypeText = (type: DisorderType) => {
    const map: Record<DisorderType, string> = {
      [DisorderType.Pothole]: '坑槽',
      [DisorderType.Crack]: '裂缝',
      [DisorderType.Rutting]: '车辙',
      [DisorderType.BridgeJump]: '桥头跳车',
      [DisorderType.Other]: '其他'
    };
    return map[type];
  };

  const getSeverityClass = (severity: Severity) => {
    const map: Record<Severity, string> = {
      [Severity.Mild]: styles.severityMild,
      [Severity.Moderate]: styles.severityModerate,
      [Severity.Severe]: styles.severitySevere,
      [Severity.Critical]: styles.severityCritical
    };
    return map[severity];
  };

  const getSeverityText = (severity: Severity) => {
    const map: Record<Severity, string> = {
      [Severity.Mild]: '轻微',
      [Severity.Moderate]: '中等',
      [Severity.Severe]: '严重',
      [Severity.Critical]: '危急'
    };
    return map[severity];
  };

  const getStatusClass = (status: DisorderStatus) => {
    const map: Record<DisorderStatus, string> = {
      [DisorderStatus.Reported]: styles.statusReported,
      [DisorderStatus.Graded]: styles.statusGraded,
      [DisorderStatus.Assigned]: styles.statusAssigned,
      [DisorderStatus.Repairing]: styles.statusRepairing,
      [DisorderStatus.Accepting]: styles.statusAccepting,
      [DisorderStatus.Closed]: styles.statusClosed
    };
    return map[status];
  };

  const getStatusText = (status: DisorderStatus) => {
    const map: Record<DisorderStatus, string> = {
      [DisorderStatus.Reported]: '已上报',
      [DisorderStatus.Graded]: '已分级',
      [DisorderStatus.Assigned]: '已指派',
      [DisorderStatus.Repairing]: '修复中',
      [DisorderStatus.Accepting]: '待验收',
      [DisorderStatus.Closed]: '已闭环'
    };
    return map[status];
  };

  return (
    <div className="page">
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>时间范围：</span>
        <select className={styles.filterSelect} defaultValue="week">
          <option value="today">今日</option>
          <option value="week">本周</option>
          <option value="month">本月</option>
          <option value="quarter">本季度</option>
          <option value="year">本年</option>
        </select>
      </div>

      <div className={styles.metricGrid}>
        {stats.map((stat, index) => (
          <div key={index} className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ backgroundColor: stat.color + '20' }}>
              <stat.icon size={24} color={stat.color} />
            </div>
            <div className={styles.metricContent}>
              <div
                className={`${styles.metricValue} ${stat.isWarning ? styles.metricWarning : ''}`}
              >
                {stat.value}
              </div>
              <div className={styles.metricLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>病害趋势</div>
          {loading ? (
            <div className="empty-state" style={{ height: 260 }}>加载中...</div>
          ) : (
            <ReactECharts option={trendOption} style={{ height: 260 }} />
          )}
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>病害状态分布</div>
          {loading ? (
            <div className="empty-state" style={{ height: 260 }}>加载中...</div>
          ) : (
            <ReactECharts option={statusOption} style={{ height: 260 }} />
          )}
        </div>
      </div>

      <div className="card">
        <h3>最近病害</h3>
        <div className={styles.disorderList}>
          <div className={styles.disorderHeader}>
            <span>编号</span>
            <span>类型</span>
            <span>严重度</span>
            <span>状态</span>
            <span>上报时间</span>
          </div>
          {disorders.slice(0, 5).map((d) => (
            <div key={d.id} className={styles.disorderItem}>
              <span className={styles.disorderId}>#{d.id}</span>
              <span className={styles.disorderTypeText}>{getDisorderTypeText(d.type)}</span>
              <span className={`${styles.severityTag} ${getSeverityClass(d.severity)}`}>
                {getSeverityText(d.severity)}
              </span>
              <span className={`${styles.statusTag} ${getStatusClass(d.status)}`}>
                {getStatusText(d.status)}
              </span>
              <span className={styles.disorderTime}>{d.createdAt}</span>
            </div>
          ))}
          {disorders.length === 0 && <div className="empty-state">暂无数据</div>}
        </div>
      </div>
    </div>
  );
}
