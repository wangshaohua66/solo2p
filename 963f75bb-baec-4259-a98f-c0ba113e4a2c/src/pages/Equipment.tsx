import { useState } from 'react';
import { 
  Cpu, 
  Lightbulb, 
  Volume2, 
  Monitor, 
  Settings,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Clock,
  RefreshCw,
  ArrowRightLeft,
  Zap
} from 'lucide-react';
import { useVenueStore } from '@/store/useVenueStore';
import { cn } from '@/utils/helpers';
import { formatDate } from '@/utils/dateUtils';

export default function Equipment() {
  const { equipment, selectedVenueId, equipmentMode, setEquipmentMode, venues } = useVenueStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSwitching, setIsSwitching] = useState(false);

  const venueEquipment = equipment.filter(e => e.venueId === selectedVenueId);
  
  const categories = Array.from(new Set(venueEquipment.map(e => e.category)));
  
  const filteredEquipment = selectedCategory === 'all' 
    ? venueEquipment 
    : venueEquipment.filter(e => e.category === selectedCategory);

  const stats = {
    total: venueEquipment.length,
    normal: venueEquipment.filter(e => e.status === 'normal').length,
    warning: venueEquipment.filter(e => e.status === 'warning').length,
    fault: venueEquipment.filter(e => e.status === 'fault').length,
    maintenance: venueEquipment.filter(e => e.status === 'maintenance').length,
  };

  const sportsCount = venueEquipment.filter(e => e.sportsMode).length;
  const concertCount = venueEquipment.filter(e => e.concertMode).length;

  const handleModeSwitch = () => {
    setIsSwitching(true);
    setTimeout(() => {
      setEquipmentMode(equipmentMode === 'sports' ? 'concert' : 'sports');
      setIsSwitching(false);
    }, 2000);
  };

  const statusColors: Record<string, string> = {
    normal: 'text-green-400 bg-green-500/10 border-green-500/30',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    fault: 'text-red-400 bg-red-500/10 border-red-500/30',
    maintenance: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  };

  const statusNames: Record<string, string> = {
    normal: '正常',
    warning: '预警',
    fault: '故障',
    maintenance: '维护中',
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return CheckCircle2;
      case 'warning': return AlertTriangle;
      case 'fault': return Zap;
      case 'maintenance': return Wrench;
      default: return Cpu;
    }
  };

  const currentVenue = venues.find(v => v.id === selectedVenueId);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">设备管理</h1>
          <p className="text-slate-400 text-sm mt-1">
            {currentVenue?.name} · 共 {venueEquipment.length} 台设备
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleModeSwitch}
            disabled={isSwitching}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all',
              isSwitching 
                ? 'bg-slate-700 text-slate-400 cursor-wait'
                : equipmentMode === 'sports'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-green-500/30'
                : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-lg hover:shadow-orange-500/30'
            )}
          >
            {isSwitching ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                模式切换中...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                切换到{equipmentMode === 'sports' ? '演唱会' : '体育'}模式
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-800/60 to-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center transition-all',
                equipmentMode === 'sports' 
                  ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/10 border border-green-500/30'
                  : 'bg-gradient-to-br from-orange-500/30 to-amber-500/10 border border-orange-500/30'
              )}>
                {equipmentMode === 'sports' ? (
                  <Settings className="w-7 h-7 text-green-400" />
                ) : (
                  <Volume2 className="w-7 h-7 text-orange-400" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  当前模式：{equipmentMode === 'sports' ? '体育赛事模式' : '演唱会模式'}
                </h2>
                <p className="text-slate-400 text-sm">
                  {equipmentMode === 'sports' 
                    ? '适用于足球、篮球、游泳等体育赛事，启用计分、计时等专业设备'
                    : '适用于演唱会、商业活动，启用舞台灯光、音响等演出设备'
                  }
                </p>
              </div>
            </div>

            <div className="h-16 w-px bg-slate-700/50" />

            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">
                  {equipmentMode === 'sports' ? sportsCount : concertCount}
                </p>
                <p className="text-sm text-slate-500">可用设备</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-400">
                  {stats.warning + stats.fault}
                </p>
                <p className="text-sm text-slate-500">异常设备</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-cyan-400">
                  {Math.round(((equipmentMode === 'sports' ? sportsCount : concertCount) / venueEquipment.length) * 100)}%
                </p>
                <p className="text-sm text-slate-500">设备就绪率</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '全部设备', value: stats.total, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: '正常运行', value: stats.normal, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: '预警状态', value: stats.warning, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: '故障设备', value: stats.fault, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: '维护中', value: stats.maintenance, color: 'text-slate-400', bg: 'bg-slate-500/10' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} border border-slate-700/50 rounded-xl p-4`}>
            <p className="text-slate-400 text-sm">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color} mt-1`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory('all')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
            selectedCategory === 'all'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/50'
          )}
        >
          全部
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              selectedCategory === cat
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/50'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-auto">
        <div className="grid grid-cols-3 gap-4 p-4">
          {filteredEquipment.map(device => {
            const StatusIcon = getStatusIcon(device.status);
            const isCompatible = equipmentMode === 'sports' ? device.sportsMode : device.concertMode;
            const needsConversion = !isCompatible;

            return (
              <div 
                key={device.id}
                className={cn(
                  'p-4 rounded-xl border transition-all',
                  device.status === 'fault' 
                    ? 'bg-red-500/5 border-red-500/30'
                    : device.status === 'warning'
                    ? 'bg-amber-500/5 border-amber-500/30'
                    : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      device.category === '灯光系统' && 'bg-yellow-500/10',
                      device.category === '音响系统' && 'bg-purple-500/10',
                      device.category === '显示系统' && 'bg-blue-500/10',
                      device.category === '体育器材' && 'bg-green-500/10',
                      (!device.category.includes('灯光') && !device.category.includes('音响') && !device.category.includes('显示') && !device.category.includes('体育')) && 'bg-slate-700/50',
                    )}>
                      {device.category.includes('灯光') && <Lightbulb className="w-6 h-6 text-yellow-400" />}
                      {device.category.includes('音响') && <Volume2 className="w-6 h-6 text-purple-400" />}
                      {device.category.includes('显示') && <Monitor className="w-6 h-6 text-blue-400" />}
                      {device.category.includes('体育') && <Settings className="w-6 h-6 text-green-400" />}
                      {(!device.category.includes('灯光') && !device.category.includes('音响') && !device.category.includes('显示') && !device.category.includes('体育')) && <Cpu className="w-6 h-6 text-slate-400" />}
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{device.name}</h4>
                      <p className="text-xs text-slate-500">{device.category}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1',
                    statusColors[device.status]
                  )}>
                    <StatusIcon className="w-3 h-3" />
                    {statusNames[device.status]}
                  </span>
                </div>

                <p className="text-sm text-slate-400 mb-3">
                  {device.specification}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                  <span>位置：{device.location}</span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs',
                    device.sportsMode 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-slate-700/50 text-slate-500'
                  )}>
                    体育模式
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs',
                    device.concertMode 
                      ? 'bg-orange-500/20 text-orange-400' 
                      : 'bg-slate-700/50 text-slate-500'
                  )}>
                    演唱会模式
                  </span>
                </div>

                {needsConversion && (
                  <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-amber-300/80">
                      需 {30 + Math.floor(Math.random() * 30)} 分钟转换时间
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/30">
                  <span className="text-xs text-slate-500">
                    上次检查：{formatDate(device.lastCheckDate)}
                  </span>
                  <button className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                    查看详情
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
