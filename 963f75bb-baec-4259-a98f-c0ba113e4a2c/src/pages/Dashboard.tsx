import { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Users,
  Ticket,
  BarChart3,
  AlertTriangle,
  Download,
  RefreshCw,
  DollarSign,
  Activity,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { useVenueStore } from '@/store/useVenueStore';
import { eventTypeNames, eventTypeColors } from '@/mock';
import { cn } from '@/utils/helpers';
import { formatMoney, formatNumber } from '@/utils/dateUtils';
import { ticketApi } from '@/services/api/ticketApi';
import { venueApi } from '@/services/api/venueApi';
import type { RevenueData, SalesAlert, DashboardStats, VenueStats } from '@/types';

type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';

export default function Dashboard() {
  const { venues } = useVenueStore();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [salesAlerts, setSalesAlerts] = useState<SalesAlert[]>([]);
  const [venueStats, setVenueStats] = useState<VenueStats[]>([]);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [statsRes, revenueRes, alertsRes, venueStatsRes] = await Promise.all([
        ticketApi.getDashboardStats(selectedPeriod),
        ticketApi.getRevenueData({ period: selectedPeriod }),
        ticketApi.getSalesAlerts(),
        venueApi.getAllVenueStats(selectedPeriod),
      ]);
      
      setStats(statsRes);
      setRevenueData(revenueRes);
      setSalesAlerts(alertsRes);
      setVenueStats(venueStatsRes);
    } catch (err) {
      setError('加载数据失败，请稍后重试');
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await ticketApi.resolveSalesAlert(alertId);
      setSalesAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, resolved: true } : a
      ));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const handleExport = async () => {
    if (exportStatus === 'loading') return;
    
    try {
      setExportStatus('loading');
      setExportProgress(0);
      
      const blob = await ticketApi.exportRevenueReport(
        { period: selectedPeriod },
        (progress) => setExportProgress(progress)
      );
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `营收报表_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setExportStatus('success');
      setTimeout(() => {
        setExportStatus('idle');
        setExportProgress(null);
      }, 2000);
    } catch (err) {
      console.error('Export failed:', err);
      setExportStatus('error');
      setTimeout(() => {
        setExportStatus('idle');
        setExportProgress(null);
      }, 3000);
    }
  };

  const chartData = useMemo(() => {
    const grouped: Record<string, { date: string; revenue: number; tickets: number }> = {};
    
    revenueData.forEach(item => {
      const key = item.date;
      if (!grouped[key]) {
        grouped[key] = { date: key.slice(5), revenue: 0, tickets: 0 };
      }
      grouped[key].revenue += item.revenue;
      grouped[key].tickets += item.ticketsSold;
    });

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [revenueData]);

  const venueRevenueData = useMemo(() => {
    return venueStats.map(vs => ({
      name: vs.venueName.replace('馆', '').replace('体育场', '体育场'),
      revenue: vs.revenue / 10000,
      events: vs.eventsCount,
      utilization: vs.utilization,
    }));
  }, [venueStats]);

  const eventTypeData = useMemo(() => {
    const types: Record<string, number> = {};
    revenueData.forEach(item => {
      if (!types[item.eventType]) types[item.eventType] = 0;
      types[item.eventType] += item.revenue;
    });
    
    return Object.entries(types).map(([type, value]) => ({
      name: eventTypeNames[type as keyof typeof eventTypeNames] || type,
      value: value / 10000,
    }));
  }, [revenueData]);

  const COLORS = ['#00FF88', '#00D4FF', '#3B82F6', '#FF6B35', '#A855F7'];

  const renderStatsCards = () => {
    if (!stats) return null;
    
    const statItems = [
      { 
        label: '总营收', 
        value: formatMoney(stats.totalRevenue), 
        change: stats.revenueChange, 
        icon: DollarSign,
        color: 'text-green-400',
        bg: 'from-green-500/20 to-emerald-500/5',
        border: 'border-green-500/30'
      },
      { 
        label: '赛事场次', 
        value: stats.totalEvents.toString(), 
        change: stats.eventsChange, 
        icon: Calendar,
        color: 'text-cyan-400',
        bg: 'from-cyan-500/20 to-blue-500/5',
        border: 'border-cyan-500/30'
      },
      { 
        label: '售票数量', 
        value: formatNumber(stats.totalTickets), 
        change: stats.ticketsChange, 
        icon: Ticket,
        color: 'text-amber-400',
        bg: 'from-amber-500/20 to-orange-500/5',
        border: 'border-amber-500/30'
      },
      { 
        label: '场馆利用率', 
        value: `${stats.venueUtilization}%`, 
        change: stats.utilizationChange, 
        icon: Activity,
        color: 'text-purple-400',
        bg: 'from-purple-500/20 to-violet-500/5',
        border: 'border-purple-500/30'
      },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((stat, idx) => {
          const Icon = stat.icon;
          const isPositive = stat.change >= 0;
          return (
            <div 
              key={idx}
              className={`bg-gradient-to-br ${stat.bg} border ${stat.border} rounded-2xl p-5 relative overflow-hidden`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full -mr-8 -mt-8" />
              
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-400 text-sm">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color} mt-2`}>{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>

              <div className="flex items-center gap-1 mt-3">
                {isPositive ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <span className={cn(
                  'text-sm font-medium',
                  isPositive ? 'text-green-400' : 'text-red-400'
                )}>
                  {isPositive ? '+' : ''}{stat.change}%
                </span>
                <span className="text-slate-500 text-sm">较上月同期</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCharts = () => {
    return (
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        <div className="col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">营收趋势</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-400" />
                <span className="text-slate-400">营收</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="text-slate-400">售票数</span>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00D4FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                  formatter={(value: number) => [`¥${(value / 10000).toFixed(1)}万`, '营收']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#00D4FF" 
                  strokeWidth={2}
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4">赛事类型分布</h3>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={eventTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {eventTypeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}万`, '营收']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {eventTypeData.slice(0, 4).map((item, idx) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                <span className="text-xs text-slate-400">{item.name}</span>
                <span className="text-xs text-slate-300 ml-auto">{item.value.toFixed(0)}万</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderBottomSection = () => {
    return (
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">场馆营收对比</h3>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={venueRevenueData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}万`, '营收']}
                />
                <Bar dataKey="revenue" fill="#00D4FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">销售预警</h3>
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
              {salesAlerts.filter(a => !a.resolved).length} 条
            </span>
          </div>
          <div className="space-y-3">
            {salesAlerts.slice(0, 3).map(alert => (
              <div 
                key={alert.id}
                className={cn(
                  'p-3 rounded-xl border transition-colors cursor-pointer',
                  alert.resolved 
                    ? 'bg-slate-700/30 border-slate-700/30 opacity-60'
                    : alert.severity === 'high'
                    ? 'bg-red-500/10 border-red-500/30'
                    : alert.severity === 'medium'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                )}
                onClick={() => !alert.resolved && handleResolveAlert(alert.id)}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className={cn(
                    'w-4 h-4 flex-shrink-0 mt-0.5',
                    alert.severity === 'high' && 'text-red-400',
                    alert.severity === 'medium' && 'text-amber-400',
                    alert.severity === 'low' && 'text-blue-400',
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{alert.eventName}</p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{alert.description}</p>
                    {alert.resolved && (
                      <span className="text-xs text-green-400 mt-1 inline-block">已处理</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-cyan-400 animate-spin" />
            <p className="text-slate-400">加载中...</p>
          </div>
        </div>
      );
    }

    if (!stats) {
      return null;
    }

    return (
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {renderStatsCards()}
        {renderCharts()}
        {renderBottomSection()}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">运营仪表盘</h1>
          <p className="text-slate-400 text-sm mt-1">实时掌握场馆运营数据</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
            {(['day', 'week', 'month', 'quarter', 'year'] as const).map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm transition-colors',
                  selectedPeriod === period 
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {period === 'day' ? '日' : period === 'week' ? '周' : period === 'month' ? '月' : period === 'quarter' ? '季' : '年'}
              </button>
            ))}
          </div>

          <button