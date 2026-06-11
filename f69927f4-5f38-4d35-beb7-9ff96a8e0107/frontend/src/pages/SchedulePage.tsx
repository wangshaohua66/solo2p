import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Button, DatePicker, Select, Modal, Drawer, Form, Input, Tag,
  Segmented, message, Tooltip,
} from 'antd';
import {
  Plus, ChevronLeft, ChevronRight, AlertTriangle, X, Shield,
} from 'lucide-react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { Schedule, ScheduleStatus } from '@/types';
import { mockKilns, mockCurves, mockMembers } from '@/mocks';
import { useScheduleStore } from '@/stores/useScheduleStore';
import { useAuthStore } from '@/stores/useAuthStore';
import StatusBadge from '@/components/StatusBadge';
import KilnTypeTag from '@/components/KilnTypeTag';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#8C8C8C',
  FIRING: '#E8602C',
  COOLING: '#3B6FA0',
  COMPLETED: '#52C41A',
  CANCELLED: '#D9D9D9',
  CONFLICT: '#FF4D4F',
};

const KILN_ROW_HEIGHT = 72;
const LEFT_COL_WIDTH = 140;
const HOURS = Array.from({ length: 25 }, (_, i) => i);

function getConflictingIds(schedules: Schedule[]): Set<number> {
  const ids = new Set<number>();
  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      if (schedules[i].kilnId === schedules[j].kilnId) {
        const aStart = dayjs(schedules[i].startTime);
        const aEnd = dayjs(schedules[i].endTime);
        const bStart = dayjs(schedules[j].startTime);
        const bEnd = dayjs(schedules[j].endTime);
        if (aStart.isBefore(bEnd) && bStart.isBefore(aEnd)) {
          ids.add(schedules[i].id);
          ids.add(schedules[j].id);
        }
      }
    }
  }
  return ids;
}

function getScheduleHours(schedule: Schedule, date: Dayjs) {
  const start = dayjs(schedule.startTime);
  const end = dayjs(schedule.endTime);
  const dayStart = date.startOf('day');
  let startHour = start.diff(dayStart, 'minute') / 60;
  let endHour = end.diff(dayStart, 'minute') / 60;
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, endHour);
  return { startHour, endHour };
}

function findConflicts(kilnId: number, startTime: string, endTime: string, schedules: Schedule[], excludeId?: number) {
  const s = dayjs(startTime);
  const e = dayjs(endTime);
  return schedules.filter(
    (sch) =>
      sch.kilnId === kilnId &&
      sch.status !== 'CANCELLED' &&
      sch.id !== excludeId &&
      dayjs(sch.startTime).isBefore(e) &&
      dayjs(sch.endTime).isAfter(s),
  );
}

function getDropPosition(clientX: number, kilnRowElement: HTMLElement): number {
  const rect = kilnRowElement.getBoundingClientRect();
  const offsetX = clientX - rect.left;
  const percentage = offsetX / rect.width;
  const hour = percentage * 24;
  return Math.max(0, Math.min(24, hour));
}

function calculateNewTimes(schedule: Schedule, newStartHour: number, date: Dayjs) {
  const duration = dayjs(schedule.endTime).diff(dayjs(schedule.startTime), 'minute');
  const dayStart = date.startOf('day');
  const newStart = dayStart.add(newStartHour, 'hour');
  const newEnd = newStart.add(duration, 'minute');
  return {
    startTime: newStart.toISOString(),
    endTime: newEnd.toISOString(),
  };
}

export default function SchedulePage() {
  const { schedules, fetchSchedules, createSchedule, updateSchedule } = useScheduleStore();
  const user = useAuthStore((s) => s.user);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [formConflicts, setFormConflicts] = useState<Schedule[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [draggingScheduleId, setDraggingScheduleId] = useState<number | null>(null);
  const [dropPreview, setDropPreview] = useState<{ kilnId: number; startHour: number; endHour: number } | null>(null);
  const [dropTargetKilnId, setDropTargetKilnId] = useState<number | null>(null);
  const [conflictFlashId, setConflictFlashId] = useState<number | null>(null);
  const [successFlashId, setSuccessFlashId] = useState<number | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const daySchedules = useMemo(
    () =>
      schedules.filter((s) => {
        const start = dayjs(s.startTime);
        return start.isSame(selectedDate, 'day') || dayjs(s.endTime).isSame(selectedDate, 'day');
      }),
    [schedules, selectedDate],
  );

  const conflictingIds = useMemo(() => getConflictingIds(daySchedules), [daySchedules]);

  const getDisplayStatus = useCallback(
    (schedule: Schedule): ScheduleStatus | 'CONFLICT' => {
      if (conflictingIds.has(schedule.id) && schedule.status !== 'CANCELLED' && schedule.status !== 'COMPLETED') {
        return 'CONFLICT';
      }
      return schedule.status;
    },
    [conflictingIds],
  );

  const handleDateChange = (dir: number) => {
    setSelectedDate((d) => d.add(dir, viewMode === 'week' ? 'week' : 'day'));
  };

  const handleFormChange = () => {
    const kilnId = form.getFieldValue('kilnId');
    const timeRange = form.getFieldValue('timeRange') as [Dayjs, Dayjs] | undefined;
    if (kilnId && timeRange?.[0] && timeRange?.[1]) {
      const conflicts = findConflicts(
        kilnId,
        timeRange[0].toISOString(),
        timeRange[1].toISOString(),
        schedules,
      );
      setFormConflicts(conflicts);
    } else {
      setFormConflicts([]);
    }
  };

  const handleCreate = async (values: {
    kilnId: number;
    memberId: number;
    curveId: number;
    timeRange: [Dayjs, Dayjs];
    workpieceCount: number;
    note?: string;
  }) => {
    const kiln = mockKilns.find((k) => k.id === values.kilnId);
    const member = mockMembers.find((m) => m.id === values.memberId);
    const curve = mockCurves.find((c) => c.id === values.curveId);
    try {
      await createSchedule({
        kilnId: values.kilnId,
        kilnName: kiln?.name ?? '',
        memberId: values.memberId,
        memberName: member?.realName ?? '',
        curveId: values.curveId,
        curveName: curve?.name ?? '',
        startTime: values.timeRange[0].toISOString(),
        endTime: values.timeRange[1].toISOString(),
        workpieceCount: values.workpieceCount,
        note: values.note,
      });
      message.success('预约创建成功');
      setModalVisible(false);
      form.resetFields();
      setFormConflicts([]);
      fetchSchedules();
    } catch {
      message.error('创建失败');
    }
  };

  const handleCancelSchedule = async (schedule: Schedule) => {
    try {
      await updateSchedule(schedule.id, { status: 'CANCELLED' });
      message.success('预约已取消');
      setDrawerVisible(false);
      fetchSchedules();
    } catch {
      message.error('取消失败');
    }
  };

  const handleForceOverride = async (schedule: Schedule) => {
    try {
      await updateSchedule(schedule.id, { status: 'CANCELLED', note: '管理员强制覆盖' });
      message.success('已强制覆盖');
      setDrawerVisible(false);
      fetchSchedules();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, schedule: Schedule) => {
    e.dataTransfer.setData('scheduleId', String(schedule.id));
    e.dataTransfer.setData('originalKilnId', String(schedule.kilnId));
    const { startHour } = getScheduleHours(schedule, selectedDate);
    e.dataTransfer.setData('originalStartHour', String(startHour));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingScheduleId(schedule.id);
  };

  const handleDragEnd = () => {
    setDraggingScheduleId(null);
    setDropPreview(null);
    setDropTargetKilnId(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, kilnId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetKilnId(kilnId);

    if (!draggingScheduleId) return;
    const schedule = schedules.find((s) => s.id === draggingScheduleId);
    if (!schedule) return;

    const startHour = getDropPosition(e.clientX, e.currentTarget);
    const duration = dayjs(schedule.endTime).diff(dayjs(schedule.startTime), 'minute') / 60;
    let endHour = startHour + duration;

    if (endHour > 24) {
      endHour = 24;
    }
    if (startHour < 0) {
      return;
    }

    setDropPreview({ kilnId, startHour, endHour });
  };

  const handleDragLeave = (kilnId: number) => {
    if (dropTargetKilnId === kilnId) {
      setDropTargetKilnId(null);
      setDropPreview(null);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, kilnId: number) => {
    e.preventDefault();
    const scheduleId = Number(e.dataTransfer.getData('scheduleId'));
    const schedule = schedules.find((s) => s.id === scheduleId);

    setDropTargetKilnId(null);
    setDropPreview(null);
    setDraggingScheduleId(null);

    if (!schedule || schedule.status !== 'PENDING') {
      return;
    }

    const startHour = getDropPosition(e.clientX, e.currentTarget);
    const { startTime, endTime } = calculateNewTimes(schedule, startHour, selectedDate);

    const endHour = startHour + dayjs(schedule.endTime).diff(dayjs(schedule.startTime), 'minute') / 60;
    if (endHour > 24 || startHour < 0) {
      message.error('时间超出当日范围');
      return;
    }

    const conflicts = findConflicts(kilnId, startTime, endTime, schedules, schedule.id);
    if (conflicts.length > 0) {
      setConflictFlashId(kilnId);
      setTimeout(() => setConflictFlashId(null), 600);
      message.error('与现有排程冲突，无法放置');
      return;
    }

    try {
      const kiln = mockKilns.find((k) => k.id === kilnId);
      await updateSchedule(schedule.id, {
        kilnId,
        kilnName: kiln?.name ?? schedule.kilnName,
        startTime,
        endTime,
      });
      setSuccessFlashId(kilnId);
      setTimeout(() => setSuccessFlashId(null), 600);
      message.success('排程已更新');
      fetchSchedules();
    } catch {
      message.error('更新失败');
    }
  };

  const weekDates = useMemo(() => {
    const start = selectedDate.startOf('week');
    return Array.from({ length: 7 }, (_, i) => start.add(i, 'day'));
  }, [selectedDate]);

  const renderBlock = (schedule: Schedule) => {
    const displayStatus = getDisplayStatus(schedule);
    const { startHour, endHour } = getScheduleHours(schedule, selectedDate);
    const left = (startHour / 24) * 100;
    const width = ((endHour - startHour) / 24) * 100;
    const isConflict = displayStatus === 'CONFLICT';
    const isDragging = draggingScheduleId === schedule.id;
    const canDrag = schedule.status === 'PENDING';

    return (
      <Tooltip
        key={schedule.id}
        title={`${schedule.memberName} | ${schedule.curveName} | ${schedule.workpieceCount}件`}
      >
        <div
          draggable={canDrag}
          onDragStart={(e) => canDrag && handleDragStart(e, schedule)}
          onDragEnd={handleDragEnd}
          onClick={() => {
            if (isDragging) return;
            setSelectedSchedule(schedule);
            setDrawerVisible(true);
          }}
          className={isConflict ? 'schedule-block-conflict' : undefined}
          style={{
            position: 'absolute',
            left: `${left}%`,
            width: `${Math.max(width, 1)}%`,
            top: 4,
            height: KILN_ROW_HEIGHT - 8,
            background: STATUS_COLORS[displayStatus],
            borderRadius: 6,
            padding: '2px 6px',
            color: '#fff',
            fontSize: 12,
            cursor: canDrag ? 'move' : 'pointer',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            lineHeight: 1.3,
            zIndex: isDragging ? 10 : 1,
            opacity: isDragging ? 0.5 : 1,
            transition: 'opacity 0.15s',
            userSelect: 'none',
          }}
        >
          <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {schedule.memberName}
          </span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.9 }}>
            {schedule.curveName}
          </span>
          <span style={{ opacity: 0.8 }}>{schedule.workpieceCount}件</span>
        </div>
      </Tooltip>
    );
  };

  const renderGantt = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', paddingLeft: LEFT_COL_WIDTH, position: 'relative', height: 32, borderBottom: '1px solid #E8E8E8' }}>
        {HOURS.filter((h) => h % 2 === 0).map((h) => (
          <div
            key={h}
            style={{
              position: 'absolute',
              left: `${(h / 24) * 100}%`,
              transform: 'translateX(-50%)',
              fontSize: 12,
              color: '#8C8C8C',
              textAlign: 'center',
            }}
          >
            {String(h).padStart(2, '0')}:00
          </div>
        ))}
      </div>

      {mockKilns.map((kiln) => {
        const isDropTarget = dropTargetKilnId === kiln.id;
        const hasConflictFlash = conflictFlashId === kiln.id;
        const hasSuccessFlash = successFlashId === kiln.id;
        const showPreview = dropPreview && dropPreview.kilnId === kiln.id;
        const draggedSchedule = draggingScheduleId
          ? schedules.find((s) => s.id === draggingScheduleId)
          : null;

        return (
          <div key={kiln.id} style={{ display: 'flex', borderBottom: '1px solid #F0F0F0' }}>
            <div
              style={{
                width: LEFT_COL_WIDTH,
                minWidth: LEFT_COL_WIDTH,
                height: KILN_ROW_HEIGHT,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '0 12px',
                borderRight: '1px solid #E8E8E8',
                background: '#FAFAFA',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14, color: '#2D2D2D' }}>{kiln.name}</span>
              <KilnTypeTag type={kiln.type} />
            </div>
            <div
              onDragOver={(e) => handleDragOver(e, kiln.id)}
              onDragLeave={() => handleDragLeave(kiln.id)}
              onDrop={(e) => handleDrop(e, kiln.id)}
              style={{
                flex: 1,
                height: KILN_ROW_HEIGHT,
                position: 'relative',
                background: isDropTarget ? '#E6F7FF' : 'transparent',
                border: isDropTarget ? '2px dashed #1890FF' : '2px solid transparent',
                boxSizing: 'border-box',
                transition: 'background 0.15s, border-color 0.15s',
                animation: hasConflictFlash
                  ? 'conflict-flash 0.6s ease-in-out'
                  : hasSuccessFlash
                  ? 'success-flash 0.6s ease-in-out'
                  : undefined,
              }}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  style={{
                    position: 'absolute',
                    left: `${(h / 24) * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: h % 6 === 0 ? '#D9D9D9' : '#F0F0F0',
                  }}
                />
              ))}
              {showPreview && draggedSchedule && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${(dropPreview.startHour / 24) * 100}%`,
                    width: `${Math.max(((dropPreview.endHour - dropPreview.startHour) / 24) * 100, 1)}%`,
                    top: 4,
                    height: KILN_ROW_HEIGHT - 8,
                    background: STATUS_COLORS[draggedSchedule.status],
                    borderRadius: 6,
                    padding: '2px 6px',
                    color: '#fff',
                    fontSize: 12,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    lineHeight: 1.3,
                    opacity: 0.4,
                    pointerEvents: 'none',
                    zIndex: 5,
                    border: '2px dashed rgba(255,255,255,0.6)',
                  }}
                >
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {draggedSchedule.memberName}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.9 }}>
                    {draggedSchedule.curveName}
                  </span>
                  <span style={{ opacity: 0.8 }}>{draggedSchedule.workpieceCount}件</span>
                </div>
              )}
              {daySchedules
                .filter((s) => s.kilnId === kiln.id)
                .map(renderBlock)}
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes conflict-flash {
          0%, 100% { background-color: transparent; }
          25%, 75% { background-color: #FFF2F0; }
          50% { background-color: #FFCCC7; }
        }
        @keyframes success-flash {
          0%, 100% { background-color: transparent; }
          50% { background-color: #D9F7BE; }
        }
      `}</style>
    </div>
  );

  const renderWeekView = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{ width: LEFT_COL_WIDTH, border: '1px solid #E8E8E8', padding: 8, background: '#FAFAFA', textAlign: 'left' }}>
              窑炉
            </th>
            {weekDates.map((d) => (
              <th
                key={d.format('YYYY-MM-DD')}
                style={{
                  border: '1px solid #E8E8E8',
                  padding: 8,
                  background: d.isSame(dayjs(), 'day') ? '#FFF7E6' : '#FAFAFA',
                  textAlign: 'center',
                  fontSize: 13,
                }}
              >
                <div>{d.format('MM/DD')}</div>
                <div style={{ color: '#8C8C8C', fontSize: 12 }}>{d.format('ddd')}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mockKilns.map((kiln) => (
            <tr key={kiln.id}>
              <td style={{ border: '1px solid #E8E8E8', padding: 8, background: '#FAFAFA' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{kiln.name}</div>
                <KilnTypeTag type={kiln.type} />
              </td>
              {weekDates.map((d) => {
                const daySch = schedules.filter(
                  (s) =>
                    s.kilnId === kiln.id &&
                    (dayjs(s.startTime).isSame(d, 'day') || dayjs(s.endTime).isSame(d, 'day')),
                );
                return (
                  <td
                    key={d.format('YYYY-MM-DD')}
                    style={{
                      border: '1px solid #E8E8E8',
                      padding: 4,
                      verticalAlign: 'top',
                      minHeight: 60,
                      background: d.isSame(dayjs(), 'day') ? '#FFF7E6' : '#fff',
                    }}
                  >
                    {daySch.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedSchedule(s);
                          setDrawerVisible(true);
                        }}
                        style={{
                          background: STATUS_COLORS[s.status],
                          color: '#fff',
                          borderRadius: 4,
                          padding: '2px 6px',
                          fontSize: 11,
                          marginBottom: 2,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {s.memberName}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderListView = () => (
    <div style={{ padding: 16 }}>
      {mockKilns.map((kiln) => {
        const kilnSchedules = daySchedules.filter((s) => s.kilnId === kiln.id);
        return (
          <div key={kiln.id} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{kiln.name}</span>
              <KilnTypeTag type={kiln.type} />
            </div>
            {kilnSchedules.length === 0 ? (
              <div style={{ color: '#8C8C8C', padding: '12px 0' }}>暂无排程</div>
            ) : (
              kilnSchedules.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedSchedule(s);
                    setDrawerVisible(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px',
                    marginBottom: 8,
                    background: '#fff',
                    borderRadius: 8,
                    border: '1px solid #F0F0F0',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 4,
                      height: 36,
                      borderRadius: 2,
                      background: STATUS_COLORS[getDisplayStatus(s)],
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.memberName}</div>
                    <div style={{ color: '#8C8C8C', fontSize: 12 }}>{s.curveName} · {s.workpieceCount}件</div>
                  </div>
                  <StatusBadge status={s.status} />
                  <div style={{ color: '#8C8C8C', fontSize: 12 }}>
                    {dayjs(s.startTime).format('HH:mm')} - {dayjs(s.endTime).format('HH:mm')}
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );

  const curveDetail = selectedSchedule
    ? mockCurves.find((c) => c.id === selectedSchedule.curveId)
    : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F5F2' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: '#fff',
          borderBottom: '1px solid #E8E8E8',
          flexShrink: 0,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button icon={<ChevronLeft size={16} />} onClick={() => handleDateChange(-1)} />
          <DatePicker
            value={selectedDate}
            onChange={(d) => d && setSelectedDate(d)}
            allowClear={false}
          />
          <Button icon={<ChevronRight size={16} />} onClick={() => handleDateChange(1)} />
          <Button size="small" onClick={() => setSelectedDate(dayjs())}>
            今天
          </Button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as 'day' | 'week')}
            options={[
              { label: '日视图', value: 'day' },
              { label: '周视图', value: 'week' },
            ]}
          />
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => setModalVisible(true)}
            style={{ background: '#E8602C', borderColor: '#E8602C' }}
          >
            新建预约
          </Button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          {isMobile
            ? renderListView()
            : viewMode === 'day'
              ? renderGantt()
              : renderWeekView()}
        </div>
      </div>

      <Modal
        title="新建预约"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setFormConflicts([]);
        }}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          onValuesChange={handleFormChange}
        >
          <Form.Item name="kilnId" label="窑炉" rules={[{ required: true, message: '请选择窑炉' }]}>
            <Select placeholder="选择窑炉">
              {mockKilns.map((k) => (
                <Select.Option key={k.id} value={k.id}>
                  {k.name} ({k.type})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="memberId" label="成员" rules={[{ required: true, message: '请选择成员' }]}>
            <Select placeholder="选择成员" showSearch optionFilterProp="children">
              {mockMembers.map((m) => (
                <Select.Option key={m.id} value={m.id}>
                  {m.realName} ({m.role})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="curveId" label="曲线模板" rules={[{ required: true, message: '请选择曲线模板' }]}>
            <Select placeholder="选择曲线模板">
              {mockCurves
                .filter((c) => c.isTemplate)
                .map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.name}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item name="timeRange" label="起止时间" rules={[{ required: true, message: '请选择起止时间' }]}>
            <DatePicker.RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>

          {formConflicts.length > 0 && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                background: '#FFF2F0',
                border: '1px solid #FFCCC7',
                borderRadius: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#FF4D4F', fontWeight: 600, marginBottom: 4 }}>
                <AlertTriangle size={14} />
                检测到时间冲突
              </div>
              {formConflicts.map((c) => (
                <div key={c.id} style={{ fontSize: 12, color: '#595959' }}>
                  {c.memberName} - {c.curveName} ({dayjs(c.startTime).format('HH:mm')}~{dayjs(c.endTime).format('HH:mm')})
                </div>
              ))}
            </div>
          )}

          <Form.Item name="workpieceCount" label="作品数量" rules={[{ required: true, message: '请输入作品数量' }]}>
            <Input type="number" min={1} placeholder="作品数量" />
          </Form.Item>

          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} placeholder="备注信息" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => { setModalVisible(false); form.resetFields(); setFormConflicts([]); }} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" style={{ background: '#E8602C', borderColor: '#E8602C' }}>
              提交
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="预约详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={420}
      >
        {selectedSchedule && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{selectedSchedule.kilnName}</span>
              <StatusBadge status={selectedSchedule.status} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ color: '#8C8C8C', fontSize: 12, marginBottom: 4 }}>成员</div>
                <div style={{ fontWeight: 500 }}>{selectedSchedule.memberName}</div>
              </div>
              <div>
                <div style={{ color: '#8C8C8C', fontSize: 12, marginBottom: 4 }}>曲线</div>
                <div style={{ fontWeight: 500 }}>{selectedSchedule.curveName}</div>
              </div>
              <div>
                <div style={{ color: '#8C8C8C', fontSize: 12, marginBottom: 4 }}>开始时间</div>
                <div style={{ fontWeight: 500 }}>{dayjs(selectedSchedule.startTime).format('YYYY-MM-DD HH:mm')}</div>
              </div>
              <div>
                <div style={{ color: '#8C8C8C', fontSize: 12, marginBottom: 4 }}>结束时间</div>
                <div style={{ fontWeight: 500 }}>{dayjs(selectedSchedule.endTime).format('YYYY-MM-DD HH:mm')}</div>
              </div>
              <div>
                <div style={{ color: '#8C8C8C', fontSize: 12, marginBottom: 4 }}>作品数量</div>
                <div style={{ fontWeight: 500 }}>{selectedSchedule.workpieceCount} 件</div>
              </div>
              {selectedSchedule.coolDownRemaining != null && (
                <div>
                  <div style={{ color: '#8C8C8C', fontSize: 12, marginBottom: 4 }}>冷却剩余</div>
                  <div style={{ fontWeight: 500 }}>{selectedSchedule.coolDownRemaining} 分钟</div>
                </div>
              )}
            </div>

            {selectedSchedule.note && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: '#8C8C8C', fontSize: 12, marginBottom: 4 }}>备注</div>
                <div style={{ background: '#FAFAFA', padding: 12, borderRadius: 6, fontSize: 14 }}>
                  {selectedSchedule.note}
                </div>
              </div>
            )}

            {curveDetail && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: '#8C8C8C', fontSize: 12, marginBottom: 8 }}>曲线详情</div>
                <div style={{ background: '#FAFAFA', borderRadius: 6, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F0F0F0' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>阶段</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>目标温度</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>时长(分钟)</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>最大斜率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {curveDetail.segments.map((seg, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F0F0F0' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <Tag color={seg.phase === 'HEAT_UP' ? 'red' : seg.phase === 'HOLD' ? 'orange' : 'blue'}>
                              {seg.phase === 'HEAT_UP' ? '升温' : seg.phase === 'HOLD' ? '保温' : '降温'}
                            </Tag>
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{seg.targetTemp}°C</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{seg.duration}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{seg.maxSlope}°C/min</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              {user?.role === 'ADMIN' && selectedSchedule.status !== 'CANCELLED' && selectedSchedule.status !== 'COMPLETED' && (
                <Button
                  danger
                  icon={<Shield size={14} />}
                  onClick={() => handleForceOverride(selectedSchedule)}
                >
                  强制覆盖
                </Button>
              )}
              {selectedSchedule.status === 'PENDING' && (
                <Button
                  icon={<X size={14} />}
                  onClick={() => handleCancelSchedule(selectedSchedule)}
                >
                  取消预约
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
