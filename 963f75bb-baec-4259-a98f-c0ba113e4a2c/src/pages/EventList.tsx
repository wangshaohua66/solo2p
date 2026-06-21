import { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ChevronDown,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Clock3,
  MoreHorizontal,
  FileText,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { useEventStore } from '@/store/useEventStore';
import { useVenueStore } from '@/store/useVenueStore';
import { eventTypeNames, eventTypeColors, statusNames } from '@/mock';
import { cn, getEventTypeColor } from '@/utils/helpers';
import { formatDateTime, formatMoney, formatRelativeTime } from '@/utils/dateUtils';
import type { EventItem } from '@/types';

export default function EventList() {
  const { events, setWizardOpen, approveEvent, rejectEvent } = useEventStore();
  const { venues } = useVenueStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            event.organizer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
      const matchesType = typeFilter === 'all' || event.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [events, searchQuery, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    total: events.length,
    pending: events.filter(e => e.status === 'pending_approval').length,
    scheduled: events.filter(e => e.status === 'scheduled').length,
    completed: events.filter(e => e.status === 'completed').length,
  }), [events]);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">赛事管理</h1>
          <p className="text-slate-400 text-sm mt-1">
            共 {events.length} 场赛事 · {stats.pending} 场待审批
          </p>
        </div>

        <button
          onClick={() => setWizardOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          新建赛事
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '全部赛事', value: stats.total, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: '待审批', value: stats.pending, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: '已排期', value: stats.scheduled, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: '已完成', value: stats.completed, color: 'text-slate-400', bg: 'bg-slate-500/10' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} border border-slate-700/50 rounded-xl p-4`}>
            <p className="text-slate-400 text-sm">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color} mt-1`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="搜索赛事名称、主办方..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-72 pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">全部状态</option>
              {Object.entries(statusNames).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="all">全部类型</option>
            {Object.entries(eventTypeNames).map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors',
              viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            列表
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors',
              viewMode === 'kanban' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            看板
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
        {viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/60 border-b border-slate-700/50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    赛事名称
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    类型
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    场馆
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    时间
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    预计营收
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {filteredEvents.map((event) => {
                  const venue = venues.find(v => v.id === event.venueId);
                  const color = getEventTypeColor(event.type);
                  const pendingStep = event.approvalSteps.find(s => s.status === 'pending');

                  return (
                    <tr 
                      key={event.id} 
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${color}20` }}
                          >
                            <FileText className="w-5 h-5" style={{ color }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{event.name}</p>
                            <p className="text-xs text-slate-500">{event.organizer}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span 
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          {eventTypeNames[event.type]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {venue?.name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-300">
                          {formatDateTime(event.startDate)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatRelativeTime(event.startDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                          event.status === 'scheduled' && 'bg-cyan-500/20 text-cyan-400',
                          event.status === 'pending_approval' && 'bg-amber-500/20 text-amber-400',
                          event.status === 'approved' && 'bg-green-500/20 text-green-400',
                          event.status === 'rejected' && 'bg-red-500/20 text-red-400',
                          event.status === 'completed' && 'bg-slate-500/20 text-slate-400',
                          event.status === 'cancelled' && 'bg-red-500/20 text-red-400',
                          event.status === 'draft' && 'bg-slate-500/20 text-slate-400',
                        )}>
                          {event.status === 'pending_approval' && (
                            <Clock3 className="w-3 h-3 animate-pulse" />
                          )}
                          {event.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                          {event.status === 'rejected' && <XCircle className="w-3 h-3" />}
                          {statusNames[event.status]}
                        </span>
                        {pendingStep && event.status === 'pending_approval' && (
                          <p className="text-xs text-slate-500 mt-1">
                            等待{pendingStep.role === 'dispatcher' ? '调度员' : pendingStep.role === 'manager' ? '运营经理' : '财务'}审批
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-green-400">
                          {formatMoney(event.expectedRevenue)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowActions(showActions === event.id ? null : event.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
                          >
                            <MoreHorizontal className="w-5 h-5" />
                          </button>
                          {showActions === event.id && (
                            <div className="absolute right-0 top-full mt-1 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 py-1">
                              <button className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center gap-2">
                                <Eye className="w-4 h-4" /> 查看详情
                              </button>
                              {event.status === 'pending_approval' && (
                                <>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      approveEvent(event.id, 'dispatcher');
                                      setShowActions(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-slate-700/50 flex items-center gap-2"
                                  >
                                    <CheckCircle className="w-4 h-4" /> 通过审批
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      rejectEvent(event.id, 'dispatcher', '驳回');
                                      setShowActions(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-700/50 flex items-center gap-2"
                                  >
                                    <XCircle className="w-4 h-4" /> 驳回
                                  </button>
                                </>
                              )}
                              <button className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center gap-2">
                                <Edit className="w-4 h-4" /> 编辑
                              </button>
                              <div className="border-t border-slate-700 my-1" />
                              <button className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-700/50 flex items-center gap-2">
                                <Trash2 className="w-4 h-4" /> 删除
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-4 gap-4">
            {['pending_approval', 'approved', 'scheduled', 'completed'].map(status => {
              const columnEvents = filteredEvents.filter(e => e.status === status);
              return (
                <div key={status} className="flex flex-col">
                  <div className="flex items-center justify-between px-3 py-2 mb-3">
                    <h3 className="text-sm font-semibold text-slate-300">
                      {statusNames[status as keyof typeof statusNames]}
                    </h3>
                    <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">
                      {columnEvents.length}
                    </span>
                  </div>
                  <div className="space-y-2 flex-1">
                    {columnEvents.map(event => {
                      const color = getEventTypeColor(event.type);
                      return (
                        <div
                          key={event.id}
                          className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 cursor-pointer hover:border-slate-600 transition-colors"
                          onClick={() => setSelectedEvent(event)}
                        >
                          <div className="flex items-start gap-2">
                            <div 
                              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate">{event.name}</p>
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDateTime(event.startDate)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
