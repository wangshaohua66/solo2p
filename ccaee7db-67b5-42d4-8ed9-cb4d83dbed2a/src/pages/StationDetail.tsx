import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Breadcrumb,
  Button,
  Space,
  Statistic,
  Tag,
  Avatar,
  Timeline,
  Table,
  Typography,
  Empty,
  Tooltip,
  message,
  Modal,
  Descriptions,
} from 'antd';
import {
  ArrowLeftOutlined,
  PhoneOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  UserOutlined,
  DesktopOutlined,
  ThunderboltFilled,
  VideoCameraOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  AlertOutlined,
  CaretRightOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useParams, useNavigate } from 'react-router-dom';
import { useMonitorStore } from '@/stores/monitorStore';
import type { StationData, ChannelData, AlarmItem, AlarmLevel, SignalStatus } from '@/types';

const { Paragraph } = Typography;

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

// 信号状态颜色映射
const SIGNAL_STATUS_COLORS: Record<SignalStatus, string> = {
  good: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
};

// 信号状态中文名称
const SIGNAL_STATUS_LABELS: Record<SignalStatus, string> = {
  good: '正常',
  warning: '警告',
  error: '异常',
};

// 拓扑设备节点类型
interface TopoDevice {
  id: string;
  name: string;
  type: 'switch' | 'encoder' | 'modulator' | 'transmitter';
  x: number;
  y: number;
  status: 'online' | 'offline' | 'warning';
}

// 拓扑连线类型
interface TopoLink {
  from: string;
  to: string;
  status: 'normal' | 'error';
}

// 机房详情页面组件
const StationDetail: React.FC = () => {
  // 获取路由参数
  const { stationId } = useParams<{ stationId: string }>();
  const navigate = useNavigate();

  // 从Store获取数据
  const { stations, channels, alarms, initializeMockData } = useMonitorStore();

  // 告警时间线加载条数控制
  const [timelineLimit, setTimelineLimit] = useState(20);

  // 拓扑设备详情弹窗
  const [topoDeviceModal, setTopoDeviceModal] = useState<{
    open: boolean;
    device: TopoDevice | null;
  }>({ open: false, device: null });

  // 确保Mock数据已初始化
  useEffect(() => {
    if (Object.keys(stations).length === 0) {
      initializeMockData();
    }
  }, [stations, initializeMockData]);

  // ===== 获取当前机房数据 =====
  const station: StationData | null = useMemo(() => {
    return stationId ? stations[stationId] || null : null;
  }, [stationId, stations]);

  // ===== 获取该机房的所有频道 =====
  const stationChannels: ChannelData[] = useMemo(() => {
    if (!station) return [];
    return Object.values(channels).filter((c) => c.stationId === station.id);
  }, [station, channels]);

  // ===== 获取该机房最近24小时的告警 =====
  const stationAlarms24h: AlarmItem[] = useMemo(() => {
    if (!station) return [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return alarms
      .filter((a) => a.stationId === station.id && a.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [station, alarms]);

  // ===== 用于时间线展示的告警（可加载更多） =====
  const displayAlarms = useMemo(() => {
    return stationAlarms24h.slice(0, timelineLimit);
  }, [stationAlarms24h, timelineLimit]);

  // ===== 计算24h告警数量 =====
  const alarms24hCount = stationAlarms24h.length;

  // ===== 实时指标仪表盘配置（4个仪表盘） =====
  const gaugesOption = useMemo(() => {
    // 模拟4个指标的随机值（基于机房信号状态动态调整）
    const avgScore = stationChannels.length > 0
      ? Math.round(stationChannels.reduce((s, c) => s + c.signalScore, 0) / stationChannels.length)
      : 85;
    const signalLevel = station?.online ? (55 + Math.random() * 20) : 0; // dBmV
    const mer = station?.online ? (28 + Math.random() * 10) : 0; // dB
    const bitrate = stationChannels.length > 0
      ? stationChannels.reduce((s, c) => s + c.bitrate, 0) / stationChannels.length
      : 8; // Mbps
    const temperature = 22 + Math.random() * 12; // °C

    return {
      backgroundColor: 'transparent',
      grid: { top: 0, left: 0, right: 0, bottom: 0 },
      series: [
        // 仪表盘1：信号电平
        {
          type: 'gauge',
          center: ['12.5%', '55%'],
          radius: '75%',
          min: 0,
          max: 100,
          startAngle: 210,
          endAngle: -30,
          splitNumber: 5,
          progress: { show: true, width: 10, itemStyle: { color: '#1677ff' } },
          axisLine: { lineStyle: { width: 10, color: [[1, 'rgba(255,255,255,0.08)']] } },
          axisTick: { show: false },
          splitLine: { distance: -14, length: 8, lineStyle: { color: 'rgba(255,255,255,0.3)', width: 2 } },
          axisLabel: { distance: -30, color: 'rgba(255,255,255,0.4)', fontSize: 9 },
          pointer: { length: '60%', width: 3, itemStyle: { color: '#1677ff' } },
          anchor: { show: true, size: 10, itemStyle: { color: '#1677ff', borderColor: '#fff', borderWidth: 1 } },
          title: { show: true, offsetCenter: [0, '82%'], color: 'rgba(255,255,255,0.6)', fontSize: 11 },
          detail: { valueAnimation: true, offsetCenter: [0, '40%'], fontSize: 18, fontWeight: 'bold', color: '#1677ff', formatter: (v: number) => `${v.toFixed(0)} dBmV` },
          data: [{ value: signalLevel, name: '信号电平' }],
        },
        // 仪表盘2：MER/BER
        {
          type: 'gauge',
          center: ['37.5%', '55%'],
          radius: '75%',
          min: 0,
          max: 40,
          startAngle: 210,
          endAngle: -30,
          splitNumber: 4,
          progress: { show: true, width: 10, itemStyle: { color: '#52c41a' } },
          axisLine: { lineStyle: { width: 10, color: [[1, 'rgba(255,255,255,0.08)']] } },
          axisTick: { show: false },
          splitLine: { distance: -14, length: 8, lineStyle: { color: 'rgba(255,255,255,0.3)', width: 2 } },
          axisLabel: { distance: -30, color: 'rgba(255,255,255,0.4)', fontSize: 9 },
          pointer: { length: '60%', width: 3, itemStyle: { color: '#52c41a' } },
          anchor: { show: true, size: 10, itemStyle: { color: '#52c41a', borderColor: '#fff', borderWidth: 1 } },
          title: { show: true, offsetCenter: [0, '82%'], color: 'rgba(255,255,255,0.6)', fontSize: 11 },
          detail: { valueAnimation: true, offsetCenter: [0, '40%'], fontSize: 18, fontWeight: 'bold', color: '#52c41a', formatter: (v: number) => `${v.toFixed(1)} dB` },
          data: [{ value: mer, name: 'MER值' }],
        },
        // 仪表盘3：码率
        {
          type: 'gauge',
          center: ['62.5%', '55%'],
          radius: '75%',
          min: 0,
          max: 20,
          startAngle: 210,
          endAngle: -30,
          splitNumber: 4,
          progress: { show: true, width: 10, itemStyle: { color: '#722ed1' } },
          axisLine: { lineStyle: { width: 10, color: [[1, 'rgba(255,255,255,0.08)']] } },
          axisTick: { show: false },
          splitLine: { distance: -14, length: 8, lineStyle: { color: 'rgba(255,255,255,0.3)', width: 2 } },
          axisLabel: { distance: -30, color: 'rgba(255,255,255,0.4)', fontSize: 9 },
          pointer: { length: '60%', width: 3, itemStyle: { color: '#722ed1' } },
          anchor: { show: true, size: 10, itemStyle: { color: '#722ed1', borderColor: '#fff', borderWidth: 1 } },
          title: { show: true, offsetCenter: [0, '82%'], color: 'rgba(255,255,255,0.6)', fontSize: 11 },
          detail: { valueAnimation: true, offsetCenter: [0, '40%'], fontSize: 18, fontWeight: 'bold', color: '#722ed1', formatter: (v: number) => `${v.toFixed(1)} Mbps` },
          data: [{ value: bitrate, name: '平均码率' }],
        },
        // 仪表盘4：温度
        {
          type: 'gauge',
          center: ['87.5%', '55%'],
          radius: '75%',
          min: 10,
          max: 50,
          startAngle: 210,
          endAngle: -30,
          splitNumber: 4,
          progress: {
            show: true,
            width: 10,
            itemStyle: {
              color: temperature > 35 ? '#ff4d4f' : temperature > 30 ? '#faad14' : '#fa8c16',
            },
          },
          axisLine: { lineStyle: { width: 10, color: [[1, 'rgba(255,255,255,0.08)']] } },
          axisTick: { show: false },
          splitLine: { distance: -14, length: 8, lineStyle: { color: 'rgba(255,255,255,0.3)', width: 2 } },
          axisLabel: { distance: -30, color: 'rgba(255,255,255,0.4)', fontSize: 9 },
          pointer: {
            length: '60%',
            width: 3,
            itemStyle: { color: temperature > 35 ? '#ff4d4f' : '#fa8c16' },
          },
          anchor: {
            show: true,
            size: 10,
            itemStyle: {
              color: temperature > 35 ? '#ff4d4f' : '#fa8c16',
              borderColor: '#fff',
              borderWidth: 1,
            },
          },
          title: { show: true, offsetCenter: [0, '82%'], color: 'rgba(255,255,255,0.6)', fontSize: 11 },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '40%'],
            fontSize: 18,
            fontWeight: 'bold',
            color: temperature > 35 ? '#ff4d4f' : '#fa8c16',
            formatter: (v: number) => `${v.toFixed(1)} °C`,
          },
          data: [{ value: temperature, name: '机房温度' }],
        },
      ],
    };
  }, [station, stationChannels]);

  // ===== 拓扑图设备和连线数据 =====
  const topoData = useMemo(() => {
    const hasAlarm = stationAlarms24h.some((a) => a.level === 'urgent');
    const devices: TopoDevice[] = [
      { id: 'sw', name: '核心交换机', type: 'switch', x: 250, y: 50, status: station?.online ? 'online' : 'offline' },
      { id: 'enc1', name: '编码器#1', type: 'encoder', x: 100, y: 140, status: 'online' },
      { id: 'enc2', name: '编码器#2', type: 'encoder', x: 400, y: 140, status: hasAlarm ? 'warning' : 'online' },
      { id: 'mod', name: '调制器', type: 'modulator', x: 250, y: 230, status: hasAlarm && Math.random() > 0.5 ? 'warning' : 'online' },
      { id: 'tx', name: '光发射机', type: 'transmitter', x: 250, y: 320, status: station?.online ? 'online' : 'offline' },
    ];
    const links: TopoLink[] = [
      { from: 'sw', to: 'enc1', status: 'normal' },
      { from: 'sw', to: 'enc2', status: hasAlarm ? 'error' : 'normal' },
      { from: 'enc1', to: 'mod', status: 'normal' },
      { from: 'enc2', to: 'mod', status: 'normal' },
      { from: 'mod', to: 'tx', status: 'normal' },
    ];
    return { devices, links };
  }, [station, stationAlarms24h]);

  // ===== 关联频道表格列定义 =====
  const channelColumns = [
    {
      title: '频道名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, rec: ChannelData) => (
        <Space size={6}>
          <VideoCameraOutlined style={{ color: '#1677ff' }} />
          <span style={{ color: 'rgba(255,255,255,0.85)' }}>{name}</span>
        </Space>
      ),
    },
    {
      title: '当前节目',
      dataIndex: 'programName',
      key: 'programName',
      ellipsis: true,
      render: (p: string) => <span style={{ color: 'rgba(255,255,255,0.7)' }}>{p}</span>,
    },
    {
      title: '信号状态',
      dataIndex: 'signalStatus',
      key: 'signalStatus',
      width: 100,
      align: 'center' as const,
      render: (s: SignalStatus) => (
        <Tag color={SIGNAL_STATUS_COLORS[s]} style={{ margin: 0 }}>
          {SIGNAL_STATUS_LABELS[s]}
        </Tag>
      ),
    },
    {
      title: '信号评分',
      dataIndex: 'signalScore',
      key: 'signalScore',
      width: 100,
      align: 'center' as const,
      render: (score: number) => (
        <span
          style={{
            color:
              score >= 80 ? '#52c41a' : score >= 60 ? '#faad14' : '#ff4d4f',
            fontWeight: 600,
          }}
        >
          {score} 分
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      align: 'center' as const,
      render: (_: unknown, record: ChannelData) => (
        <Space size={4}>
          <Tooltip title="放大监控">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                navigate('/monitor');
                message.success(`已切换到监控墙：${record.name}`);
              }}
              style={{ padding: '0 4px' }}
            >
              监控
            </Button>
          </Tooltip>
          <Tooltip title="告警详情">
            <Button
              type="link"
              size="small"
              icon={<AlertOutlined />}
              onClick={() => navigate('/alarm-center')}
              style={{ padding: '0 4px' }}
            >
              告警
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ===== 一键呼叫值班电话 =====
  const handleCallDuty = () => {
    if (station?.phone) {
      message.success(`正在呼叫值班电话：${station.phone}`);
      Modal.info({
        title: '一键呼叫',
        content: (
          <Space direction="vertical">
            <Space>
              <PhoneOutlined style={{ color: '#52c41a' }} />
              <span>正在拨打：</span>
              <a href={`tel:${station.phone}`} style={{ fontSize: 18, fontWeight: 600 }}>
                {station.phone}
              </a>
            </Space>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              联系人：{station.contact}（{station.name}）
            </Paragraph>
          </Space>
        ),
        okText: '确认拨打',
      });
    }
  };

  // ===== 启动应急预案 =====
  const handleEmergencyPlan = () => {
    Modal.confirm({
      title: '启动应急预案',
      icon: <WarningOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p>即将为 <b>{station?.name}</b> 启动应急预案：</p>
          <ul style={{ paddingLeft: 20, color: 'rgba(0,0,0,0.65)' }}>
            <li>自动切换至备用信号源</li>
            <li>通知所有值班人员（短信+电话）</li>
            <li>记录应急处理流程日志</li>
            <li>锁定相关设备操作权限</li>
          </ul>
        </div>
      ),
      okText: '确认启动',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        message.loading({ content: '正在启动应急预案...', key: 'emergency' });
        setTimeout(() => {
          message.success({ content: '应急预案已启动，相关人员已通知', key: 'emergency' });
        }, 1500);
      },
    });
  };

  // ===== 生成机房报告 =====
  const handleGenerateReport = () => {
    message.loading({ content: '正在生成机房报告...', key: 'report' });
    setTimeout(() => {
      message.success({ content: `《${station?.name}运行报告》已生成，点击下载`, key: 'report' });
    }, 1200);
  };

  // ===== 点击拓扑设备 =====
  const handleDeviceClick = (device: TopoDevice) => {
    setTopoDeviceModal({ open: true, device });
  };

  // ===== 找不到机房时显示Empty =====
  if (!station) {
    return (
      <div style={{ padding: 16 }}>
        <Card style={{ borderRadius: 8 }}>
          <Empty
            description={
              <Space direction="vertical" size={8}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                  未找到机房：{stationId || '未知ID'}
                </span>
                <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
                  返回总览
                </Button>
              </Space>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {/* ========== 顶部面包屑 + 返回按钮 ========== */}
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space size={12}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard')}
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            返回总览
          </Button>
          <Breadcrumb
            separator=">"
            items={[
              { title: <a onClick={() => navigate('/dashboard')}>监控总览</a> },
              { title: '机房列表' },
              { title: station.name },
            ]}
          />
        </Space>

        {/* ========== 顶部机房信息卡片 ========== */}
        <Card
          styles={{ body: { padding: 20 } }}
          style={{ borderRadius: 8 }}
        >
          <Row gutter={[24, 16]} align="middle" justify="space-between">
            {/* 左侧：机房基本信息 */}
            <Col xs={24} md={12}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space size={16} align="center">
                  {/* 在线状态大图标 */}
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: station.online
                        ? 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)'
                        : 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: station.online
                        ? '0 4px 16px rgba(82,196,26,0.35)'
                        : '0 4px 16px rgba(255,77,79,0.35)',
                    }}
                  >
                    <EnvironmentOutlined style={{ fontSize: 28, color: '#fff' }} />
                  </div>
                  <Space direction="vertical" size={4}>
                    <Space size={10} align="center">
                      <h2 style={{ margin: 0, color: '#fff', fontSize: 22, fontWeight: 600 }}>
                        {station.name}
                      </h2>
                      <Tag
                        icon={station.online ? <CaretRightOutlined /> : <WarningOutlined />}
                        color={station.online ? 'success' : 'error'}
                        style={{ padding: '2px 10px' }}
                      >
                        {station.online ? '在线运行' : '离线告警'}
                      </Tag>
                    </Space>
                    <Space size={16} wrap>
                      <Space size={4}>
                        <EnvironmentOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />
                        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                          {station.city} · {station.address}
                        </span>
                      </Space>
                    </Space>
                    <Space size={20}>
                      <Space size={6}>
                        <Avatar size={22} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                          {station.contact}
                        </span>
                      </Space>
                      <Space size={6}>
                        <PhoneOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />
                        <a href={`tel:${station.phone}`} style={{ color: '#52c41a', fontSize: 13 }}>
                          {station.phone}
                        </a>
                      </Space>
                    </Space>
                  </Space>
                </Space>
              </Space>
            </Col>

            {/* 中间：4个小统计 */}
            <Col xs={24} md={7}>
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: 'rgba(22,119,255,0.08)',
                      border: '1px solid rgba(22,119,255,0.15)',
                    }}
                  >
                    <Statistic
                      title={
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                          设备总数
                        </span>
                      }
                      value={station.deviceCount}
                      valueStyle={{ color: '#1677ff', fontSize: 20, fontWeight: 600 }}
                      prefix={<DesktopOutlined style={{ fontSize: 14 }} />}
                      suffix="台"
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: 'rgba(114,46,209,0.08)',
                      border: '1px solid rgba(114,46,209,0.15)',
                    }}
                  >
                    <Statistic
                      title={
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                          频道总数
                        </span>
                      }
                      value={station.channelCount}
                      valueStyle={{ color: '#722ed1', fontSize: 20, fontWeight: 600 }}
                      prefix={<ThunderboltFilled style={{ fontSize: 14 }} />}
                      suffix="路"
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: station.alarmCount > 0
                        ? 'rgba(255,77,79,0.08)'
                        : 'rgba(82,196,26,0.08)',
                      border: station.alarmCount > 0
                        ? '1px solid rgba(255,77,79,0.15)'
                        : '1px solid rgba(82,196,26,0.15)',
                    }}
                  >
                    <Statistic
                      title={
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                          当前告警
                        </span>
                      }
                      value={station.alarmCount}
                      valueStyle={{
                        color: station.alarmCount > 0 ? '#ff4d4f' : '#52c41a',
                        fontSize: 20,
                        fontWeight: 600,
                      }}
                      prefix={<WarningOutlined style={{ fontSize: 14 }} />}
                      suffix="条"
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: 'rgba(250,173,20,0.08)',
                      border: '1px solid rgba(250,173,20,0.15)',
                    }}
                  >
                    <Statistic
                      title={
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                          24h告警
                        </span>
                      }
                      value={alarms24hCount}
                      valueStyle={{ color: '#faad14', fontSize: 20, fontWeight: 600 }}
                      prefix={<ClockCircleOutlined style={{ fontSize: 14 }} />}
                      suffix="条"
                    />
                  </div>
                </Col>
              </Row>
            </Col>

            {/* 右侧：操作区按钮 */}
            <Col xs={24} md={5}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Button
                  type="primary"
                  block
                  size="large"
                  icon={<PhoneOutlined />}
                  onClick={handleCallDuty}
                  style={{
                    height: 42,
                    borderRadius: 6,
                    background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                    border: 'none',
                  }}
                >
                  一键呼叫值班电话
                </Button>
                <Button
                  block
                  size="large"
                  danger
                  icon={<ThunderboltOutlined />}
                  onClick={handleEmergencyPlan}
                  style={{ height: 42, borderRadius: 6 }}
                >
                  启动应急预案
                </Button>
                <Button
                  block
                  size="large"
                  icon={<FileTextOutlined />}
                  onClick={handleGenerateReport}
                  style={{ height: 42, borderRadius: 6 }}
                >
                  生成机房报告
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* ========== 下方 2x2 网格布局（4张卡片） ========== */}
        <Row gutter={[16, 16]}>
          {/* 卡片1：实时指标仪表盘 */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space size={8}>
                  <DashboardOutlined style={{ color: '#1677ff' }} />
                  <span>实时指标监控</span>
                </Space>
              }
              extra={
                <Tooltip title="刷新指标">
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => message.success('指标已刷新')}
                    style={{ color: 'rgba(255,255,255,0.4)', padding: 0 }}
                  />
                </Tooltip>
              }
              styles={{ body: { padding: 8 } }}
              style={{ borderRadius: 8, height: '100%' }}
            >
              <div style={{ height: 260 }}>
                <ReactECharts
                  option={gaugesOption}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            </Card>
          </Col>

          {/* 卡片2：机房拓扑示意 */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space size={8}>
                  <DesktopOutlined style={{ color: '#722ed1' }} />
                  <span>机房设备拓扑</span>
                </Space>
              }
              styles={{ body: { padding: 12 } }}
              style={{ borderRadius: 8, height: '100%' }}
            >
              <div style={{ width: '100%', height: 260, position: 'relative' }}>
                <svg
                  viewBox="0 0 500 370"
                  style={{ width: '100%', height: '100%' }}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* 定义渐变和滤镜 */}
                  <defs>
                    <linearGradient id="grad-green" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#52c41a" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#73d13d" stopOpacity="0.9" />
                    </linearGradient>
                    <linearGradient id="grad-red" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff4d4f" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#ff7875" stopOpacity="0.9" />
                    </linearGradient>
                    <linearGradient id="grad-yellow" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#faad14" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#ffc53d" stopOpacity="0.9" />
                    </linearGradient>
                    <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* 连线 */}
                  {topoData.links.map((link) => {
                    const from = topoData.devices.find((d) => d.id === link.from)!;
                    const to = topoData.devices.find((d) => d.id === link.to)!;
                    const color = link.status === 'normal' ? '#52c41a' : '#ff4d4f';
                    const midX = (from.x + to.x) / 2;
                    const midY = (from.y + to.y) / 2;
                    return (
                      <g key={`${link.from}-${link.to}`}>
                        <line
                          x1={from.x}
                          y1={from.y + 22}
                          x2={to.x}
                          y2={to.y - 22}
                          stroke={color}
                          strokeWidth={2}
                          strokeOpacity={0.6}
                          strokeDasharray={link.status === 'error' ? '6,4' : 'none'}
                          style={
                            link.status === 'error'
                              ? {
                                  animation: 'dash 0.8s linear infinite',
                                  transformOrigin: `${midX}px ${midY}px`,
                                }
                              : {}
                          }
                        />
                        {/* 连线中间的方向箭头圆点 */}
                        <circle cx={midX} cy={midY} r={3} fill={color}>
                          {link.status === 'error' && (
                            <animate
                              attributeName="r"
                              values="3;5;3"
                              dur="1.2s"
                              repeatCount="indefinite"
                            />
                          )}
                        </circle>
                      </g>
                    );
                  })}

                  {/* 设备节点 */}
                  {topoData.devices.map((device) => {
                    const fillId =
                      device.status === 'online'
                        ? 'url(#grad-green)'
                        : device.status === 'warning'
                        ? 'url(#grad-yellow)'
                        : 'url(#grad-red)';
                    const filterId =
                      device.status === 'online' ? 'url(#glow-green)' : '';
                    return (
                      <g
                        key={device.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleDeviceClick(device)}
                      >
                        {/* 异常闪烁动画 */}
                        {device.status !== 'online' && (
                          <circle
                            cx={device.x}
                            cy={device.y}
                            r={32}
                            fill="none"
                            stroke={device.status === 'warning' ? '#faad14' : '#ff4d4f'}
                            strokeWidth={2}
                            opacity={0.5}
                          >
                            <animate
                              attributeName="r"
                              values="28;40;28"
                              dur="1.8s"
                              repeatCount="indefinite"
                            />
                            <animate
                              attributeName="opacity"
                              values="0.6;0;0.6"
                              dur="1.8s"
                              repeatCount="indefinite"
                            />
                          </circle>
                        )}
                        {/* 设备矩形框 */}
                        <rect
                          x={device.x - 52}
                          y={device.y - 22}
                          width={104}
                          height={44}
                          rx={8}
                          fill={fillId}
                          filter={filterId}
                          stroke="rgba(255,255,255,0.25)"
                          strokeWidth={1}
                        />
                        {/* 设备图标 */}
                        <text
                          x={device.x}
                          y={device.y - 2}
                          textAnchor="middle"
                          fontSize={14}
                          fill="#fff"
                          fontWeight="bold"
                        >
                          {device.type === 'switch' && '⬢'}
                          {device.type === 'encoder' && '▶'}
                          {device.type === 'modulator' && '◆'}
                          {device.type === 'transmitter' && '▲'}
                        </text>
                        {/* 设备名称 */}
                        <text
                          x={device.x}
                          y={device.y + 13}
                          textAnchor="middle"
                          fontSize={11}
                          fill="#fff"
                        >
                          {device.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                {/* 图例 */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 8,
                    display: 'flex',
                    gap: 12,
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  <Space size={4}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#52c41a' }} />
                    正常
                  </Space>
                  <Space size={4}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#faad14' }} />
                    告警
                  </Space>
                  <Space size={4}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#ff4d4f' }} />
                    离线
                  </Space>
                </div>
              </div>
            </Card>
          </Col>

          {/* 卡片3：最近24h告警时间线 */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space size={8}>
                  <ClockCircleOutlined style={{ color: '#faad14' }} />
                  <span>最近24h告警时间线</span>
                  <Tag color="orange">{stationAlarms24h.length}条</Tag>
                </Space>
              }
              styles={{ body: { padding: '16px 20px' } }}
              style={{ borderRadius: 8, height: '100%' }}
            >
              {stationAlarms24h.length === 0 ? (
                <Empty description="24小时内无告警，运行状态良好" style={{ padding: '40px 0' }} />
              ) : (
                <div>
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    <Timeline
                      mode="left"
                      items={displayAlarms.map((alarm) => ({
                        color: LEVEL_COLORS[alarm.level],
                        dot: (
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: LEVEL_COLORS[alarm.level],
                              boxShadow: `0 0 8px ${LEVEL_COLORS[alarm.level]}`,
                            }}
                          />
                        ),
                        label: (
                          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                            {dayjs(alarm.timestamp).format('MM-DD HH:mm:ss')}
                          </span>
                        ),
                        children: (
                          <div style={{ paddingBottom: 4 }}>
                            <Space size={6} align="center" wrap>
                              <Tag
                                color={LEVEL_COLORS[alarm.level]}
                                style={{ margin: 0, padding: '0 6px', fontSize: 10, height: 18, lineHeight: '16px' }}
                              >
                                {LEVEL_LABELS[alarm.level]}
                              </Tag>
                              <span
                                style={{
                                  color: 'rgba(255,255,255,0.85)',
                                  fontSize: 13,
                                }}
                              >
                                {alarm.title}
                              </span>
                            </Space>
                            <div
                              style={{
                                color: 'rgba(255,255,255,0.45)',
                                fontSize: 11,
                                marginTop: 2,
                              }}
                            >
                              {alarm.channelName} · 重复 {alarm.count} 次
                              {alarm.ack && <Tag color="success" style={{ marginLeft: 6, fontSize: 10 }}>已确认</Tag>}
                            </div>
                          </div>
                        ),
                      }))}
                    />
                  </div>
                  {timelineLimit < stationAlarms24h.length && (
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => setTimelineLimit((prev) => prev + 10)}
                      >
                        加载更多（剩余 {stationAlarms24h.length - timelineLimit} 条）
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </Col>

          {/* 卡片4：关联频道列表 */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space size={8}>
                  <VideoCameraOutlined style={{ color: '#52c41a' }} />
                  <span>关联频道列表</span>
                  <Tag color="green">{stationChannels.length}路</Tag>
                </Space>
              }
              styles={{ body: { padding: 4 } }}
              style={{ borderRadius: 8, height: '100%' }}
            >
              <Table
                dataSource={stationChannels}
                columns={channelColumns}
                rowKey="id"
                size="small"
                pagination={stationChannels.length > 8 ? { pageSize: 8, size: 'small' } : false}
                scroll={{ y: 220 }}
                locale={{ emptyText: <Empty description="该机房暂无频道" style={{ padding: '30px 0' }} /> }}
              />
            </Card>
          </Col>
        </Row>
      </Space>

      {/* ========== 拓扑设备详情弹窗 ========== */}
      <Modal
        open={topoDeviceModal.open}
        title={
          <Space size={8}>
            <DesktopOutlined style={{ color: '#1677ff' }} />
            <span>设备详情：{topoDeviceModal.device?.name}</span>
            <Tag
              color={
                topoDeviceModal.device?.status === 'online'
                  ? 'success'
                  : topoDeviceModal.device?.status === 'warning'
                  ? 'warning'
                  : 'error'
              }
            >
              {topoDeviceModal.device?.status === 'online'
                ? '在线'
                : topoDeviceModal.device?.status === 'warning'
                ? '告警'
                : '离线'}
            </Tag>
          </Space>
        }
        onCancel={() => setTopoDeviceModal({ open: false, device: null })}
        footer={
          <Space>
            <Button type="primary" onClick={() => setTopoDeviceModal({ open: false, device: null })}>
              关闭
            </Button>
          </Space>
        }
      >
        {topoDeviceModal.device && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="设备名称">{topoDeviceModal.device.name}</Descriptions.Item>
            <Descriptions.Item label="设备类型">
              {topoDeviceModal.device.type === 'switch' && '核心交换机'}
              {topoDeviceModal.device.type === 'encoder' && '视频编码器'}
              {topoDeviceModal.device.type === 'modulator' && '信号调制器'}
              {topoDeviceModal.device.type === 'transmitter' && '光发射机'}
            </Descriptions.Item>
            <Descriptions.Item label="所属机房">{station?.name}</Descriptions.Item>
            <Descriptions.Item label="运行状态">
              <Tag
                color={
                  topoDeviceModal.device.status === 'online'
                    ? 'success'
                    : topoDeviceModal.device.status === 'warning'
                    ? 'warning'
                    : 'error'
                }
              >
                {topoDeviceModal.device.status === 'online'
                  ? '正常运行'
                  : topoDeviceModal.device.status === 'warning'
                  ? '存在告警'
                  : '设备离线'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="运行时长">
              {Math.floor(Math.random() * 60) + 30} 天 {Math.floor(Math.random() * 24)} 小时
            </Descriptions.Item>
            <Descriptions.Item label="固件版本">
              v1.{Math.floor(Math.random() * 9) + 2}.{Math.floor(Math.random() * 10)}
            </Descriptions.Item>
            <Descriptions.Item label="最后巡检">
              {dayjs().subtract(Math.floor(Math.random() * 8) + 1, 'hour').format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default StationDetail;
