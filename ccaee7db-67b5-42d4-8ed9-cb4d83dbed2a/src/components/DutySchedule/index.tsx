import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Row,
  Col,
  Button,
  Card,
  Tabs,
  Tag,
  List,
  Avatar,
  Form,
  Input,
  Modal,
  Statistic,
  Select,
  DatePicker,
  Space,
  Badge,
  Collapse,
  Tooltip,
  message,
} from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  DownloadOutlined,
  EditOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import dayjs, { Dayjs } from 'dayjs';
import { useDutyStore } from '@/stores/dutyStore';
import { useMonitorStore } from '@/stores/monitorStore';
import { exportToCSV } from '@/utils/dataAggregator';
import type { DutyRecord, DutyShift, HandoverRecord } from '@/types';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

// 班次颜色配置
const SHIFT_CONFIG: Record<
  DutyShift,
  { color: string; bgColor: string; label: string; startHour: number; endHour: number }
> = {
  morning: {
    color: '#52c41a',
    bgColor: '#f6ffed',
    label: '早班',
    startHour: 8,
    endHour: 16,
  },
  afternoon: {
    color: '#1677ff',
    bgColor: '#e6f4ff',
    label: '中班',
    startHour: 16,
    endHour: 24,
  },
  night: {
    color: '#722ed1',
    bgColor: '#f9f0ff',
    label: '夜班',
    startHour: 0,
    endHour: 8,
  },
};

// 视图类型
type CalendarView = 'month' | 'week';

// 签名Canvas组件
const SignatureCanvas: React.FC<{
  visible: boolean;
  onConfirm: (signatureData: string) => void;
  onCancel: () => void;
}> = ({ visible, onConfirm, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (visible && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      setHasDrawn(false);
    }
  }, [visible]);

  const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    setHasDrawn(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      const pos = getPosition(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      const pos = getPosition(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const endDraw = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  const handleConfirm = () => {
    if (!hasDrawn) {
      message.warning('请先签名');
      return;
    }
    const dataUrl = canvasRef.current?.toDataURL('image/png') || '';
    onConfirm(dataUrl);
  };

  return (
    <Modal
      title="签名确认"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="clear" onClick={clearCanvas}>
          清除
        </Button>,
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="confirm" type="primary" onClick={handleConfirm}>
          确认签名
        </Button>,
      ]}
      width={520}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#666', marginBottom: 12 }}>请在下方区域手写签名确认交接</p>
        <canvas
          ref={canvasRef}
          width={460}
          height={200}
          style={{
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            background: '#fff',
            cursor: 'crosshair',
            touchAction: 'none',
            width: '100%',
            maxWidth: 460,
          }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
    </Modal>
  );
};

const DutySchedule: React.FC = () => {
  // 从 dutyStore 获取状态和方法
  const {
    dutyRecords,
    handoverRecords,
    currentShift,
    pendingHandover,
    currentUser,
    dutyStatistics,
    createHandover,
    submitHandover,
    confirmHandover,
    updateShiftRecord,
    getRecordsByMonth,
    getRecordsByWeek,
    calculateContinuousHours,
  } = useDutyStore();

  // 从 monitorStore 获取已处理告警数
  const alarms = useMonitorStore((state) => state.alarms);
  const handledAlarmCount = useMemo(
    () => alarms.filter((a) => a.ack).length,
    [alarms],
  );

  // 当前日历日期
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  // 日历视图
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  // 当前Tab
  const [activeTab, setActiveTab] = useState<string>('calendar');

  // 交接班表单
  const [handoverForm] = Form.useForm();
  // 签名弹窗
  const [signatureVisible, setSignatureVisible] = useState<boolean>(false);
  const [confirmingHandoverId, setConfirmingHandoverId] = useState<string | null>(null);

  // 值班统计时间范围
  const [statsTimeRange, setStatsTimeRange] = useState<'month' | 'quarter' | 'custom'>('month');
  const [statsCustomRange, setStatsCustomRange] = useState<[Dayjs, Dayjs] | null>(null);

  // 拖拽状态
  const [draggedRecord, setDraggedRecord] = useState<DutyRecord | null>(null);
  const [conflictDates, setConflictDates] = useState<Set<string>>(new Set());

  // 格式化日期 YYYY-MM-DD
  const formatDate = (d: Dayjs | Date): string => dayjs(d).format('YYYY-MM-DD');

  // 获取周一开始的日期
  const getWeekStart = (d: Dayjs): Dayjs => {
    const day = d.day();
    const diff = day === 0 ? -6 : 1 - day;
    return d.add(diff, 'day');
  };

  // 生成周视图数据
  const weekDays = useMemo(() => {
    const start = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => start.add(i, 'day'));
  }, [currentDate]);

  // 获取每周的值班记录
  const weekRecords = useMemo(() => {
    const weekStart = formatDate(getWeekStart(currentDate));
    return getRecordsByWeek(weekStart);
  }, [currentDate, getRecordsByWeek]);

  // 获取月度的值班记录
  const monthRecords = useMemo(() => {
    const yearMonth = currentDate.format('YYYY-MM');
    return getRecordsByMonth(yearMonth);
  }, [currentDate, getRecordsByMonth]);

  // 生成本月日历格子（6周）
  const monthCalendarCells = useMemo(() => {
    const year = currentDate.year();
    const month = currentDate.month();
    const firstDay = dayjs(new Date(year, month, 1));
    const start = getWeekStart(firstDay);

    const cells: Array<{ date: Dayjs; records: DutyRecord[]; isCurrentMonth: boolean }> = [];

    for (let i = 0; i < 42; i++) {
      const date = start.add(i, 'day');
      const dateStr = formatDate(date);
      const records = dutyRecords.filter((r) => r.date === dateStr);
      cells.push({
        date,
        records,
        isCurrentMonth: date.month() === month,
      });
    }

    return cells;
  }, [currentDate, dutyRecords]);

  // 检测连续超时（>12h）
  const checkOvertimeByUser = useMemo(() => {
    const result: Record<string, boolean> = {};
    const userIds = new Set(dutyRecords.map((r) => r.userId));
    userIds.forEach((uid) => {
      result[uid] = calculateContinuousHours(uid) > 12;
    });
    return result;
  }, [dutyRecords, calculateContinuousHours]);

  // 本月每人班次统计
  const monthlyUserStats = useMemo(() => {
    const stats: Record<string, { morning: number; afternoon: number; night: number; total: number }> = {};
    monthRecords.forEach((r) => {
      if (!stats[r.userId]) {
        stats[r.userId] = { morning: 0, afternoon: 0, night: 0, total: 0 };
      }
      stats[r.userId][r.shift] += 1;
      stats[r.userId].total += 1;
    });
    return stats;
  }, [monthRecords]);

  // 生成用户值班时长对比柱状图 Option
  const userBarChartOption = useMemo<EChartsOption>(() => {
    const userIds = Object.keys(monthlyUserStats);
    const userNames = userIds.map((uid) => {
      const record = monthRecords.find((r) => r.userId === uid);
      return record?.userName || uid;
    });

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: {
        data: Object.values(SHIFT_CONFIG).map((s) => s.label),
        top: 0,
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: userNames,
        axisLabel: { rotate: 0 },
      },
      yAxis: {
        type: 'value',
        name: '班次数量',
        axisLabel: { formatter: '{value} 个' },
      },
      series: (['morning', 'afternoon', 'night'] as DutyShift[]).map((shift) => ({
        name: SHIFT_CONFIG[shift].label,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: userIds.map((uid) => monthlyUserStats[uid]?.[shift] || 0),
        itemStyle: { color: SHIFT_CONFIG[shift].color },
      })),
    } as EChartsOption;
  }, [monthlyUserStats, monthRecords]);

  // 班次分布饼图 Option
  const shiftPieChartOption = useMemo<EChartsOption>(() => {
    const counts = { morning: 0, afternoon: 0, night: 0 };
    monthRecords.forEach((r) => {
      counts[r.shift] += 1;
    });

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: true, formatter: '{b}\n{d}%' },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold' },
          },
          data: (['morning', 'afternoon', 'night'] as DutyShift[]).map((s) => ({
            value: counts[s],
            name: SHIFT_CONFIG[s].label,
            itemStyle: { color: SHIFT_CONFIG[s].color },
          })),
        },
      ],
    } as EChartsOption;
  }, [monthRecords]);

  // 近6个月趋势折线图 Option
  const trendLineChartOption = useMemo<EChartsOption>(() => {
    const months: string[] = [];
    const shiftCounts: Record<DutyShift, number[]> = {
      morning: [],
      afternoon: [],
      night: [],
    };

    for (let i = 5; i >= 0; i--) {
      const d = dayjs().subtract(i, 'month');
      months.push(d.format('YYYY-MM'));
      const records = getRecordsByMonth(d.format('YYYY-MM'));
      const counts = { morning: 0, afternoon: 0, night: 0 };
      records.forEach((r) => {
        counts[r.shift] += 1;
      });
      shiftCounts.morning.push(counts.morning);
      shiftCounts.afternoon.push(counts.afternoon);
      shiftCounts.night.push(counts.night);
    }

    return {
      tooltip: { trigger: 'axis' },
      legend: {
        data: Object.values(SHIFT_CONFIG).map((s) => s.label),
        top: 0,
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: months },
      yAxis: { type: 'value', name: '班次数量' },
      series: (['morning', 'afternoon', 'night'] as DutyShift[]).map((s) => ({
        name: SHIFT_CONFIG[s].label,
        type: 'line',
        smooth: true,
        data: shiftCounts[s],
        itemStyle: { color: SHIFT_CONFIG[s].color },
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.1, color: SHIFT_CONFIG[s].color },
      })),
    } as EChartsOption;
  }, [getRecordsByMonth]);

  // 本月统计柱状图（右侧面板）
  const monthlyStatsChartOption = useMemo<EChartsOption>(() => {
    const userIds = Object.keys(monthlyUserStats);
    const userNames = userIds.map((uid) => {
      const record = monthRecords.find((r) => r.userId === uid);
      return record?.userName || uid;
    });

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: userNames,
        axisLabel: { rotate: 45, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: '总班次',
        axisLabel: { formatter: '{value}' },
      },
      series: [
        {
          type: 'bar',
          data: userIds.map((uid) => monthlyUserStats[uid]?.total || 0),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#1677ff' },
                { offset: 1, color: '#69b1ff' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            fontSize: 11,
          },
        },
      ],
    } as EChartsOption;
  }, [monthlyUserStats, monthRecords]);

  // 月份导航
  const goPrevMonth = () => setCurrentDate((d) => d.subtract(1, 'month'));
  const goNextMonth = () => setCurrentDate((d) => d.add(1, 'month'));
  const goToday = () => setCurrentDate(dayjs());

  // 周导航
  const goPrevWeek = () => setCurrentDate((d) => d.subtract(1, 'week'));
  const goNextWeek = () => setCurrentDate((d) => d.add(1, 'week'));

  // 拖拽处理
  const handleDragStart = (record: DutyRecord) => {
    setDraggedRecord(record);
  };

  const handleDragEnd = () => {
    setDraggedRecord(null);
    setConflictDates(new Set());
  };

  const handleDragOver = (e: React.DragEvent, targetDate: string, targetShift: DutyShift) => {
    e.preventDefault();
    if (!draggedRecord) return;

    const hasConflict = monthRecords.some(
      (r) =>
        r.date === targetDate &&
        r.shift === targetShift &&
        r.id !== draggedRecord.id,
    );

    setConflictDates(hasConflict ? new Set([`${targetDate}_${targetShift}`]) : new Set());
  };

  const handleDrop = (
    e: React.DragEvent,
    targetDate: string,
    targetShift: DutyShift,
  ) => {
    e.preventDefault();
    if (!draggedRecord) return;

    const hasConflict = monthRecords.some(
      (r) =>
        r.date === targetDate &&
        r.shift === targetShift &&
        r.id !== draggedRecord.id,
    );

    if (hasConflict) {
      message.error('该时段已有人值班，不能重复排班');
      handleDragEnd();
      return;
    }

    const SHIFT_HOURS: Record<DutyShift, { start: number; duration: number }> = {
      morning: { start: 8, duration: 8 },
      afternoon: { start: 16, duration: 8 },
      night: { start: 0, duration: 8 },
    };

    const parsedDate = new Date(
      Number(targetDate.split('-')[0]),
      Number(targetDate.split('-')[1]) - 1,
      Number(targetDate.split('-')[2]),
    );

    const { start, duration } = SHIFT_HOURS[targetShift];
    const startTime = new Date(parsedDate);
    startTime.setHours(start, 0, 0, 0);
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);

    const now = Date.now();
    let status: DutyRecord['status'] = 'completed';
    if (startTime.getTime() > now) {
      status = 'pending';
    } else if (endTime.getTime() > now) {
      status = 'ongoing';
    }

    updateShiftRecord(draggedRecord.id, {
      date: targetDate,
      shift: targetShift,
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      status,
    });

    message.success(`已调整排班：${draggedRecord.userName} → ${dayjs(targetDate).format('MM-DD')} ${SHIFT_CONFIG[targetShift].label}`);
    handleDragEnd();
  };

  // 创建交接班
  const handleCreateHandover = () => {
    try {
      const handover = createHandover();
      handoverForm.setFieldsValue({
        alarmsHandled: handledAlarmCount,
        pendingItems: '',
        deviceChanges: '',
        importantNotes: '',
        summary: '',
      });
      message.success('已创建交接班单，请填写交接内容');
    } catch (e) {
      message.error('创建交接班失败');
    }
  };

  // 提交交接班
  const handleSubmitHandover = async () => {
    try {
      const values = await handoverForm.validateFields();
      if (!pendingHandover) return;

      const submittedRecord: HandoverRecord = {
        ...pendingHandover,
        summary: values.summary || '',
        pendingItems: values.pendingItems
          ? values.pendingItems.split('\n').filter((s: string) => s.trim())
          : [],
        alarmsHandled: values.alarmsHandled || handledAlarmCount,
      };

      // 附加自定义字段
      (submittedRecord as any).deviceChanges = values.deviceChanges || '';
      (submittedRecord as any).importantNotes = values.importantNotes || '';

      submitHandover(submittedRecord);
      message.success('交接班已提交，等待接班人确认');
    } catch (e) {
      // 表单校验失败不处理
    }
  };

  // 确认交接班（打开签名弹窗）
  const openConfirmHandover = (recordId: string) => {
    setConfirmingHandoverId(recordId);
    setSignatureVisible(true);
  };

  // 签名确认完成
  const handleSignatureConfirm = (signatureData: string) => {
    if (confirmingHandoverId) {
      confirmHandover(confirmingHandoverId, signatureData);
      message.success('交接班确认成功');
    }
    setSignatureVisible(false);
    setConfirmingHandoverId(null);
  };

  // 导出报表
  const handleExportReport = () => {
    try {
      const headers = [
        '日期',
        '班次',
        '值班人员',
        '开始时间',
        '结束时间',
        '状态',
      ];

      const rows = monthRecords.map((r) => [
        r.date,
        SHIFT_CONFIG[r.shift].label,
        r.userName,
        dayjs(r.startTime).format('YYYY-MM-DD HH:mm:ss'),
        dayjs(r.endTime).format('YYYY-MM-DD HH:mm:ss'),
        r.status === 'ongoing'
          ? '进行中'
          : r.status === 'completed'
          ? '已完成'
          : '待执行',
      ]);

      exportToCSV(
        headers,
        rows,
        `值班排班报表_${currentDate.format('YYYYMM')}`,
      );
      message.success('报表导出成功');
    } catch (error) {
      message.error('报表导出失败');
    }
  };

  // 倒计时
  const [countdown, setCountdown] = useState<string>('');
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentShift) {
        const hours = Math.floor(currentShift.hoursRemaining);
        const minutes = Math.floor((currentShift.hoursRemaining - hours) * 60);
        setCountdown(`${hours}小时${minutes}分钟`);
      }
    }, 1000 * 60);

    if (currentShift) {
      const hours = Math.floor(currentShift.hoursRemaining);
      const minutes = Math.floor((currentShift.hoursRemaining - hours) * 60);
      setCountdown(`${hours}小时${minutes}分钟`);
    }

    return () => clearInterval(timer);
  }, [currentShift]);

  // 渲染班次Tag
  const renderShiftTag = (shift: DutyShift, name?: string, compact = false) => {
    const config = SHIFT_CONFIG[shift];
    return (
      <Tag
        color={config.bgColor}
        style={{
          color: config.color,
          borderColor: config.color,
          border: `1px solid ${config.color}40`,
          fontSize: compact ? 11 : 12,
          padding: compact ? '0 4px' : '2px 8px',
          margin: 0,
          lineHeight: compact ? '18px' : '22px',
        }}
      >
        {compact ? (name || config.label) : `${config.label} ${name ? '· ' + name : ''}`}
      </Tag>
    );
  };

  return (
    <div style={{ padding: 16, background: '#f5f5f5', minHeight: '100vh' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="large"
        items={[
          // Tab 1 - 排班日历
          {
            key: 'calendar',
            label: (
              <span>
                <CalendarOutlined /> 排班日历
              </span>
            ),
            children: (
              <Row gutter={16}>
                {/* 左侧：日历主体 */}
                <Col xs={24} xl={18}>
                  <Card
                    size="small"
                    title={
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <Space>
                          <Button
                            size="small"
                            icon={<LeftOutlined />}
                            onClick={calendarView === 'month' ? goPrevMonth : goPrevWeek}
                          />
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            onClick={goToday}
                          >
                            今日
                          </Button>
                          <Button
                            size="small"
                            icon={<RightOutlined />}
                            onClick={calendarView === 'month' ? goNextMonth : goNextWeek}
                          />
                          <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 8 }}>
                            {calendarView === 'month'
                              ? currentDate.format('YYYY年MM月')
                              : `${weekDays[0].format('YYYY年MM月DD日')} - ${weekDays[6].format('MM月DD日')}`}
                          </span>
                        </Space>
                        <Space>
                          <Button.Group size="small">
                            <Button
                              type={calendarView === 'week' ? 'primary' : 'default'}
                              onClick={() => setCalendarView('week')}
                            >
                              周视图
                            </Button>
                            <Button
                              type={calendarView === 'month' ? 'primary' : 'default'}
                              onClick={() => setCalendarView('month')}
                            >
                              月视图
                            </Button>
                          </Button.Group>
                        </Space>
                      </div>
                    }
                  >
                    {/* 周视图 */}
                    {calendarView === 'week' && (
                      <div style={{ display: 'flex', border: '1px solid #f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
                        {/* 时间轴列 */}
                        <div style={{ width: 60, flexShrink: 0, borderRight: '1px solid #f0f0f0' }}>
                          <div
                            style={{
                              height: 40,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#fafafa',
                              borderBottom: '1px solid #f0f0f0',
                              fontSize: 12,
                              color: '#666',
                              fontWeight: 500,
                            }}
                          >
                            时间
                          </div>
                          {Array.from({ length: 24 }, (_, h) => (
                            <div
                              key={h}
                              style={{
                                height: 28,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                color: '#999',
                                borderBottom: h < 23 ? '1px dashed #f5f5f5' : 'none',
                              }}
                            >
                              {String(h).padStart(2, '0')}:00
                            </div>
                          ))}
                        </div>

                        {/* 每天列 */}
                        {weekDays.map((day, dayIdx) => {
                          const dateStr = formatDate(day);
                          const isToday = dayjs().isSame(day, 'day');
                          const dayRecords = weekRecords.filter((r) => r.date === dateStr);

                          return (
                            <div
                              key={dayIdx}
                              style={{
                                flex: 1,
                                position: 'relative',
                                borderRight: dayIdx < 6 ? '1px solid #f0f0f0' : 'none',
                                background: isToday ? '#e6f4ff20' : 'transparent',
                              }}
                            >
                              {/* 星期头 */}
                              <div
                                style={{
                                  height: 40,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: isToday ? '#1677ff' : '#fafafa',
                                  color: isToday ? '#fff' : '#333',
                                  borderBottom: '1px solid #f0f0f0',
                                  fontSize: 12,
                                  fontWeight: isToday ? 600 : 400,
                                }}
                              >
                                <span>{['周一', '周二', '周三', '周四', '周五', '周六', '周日'][dayIdx]}</span>
                                <span style={{ fontSize: 13 }}>{day.format('MM/DD')}</span>
                              </div>

                              {/* 时间网格 */}
                              <div style={{ position: 'relative', height: 24 * 28 }}>
                                {/* 24小时分隔线 */}
                                {Array.from({ length: 24 }, (_, h) => (
                                  <div
                                    key={h}
                                    style={{
                                      position: 'absolute',
                                      top: h * 28,
                                      left: 0,
                                      right: 0,
                                      height: 28,
                                      borderBottom: h < 23 ? '1px dashed #f5f5f5' : 'none',
                                    }}
                                    onDragOver={(e) => {
                                      let targetShift: DutyShift;
                                      if (h >= 8 && h < 16) targetShift = 'morning';
                                      else if (h >= 16) targetShift = 'afternoon';
                                      else targetShift = 'night';
                                      handleDragOver(e, dateStr, targetShift);
                                    }}
                                    onDrop={(e) => {
                                      let targetShift: DutyShift;
                                      if (h >= 8 && h < 16) targetShift = 'morning';
                                      else if (h >= 16) targetShift = 'afternoon';
                                      else targetShift = 'night';
                                      handleDrop(e, dateStr, targetShift);
                                    }}
                                  />
                                ))}

                                {/* 班次色块 */}
                                {(['morning', 'afternoon', 'night'] as DutyShift[]).map((shift) => {
                                  const config = SHIFT_CONFIG[shift];
                                  const records = dayRecords.filter((r) => r.shift === shift);
                                  if (records.length === 0) return null;

                                  const top = config.startHour * 28;
                                  const height = 8 * 28 - 4;
                                  const isConflict = conflictDates.has(`${dateStr}_${shift}`);

                                  return records.map((record) => {
                                    const isOvertime = checkOvertimeByUser[record.userId];
                                    return (
                                      <div
                                        key={record.id}
                                        draggable
                                        onDragStart={() => handleDragStart(record)}
                                        onDragEnd={handleDragEnd}
                                        style={{
                                          position: 'absolute',
                                          top: top + 2,
                                          left: 4,
                                          right: 4,
                                          height,
                                          background: isConflict ? '#fff1f0' : config.bgColor,
                                          border: `2px solid ${isConflict ? '#ff4d4f' : config.color}`,
                                          borderRadius: 6,
                                          padding: '6px 8px',
                                          cursor: 'move',
                                          overflow: 'hidden',
                                          transition: 'all 0.2s',
                                          zIndex: isConflict ? 10 : 1,
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                          <div
                                            style={{
                                              fontSize: 12,
                                              fontWeight: 600,
                                              color: config.color,
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 4,
                                            }}
                                          >
                                            {config.label}
                                            {isOvertime && (
                                              <Tooltip title="连续值班超时预警">
                                                <WarningOutlined style={{ color: '#ff4d4f' }} />
                                              </Tooltip>
                                            )}
                                          </div>
                                          <span style={{ fontSize: 10, color: '#999' }}>8h</span>
                                        </div>
                                        <div
                                          style={{
                                            marginTop: 4,
                                            fontSize: 13,
                                            fontWeight: 500,
                                            color: '#333',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                          }}
                                        >
                                          <Avatar
                                            size={18}
                                            icon={<UserOutlined />}
                                            style={{ background: config.color }}
                                          />
                                          {record.userName}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                                          {record.status === 'ongoing' && (
                                            <Badge status="processing" text="进行中" />
                                          )}
                                          {record.status === 'pending' && (
                                            <Badge status="default" text="待执行" />
                                          )}
                                          {record.status === 'completed' && (
                                            <Badge status="success" text="已完成" />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  });
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 月视图 */}
                    {calendarView === 'month' && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(7, 1fr)',
                          border: '1px solid #f0f0f0',
                          borderRadius: 6,
                          overflow: 'hidden',
                        }}
                      >
                        {/* 星期头 */}
                        {['一', '二', '三', '四', '五', '六', '日'].map((w, i) => (
                          <div
                            key={w}
                            style={{
                              padding: '8px 4px',
                              textAlign: 'center',
                              background: '#fafafa',
                              borderBottom: '1px solid #f0f0f0',
                              borderRight: i < 6 ? '1px solid #f0f0f0' : 'none',
                              fontSize: 12,
                              color: i >= 5 ? '#ff4d4f' : '#333',
                              fontWeight: 500,
                            }}
                          >
                            周{w}
                          </div>
                        ))}

                        {/* 日期格子 */}
                        {monthCalendarCells.map((cell, idx) => {
                          const dateStr = formatDate(cell.date);
                          const isToday = dayjs().isSame(cell.date, 'day');
                          const colIdx = idx % 7;

                          const shifts: DutyShift[] = ['morning', 'afternoon', 'night'];
                          const shiftRecords = shifts.map((s) =>
                            cell.records.find((r) => r.shift === s),
                          );

                          return (
                            <div
                              key={idx}
                              onDragOver={(e) => e.preventDefault()}
                              style={{
                                minHeight: 110,
                                padding: 6,
                                borderBottom: '1px solid #f0f0f0',
                                borderRight: colIdx < 6 ? '1px solid #f0f0f0' : 'none',
                                background: !cell.isCurrentMonth
                                  ? '#fafafa80'
                                  : isToday
                                  ? '#e6f4ff40'
                                  : 'transparent',
                                opacity: cell.isCurrentMonth ? 1 : 0.5,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 3,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: isToday ? 600 : 400,
                                    background: isToday ? '#1677ff' : 'transparent',
                                    color: isToday ? '#fff' : colIdx >= 5 ? '#ff4d4f' : '#333',
                                    borderRadius: '50%',
                                    width: 22,
                                    height: 22,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {cell.date.date()}
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {shiftRecords.map((record, sIdx) => {
                                  const shift = shifts[sIdx];
                                  const config = SHIFT_CONFIG[shift];
                                  if (!record) {
                                    return (
                                      <div
                                        key={sIdx}
                                        style={{
                                          height: 18,
                                          borderRadius: 3,
                                          border: `1px dashed ${config.color}30`,
                                          background: `${config.bgColor}40`,
                                          fontSize: 10,
                                          color: '#bbb',
                                          display: 'flex',
                                          alignItems: 'center',
                                          paddingLeft: 4,
                                        }}
                                        onDragOver={(e) => handleDragOver(e, dateStr, shift)}
                                        onDrop={(e) => handleDrop(e, dateStr, shift)}
                                      >
                                        {config.label[0]}班
                                      </div>
                                    );
                                  }

                                  const isOvertime = checkOvertimeByUser[record.userId];
                                  return (
                                    <div
                                      key={sIdx}
                                      draggable
                                      onDragStart={() => handleDragStart(record)}
                                      onDragEnd={handleDragEnd}
                                      style={{
                                        height: 18,
                                        borderRadius: 3,
                                        background: conflictDates.has(`${dateStr}_${shift}`)
                                          ? '#fff1f0'
                                          : config.bgColor,
                                        border: `1px solid ${conflictDates.has(`${dateStr}_${shift}`) ? '#ff4d4f' : config.color}`,
                                        fontSize: 10,
                                        color: config.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0 4px',
                                        gap: 2,
                                        cursor: 'move',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                      }}
                                      onDragOver={(e) => handleDragOver(e, dateStr, shift)}
                                      onDrop={(e) => handleDrop(e, dateStr, shift)}
                                    >
                                      <span
                                        style={{
                                          flexShrink: 0,
                                          fontWeight: 600,
                                        }}
                                      >
                                        {config.label[0]}
                                      </span>
                                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {record.userName}
                                      </span>
                                      {isOvertime && <WarningOutlined style={{ fontSize: 10, color: '#ff4d4f' }} />}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 图例 */}
                    <div
                      style={{
                        marginTop: 12,
                        display: 'flex',
                        gap: 16,
                        flexWrap: 'wrap',
                        fontSize: 12,
                        padding: '8px 12px',
                        background: '#fafafa',
                        borderRadius: 6,
                      }}
                    >
                      {(['morning', 'afternoon', 'night'] as DutyShift[]).map((s) => (
                        <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 14,
                              height: 14,
                              borderRadius: 3,
                              background: SHIFT_CONFIG[s].bgColor,
                              border: `1px solid ${SHIFT_CONFIG[s].color}`,
                            }}
                          />
                          {SHIFT_CONFIG[s].label} ({SHIFT_CONFIG[s].startHour}:00-{SHIFT_CONFIG[s].endHour === 24 ? '24' : SHIFT_CONFIG[s].endHour}:00)
                        </span>
                      ))}
                      <span style={{ color: '#999' }}>拖拽班次块可调整排班</span>
                    </div>
                  </Card>
                </Col>

                {/* 右侧：本月统计面板 */}
                <Col xs={24} xl={6}>
                  <Card size="small" title="📊 本月统计" style={{ marginBottom: 16 }}>
                    <ReactECharts
                      option={monthlyStatsChartOption}
                      style={{ height: 220, width: '100%' }}
                      notMerge
                    />
                  </Card>

                  <Card size="small" title="👥 人员班次详情">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Object.entries(monthlyUserStats).map(([uid, stats]) => {
                        const record = monthRecords.find((r) => r.userId === uid);
                        const isOvertime = checkOvertimeByUser[uid];
                        return (
                          <div
                            key={uid}
                            style={{
                              padding: 10,
                              background: '#fafafa',
                              borderRadius: 6,
                              border: isOvertime ? '1px solid #ff4d4f80' : '1px solid #f0f0f0',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 6,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Avatar size={20} icon={<UserOutlined />} />
                                <span style={{ fontWeight: 500 }}>{record?.userName || uid}</span>
                                {isOvertime && (
                                  <Tooltip title="连续值班超时预警 (>12h)">
                                    <Tag color="red" style={{ fontSize: 10, padding: '0 4px' }}>
                                      <WarningOutlined /> 超时
                                    </Tag>
                                  </Tooltip>
                                )}
                              </div>
                              <Tag color="blue" style={{ fontSize: 11 }}>
                                共 {stats.total} 班
                              </Tag>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {renderShiftTag('morning', `早 ${stats.morning}`, true)}
                              {renderShiftTag('afternoon', `中 ${stats.afternoon}`, true)}
                              {renderShiftTag('night', `夜 ${stats.night}`, true)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </Col>
              </Row>
            ),
          },

          // Tab 2 - 交接班管理
          {
            key: 'handover',
            label: (
              <span>
                <FileTextOutlined /> 交接班管理
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                {/* 上方：当前班次卡片 + 创建按钮 */}
                <Col span={24}>
                  <Card size="small">
                    <Row gutter={16} align="middle">
                      <Col xs={24} md={18}>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                          {currentShift && (
                            <>
                              <Tag
                                color={SHIFT_CONFIG[currentShift.shift].color}
                                style={{
                                  fontSize: 14,
                                  padding: '6px 16px',
                                  borderRadius: 6,
                                }}
                              >
                                <ClockCircleOutlined /> 当前班次：
                                {SHIFT_CONFIG[currentShift.shift].label}
                              </Tag>

                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ color: '#666' }}>交班人：</span>
                                <Avatar size={24} icon={<UserOutlined />} src={currentUser.avatar} />
                                <span style={{ fontWeight: 500 }}>{currentShift.records[0]?.userName || currentUser.name}</span>
                              </div>

                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ color: '#666' }}>接班人：</span>
                                {(() => {
                                  const shifts: DutyShift[] = ['morning', 'afternoon', 'night'];
                                  const idx = shifts.indexOf(currentShift.shift);
                                  const nextShift = shifts[(idx + 1) % 3];
                                  let nextDate = currentShift.date;
                                  if (idx === 2) {
                                    nextDate = dayjs(currentShift.date).add(1, 'day').format('YYYY-MM-DD');
                                  }
                                  const nextRecord = dutyRecords.find(
                                    (r) => r.date === nextDate && r.shift === nextShift,
                                  );
                                  return (
                                    <>
                                      <Avatar size={24} icon={<UserOutlined />} />
                                      <span style={{ fontWeight: 500 }}>{nextRecord?.userName || '-'}</span>
                                      <Tag style={{ fontSize: 10 }} color="purple">
                                        {SHIFT_CONFIG[nextShift].label}
                                      </Tag>
                                    </>
                                  );
                                })()}
                              </div>

                              <Statistic
                                title={<span style={{ fontSize: 12, color: '#666' }}>距交接班</span>}
                                value={countdown}
                                valueStyle={{ fontSize: 14, color: '#fa541c' }}
                                prefix={<ClockCircleOutlined />}
                              />
                            </>
                          )}
                        </div>
                      </Col>
                      <Col xs={24} md={6} style={{ textAlign: 'right' }}>
                        <Button
                          type="primary"
                          icon={<EditOutlined />}
                          onClick={handleCreateHandover}
                          disabled={!!pendingHandover}
                        >
                          {pendingHandover ? '交接班单已创建' : '创建交接班'}
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                </Col>

                {/* 中部：交接班表单（有pendingHandover时显示） */}
                {pendingHandover && (
                  <Col span={24}>
                    <Card
                      size="small"
                      title={
                        <span style={{ color: '#fa541c' }}>
                          <Badge status="processing" /> 待提交的交接班单
                        </span>
                      }
                      extra={
                        <Button type="primary" onClick={handleSubmitHandover}>
                          <CheckCircleOutlined /> 提交交接
                        </Button>
                      }
                    >
                      <Form form={handoverForm} layout="vertical">
                        <Row gutter={16}>
                          <Col xs={24} md={8}>
                            <Form.Item
                              label="本班告警处理汇总（已自动读取）"
                              name="alarmsHandled"
                              initialValue={handledAlarmCount}
                            >
                              <Statistic
                                value={handledAlarmCount}
                                suffix="起"
                                valueStyle={{ fontSize: 20, color: '#1677ff' }}
                                prefix={<WarningOutlined />}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item
                              label="值班总结"
                              name="summary"
                              rules={[{ required: true, message: '请输入值班总结' }]}
                            >
                              <TextArea
                                rows={4}
                                placeholder="请概述本班次整体运行情况、主要工作内容..."
                                maxLength={500}
                                showCount
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item label="未完成事项（每行一条）" name="pendingItems">
                              <TextArea
                                rows={4}
                                placeholder={'请输入待办事项，每行一条\n例如：\n跟进xx机房设备维修\n明天上午xx频道切换测试'}
                                maxLength={500}
                                showCount
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item label="设备变更记录" name="deviceChanges">
                              <TextArea
                                rows={3}
                                placeholder="记录本班次设备上下线、切换、维护等变更情况..."
                                maxLength={300}
                                showCount
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item label="重要事项备注" name="importantNotes">
                              <TextArea
                                rows={3}
                                placeholder="其他需要备注的重要事项..."
                                maxLength={300}
                                showCount
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Form>
                    </Card>
                  </Col>
                )}

                {/* 下方：交接班历史列表 */}
                <Col span={24}>
                  <Card
                    size="small"
                    title={
                      <span>
                        <FileTextOutlined /> 交接班历史记录（最近5条）
                      </span>
                    }
                  >
                    <List
                      itemLayout="vertical"
                      size="large"
                      dataSource={handoverRecords.slice(0, 5)}
                      renderItem={(item) => {
                        const needConfirm =
                          !item.confirmedAt && item.toUserId === currentUser.id;
                        return (
                          <List.Item
                            key={item.id}
                            actions={[
                              needConfirm && (
                                <Button
                                  key="confirm"
                                  type="primary"
                                  size="small"
                                  onClick={() => openConfirmHandover(item.id)}
                                >
                                  <CheckCircleOutlined /> 签名确认交接
                                </Button>
                              ),
                            ].filter(Boolean)}
                          >
                            <List.Item.Meta
                              avatar={
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <Avatar
                                    src={''}
                                    icon={<UserOutlined />}
                                    style={{ background: SHIFT_CONFIG[item.shift].color }}
                                  />
                                  <Avatar
                                    src={''}
                                    icon={<UserOutlined />}
                                    style={{ background: '#8c8c8c', marginLeft: -8 }}
                                  />
                                </div>
                              }
                              title={
                                <Space wrap>
                                  <span style={{ fontWeight: 600 }}>{item.fromUserName}</span>
                                  <span style={{ color: '#999' }}>→</span>
                                  <span style={{ fontWeight: 600 }}>{item.toUserName}</span>
                                  {renderShiftTag(item.shift)}
                                  <Tag color={item.confirmedAt ? 'green' : 'orange'}>
                                    {item.confirmedAt ? '已确认' : '待确认'}
                                  </Tag>
                                  {needConfirm && (
                                    <Badge status="processing" text="需要您确认" />
                                  )}
                                </Space>
                              }
                              description={
                                <Space size={[12, 4]} wrap style={{ fontSize: 12 }}>
                                  <span style={{ color: '#666' }}>
                                    📅 {item.date} {dayjs(item.createdAt).format('HH:mm')}
                                  </span>
                                  <span style={{ color: '#1677ff' }}>
                                    ⚠️ 处理告警 {item.alarmsHandled} 起
                                  </span>
                                  {item.confirmedAt && (
                                    <span style={{ color: '#52c41a' }}>
                                      ✅ 确认时间：{dayjs(item.confirmedAt).format('HH:mm')}
                                    </span>
                                  )}
                                </Space>
                              }
                            />

                            <Collapse
                              size="small"
                              ghost
                              items={[
                                {
                                  key: 'detail',
                                  label: '查看交接详情',
                                  children: (
                                    <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                      <div>
                                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                                          📝 值班总结：
                                        </div>
                                        <div
                                          style={{
                                            padding: '8px 12px',
                                            background: '#fafafa',
                                            borderRadius: 4,
                                            lineHeight: 1.6,
                                          }}
                                        >
                                          {item.summary || '无'}
                                        </div>
                                      </div>

                                      {item.pendingItems.length > 0 && (
                                        <div>
                                          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                                            📋 未完成事项：
                                          </div>
                                          <div style={{ paddingLeft: 16 }}>
                                            {item.pendingItems.map((pi, idx) => (
                                              <div key={idx} style={{ lineHeight: 2 }}>
                                                • {pi}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {(item as any).deviceChanges && (
                                        <div>
                                          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                                            🔧 设备变更：
                                          </div>
                                          <div
                                            style={{
                                              padding: '8px 12px',
                                              background: '#fffbe6',
                                              borderRadius: 4,
                                              lineHeight: 1.6,
                                            }}
                                          >
                                            {(item as any).deviceChanges}
                                          </div>
                                        </div>
                                      )}

                                      {(item as any).importantNotes && (
                                        <div>
                                          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                                            💡 重要备注：
                                          </div>
                                          <div
                                            style={{
                                              padding: '8px 12px',
                                              background: '#e6f4ff',
                                              borderRadius: 4,
                                              lineHeight: 1.6,
                                            }}
                                          >
                                            {(item as any).importantNotes}
                                          </div>
                                        </div>
                                      )}

                                      {item.signature && item.signature.startsWith('data:') && (
                                        <div>
                                          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                                            ✍️ 接班人签名：
                                          </div>
                                          <img
                                            src={item.signature}
                                            alt="signature"
                                            style={{
                                              maxWidth: 300,
                                              maxHeight: 120,
                                              border: '1px solid #eee',
                                              borderRadius: 4,
                                              padding: 4,
                                              background: '#fff',
                                            }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ),
                                },
                              ]}
                            />
                          </List.Item>
                        );
                      }}
                    />
                    {handoverRecords.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                        暂无交接班记录
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },

          // Tab 3 - 值班统计
          {
            key: 'statistics',
            label: (
              <span>
                <Statistic /> 值班统计
              </span>
            ),
            children: (
              <div>
                {/* 顶部：时间选择 + 导出 */}
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Row gutter={16} align="middle" justify="space-between">
                    <Col>
                      <Space wrap>
                        <span style={{ color: '#666' }}>统计范围：</span>
                        <Button.Group size="small">
                          <Button
                            type={statsTimeRange === 'month' ? 'primary' : 'default'}
                            onClick={() => setStatsTimeRange('month')}
                          >
                            月度
                          </Button>
                          <Button
                            type={statsTimeRange === 'quarter' ? 'primary' : 'default'}
                            onClick={() => setStatsTimeRange('quarter')}
                          >
                            季度
                          </Button>
                          <Button
                            type={statsTimeRange === 'custom' ? 'primary' : 'default'}
                            onClick={() => setStatsTimeRange('custom')}
                          >
                            自定义
                          </Button>
                        </Button.Group>
                        {statsTimeRange === 'custom' && (
                          <RangePicker
                            size="small"
                            value={statsCustomRange}
                            onChange={(dates) => setStatsCustomRange(dates as [Dayjs, Dayjs])}
                          />
                        )}
                      </Space>
                    </Col>
                    <Col>
                      <Button icon={<DownloadOutlined />} onClick={handleExportReport}>
                        导出报表
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {/* 4个统计卡片 */}
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={12} md={6}>
                    <Card size="small">
                      <Statistic
                        title="总班次"
                        value={dutyStatistics.totalShifts}
                        suffix="个"
                        valueStyle={{ color: '#1677ff' }}
                        prefix={<CalendarOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={12} md={6}>
                    <Card size="small">
                      <Statistic
                        title="总值班时长"
                        value={dutyStatistics.totalHours}
                        suffix="小时"
                        valueStyle={{ color: '#52c41a' }}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={12} md={6}>
                    <Card size="small">
                      <Statistic
                        title="平均每班时长"
                        value={
                          dutyStatistics.totalShifts > 0
                            ? (dutyStatistics.totalHours / dutyStatistics.totalShifts).toFixed(1)
                            : 0
                        }
                        suffix="小时"
                        valueStyle={{ color: '#722ed1' }}
                        prefix={<UserOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={12} md={6}>
                    <Card size="small">
                      <Statistic
                        title="加班预警次数"
                        value={dutyStatistics.overtimeWarnings}
                        suffix="次"
                        valueStyle={{ color: '#ff4d4f' }}
                        prefix={<WarningOutlined />}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* 图表区域 */}
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <Card size="small" title="📊 各人员值班时长对比">
                      <ReactECharts
                        option={userBarChartOption}
                        style={{ height: 300, width: '100%' }}
                        notMerge
                      />
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card size="small" title="🥧 班次分布占比">
                      <ReactECharts
                        option={shiftPieChartOption}
                        style={{ height: 300, width: '100%' }}
                        notMerge
                      />
                    </Card>
                  </Col>
                  <Col span={24}>
                    <Card size="small" title="📈 月度班次趋势（近6个月）">
                      <ReactECharts
                        option={trendLineChartOption}
                        style={{ height: 300, width: '100%' }}
                        notMerge
                      />
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
        ]}
      />

      {/* 签名确认弹窗 */}
      <SignatureCanvas
        visible={signatureVisible}
        onConfirm={handleSignatureConfirm}
        onCancel={() => {
          setSignatureVisible(false);
          setConfirmingHandoverId(null);
        }}
      />
    </div>
  );
};

export default DutySchedule;
