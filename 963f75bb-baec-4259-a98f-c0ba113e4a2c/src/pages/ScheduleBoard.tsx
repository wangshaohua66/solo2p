import { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Filter, 
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  X
} from 'lucide-react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { useVenueStore } from '@/store/useVenueStore';
import { useEventStore } from '@/store/useEventStore';
import { eventTypeColors, eventTypeNames, statusNames } from '@/mock';
import { cn, getEventTypeColor } from '@/utils/helpers';
import { 
  formatDate, 
  formatDateTime, 
  formatMoney,
  getMonthDays, 
  getMonthName, 
  getNextMonth, 
  getPrevMonth,
  isCurrentMonth,
  isTodayDate,
  calculateDuration
} from '@/utils/dateUtils';
import type { EventItem } from '@/types';

export default function ScheduleBoard() {
  const { events, selectedEventId, selectEvent, conflictResult, checkConflicts } = useScheduleStore();
  const { venues, selectedVenueId } = useVenueStore();
  const { setWizardOpen } = useEventStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [filterType, setFilterType] = useState<string | null>(null);

  const days = useMemo(() => getMonthDays(currentDate), [currentDate]);
  
  const filteredEvents = useMemo(() => {
    let result = events.filter(e => 
      selectedVenueId ? e.venueId === selectedVenueId : true
    );
    
    if (filterType) {
      result = result.filter(e => e.type === filterType);
    }
    
    return result;
  }, [events, selectedVenueId, filterType]);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const handlePrevMonth = () => setCurrentDate(getPrevMonth(currentDate));
  const handleNextMonth = () => setCurrentDate(getNextMonth(currentDate));

  const getEventsForDay = (day: Date) => {
    const dayStr = day.toDateString();
    return filteredEvents.filter(e => {
      const startStr = new Date(e.startDate).toDateString();
      const endStr = new Date(e.endDate).toDateString();
      return dayStr >= startStr && dayStr <= endStr;
    });
  };

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">档期看板</h1>
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                viewMode === 'month' 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              月视图
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                viewMode === 'week' 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              周视图
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterType || ''}
              onChange={(e) => setFilterType(e.target.value || null)}
              className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">全部类型</option>
              {Object.entries(eventTypeNames).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            新建赛事
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/60">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-white min-w-[140px] text-center">
              {getMonthName(currentDate)}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-xs">
              {Object.entries(eventTypeNames).slice(0, 6).map(([type, name]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div 
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: eventTypeColors[type as keyof typeof eventTypeColors] }}
                  />
                  <span className="text-slate-400">{name}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-sm text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors border border-cyan-500/30"
            >
              今天
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-700/50">
          {weekDays.map((day, idx) => (
            <div 
              key={day} 
              className={cn(
                'py-3 text-center text-sm font-medium',
                idx >= 5 ? 'text-red-400' : 'text-slate-400'
              )}
            >
              周{day}
            </div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isCurrent = isCurrentMonth(day, currentDate);
            const isToday = isTodayDate(day);

            return (
              <div
                key={idx}
                className={cn(
                  'border-r border-b border-slate-700/30 p-1.5 overflow-hidden transition-colors',
                  !isCurrent && 'bg-slate-900/50',
                  isToday && 'bg-cyan-500/5',
                  idx % 7 === 6 && 'border-r-0'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    'text-xs font-medium',
                    !isCurrent && 'text-slate-600',
                    isToday && 'text-cyan-400 font-bold',
                    isCurrent && !isToday && 'text-slate-400'
                  )}>
                    {day.getDate()}
                  </span>
                  {dayEvents.length > 3 && (
                    <span className="text-xs text-slate-500">+{dayEvents.length - 3}</span>
                  )}
                </div>
                
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => {
                    const isStart = new Date(event.startDate).toDateString() === day.toDateString();
                    const color = getEventTypeColor(event.type);
                    
                    return (
                      <button
                        key={event.id}
                        onClick={() => selectEvent(event.id)}
                        className={cn(
                          'w-full text-left px-1.5 py-0.5 rounded text-xs truncate transition-all hover:scale-[1.02]',
                          isStart ? 'rounded-l-sm' : '',
                          event.status === 'cancelled' && 'opacity-50 line-through'
                        )}
                        style={{
                          backgroundColor: `${color}25`,
                          borderLeft: `2px solid ${color}`,
                          color: color,
                        }}
                        title={event.name}
                      >
                        {event.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => selectEvent(null)} />
      )}

      {conflictResult && conflictResult.hasConflict && (
        <ConflictAlert conflicts={conflictResult.conflicts} />
      )}
    </div>
  );
}

function EventDetailModal({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const color = getEventTypeColor(event.type);
  const venue = useVenueStore.getState().venues.find(v => v.id === event.venueId);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{
          boxShadow: `0 0 60px ${color}15`,
        }}
      >
        <div 
          className="p-6 border-b border-slate-700/50"
          style={{ 
            background: `linear-gradient(135deg, ${color}15 0%, transparent 100%)`,
            borderBottom: `1px solid ${color}30`,
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span 
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${color}25`, color }}
                >
                  {eventTypeNames[event.type]}
                </span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  event.status === 'scheduled' && 'bg-cyan-500/20 text-cyan-400',
                  event.status === 'pending_approval' && 'bg-amber-500/20 text-amber-400',
                  event.status === 'approved' && 'bg-green-500/20 text-green-400',
                  event.status === 'rejected' && 'bg-red-500/20 text-red-400',
                  event.status === 'completed' && 'bg-slate-500/20 text-slate-400',
                  event.status === 'cancelled' && 'bg-red-500/20 text-red-400',
                )}>
                  {statusNames[event.status]}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white">{event.name}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/60 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs">举办场馆</span>
              </div>
              <p className="text-white font-medium">{venue?.name || '未指定'}</p>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs">预计时长</span>
              </div>
              <p className="text-white font-medium">
                {calculateDuration(event.startDate, event.endDate)}
              </p>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-xs">时间安排</span>
            </div>
            <p className="text-white">
              {formatDateTime(event.startDate)}
              <span className="text-slate-500 mx-2">~</span>
              {formatDateTime(event.endDate)}
            </p>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">主办单位</span>
              <span className="text-sm text-slate-300">{event.organizer}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">预计营收</span>
              <span className="text-lg font-bold text-green-400">
                {formatMoney(event.expectedRevenue)}
              </span>
            </div>
          </div>

          {event.description && (
            <div className="bg-slate-800/60 rounded-xl p-4">
              <span className="text-xs text-slate-400 block mb-2">赛事介绍</span>
              <p className="text-sm text-slate-300 leading-relaxed">{event.description}</p>
            </div>
          )}

          <div className="bg-slate-800/60 rounded-xl p-4">
            <span className="text-xs text-slate-400 block mb-3">审批进度</span>
            <div className="flex items-center">
              {event.approvalSteps.map((step, idx) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      step.status === 'approved' && 'bg-green-500/20 text-green-400',
                      step.status === 'pending' && 'bg-slate-700 text-slate-400',
                      step.status === 'rejected' && 'bg-red-500/20 text-red-400',
                    )}>
                      {step.status === 'approved' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : step.status === 'rejected' ? (
                        '✕'
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span className="text-xs text-slate-500 mt-1">
                      {step.role === 'dispatcher' && '调度员'}
                      {step.role === 'manager' && '运营经理'}
                      {step.role === 'finance' && '财务核价'}
                    </span>
                  </div>
                  {idx < event.approvalSteps.length - 1 && (
                    <div className={cn(
                      'w-8 h-0.5 mx-1',
                      step.status === 'approved' ? 'bg-green-500/50' : 'bg-slate-700'
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700/50 flex gap-3 justify-end bg-slate-800/30">
          <button className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
            编辑
          </button>
          <button className="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm hover:bg-slate-600 transition-colors">
            查看详情
          </button>
        </div>
      </div>
    </div>
  );
}

function ConflictAlert({ conflicts }: { conflicts: any[] }) {
  return (
    <div className="fixed top-20 right-6 z-50 w-80">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-red-400 font-semibold text-sm">档期冲突警告</h4>
            <p className="text-red-300/80 text-xs mt-1">
              检测到 {conflicts.length} 处档期冲突
            </p>
            <div className="mt-2 space-y-1">
              {conflicts.slice(0, 3).map((c, i) => (
                <p key={i} className="text-xs text-red-300/70">
                  · {c.description}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
