import React, { useMemo, useState, useEffect } from 'react';
import {
  Card,
  Form,
  Row,
  Col,
  DatePicker,
  Select,
  Input,
  Button,
  Space,
  Table,
  Tag,
  Tabs,
  Statistic,
  Tooltip,
  Modal,
  Descriptions,
  message,
  Empty,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ExportOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useMonitorStore } from '@/stores/monitorStore';
import type { AlarmItem, AlarmLevel, AlarmType } from '@/types';

// 告警级别对应的颜色配置
const LEVEL_COLORS: Record<AlarmLevel, string> = {
  urgent: '#ff4d4f',
  important: '#faad14',
  general: '#1890ff',
};

// 告警级别对应的中文名称
const LEVEL_LABELS: Record<AlarmLevel, string> = {
  urgent: '紧急',
  important: '重要',
  general: '一般',
};

// 告警类型对应的中文名称
const TYPE_LABELS: Record<AlarmType, string> = {
  signal_loss: '信号丢失',
  black_frame: '黑帧检测',
  static_frame: '静帧检测',
  audio_loss: '音频丢失',
  bitrate_error: '码率异常',
  device_offline: '设备离线',
};

// 告警类型对应的颜色
const TYPE_COLORS: Record<AlarmType, string> = {
  signal_loss: '#ff4d4f',
  black_frame: '#fa8c16',
  static_frame: '#faad14',
  audio_loss: '#a0d911',
  bitrate_error: '#1890ff',
  device_offline: '#722ed1',
};

// 筛选条件表单类型
interface FilterFormValues {
  timeRange?: [Dayjs, Dayjs];
  levels?: AlarmLevel[];
  types?: AlarmType[];
  stationId?: string;
  keyword?: string;
}

// 扩展告警项（包含处理人等附加字段）
interface ExtendedAlarmItem extends AlarmItem {
  handlerName?: string;
}

// 生成唯一ID
const generateId = () => `al_hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// 处理人姓名池
const HANDLER_NAMES = ['李建国', '王美玲', '张伟', '赵晓东', '系统自动', '待分配'];

// 告警历史页面组件
const AlarmHistory: React.FC = () => {
  // 获取Store数据
  const { alarms, stations, initializeMockData, channels } = useMonitorStore();

  // 表单实例
  const [form] = Form.useForm<FilterFormValues>();

  // 当前激活的Tab
  const [activeTab, setActiveTab] = useState<string>('table');

  // 表格选中行的key列表
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 详情弹窗状态
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    alarm: ExtendedAlarmItem | null;
  }>({ open: false, alarm: null });

  // 确保Mock数据已初始化
  useEffect(() => {
    if (Object.keys(stations).length === 0) {
      initializeMockData();
    }
  }, [stations, initializeMockData]);

  // ===== 生成500条历史告警模拟数据（向前分布30天） =====
  const historicalAlarms: ExtendedAlarmItem[] = useMemo(() => {
    const alarmTypeKeys: AlarmType[] = [
      'signal_loss',
      'black_frame',
      'static_frame',
      'audio_loss',
      'bitrate_error',
      'device_offline',
    ];
    const levelByType: Record<AlarmType, AlarmLevel> = {
      signal_loss: 'urgent',
      black_frame: 'important',
      static_frame: 'important',
      audio_loss: 'important',
      bitrate_error: 'general',
      device_offline: 'urgent',
    };
    const alarmTitleByType: Record<AlarmType, string> = {
      signal_loss: '信号丢失告警',
      black_frame: '黑帧检测告警',
      static_frame: '静帧检测告警',
      audio_loss: '音频丢失告警',
      bitrate_error: '码率异常告警',
      device_offline: '设备离线告警',
    };
    const alarmContentByType: Record<AlarmType, string> = {
      signal_loss: '检测到频道信号丢失超过30秒，请检查传输链路',
      black_frame: '检测到连续黑帧超过10秒，可能存在播出故障',
      static_frame: '检测到画面静止超过60秒，可能存在播出异常',
      audio_loss: '检测到主声道音频丢失，请检查音频编码设备',
      bitrate_error: '当前码率波动超过阈值±30%，请检查编码输出',
      device_offline: '机房主设备心跳超时，设备可能已离线',
    };

    const stationList = Object.values(stations);
    const channelList = Object.values(channels);
    const result: ExtendedAlarmItem[] = [];
    const now = Date.now();

    // 生成500条历史数据
    for (let i = 0; i < 500; i++) {
      const type = alarmTypeKeys[Math.floor(Math.random() * alarmTypeKeys.length)];
      const level = levelByType[type];
      // 随机向前偏移0~30天的时间戳
      const randomOffsetMs = Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000);
      const timestamp = now - randomOffsetMs;
      const firstTimestamp = timestamp - Math.floor(Math.random() * 30 * 60 * 1000);
      // 关联随机的机房和频道
      const station = stationList[Math.floor(Math.random() * stationList.length)];
      const channel =
        channelList.find((c) => c.stationId === station?.id) ||
        channelList[Math.floor(Math.random() * channelList.length)];

      const ack = Math.random() < 0.7; // 70%已确认

      result.push({
        id: generateId(),
        level,
        type,
        title: alarmTitleByType[type],
        stationId: station?.id || 'st0001',
        stationName: station?.name || '未知机房',
        channelId: channel?.id || 'ch0001',
        channelName: channel?.name || '未知频道',
        content: alarmContentByType[type],
        timestamp,
        firstTimestamp,
        ack,
        count: 1 + Math.floor(Math.random() * 8),
        handlerName: ack
          ? HANDLER_NAMES[Math.floor(Math.random() * (HANDLER_NAMES.length - 1))]
          : undefined,
      });
    }

    // 将现有告警也合并进来，并附加处理人字段
    const existingWithHandler: ExtendedAlarmItem[] = alarms.map((a) => ({
      ...a,
      handlerName: a.ack
        ? HANDLER_NAMES[Math.floor(Math.random() * (HANDLER_NAMES.length - 1))]
        : undefined,
    }));

    // 合并并按时间倒序排序
    return [...existingWithHandler, ...result].sort((a, b) => b.timestamp - a.timestamp);
  }, [alarms, stations, channels]);

  // ===== 根据筛选条件过滤告警 =====
  const [filters, setFilters] = useState<FilterFormValues>({});

  const filteredAlarms = useMemo(() => {
    return historicalAlarms.filter((alarm) => {
      // 时间范围过滤
      if (filters.timeRange && filters.timeRange.length === 2) {
        const [start, end] = filters.timeRange;
        if (
          alarm.timestamp < start.valueOf() ||
          alarm.timestamp > end.valueOf() + 24 * 60 * 60 * 1000
        ) {
          return false;
        }
      }
      // 告警级别过滤
      if (filters.levels && filters.levels.length > 0 && !filters.levels.includes(alarm.level)) {
        return false;
      }
      // 告警类型过滤
      if (filters.types && filters.types.length > 0 && !filters.types.includes(alarm.type)) {
        return false;
      }
      // 机房过滤
      if (filters.stationId && alarm.stationId !== filters.stationId) {
        return false;
      }
      // 关键词过滤
      if (filters.keyword && filters.keyword.trim()) {
        const kw = filters.keyword.trim().toLowerCase();
        const haystack = `${alarm.title} ${alarm.content} ${alarm.stationName} ${alarm.channelName}`.toLowerCase();
        if (!haystack.includes(kw)) {
          return false;
        }
      }
      return true;
    });
  }, [historicalAlarms, filters]);

  // ===== 表单提交：应用筛选条件 =====
  const handleSearch = (values: FilterFormValues) => {
    setFilters(values);
    message.success(`查询完成，共找到 ${filteredAlarms.length} 条记录`);
  };

  // ===== 重置筛选条件 =====
  const handleReset = () => {
    form.resetFields();
    setFilters({});
    setSelectedRowKeys([]);
  };

  // ===== 告警数据导出为CSV =====
  const exportToCSV = (dataList: ExtendedAlarmItem[], filename: string) => {
    const headers = [
      '序号',
      '告警级别',
      '告警类型',
      '所属机房',
      '频道',
      '告警标题',
      '告警内容',
      '发生时间',
      '首次时间',
      '重复次数',
      '确认状态',
      '处理人',
    ];
    const rows = dataList.map((alarm, idx) => [
      idx + 1,
      LEVEL_LABELS[alarm.level],
      TYPE_LABELS[alarm.type],
      alarm.stationName,
      alarm.channelName,
      alarm.title,
      alarm.content,
      dayjs(alarm.timestamp).format('YYYY-MM-DD HH:mm:ss'),
      dayjs(alarm.firstTimestamp).format('YYYY-MM-DD HH:mm:ss'),
      alarm.count,
      alarm.ack ? '已确认' : '未确认',
      alarm.handlerName || '待分配',
    ]);
    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
        )
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // ===== 导出全部告警 =====
  const handleExportAll = () => {
    if (filteredAlarms.length === 0) {
      message.warning('暂无可导出的数据');
      return;
    }
    message.loading({ content: '正在生成CSV文件...', key: 'export' });
    setTimeout(() => {
      exportToCSV(filteredAlarms, '告警历史_全部');
      message.success({ content: `已导出 ${filteredAlarms.length} 条记录`, key: 'export' });
    }, 500);
  };

  // ===== 批量导出选中行 =====
  const handleExportSelected = () => {
    const selected = filteredAlarms.filter((a) => selectedRowKeys.includes(a.id));
    if (selected.length === 0) {
      message.warning('请先选择要导出的记录');
      return;
    }
    exportToCSV(selected, '告警历史_批量');
    message.success(`已导出 ${selected.length} 条记录`);
  };

  // ===== 查看告警详情 =====
  const handleViewDetail = (alarm: ExtendedAlarmItem) => {
    setDetailModal({ open: true, alarm });
  };

  // ===== 导出单条告警 =====
  const handleExportSingle = (alarm: ExtendedAlarmItem) => {
    exportToCSV([alarm], `告警_${alarm.id}`);
    message.success('已导出');
  };

  // ===== 表格列定义 =====
  const tableColumns = [
    {
      title: '序号',
      key: 'index',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: '告警级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      align: 'center' as const,
      render: (level: AlarmLevel) => (
        <Tag color={LEVEL_COLORS[level]} style={{ margin: 0, padding: '2px 10px' }}>
          {LEVEL_LABELS[level]}
        </Tag>
      ),
    },
    {
      title: '告警类型',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (type: AlarmType) => (
        <span style={{ color: TYPE_COLORS[type] }}>{TYPE_LABELS[type]}</span>
      ),
    },
    {
      title: '所属机房',
      dataIndex: 'stationName',
      key: 'stationName',
      width: 180,
      ellipsis: true,
    },
    {
      title: '频道',
      dataIndex: 'channelName',
      key: 'channelName',
      width: 180,
      ellipsis: true,
    },
    {
      title: '告警标题',
      dataIndex: 'title',
      key: 'title',
      width: 160,
      ellipsis: true,
    },
    {
      title: '发生时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 170,
      sorter: (a: ExtendedAlarmItem, b: ExtendedAlarmItem) => a.timestamp - b.timestamp,
      render: (ts: number) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '首次时间',
      dataIndex: 'firstTimestamp',
      key: 'firstTimestamp',
      width: 170,
      render: (ts: number) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '重复次数',
      dataIndex: 'count',
      key: 'count',
      width: 90,
      align: 'center' as const,
      sorter: (a: ExtendedAlarmItem, b: ExtendedAlarmItem) => a.count - b.count,
      render: (count: number) => (
        <span style={{ color: count > 3 ? '#ff4d4f' : 'inherit', fontWeight: count > 3 ? 600 : 400 }}>
          {count} 次
        </span>
      ),
    },
    {
      title: '确认状态',
      dataIndex: 'ack',
      key: 'ack',
      width: 100,
      align: 'center' as const,
      render: (ack: boolean) =>
        ack ? (
          <Space size={4}>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span style={{ color: '#52c41a' }}>已确认</span>
          </Space>
        ) : (
          <Space size={4}>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span style={{ color: '#ff4d4f' }}>未确认</span>
          </Space>
        ),
    },
    {
      title: '处理人',
      dataIndex: 'handlerName',
      key: 'handlerName',
      width: 100,
      render: (name?: string) => name || <span style={{ color: 'rgba(255,255,255,0.3)' }}>待分配</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      fixed: 'right' as const,
      render: (_: unknown, record: ExtendedAlarmItem) => (
        <Space size={4}>
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
              style={{ padding: '0 4px' }}
            >
              详情
            </Button>
          </Tooltip>
          <Tooltip title="导出该条">
            <Button
              type="link"
              size="small"
              icon={<ExportOutlined />}
              onClick={() => handleExportSingle(record)}
              style={{ padding: '0 4px' }}
            >
              导出
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ===== Tab2：统计分析数据 =====

  // 4个统计卡片
  const stats = useMemo(() => {
    const total = filteredAlarms.length;
    const acked = filteredAlarms.filter((a) => a.ack).length;
    const unacked = total - acked;
    // 计算时间范围（默认30天）
    const minTime = Math.min(...filteredAlarms.map((a) => a.timestamp));
    const maxTime = Math.max(...filteredAlarms.map((a) => a.timestamp));
    const days = Math.max(1, Math.ceil((maxTime - minTime) / (24 * 60 * 60 * 1000)));
    const dailyAvg = Math.round((total / days) * 10) / 10;
    return { total, acked, unacked, dailyAvg };
  }, [filteredAlarms]);

  // 近30天告警数量趋势折线图
  const trendLineOption = useMemo(() => {
    const now = dayjs();
    const days = 30;
    const dateLabels: string[] = [];
    const counts: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = now.subtract(i, 'day');
      const dateStart = date.startOf('day').valueOf();
      const dateEnd = date.endOf('day').valueOf();
      dateLabels.push(date.format('MM-DD'));
      counts.push(
        filteredAlarms.filter((a) => a.timestamp >= dateStart && a.timestamp <= dateEnd).length,
      );
    }
    return {
      backgroundColor: 'transparent',
      grid: { left: '3%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0];
          return `${p.name}<br/>告警数量：<b>${p.value}</b> 条`;
        },
      },
      xAxis: {
        type: 'category',
        data: dateLabels,
        boundaryGap: false,
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(255,255,255,0.5)' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [
        {
          type: 'line',
          data: counts,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#1677ff' },
          lineStyle: { color: '#1677ff', width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(22,119,255,0.35)' },
                { offset: 1, color: 'rgba(22,119,255,0.02)' },
              ],
            },
          },
        },
      ],
    };
  }, [filteredAlarms]);

  // 告警类型占比饼图
  const typePieOption = useMemo(() => {
    const typeCount: Record<string, number> = {};
    filteredAlarms.forEach((a) => {
      typeCount[a.type] = (typeCount[a.type] || 0) + 1;
    });
    const pieData = Object.entries(typeCount).map(([type, value]) => ({
      name: TYPE_LABELS[type as AlarmType] || type,
      value,
      itemStyle: { color: TYPE_COLORS[type as AlarmType] || '#1677ff' },
    }));
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}<br/>数量：<b>${p.value}</b>（${p.percent}%）`,
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#0f172a', borderWidth: 2 },
          label: {
            show: false,
          },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#fff' },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0,0,0,0.5)',
            },
          },
          data: pieData,
        },
      ],
    };
  }, [filteredAlarms]);

  // 各机房告警数量TOP10横向柱状图
  const stationBarOption = useMemo(() => {
    const stationCount: Record<string, number> = {};
    filteredAlarms.forEach((a) => {
      stationCount[a.stationName] = (stationCount[a.stationName] || 0) + 1;
    });
    const sorted = Object.entries(stationCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reverse();
    return {
      backgroundColor: 'transparent',
      grid: { left: '3%', right: '6%', bottom: '3%', top: '3%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = params[0];
          return `${p.name}<br/>告警数量：<b>${p.value}</b> 条`;
        },
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(255,255,255,0.5)' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map(([name]) => name),
        axisLabel: {
          color: 'rgba(255,255,255,0.65)',
          fontSize: 11,
          width: 140,
          overflow: 'truncate',
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      series: [
        {
          type: 'bar',
          data: sorted.map(([, count], idx) => ({
            value: count,
            itemStyle: {
              color:
                idx >= sorted.length - 3
                  ? '#ff4d4f'
                  : idx >= sorted.length - 6
                  ? '#faad14'
                  : '#1890ff',
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: '55%',
          label: {
            show: true,
            position: 'right',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 11,
          },
        },
      ],
    };
  }, [filteredAlarms]);

  // ===== 机房选择下拉选项 =====
  const stationOptions = useMemo(() => {
    return Object.values(stations)
      .sort((a, b) => a.city.localeCompare(b.city))
      .map((s) => ({
        label: `${s.city} · ${s.name}`,
        value: s.id,
      }));
  }, [stations]);

  return (
    <div style={{ padding: 16 }}>
      {/* ========== 顶部工具栏 ========== */}
      <Card
        styles={{ body: { padding: '16px 16px 0' } }}
        style={{ borderRadius: 8, marginBottom: 16 }}
        title={
          <Space size={8}>
            <FileTextOutlined style={{ color: '#1677ff' }} />
            <span>告警历史查询</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportAll}
              disabled={filteredAlarms.length === 0}
            >
              导出全部CSV（{filteredAlarms.length}）
            </Button>
          </Space>
        }
      >
        {/* ========== 筛选条件表单 ========== */}
        <Form<FilterFormValues>
          form={form}
          layout="horizontal"
          onFinish={handleSearch}
          initialValues={{
            timeRange: [dayjs().subtract(7, 'day'), dayjs()],
          }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} lg={8} xl={6}>
              <Form.Item
                label="时间范围"
                name="timeRange"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                style={{ marginBottom: 16 }}
              >
                <DatePicker.RangePicker
                  style={{ width: '100%' }}
                  showTime
                  format="YYYY-MM-DD"
                  placeholder={['开始日期', '结束日期']}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} lg={8} xl={5}>
              <Form.Item
                label="告警级别"
                name="levels"
                labelCol={{ span: 7 }}
                wrapperCol={{ span: 17 }}
                style={{ marginBottom: 16 }}
              >
                <Select
                  mode="multiple"
                  placeholder="全部级别"
                  allowClear
                  options={Object.entries(LEVEL_LABELS).map(([value, label]) => ({
                    label: (
                      <Space size={4}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: LEVEL_COLORS[value as AlarmLevel],
                          }}
                        />
                        {label}
                      </Space>
                    ),
                    value,
                  }))}
                  maxTagCount="responsive"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} lg={8} xl={5}>
              <Form.Item
                label="告警类型"
                name="types"
                labelCol={{ span: 7 }}
                wrapperCol={{ span: 17 }}
                style={{ marginBottom: 16 }}
              >
                <Select
                  mode="multiple"
                  placeholder="全部类型"
                  allowClear
                  options={Object.entries(TYPE_LABELS).map(([value, label]) => ({
                    label,
                    value,
                  }))}
                  maxTagCount="responsive"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} lg={8} xl={5}>
              <Form.Item
                label="机房名称"
                name="stationId"
                labelCol={{ span: 7 }}
                wrapperCol={{ span: 17 }}
                style={{ marginBottom: 16 }}
              >
                <Select
                  showSearch
                  placeholder="搜索机房"
                  allowClear
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  options={stationOptions}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={24} lg={24} xl={3}>
              <Form.Item style={{ marginBottom: 16 }}>
                <Space>
                  <Input
                    placeholder="关键词搜索..."
                    prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                    style={{ width: 180 }}
                    value={form.getFieldValue('keyword')}
                    onChange={(e) => form.setFieldValue('keyword', e.target.value)}
                  />
                  <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                    查询
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* ========== Tab切换区 ========== */}
      <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 8 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarStyle={{ padding: '0 16px', margin: 0 }}
          items={[
            {
              key: 'table',
              label: (
                <Space size={6}>
                  <FileTextOutlined />
                  告警表格
                  <Tag color="blue">{filteredAlarms.length}</Tag>
                </Space>
              ),
              children: (
                <div style={{ padding: '0 16px 16px' }}>
                  {/* 批量操作工具栏 */}
                  {selectedRowKeys.length > 0 && (
                    <div
                      style={{
                        padding: '10px 16px',
                        background: 'rgba(22,119,255,0.08)',
                        borderRadius: 6,
                        marginBottom: 12,
                        border: '1px solid rgba(22,119,255,0.2)',
                      }}
                    >
                      <Space size={16}>
                        <span style={{ color: '#1677ff' }}>
                          已选择 <b>{selectedRowKeys.length}</b> 条记录
                        </span>
                        <Button
                          type="primary"
                          size="small"
                          icon={<ExportOutlined />}
                          onClick={handleExportSelected}
                        >
                          批量导出
                        </Button>
                        <Button
                          size="small"
                          onClick={() => setSelectedRowKeys([])}
                        >
                          取消选择
                        </Button>
                      </Space>
                    </div>
                  )}
                  {/* 告警表格 */}
                  <Table
                    dataSource={filteredAlarms}
                    columns={tableColumns}
                    rowKey="id"
                    pagination={{
                      pageSize: 50,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 条记录`,
                      pageSizeOptions: ['50', '100', '200'],
                    }}
                    scroll={{ x: 1500, y: 600 }}
                    rowSelection={{
                      selectedRowKeys,
                      onChange: setSelectedRowKeys,
                      preserveSelectedRowKeys: true,
                    }}
                    locale={{
                      emptyText: <Empty description="未找到匹配的告警记录" />,
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'stats',
              label: (
                <Space size={6}>
                  <ExclamationCircleOutlined />
                  统计分析
                </Space>
              ),
              children: (
                <div style={{ padding: 16 }}>
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    {/* 4个统计卡片 */}
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12} md={6}>
                        <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 6 }}>
                          <Statistic
                            title={<span style={{ color: 'rgba(255,255,255,0.55)' }}>总告警数</span>}
                            value={stats.total}
                            valueStyle={{ color: '#1677ff', fontSize: 26, fontWeight: 600 }}
                            prefix={<ExclamationCircleOutlined />}
                            suffix="条"
                          />
                        </Card>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 6 }}>
                          <Statistic
                            title={<span style={{ color: 'rgba(255,255,255,0.55)' }}>已确认</span>}
                            value={stats.acked}
                            valueStyle={{ color: '#52c41a', fontSize: 26, fontWeight: 600 }}
                            prefix={<CheckCircleOutlined />}
                            suffix="条"
                          />
                        </Card>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 6 }}>
                          <Statistic
                            title={<span style={{ color: 'rgba(255,255,255,0.55)' }}>未确认</span>}
                            value={stats.unacked}
                            valueStyle={{ color: '#ff4d4f', fontSize: 26, fontWeight: 600 }}
                            prefix={<ExclamationCircleOutlined />}
                            suffix="条"
                          />
                        </Card>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 6 }}>
                          <Statistic
                            title={<span style={{ color: 'rgba(255,255,255,0.55)' }}>日均告警数</span>}
                            value={stats.dailyAvg}
                            valueStyle={{ color: '#722ed1', fontSize: 26, fontWeight: 600 }}
                            suffix="条/天"
                          />
                        </Card>
                      </Col>
                    </Row>

                    {/* 图表1：近30天告警趋势折线图 */}
                    <Card title="近30天告警数量趋势" style={{ borderRadius: 6 }}>
                      <div style={{ height: 280 }}>
                        <ReactECharts option={trendLineOption} style={{ height: '100%', width: '100%' }} />
                      </div>
                    </Card>

                    {/* 图表2+3：两列并排 */}
                    <Row gutter={[16, 16]}>
                      <Col xs={24} lg={11}>
                        <Card title="告警类型占比" style={{ borderRadius: 6 }}>
                          <div style={{ height: 320 }}>
                            {filteredAlarms.length > 0 ? (
                              <ReactECharts option={typePieOption} style={{ height: '100%', width: '100%' }} />
                            ) : (
                              <Empty description="暂无数据" style={{ paddingTop: 80 }} />
                            )}
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} lg={13}>
                        <Card title="各机房告警数量 TOP10" style={{ borderRadius: 6 }}>
                          <div style={{ height: 320 }}>
                            {filteredAlarms.length > 0 ? (
                              <ReactECharts option={stationBarOption} style={{ height: '100%', width: '100%' }} />
                            ) : (
                              <Empty description="暂无数据" style={{ paddingTop: 80 }} />
                            )}
                          </div>
                        </Card>
                      </Col>
                    </Row>
                  </Space>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* ========== 告警详情弹窗 ========== */}
      <Modal
        open={detailModal.open}
        title="告警详情"
        onCancel={() => setDetailModal({ open: false, alarm: null })}
        footer={
          detailModal.alarm ? (
            <Space>
              <Button
                icon={<ExportOutlined />}
                onClick={() => {
                  if (detailModal.alarm) handleExportSingle(detailModal.alarm);
                }}
              >
                导出
              </Button>
              <Button type="primary" onClick={() => setDetailModal({ open: false, alarm: null })}>
                关闭
              </Button>
            </Space>
          ) : null
        }
        width={720}
      >
        {detailModal.alarm && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="告警ID" span={2}>
              {detailModal.alarm.id}
            </Descriptions.Item>
            <Descriptions.Item label="告警级别">
              <Tag color={LEVEL_COLORS[detailModal.alarm.level]}>{LEVEL_LABELS[detailModal.alarm.level]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="告警类型">
              <span style={{ color: TYPE_COLORS[detailModal.alarm.type] }}>
                {TYPE_LABELS[detailModal.alarm.type]}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="所属机房">{detailModal.alarm.stationName}</Descriptions.Item>
            <Descriptions.Item label="频道">{detailModal.alarm.channelName}</Descriptions.Item>
            <Descriptions.Item label="告警标题" span={2}>
              {detailModal.alarm.title}
            </Descriptions.Item>
            <Descriptions.Item label="告警内容" span={2}>
              {detailModal.alarm.content}
            </Descriptions.Item>
            <Descriptions.Item label="发生时间">
              {dayjs(detailModal.alarm.timestamp).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="首次时间">
              {dayjs(detailModal.alarm.firstTimestamp).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="重复次数">
              <span style={{ color: detailModal.alarm.count > 3 ? '#ff4d4f' : 'inherit' }}>
                {detailModal.alarm.count} 次
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="确认状态">
              {detailModal.alarm.ack ? (
                <Tag color="success">已确认</Tag>
              ) : (
                <Tag color="error">未确认</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="处理人" span={2}>
              {detailModal.alarm.handlerName || '待分配'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AlarmHistory;
