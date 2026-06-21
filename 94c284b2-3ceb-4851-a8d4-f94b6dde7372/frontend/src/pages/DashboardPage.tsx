import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {
  Calendar,
  AlertTriangle,
  Users,
  TrendingUp,
  Plus,
  FileText,
  Bell,
  UserPlus,
  ArrowUp,
  ArrowDown,
  Clock,
  MapPin,
} from 'lucide-react';
import { useAppStore } from '@/store';
import WarningPanel from '@/components/WarningPanel';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { overviewStats, loadOverview, appointments, loadAppointments, warnings, loadWarnings } = useAppStore();

  useEffect(() => {
    loadOverview();
    loadAppointments();
    loadWarnings({ status: 'pending' });
  }, [loadOverview, loadAppointments, loadWarnings]);

  const stats = [
    {
      label: '今日预约',
      value: overviewStats?.todayAppointments || 0,
      trend: '+12.5%',
      up: true,
      icon: Calendar,
      gradient: 'from-primary-500 to-primary-600',
    },
    {
      label: '待处理预警',
      value: overviewStats?.pendingWarnings || 0,
      trend: '+3',
      up: false,
      icon: AlertTriangle,
      gradient: 'from-danger-500 to-danger-600',
    },
    {
      label: '患者总数',
      value: (overviewStats?.totalPatients || 0).toLocaleString(),
      trend: '+156',
      up: true,
      icon: Users,
      gradient: 'from-secondary-500 to-secondary-600',
    },
    {
      label: '高危患者',
      value: overviewStats?.highRiskPatients || 0,
      trend: '-2.1%',
      up: true,
      icon: TrendingUp,
      gradient: 'from-warning-500 to-warning-600',
    },
  ];

  const quickActions = [
    { label: '新建预约', icon: Plus, onClick: () => navigate('/appointments') },
    { label: '新增患者', icon: UserPlus, onClick: () => navigate('/patients') },
    { label: '量表评估', icon: FileText, onClick: () => navigate('/patients') },
    { label: '预警处置', icon: Bell, onClick: () => navigate('/warnings') },
  ];

  const todayAppts = appointments.slice(0, 6);
  const pendingWarnings = warnings.filter((w) => w.status !== 'resolved').slice(0, 3);

  const chartOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: { color: '#6B7280' },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#F3F4F6' } },
      axisLabel: { color: '#6B7280' },
    },
    series: [
      {
        name: '预约量',
        type: 'bar',
        data: [45, 52, 61, 58, 67, 42, 35],
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#3B82F6' },
              { offset: 1, color: '#1E6FD9' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: 28,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="card-hover p-5 overflow-hidden relative animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br ${s.gradient} opacity-10`} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{s.value}</p>
                  <p className={`text-xs mt-2 flex items-center gap-1 ${s.up ? 'text-secondary-600' : 'text-danger-600'}`}>
                    {s.up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    <span>{s.trend}</span>
                    <span className="text-gray-400 ml-1">较上周</span>
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${s.gradient} text-white flex items-center justify-center shadow-md`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {quickActions.map((a, i) => {
          const Icon = a.icon;
          return (
            <button
              key={i}
              onClick={a.onClick}
              className="card-hover p-4 flex items-center gap-3 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-colors">
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-gray-700">{a.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-800">本周预约趋势</h3>
            <button onClick={() => navigate('/appointments')} className="text-sm text-primary-600 hover:text-primary-700">
              查看全部 →
            </button>
          </div>
          <ReactECharts option={chartOption} style={{ height: 280 }} />
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-800">待处理高危预警</h3>
            <button onClick={() => navigate('/warnings')} className="text-sm text-primary-600 hover:text-primary-700">
              预警中心 →
            </button>
          </div>
          <div className="space-y-3">
            {pendingWarnings.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">暂无待处理预警</p>
            ) : (
              pendingWarnings.map((w) => <WarningPanel key={w.id} warning={w} compact />)
            )}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">今日就诊日程</h3>
          <button onClick={() => navigate('/appointments')} className="text-sm text-primary-600 hover:text-primary-700">
            全部预约 →
          </button>
        </div>
        {todayAppts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">今日暂无预约</p>
        ) : (
          <div className="space-y-1">
            {todayAppts.map((a, i) => (
              <div
                key={a.id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors group table-row"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex flex-col items-center w-14 border-r border-gray-100 pr-3">
                  <Clock className="w-4 h-4 text-gray-400 mb-1" />
                  <span className="text-sm font-medium text-gray-800">{a.timeSlot}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{a.patientName || '未命名患者'}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>{a.doctorName}</span>
                    <span>·</span>
                    <MapPin className="w-3 h-3" />
                    <span>{a.date}</span>
                  </p>
                </div>
                <span
                  className={`badge ${
                    a.status === 'confirmed'
                      ? 'bg-secondary-100 text-secondary-700'
                      : a.status === 'completed'
                        ? 'bg-gray-100 text-gray-600'
                        : a.status === 'cancelled'
                          ? 'bg-gray-100 text-gray-400'
                          : 'bg-warning-100 text-warning-700'
                  }`}
                >
                  {a.status === 'confirmed'
                    ? '已确认'
                    : a.status === 'completed'
                      ? '已完成'
                      : a.status === 'cancelled'
                        ? '已取消'
                        : '待确认'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
