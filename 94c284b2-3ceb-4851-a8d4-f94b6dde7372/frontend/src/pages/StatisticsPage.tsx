import { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Filter,
  Users,
  CalendarCheck,
  AlertTriangle,
  Activity,
  X,
  FileText,
} from 'lucide-react';
import { mockApi } from '@/api/mock';
import LoadingButton from '@/components/LoadingButton';
import type { ApptStatItem, WarningStatItem, ReportData } from '@/types';

const TIME_RANGES = [
  { value: '7', label: '近7天' },
  { value: '30', label: '近30天' },
  { value: '90', label: '近90天' },
  { value: 'custom', label: '自定义' },
];

export default function StatisticsPage() {
  const [timeRange, setTimeRange] = useState('30');
  const [apptStats, setApptStats] = useState<ApptStatItem[]>([]);
  const [warningStats, setWarningStats] = useState<WarningStatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (timeRange === 'custom') return;
    (async () => {
      setLoading(true);
      const [a, w] = await Promise.all([mockApi.getApptStats(), mockApi.getWarningStatsTrend()]);
      setApptStats(a.slice(-parseInt(timeRange)));
      setWarningStats(w.slice(-parseInt(timeRange)));
      setLoading(false);
    })();
  }, [timeRange]);

  const handleExportReport = async () => {
    const startDate = timeRange === 'custom' ? customStartDate : new Date(Date.now() - parseInt(timeRange) * 86400000).toISOString().slice(0, 10);
    const endDate = timeRange === 'custom' ? customEndDate : new Date().toISOString().slice(0, 10);
    const data = await mockApi.exportReport(startDate, endDate);
    setReportData(data);
    setShowReport(true);
  };

  const totalAppointments = useMemo(
    () => apptStats.reduce((s, i) => s + i.count, 0),
    [apptStats]
  );

  const totalWarnings = useMemo(
    () =>
      warningStats.reduce(
        (s, i) => s + i.highCount + i.mediumCount + i.lowCount,
        0
      ),
    [warningStats]
  );

  const highWarningCount = useMemo(
    () => warningStats.reduce((s, i) => s + i.highCount, 0),
    [warningStats]
  );

  const avgDailyAppointments = useMemo(
    () => Math.round(totalAppointments / Math.max(apptStats.length, 1)),
    [totalAppointments, apptStats.length]
  );

  const apptChartOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: apptStats.map((i) => i.date.slice(5)),
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: { color: '#6B7280', fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLabel: { color: '#6B7280', fontSize: 11 },
      },
      series: [
        {
          data: apptStats.map((i) => i.count),
          type: 'bar',
          barWidth: '55%',
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#1E6FD9' },
                { offset: 1, color: '#60A5FA' },
              ],
            },
          },
        },
      ],
    }),
    [apptStats]
  );

  const warningChartOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: {
        data: ['高危', '中危', '低危'],
        right: 10,
        top: 0,
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 8,
        textStyle: { fontSize: 12, color: '#6B7280' },
      },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: {
        type: 'category',
        data: warningStats.map((i) => i.date.slice(5)),
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: { color: '#6B7280', fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLabel: { color: '#6B7280', fontSize: 11 },
      },
      series: [
        {
          name: '高危',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: warningStats.map((i) => i.highCount),
          itemStyle: { color: '#DC2626' },
          lineStyle: { width: 2.5, color: '#DC2626' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(220,38,38,0.25)' },
                { offset: 1, color: 'rgba(220,38,38,0)' },
              ],
            },
          },
        },
        {
          name: '中危',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: warningStats.map((i) => i.mediumCount),
          itemStyle: { color: '#F59E0B' },
          lineStyle: { width: 2.5, color: '#F59E0B' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(245,158,11,0.25)' },
                { offset: 1, color: 'rgba(245,158,11,0)' },
              ],
            },
          },
        },
        {
          name: '低危',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: warningStats.map((i) => i.lowCount),
          itemStyle: { color: '#10B981' },
          lineStyle: { width: 2.5, color: '#10B981' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16,185,129,0.25)' },
                { offset: 1, color: 'rgba(16,185,129,0)' },
              ],
            },
          },
        },
      ],
    }),
    [warningStats]
  );

  const deptPieOption = useMemo(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { fontSize: 12, color: '#4B5563' },
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold' },
          },
          data: [
            { value: 342, name: '精神科', itemStyle: { color: '#1E6FD9' } },
            { value: 268, name: '心理咨询科', itemStyle: { color: '#60A5FA' } },
            { value: 156, name: '儿童青少年科', itemStyle: { color: '#93C5FD' } },
            { value: 124, name: '老年精神科', itemStyle: { color: '#F59E0B' } },
            { value: 98, name: '睡眠医学科', itemStyle: { color: '#10B981' } },
            { value: 67, name: '成瘾医学科', itemStyle: { color: '#8B5CF6' } },
          ],
        },
      ],
    }),
    []
  );

  const riskPieOption = useMemo(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}: {c}人 ({d}%)' },
      series: [
        {
          type: 'pie',
          radius: ['55%', '80%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 3 },
          label: {
            show: true,
            position: 'center',
            formatter: () => `80,000+\n已建档患者`,
            fontSize: 14,
            color: '#374151',
            lineHeight: 22,
            fontWeight: 500,
          },
          data: [
            { value: 124, name: '高危', itemStyle: { color: '#DC2626' } },
            { value: 1568, name: '中危', itemStyle: { color: '#F59E0B' } },
            { value: 78308, name: '低危', itemStyle: { color: '#10B981' } },
          ],
        },
      ],
      legend: {
        bottom: 10,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { fontSize: 12, color: '#4B5563' },
      },
    }),
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">统计报表</h1>
          <p className="mt-1 text-sm text-gray-500">多维度业务数据分析，助力科学决策</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setTimeRange(r.value)}
                className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                  timeRange === r.value
                    ? 'bg-white text-primary-600 shadow-sm font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {timeRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="input !py-1.5 !text-xs w-36"
              />
              <span className="text-gray-400 text-xs">至</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="input !py-1.5 !text-xs w-36"
              />
            </div>
          )}
          <LoadingButton
            onClick={handleExportReport}
            variant="secondary"
            disabled={timeRange === 'custom' && (!customStartDate || !customEndDate)}
            loadingText="导出中..."
          >
            <Download className="w-4 h-4 mr-1.5" />
            导出报表
          </LoadingButton>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: '总预约量',
            value: totalAppointments.toLocaleString(),
            icon: CalendarCheck,
            color: 'primary',
            sub: `日均 ${avgDailyAppointments} 次`,
          },
          {
            label: '预警总数',
            value: totalWarnings,
            icon: AlertTriangle,
            color: 'danger',
            sub: `高危 ${highWarningCount} 条`,
          },
          {
            label: '患者总数',
            value: '80,000+',
            icon: Users,
            color: 'secondary',
            sub: '已建档管理',
          },
          {
            label: '就诊率',
            value: '92.3%',
            icon: Activity,
            color: 'green',
            sub: '较上月 +2.1%',
          },
        ].map((s, i) => {
          const Icon = s.icon;
          const colorMap: Record<string, string> = {
            primary: 'from-primary-500 to-primary-600',
            danger: 'from-danger-500 to-danger-600',
            secondary: 'from-secondary-500 to-secondary-600',
            green: 'from-green-500 to-green-600',
          };
          return (
            <div
              key={i}
              className="card p-4 animate-slide-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-gray-500">{s.label}</div>
                  <div className="mt-2 text-2xl font-bold text-gray-800">{s.value}</div>
                  <div className="mt-1 text-xs text-gray-400">{s.sub}</div>
                </div>
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorMap[s.color]} flex items-center justify-center`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-gray-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-600" />
              预约量趋势
            </h3>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              近{timeRange}天
            </span>
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-400">加载中...</div>
          ) : (
            <ReactECharts option={apptChartOption} style={{ height: 280 }} />
          )}
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              科室预约分布
            </h3>
          </div>
          <ReactECharts option={deptPieOption} style={{ height: 280 }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              预警趋势分析
            </h3>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              按风险等级
            </span>
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-400">加载中...</div>
          ) : (
            <ReactECharts option={warningChartOption} style={{ height: 280 }} />
          )}
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning-600" />
              患者风险分布
            </h3>
          </div>
          <ReactECharts option={riskPieOption} style={{ height: 280 }} />
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-base font-medium text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary-600" />
          医生工作量排行 TOP 10
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-3 px-3 font-medium">排名</th>
                <th className="py-3 px-3 font-medium">医生</th>
                <th className="py-3 px-3 font-medium">科室</th>
                <th className="py-3 px-3 font-medium">服务站</th>
                <th className="py-3 px-3 font-medium">预约量</th>
                <th className="py-3 px-3 font-medium">就诊率</th>
                <th className="py-3 px-3 font-medium">患者满意度</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['张建华', '精神科', '中心院区', 156, '96.2%', '98.5%'],
                ['刘建国', '睡眠医学科', '中心院区', 142, '93.7%', '97.2%'],
                ['李雪梅', '心理咨询科', '中心院区', 128, '91.4%', '96.8%'],
                ['王志强', '精神科', '东区服务站', 115, '89.6%', '95.3%'],
                ['陈美玲', '儿童青少年科', '西区服务站', 98, '94.9%', '97.1%'],
                ['赵晓燕', '心理咨询科', '南区服务站', 87, '88.5%', '94.6%'],
              ].map((row, i) => (
                <tr key={i} className="table-row">
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        i === 0
                          ? 'bg-yellow-100 text-yellow-700'
                          : i === 1
                          ? 'bg-gray-200 text-gray-600'
                          : i === 2
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-medium text-gray-800">{row[0]}</td>
                  <td className="py-3 px-3 text-gray-600">{row[1]}</td>
                  <td className="py-3 px-3 text-gray-600">{row[2]}</td>
                  <td className="py-3 px-3">
                    <span className="font-medium text-primary-600">{row[3]}</span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: row[4] }}
                        />
                      </div>
                      <span className="text-gray-700 text-xs">{row[4]}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500"
                          style={{ width: row[5] }}
                        />
                      </div>
                      <span className="text-gray-700 text-xs">{row[5]}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showReport && reportData && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                报表数据（{reportData.startDate} ~ {reportData.endDate}）
              </h3>
              <button onClick={() => setShowReport(false)} className="btn-ghost p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: '总预约量', value: reportData.totalAppointments, color: 'text-primary-600' },
                  { label: '已完成预约', value: reportData.completedAppointments, color: 'text-green-600' },
                  { label: '已取消预约', value: reportData.cancelledAppointments, color: 'text-danger-600' },
                  { label: '预警总数', value: reportData.totalWarnings, color: 'text-warning-600' },
                  { label: '高危预警', value: reportData.highRiskWarnings, color: 'text-danger-600' },
                ].map((item) => (
                  <div key={item.label} className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">{item.label}</div>
                    <div className={`mt-1 text-2xl font-bold ${item.color}`}>{item.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">按科室分布</h4>
                  <div className="space-y-2">
                    {Object.entries(reportData.byDepartment).map(([dept, count]) => (
                      <div key={dept} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">{dept}</span>
                        <span className="text-sm font-medium text-primary-600">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">按服务站分布</h4>
                  <div className="space-y-2">
                    {Object.entries(reportData.byStation).map(([station, count]) => (
                      <div key={station} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">{station}</span>
                        <span className="text-sm font-medium text-primary-600">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowReport(false)} className="btn-secondary">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
