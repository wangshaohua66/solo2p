import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Card, Tag, Tooltip, Button, Space, Popover, DatePicker } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Schedule, Venue } from '../../types';
import { formatDate, getDaysDiff, isDateOverlap } from '../../utils/dateUtils';

const { RangePicker } = DatePicker;

interface ScheduleGanttProps {
  schedules: Schedule[];
  venues: Venue[];
  loading?: boolean;
  onScheduleClick?: (schedule: Schedule) => void;
  onScheduleDragEnd?: (schedule: Schedule, newStart: string, newEnd: string) => void;
  onConflictDetected?: (conflicts: Schedule[]) => void;
}

const statusColors: Record<string, string> = {
  pending: 'gold',
  approved: 'blue',
  locked: 'purple',
  ongoing: 'green',
  completed: 'gray',
  cancelled: 'red',
  rejected: 'red',
};

const statusLabels: Record<string, string> = {
  pending: '待审批',
  approved: '已批准',
  locked: '已锁定',
  ongoing: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  rejected: '已拒绝',
};

const GanttBar: React.FC<{
  schedule: Schedule;
  left: number;
  width: number;
  rowIndex: number;
  rowHeight: number;
  hasConflict: boolean;
  onClick: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}> = ({ schedule, left, width, rowIndex, rowHeight, hasConflict, onClick, onDragStart }) => {
  const color = statusColors[schedule.status] || 'default';
  const barHeight = rowHeight - 12;
  const top = rowIndex * rowHeight + 6;

  return (
    <div
      className={`absolute rounded-lg cursor-pointer transition-all duration-150 hover:shadow-lg hover:z-10 ${
        hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''
      }`}
      style={{
        left: `${left}%`,
        top: `${top}px`,
        width: `${width}%`,
        height: `${barHeight}px`,
        background: hasConflict 
          ? 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)'
          : `linear-gradient(135deg, var(--ant-${color}-5) 0%, var(--ant-${color}-4) 100%)`,
        borderLeft: `4px solid var(--ant-${color}-6)`,
        minWidth: '40px',
      }}
      onClick={onClick}
      onMouseDown={onDragStart}
    >
      <div className="px-3 py-1 h-full flex flex-col justify-center overflow-hidden">
        <div className="text-xs font-medium text-white truncate drop-shadow">
          {schedule.exhibitionName}
        </div>
        <div className="text-[10px] text-white/80 truncate">
          {formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}
        </div>
      </div>
      {hasConflict && (
        <div className="absolute -top-1 -right-1">
          <Tooltip title="档期冲突">
            <Tag color="red" className="m-0 px-1 py-0 text-[10px] h-4 leading-3">
              <InfoCircleOutlined /> 冲突
            </Tag>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

const ScheduleGantt: React.FC<ScheduleGanttProps> = ({
  schedules,
  venues,
  loading,
  onScheduleClick,
  onScheduleDragEnd,
  onConflictDetected,
}) => {
  const [zoom, setZoom] = useState(1);
  const [viewRange, setViewRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('year'),
    dayjs().endOf('year').add(3, 'month'),
  ]);
  const [dragging, setDragging] = useState<{
    schedule: Schedule;
    startX: number;
    originalStart: string;
    originalEnd: string;
    currentOffset: number;
  } | null>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  const totalDays = useMemo(
    () => getDaysDiff(viewRange[0].format('YYYY-MM-DD'), viewRange[1].format('YYYY-MM-DD')) + 1,
    [viewRange]
  );

  const months = useMemo(() => {
    const result: { label: string; start: number; width: number }[] = [];
    let current = viewRange[0].startOf('month');
    const end = viewRange[1];
    
    while (current.isBefore(end) || current.isSame(end, 'month')) {
      const monthStart = current.isBefore(viewRange[0]) ? viewRange[0] : current;
      const monthEnd = current.endOf('month').isAfter(end) ? end : current.endOf('month');
      const days = getDaysDiff(monthStart.format('YYYY-MM-DD'), monthEnd.format('YYYY-MM-DD')) + 1;
      const startPercent = getDaysDiff(viewRange[0].format('YYYY-MM-DD'), monthStart.format('YYYY-MM-DD')) / totalDays * 100;
      const widthPercent = days / totalDays * 100;
      
      result.push({
        label: current.format('YYYY年M月'),
        start: startPercent,
        width: widthPercent,
      });
      
      current = current.add(1, 'month');
    }
    return result;
  }, [viewRange, totalDays]);

  const conflicts = useMemo(() => {
    const conflictMap: Record<string, string[]> = {};
    
    schedules.forEach((s1, i) => {
      schedules.forEach((s2, j) => {
        if (i >= j) return;
        const hasOverlapVenue = s1.venueIds.some(v => s2.venueIds.includes(v));
        if (hasOverlapVenue && isDateOverlap(s1.startDate, s1.endDate, s2.startDate, s2.endDate)) {
          if (!conflictMap[s1.id]) conflictMap[s1.id] = [];
          if (!conflictMap[s2.id]) conflictMap[s2.id] = [];
          if (!conflictMap[s1.id].includes(s2.id)) conflictMap[s1.id].push(s2.id);
          if (!conflictMap[s2.id].includes(s1.id)) conflictMap[s2.id].push(s1.id);
        }
      });
    });
    
    const allConflicts = Object.values(conflictMap).flat();
    if (allConflicts.length > 0 && onConflictDetected) {
      onConflictDetected(schedules.filter(s => allConflicts.includes(s.id)));
    }
    
    return conflictMap;
  }, [schedules, onConflictDetected]);

  const getBarPosition = useCallback((schedule: Schedule) => {
    const startDiff = getDaysDiff(viewRange[0].format('YYYY-MM-DD'), schedule.startDate);
    const duration = getDaysDiff(schedule.startDate, schedule.endDate) + 1;
    const left = Math.max(0, startDiff / totalDays * 100);
    const width = Math.min(100 - left, duration / totalDays * 100);
    return { left, width };
  }, [viewRange, totalDays]);

  const handleDragStart = useCallback((e: React.MouseEvent, schedule: Schedule) => {
    e.stopPropagation();
    if (schedule.status === 'locked' || schedule.status === 'completed') return;
    
    setDragging({
      schedule,
      startX: e.clientX,
      originalStart: schedule.startDate,
      originalEnd: schedule.endDate,
      currentOffset: 0,
    });
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const ganttWidth = ganttRef.current?.clientWidth || 1000;
      const offsetX = e.clientX - dragging.startX;
      const dayOffset = Math.round((offsetX / ganttWidth) * totalDays * zoom);
      
      setDragging(prev => prev ? { ...prev, currentOffset: dayOffset } : null);
    };

    const handleMouseUp = () => {
      if (dragging && dragging.currentOffset !== 0) {
        const newStart = dayjs(dragging.originalStart).add(dragging.currentOffset, 'day').format('YYYY-MM-DD');
        const newEnd = dayjs(dragging.originalEnd).add(dragging.currentOffset, 'day').format('YYYY-MM-DD');
        onScheduleDragEnd?.(dragging.schedule, newStart, newEnd);
      }
      setDragging(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, totalDays, zoom, onScheduleDragEnd]);

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 5));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setViewRange([dayjs().startOf('year'), dayjs().endOf('year').add(3, 'month')]);
  };

  const rowHeight = 50;
  const sortedVenues = venues.filter(v => v.type === 'exhibition_hall' || v.type === 'multi_function');

  const renderScheduleDetail = (schedule: Schedule) => (
    <div className="w-72 p-2">
      <div className="font-medium text-base mb-2">{schedule.exhibitionName}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">主办方：</span>
          <span>{schedule.organizerName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">展览日期：</span>
          <span>{formatDate(schedule.startDate)} ~ {formatDate(schedule.endDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">布展日期：</span>
          <span>{formatDate(schedule.setupStartDate)} ~ {formatDate(schedule.teardownEndDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">使用展厅：</span>
          <span>{schedule.venues?.map(v => v.name).join('、')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">预计观众：</span>
          <span>{schedule.expectedVisitors?.toLocaleString()} 人</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">状态：</span>
          <Tag color={statusColors[schedule.status]}>{statusLabels[schedule.status]}</Tag>
        </div>
      </div>
    </div>
  );

  return (
    <Card
      loading={loading}
      className="shadow-sm"
      title={
        <div className="flex items-center justify-between w-full">
          <span className="font-semibold">档期甘特图</span>
          <Space>
            <RangePicker
              value={viewRange}
              onChange={(dates) => dates && setViewRange([dates[0], dates[1]])}
              size="small"
            />
            <Button.Group size="small">
              <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
              <Button onClick={handleReset}>
                {Math.round(zoom * 100)}%
              </Button>
              <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
              <Button icon={<ReloadOutlined />} onClick={handleReset} />
            </Button.Group>
          </Space>
        </div>
      }
    >
      <div className="flex">
        <div 
          className="flex-shrink-0 border-r border-gray-200 bg-gray-50"
          style={{ width: '120px' }}
        >
          <div className="h-10 border-b border-gray-200 flex items-center px-3 font-medium text-sm text-gray-600">
            展厅
          </div>
          {sortedVenues.map((venue, index) => (
            <div
              key={venue.id}
              className={`flex items-center px-3 text-sm border-b border-gray-100 ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
              }`}
              style={{ height: `${rowHeight}px` }}
            >
              <Tooltip title={venue.name}>
                <span className="truncate w-full">{venue.name}</span>
              </Tooltip>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto" ref={ganttRef}>
          <div style={{ width: `${100 * zoom}%`, minWidth: '100%' }}>
            <div className="h-10 border-b border-gray-200 bg-gray-50 sticky top-0 z-20">
              <div className="relative h-full">
                {months.map((month, i) => (
                  <div
                    key={i}
                    className="absolute h-full flex items-center justify-center text-sm font-medium text-gray-600 border-r border-gray-200 last:border-r-0"
                    style={{
                      left: `${month.start}%`,
                      width: `${month.width}%`,
                    }}
                  >
                    {month.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              {sortedVenues.map((venue, index) => (
                <div
                  key={venue.id}
                  className={`relative border-b border-gray-100 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                  }`}
                  style={{ height: `${rowHeight}px` }}
                >
                  <div className="absolute inset-0 flex">
                    {months.map((month, i) => (
                      <div
                        key={i}
                        className="h-full border-r border-gray-100 last:border-r-0"
                        style={{
                          width: `${month.width}%`,
                        }}
                      />
                    ))}
                  </div>
                  
                  {schedules
                    .filter(s => s.venueIds.includes(venue.id))
                    .map(schedule => {
                      const { left, width } = getBarPosition(schedule);
                      if (width <= 0) return null;
                      
                      return (
                        <GanttBar
                          key={`${venue.id}-${schedule.id}`}
                          schedule={schedule}
                          left={left}
                          width={width}
                          rowIndex={index}
                          rowHeight={rowHeight}
                          hasConflict={!!conflicts[schedule.id]}
                          onClick={() => onScheduleClick?.(schedule)}
                          onDragStart={(e) => handleDragStart(e, schedule)}
                        />
                      );
                    })}

                  {dragging && dragging.schedule.venueIds.includes(venue.id) && (
                    <GanttBar
                      schedule={{
                        ...dragging.schedule,
                        startDate: dayjs(dragging.originalStart).add(dragging.currentOffset, 'day').format('YYYY-MM-DD'),
                        endDate: dayjs(dragging.originalEnd).add(dragging.currentOffset, 'day').format('YYYY-MM-DD'),
                      }}
                      left={getBarPosition({
                        ...dragging.schedule,
                        startDate: dayjs(dragging.originalStart).add(dragging.currentOffset, 'day').format('YYYY-MM-DD'),
                      }).left}
                      width={getBarPosition(dragging.schedule).width}
                      rowIndex={index}
                      rowHeight={rowHeight}
                      hasConflict={false}
                      onClick={() => {}}
                      onDragStart={() => {}}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-6 text-sm">
        <span className="text-gray-500">图例：</span>
        {Object.entries(statusLabels).map(([status, label]) => (
          <div key={status} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: `var(--ant-${statusColors[status]}-5)` }}
            />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-4">
          <div className="w-3 h-3 rounded bg-red-200 ring-2 ring-red-500 ring-offset-1" />
          <span className="text-gray-600">档期冲突</span>
        </div>
      </div>
    </Card>
  );
};

export default ScheduleGantt;
