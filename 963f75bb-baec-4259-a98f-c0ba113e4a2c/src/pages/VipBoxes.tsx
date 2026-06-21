import { useState } from 'react';
import { 
  Crown, 
  Users, 
  Clock, 
  DollarSign,
  Star,
  AlertCircle,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  MoreHorizontal,
  ArrowRightLeft,
  Lock,
  Clock3
} from 'lucide-react';
import { useVenueStore } from '@/store/useVenueStore';
import { vipBoxes, vipBookings } from '@/mock';
import { cn } from '@/utils/helpers';
import { formatDateTime, formatMoney, formatRelativeTime } from '@/utils/dateUtils';
import type { VipBox, VipBooking, BookingPriority, VipBoxLevel } from '@/types';

export default function VipBoxes() {
  const { selectedVenueId } = useVenueStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterLevel, setFilterLevel] = useState<VipBoxLevel | 'all'>('all');
  const [selectedBox, setSelectedBox] = useState<VipBox | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const venueBoxes = vipBoxes.filter(b => b.venueId === selectedVenueId);
  
  const filteredBoxes = venueBoxes.filter(box => {
    const matchesLevel = filterLevel === 'all' || box.level === filterLevel;
    const matchesSearch = box.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const stats = {
    total: venueBoxes.length,
    available: venueBoxes.filter(b => b.status === 'available').length,
    occupied: venueBoxes.filter(b => b.status === 'occupied').length,
    maintenance: venueBoxes.filter(b => b.status === 'maintenance').length,
  };

  const levelColors: Record<VipBoxLevel, string> = {
    presidential: 'from-amber-400 to-yellow-600',
    premium: 'from-purple-400 to-purple-600',
    standard: 'from-cyan-400 to-blue-500',
  };

  const levelNames: Record<VipBoxLevel, string> = {
    presidential: '总统级',
    premium: '豪华级',
    standard: '标准级',
  };

  const priorityColors: Record<BookingPriority, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    medium: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  const priorityNames: Record<BookingPriority, string> = {
    critical: '特急',
    high: '高',
    medium: '中',
    low: '低',
  };

  const statusColors: Record<string, string> = {
    confirmed: 'bg-green-500/20 text-green-400',
    locked: 'bg-cyan-500/20 text-cyan-400',
    pending: 'bg-amber-500/20 text-amber-400',
    negotiating: 'bg-purple-500/20 text-purple-400',
    cancelled: 'bg-red-500/20 text-red-400',
  };

  const statusNames: Record<string, string> = {
    confirmed: '已确认',
    locked: '已锁定',
    pending: '待确认',
    negotiating: '协商中',
    cancelled: '已取消',
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">VIP包厢管理</h1>
          <p className="text-slate-400 text-sm mt-1">
            共 {venueBoxes.length} 间包厢 · {stats.available} 间可用
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-amber-500/30 transition-all">
            <Crown className="w-4 h-4" />
            新建预订
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '包厢总数', value: stats.total, icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: '可预订', value: stats.available, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: '已占用', value: stats.occupied, icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: '维护中', value: stats.maintenance, icon: AlertCircle, color: 'text-slate-400', bg: 'bg-slate-500/10' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`${stat.bg} border border-slate-700/50 rounded-xl p-4`}>
              <div className="flex items-center justify-between">
                <p className="text-slate-400 text-sm">{stat.label}</p>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className={`text-3xl font-bold ${stat.color} mt-2`}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="搜索包厢..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as any)}
              className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">全部等级</option>
              <option value="presidential">总统级</option>
              <option value="premium">豪华级</option>
              <option value="standard">标准级</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors',
              viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            网格
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors',
              viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            列表
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 overflow-auto">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-6 gap-3">
              {filteredBoxes.map(box => (
                <button
                  key={box.id}
                  onClick={() => setSelectedBox(box)}
                  className={cn(
                    'p-4 rounded-xl border transition-all text-left',
                    selectedBox?.id === box.id
                      ? 'border-cyan-500/50 bg-cyan-500/10 scale-105'
                      : 'border-slate-700/50 bg-slate-800/60 hover:border-slate-600'
                  )}
                >
                  <div className={`w-full aspect-square rounded-lg bg-gradient-to-br ${levelColors[box.level]} flex items-center justify-center mb-3 relative overflow-hidden`}>
                    <Crown className="w-8 h-8 text-white/90" />
                    {box.status === 'occupied' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white/80" />
                      </div>
                    )}
                    {box.status === 'maintenance' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-amber-400" />
                      </div>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-white truncate">{box.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{levelNames[box.level]}</p>
                  <p className="text-xs text-amber-400 mt-2 font-medium">{formatMoney(box.price)}/场</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBoxes.map(box => (
                <div 
                  key={box.id}
                  className="flex items-center justify-between p-4 bg-slate-800/60 rounded-xl border border-slate-700/30 hover:border-slate-600 transition-colors cursor-pointer"
                  onClick={() => setSelectedBox(box)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${levelColors[box.level]} flex items-center justify-center`}>
                      <Crown className="w-6 h-6 text-white/90" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium">{box.name}</h4>
                      <p className="text-xs text-slate-500">{levelNames[box.level]} · {box.capacity}人 · {box.amenities.length}项设施</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-amber-400 font-semibold">{formatMoney(box.price)}/场</span>
                    <span className={cn(
                      'px-2 py-1 rounded-lg text-xs font-medium',
                      box.status === 'available' && 'bg-green-500/20 text-green-400',
                      box.status === 'occupied' && 'bg-cyan-500/20 text-cyan-400',
                      box.status === 'maintenance' && 'bg-slate-500/20 text-slate-400',
                    )}>
                      {box.status === 'available' ? '可预订' : box.status === 'occupied' ? '使用中' : '维护中'}
                    </span>
                    <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-96 flex-shrink-0 bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
          {selectedBox ? (
            <>
              <div className={`p-5 bg-gradient-to-br ${levelColors[selectedBox.level]}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Crown className="w-6 h-6 text-white" />
                      <h3 className="text-xl font-bold text-white">{selectedBox.name}</h3>
                    </div>
                    <p className="text-white/70 text-sm mt-1">{levelNames[selectedBox.level]}</p>
                  </div>
                  <span className={cn(
                    'px-3 py-1 rounded-full text-sm font-medium',
                    selectedBox.status === 'available' && 'bg-white/20 text-white',
                    selectedBox.status === 'occupied' && 'bg-red-500/50 text-white',
                    selectedBox.status === 'maintenance' && 'bg-amber-500/50 text-white',
                  )}>
                    {selectedBox.status === 'available' ? '可预订' : selectedBox.status === 'occupied' ? '使用中' : '维护中'}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/60 rounded-xl p-3">
                    <p className="text-xs text-slate-500">容纳人数</p>
                    <p className="text-xl font-bold text-white mt-1">{selectedBox.capacity}人</p>
                  </div>
                  <div className="bg-slate-800/60 rounded-xl p-3">
                    <p className="text-xs text-slate-500">价格</p>
                    <p className="text-xl font-bold text-amber-400 mt-1">{formatMoney(selectedBox.price)}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">配套设施</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedBox.amenities.map(amenity => (
                      <span key={amenity} className="px-2 py-1 bg-slate-700/50 rounded-md text-xs text-slate-300">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-white">预订记录</h4>
                    <span className="text-xs text-slate-500">
                      {vipBookings.filter(b => b.boxId === selectedBox.id).length} 条
                    </span>
                  </div>
                  <div className="space-y-2">
                    {vipBookings.filter(b => b.boxId === selectedBox.id).slice(0, 3).map(booking => (
                      <div key={booking.id} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white font-medium truncate">{booking.eventName}</span>
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs flex-shrink-0',
                            statusColors[booking.status]
                          )}>
                            {statusNames[booking.status]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{booking.customerName}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded border',
                            priorityColors[booking.priority]
                          )}>
                            {priorityNames[booking.priority]}优先级
                          </span>
                          <span className="text-xs text-amber-400 font-medium">{formatMoney(booking.amount)}</span>
                        </div>
                      </div>
                    ))}
                    {vipBookings.filter(b => b.boxId === selectedBox.id).length === 0 && (
                      <p className="text-center text-slate-500 text-sm py-4">暂无预订记录</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-700/50 flex gap-3">
                <button className="flex-1 py-2.5 bg-slate-700/50 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors">
                  查看详情
                </button>
                <button className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-amber-500/30 transition-all">
                  立即预订
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto mb-3">
                  <Crown className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-slate-500">选择包厢查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">待分配队列</h3>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock3 className="w-4 h-4" />
            <span>共 {vipBookings.filter(b => b.status === 'pending' || b.status === 'negotiating').length} 个待处理</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {vipBookings.filter(b => b.status === 'pending' || b.status === 'negotiating').map(booking => (
            <div 
              key={booking.id}
              className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/30"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-white font-medium">{booking.eventName}</h4>
                  <p className="text-sm text-slate-500 mt-0.5">{booking.customerName}</p>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded text-xs border',
                  priorityColors[booking.priority]
                )}>
                  {priorityNames[booking.priority]}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                <span>{formatDateTime(booking.createdAt)}</span>
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-xs',
                  statusColors[booking.status]
                )}>
                  {statusNames[booking.status]}
                </span>
              </div>

              {booking.notes && (
                <p className="text-xs text-slate-500 bg-slate-700/30 p-2 rounded-lg mb-3">
                  {booking.notes}
                </p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-amber-400 font-semibold">{formatMoney(booking.amount)}</span>
                <div className="flex items-center gap-2">
                  {booking.status === 'negotiating' && (
                    <button className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-xs hover:bg-purple-500/30 transition-colors">
                      <ArrowRightLeft className="w-3 h-3" />
                      置换协商
                    </button>
                  )}
                  <button className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs hover:bg-cyan-500/30 transition-colors">
                    确认预订
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
