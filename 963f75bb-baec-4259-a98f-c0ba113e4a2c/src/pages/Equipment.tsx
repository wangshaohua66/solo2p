import { useState, useMemo } from 'react';
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
  Zap,
  X,
  ArrowRight,
  Info,
  Shield,
  Timer
} from 'lucide-react';
import { useVenueStore } from '@/store/useVenueStore';
import { cn } from '@/utils/helpers';
import { formatDate } from '@/utils/dateUtils';
import type { Equipment } from '@/types';

interface AlternativeEquipment {
  id: string;
  name: string;
  category: string;
  switchTime: number;
  impactLevel: 'low' | 'medium' | 'high';
  impactDescription: string;
  status: 'available' | 'occupied' | 'maintenance';
}

export default function Equipment() {
  const { equipment, selectedVenueId, equipmentMode, setEquipmentMode, venues } = useVenueStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSwitching, setIsSwitching] = useState(false);
  const [selectedFaultDevice, setSelectedFaultDevice] = useState<Equipment | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [switchingDeviceId, setSwitchingDeviceId] = useState<string | null>(null);

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

  const alternativeEquipment = useMemo((): AlternativeEquipment[] => {
    if (!selectedFaultDevice) return [];
    
    const sameCategory = venueEquipment.filter(e => 
      e.id !== selectedFaultDevice.id && 
      e.category === selectedFaultDevice.category &&
      e.status === 'normal'
    );

    return sameCategory.slice(0, 3).map((e, idx) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      switchTime: 15 + idx * 10,
      impactLevel: idx === 0 ? 'low' : idx === 1 ? 'medium' : 'high',
      impactDescription: idx === 0 
        ? '性能匹配，无明显影响' 
        : idx === 1 
        ? '部分功能需要调整，影响较小'
        : '需要额外配置，可能影响部分体验',
      status: 'available'
    }));
  }, [selectedFaultDevice, venueEquipment]);

  const handleDeviceClick = (device: Equipment) => {
    if (device.status === 'fault' || device.status === 'warning') {
      setSelectedFaultDevice(device);
      setIsSidebarOpen(true);
    }
  };

  const handleSwitchToAlternative = async (alternative: AlternativeEquipment) => {
    if (!selectedFaultDevice || switchingDeviceId) return;
    
    setSwitchingDeviceId(alternative.id);
    
    await new Promise(resolve => setTimeout(resolve, alternative.switchTime * 50));
    
    setSwitchingDeviceId(null);
    setIsSidebarOpen(false);
    setSelectedFaultDevice(null);
  };

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
                onClick={() => handleDeviceClick(device)}
                className={cn(
                  'p-4 rounded-xl border transition-all',
                  device.status === 'fault' 
                    ? 'bg-red-500/5 border-red-500/30 cursor-pointer hover:bg-red-500/10'
                    : device.status === 'warning'
                    ? 'bg-amber-500/5 border-amber-500/30 cursor-pointer hover:bg-amber-500/10'
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
                  {(device.status === 'fault' || device.status === 'warning') && (
                    <span className="text-xs text-red-400 animate-pulse">
                      点击查看解决方案
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedFaultDevice && (
        <FaultDeviceSidebar
          isOpen={isSidebarOpen}
          onClose={() => {
            setIsSidebarOpen(false);
            setSelectedFaultDevice(null);
          }}
          device={selectedFaultDevice}
          alternatives={alternativeEquipment}
          switchingDeviceId={switchingDeviceId}
          onSwitch={handleSwitchToAlternative}
        />
      )}
    </div>
  );
}

function FaultDeviceSidebar({
  isOpen,
  onClose,
  device,
  alternatives,
  switchingDeviceId,
  onSwitch,
}: {
  isOpen: boolean;
  onClose: () => void;
  device: Equipment;
  alternatives: AlternativeEquipment[];
  switchingDeviceId: string | null;
  onSwitch: (alt: AlternativeEquipment) => void;
}) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          onClick={onClose}
        />
      )}
      
      <aside
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50 w-full sm:w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50 flex flex-col transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="text-white font-semibold">设备故障详情</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold">{device.name}</h3>
                <p className="text-sm text-slate-400 mt-1">{device.category}</p>
                <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  {device.status === 'fault' ? '故障' : '预警'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-red-500/20 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">位置</span>
                <span className="text-white">{device.location}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">规格</span>
                <span className="text-white">{device.specification}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">上次检查</span>
                <span className="text-white">{formatDate(device.lastCheckDate)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-cyan-400" />
              <h3 className="text-white font-semibold">备选方案推荐</h3>
            </div>

            {alternatives.length > 0 ? (
              <div className="space-y-3">
                {alternatives.map((alt, idx) => {
                  const isSwitching = switchingDeviceId === alt.id;
                  
                  return (
                    <div
                      key={alt.id}
                      className={cn(
                        'bg-slate-800/60 border rounded-xl p-4 transition-all',
                        idx === 0 
                          ? 'border-green-500/30 bg-green-500/5' 
                          : 'border-slate-700/50'
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-white font-medium">{alt.name}</h4>
                            {idx === 0 && (
                              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                                推荐
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{alt.category}</p>
                        </div>
                        <span className={cn(
                          'px-2 py-1 rounded text-xs font-medium',
                          alt.status === 'available' 
                            ? 'bg-green-500/20 text-green-400'
                            : alt.status === 'occupied'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-500/20 text-slate-400'
                        )}>
                          {alt.status === 'available' ? '可用' : alt.status === 'occupied' ? '占用' : '维护'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-slate-700/30 rounded-lg p-2">
                          <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                            <Timer className="w-3 h-3" />
                            <span>切换时间</span>
                          </div>
                          <p className="text-white text-sm font-medium">{alt.switchTime} 分钟</p>
                        </div>
                        <div className="bg-slate-700/30 rounded-lg p-2">
                          <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                            <Shield className="w-3 h-3" />
                            <span>影响评估</span>
                          </div>
                          <p className={cn(
                            'text-sm font-medium',
                            alt.impactLevel === 'low' && 'text-green-400',
                            alt.impactLevel === 'medium' && 'text-amber-400',
                            alt.impactLevel === 'high' && 'text-red-400'
                          )}>
                            {alt.impactLevel === 'low' ? '低' : alt.impactLevel === 'medium' ? '中' : '高'}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 mb-3">
                        {alt.impactDescription}
                      </p>

                      <button
                        onClick={() => onSwitch(alt)}
                        disabled={isSwitching || alt.status !== 'available'}
                        className={cn(
                          'w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
                          isSwitching
                            ? 'bg-slate-700 text-slate-400 cursor-wait'
                            : alt.status === 'available'
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/30'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        )}
                      >
                        {isSwitching ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            切换中...
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-4 h-4" />
                            一键切换
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-800/40 rounded-xl border border-slate-700/50">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-400" />
                <p className="text-slate-400 text-sm">暂无可用的备选设备</p>
                <p className="text-slate-500 text-xs mt-1">请联系维修人员处理</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-700/50">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-600 transition-colors"
          >
            关闭
          </button>
        </div>
      </aside>
    </>
  );
}
