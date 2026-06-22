import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Filter, 
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  X,
  Trash2,
  MapPin,
  List,
  LayoutGrid,
  CalendarDays
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
import { useIsMobile } from '@/hooks/useResponsive';
import type { EventItem } from '@/types';

type ViewMode = 'list' | 'month' | 'week';

export default function ScheduleBoard() {
  const { events, selectedEventId, selectEvent, conflictResult, checkConflicts, deleteEvent } = useScheduleStore();
  const { venues, selectedVenueId } = useVenueStore();
  const { setWizardOpen } = useEventStore();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'list' : 'month');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  useEffect(() => {
    setViewMode(isMobile ? 'list' : 'month');
  }, [isMobile]);

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

  const sortedEvents = useMemo(() => {
        return [...filteredEvents].sort((a, b) => 
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
      }, [filteredEvents]);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-white">档期看板</h1>
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1',
                viewMode === 'list' 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">列表</span>
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1',
                viewMode === 'month' 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">月</span>
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1',
                viewMode === 'week' 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">周</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">新建赛事</span>
            <span className="sm:hidden">新建</span>
          </button>
        </div>
      </div>

      {isMobile && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilterType(null)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors',
              !filterType
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/50 border border-transparent'
            )}
          >
            全部
          </button>
          {Object.entries(eventTypeNames).map(([key, name]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors',
                filterType === key
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/50 border border-transparent'
              )}
              style={{
                borderColor: filterType === key ? eventTypeColors[key as keyof typeof eventTypeColors] : undefined,
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {!isMobile && (
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
        </div>
      )}

      {viewMode === 'list' ? (
        <ListView
          events={sortedEvents}
          venues={venues}
          expandedEventId={expandedEventId}
          setExpandedEventId={setExpandedEventId}
          onSelectEvent={selectEvent}
          onDeleteEvent={deleteEvent}
        />
      ) : (
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
      )}

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

function ListView({
  events,
  venues,
  expandedEventId,
  setExpandedEventId,
  onSelectEvent,
  onDeleteEvent,
}: {
  events: EventItem[];
  venues: ReturnType<typeof useVenueStore.getState>['venues'];
  expandedEventId: string | null;
  setExpandedEventId: (id: string | null) => void;
  onSelectEvent: (id: string | null) => void;
  onDeleteEvent: (id: string) => void;
}) {
  const [swipedEventId, setSwipedEventId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent, eventId: string) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    setSwipedEventId(eventId);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (eventId: string) => {
    if (touchStartX.current === null || touchCurrentX.current === null) return;
    
    const deltaX = touchCurrentX.current - touchStartX.current;
    
    if (deltaX < -80) {
      setSwipedEventId(eventId);
    } else if (deltaX > 30) {
      setSwipedEventId(null);
    }
    
    touchStartX.current = null;
    touchCurrentX.current = null;
  };

  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-700" />
          <p className="text-slate-500">暂无赛事安排</p>
          <p className="text-slate-600 text-sm mt-1">点击右上角按钮创建新赛事</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-3">
      {events.map(event => {
        const venue = venues.find(v => v.id === event.venueId);
        const isExpanded = expandedEventId === event.id;
        const isSwiped = swipedEventId === event.id;
        const color = getEventTypeColor(event.type);

        return (
          <div key={event.id} className="relative overflow-hidden rounded-xl">
            {isSwiped && (
              <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center">
                <button
                  onClick={() => {
                    onDeleteEvent(event.id);
                    setSwipedEventId(null);
                  }}
                  className="w-full h-full flex items-center justify-center text-white"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}
            
            <div
              className={cn(
                'relative bg-slate-800/60 border border-slate-700/50 transition-all duration-300',
                isSwiped && 'transform -translate-x-20'
              )}
              onTouchStart={(e) => handleTouchStart(e, event.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => handleTouchEnd(event.id)}
            >
              <button
                onClick={() => {
                  setExpandedEventId(isExpanded ? null : event.id);
                  onSelectEvent(event.id);
                }}
                className="w-full p-4 text-left"
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-1.5 flex-shrink-0 self-stretch rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span 
                            className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                            style={{ backgroundColor: `${color}25`, color }}
                          >
                            {eventTypeNames[event.type]}
                          </span>
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
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
                        <h3 className="text-white font-medium truncate">{event.name}</h3>
                      </div>
                      <ChevronRight className={cn(
                        'w-5 h-5 text-slate-500 flex-shrink-0 transition-transform',
                        isExpanded && 'rotate-90'
                      )} />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-slate-300 truncate">
                          {formatDateTime(event.startDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-slate-300 truncate">
                          {venue?.name || '未指定场馆'}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-800/60 rounded-lg p-3">
                            <div className="text-xs text-slate-500 mb-1">预计时长</div>
                            <div className="text-sm text-white font-medium">
                              {calculateDuration(event.startDate, event.endDate)}
                            </div>
                          </div>
                          <div className="bg-slate-800/60 rounded-lg p-3">
                            <div className="text-xs text-slate-500 mb-1">预计营收</div>
                            <div className="text-sm text-green-400 font-medium">
                              {formatMoney(event.expectedRevenue)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-slate-800/60 rounded-lg p-3">
                          <div className="text-xs text-slate-500 mb-1">主办单位</div>
                          <div className="text-sm text-white">{event.organizer}</div>
                        </div>

                        {event.description && (
                          <div className="bg-slate-800/60 rounded-lg p-3">
                            <div className="text-xs text-slate-500 mb-1">赛事介绍</div>
                            <div className="text-sm text-slate-300 leading-relaxed">
                              {event.description}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600 transition-colors">
                            编辑
                          </button>
                          <button className="flex-1 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors border border-cyan-500/30">
                            查看详情
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
