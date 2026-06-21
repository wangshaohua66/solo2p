import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Tag,
  Space,
  List,
  Button,
  Avatar,
  Tooltip,
  Empty,
} from 'antd';
import {
  DatabaseOutlined,
  WarningOutlined,
  RiseOutlined,
  FallOutlined,
  SafetyCertificateOutlined,
  ArrowRightOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  UserOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigate } from 'react-router-dom';
import { useMonitorStore } from '@/stores/monitorStore';
import { useDutyStore } from '@/stores/dutyStore';
import MonitorPanel from '@/components/MonitorPanel';
import type { AlarmItem, AlarmLevel } from '@/types';

// 注册dayjs相对时间插件
dayjs.extend(relativeTime);

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

// 班次对应的中文名称
const SHIFT_LABELS = {
  morning: '早班',
  afternoon: '中班',
  night: '夜班',
};

// 监控总览页面组件
const Dashboard: React.FC = () => {
  // 导航钩子
  const navigate = useNavigate();

  // 从监控Store获取数据
  const { summary, alarms, stations, channels, channelOrder } = useMonitorStore();
  const { currentShift, currentUser, createHandover } = useDutyStore();

  // 告警列表滚动动画容器引用
  const alarmListRef = useRef<HTMLDivElement>(null);
  // 马灯式滚动动画偏移量
  const [scrollOffset, setScrollOffset] = useState(0);

  // ===== 计算各级别告警数量 =====
  const levelCounts = useMemo(() => {
    const unacked = alarms.filter((a) => !a.ack);
    return {
      urgent: unacked.filter((a) => a.level === 'urgent').length,
      important: unacked.filter((a) => a.level === 'important').length,
      general: unacked.filter((a) => a.level === 'general').length,
      total: unacked.length,
    };
  }, [alarms]);

  // ===== 计算机房在线率 =====
  const onlineRate = useMemo(() => {
    return summary.totalStations > 0
      ? Math.round((summary.onlineStations / summary.totalStations) * 100)
      : 0;
  }, [summary.totalStations, summary.onlineStations]);

  // ===== 模拟昨日告警数量（用于同比计算） =====
  const yesterdayAlarms = useMemo(() => {
    const base = summary.todayAlarms;
    const variance = Math.floor(base * 0.3);
    return Math.max(1, base + (Math.random() > 0.5 ? variance : -variance));
  }, [summary.todayAlarms]);

  // ===== 今日告警同比变化 =====
  const alarmChange = useMemo(() => {
    if (yesterdayAlarms === 0) return { ratio: 0, isUp: true };
    const diff = summary.todayAlarms - yesterdayAlarms;
    const ratio = Math.round(Math.abs((diff / yesterdayAlarms) * 100));
    return { ratio, isUp: diff >= 0 };
  }, [summary.todayAlarms, yesterdayAlarms]);

  // ===== 各地市告警数量统计 =====
  const cityAlarmData = useMemo(() => {
    const cityMap: Record<string, number> = {};
    Object.values(stations).forEach((s) => {
      if (!cityMap[s.city]) cityMap[s.city] = 0;
    });
    alarms.forEach((a) => {
      const station = stations[a.stationId];
      if (station) {
        cityMap[station.city] = (cityMap[station.city] || 0) + 1;
      }
    });
    const entries = Object.entries(cityMap).sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 16);
  }, [stations, alarms]);

  // ===== 各地市告警分布柱状图配置 =====
  const cityBarOption = useMemo(() => {
    const top5Cities = cityAlarmData.slice(0, 5).map(([name]) => name);
    return {
      backgroundColor: 'transparent',
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '10%',
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const data = params[0];
          return `${data.name}<br/>告警数量：<b>${data.value}</b> 条`;
        },
      },
      xAxis: {
        type: 'category',
        data: cityAlarmData.map(([name]) => name),
        axisLabel: {
          color: 'rgba(255,255,255,0.65)',
          rotate: 30,
          fontSize: 11,
          interval: 0,
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
      },
      yAxis: {
        type: 'value',
        name: '告警数',
        nameTextStyle: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
        axisLabel: { color: 'rgba(255,255,255,0.65)' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      series: [
        {
          type: 'bar',
          data: cityAlarmData.map(([name, count]) => ({
            value: count,
            itemStyle: {
              color: top5Cities.includes(name) ? '#ff4d4f' : '#1890ff',
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barWidth: '55%',
          label: {
            show: true,
            position: 'top',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 11,
          },
        },
      ],
    };
  }, [cityAlarmData]);

  // ===== 平均信号质量仪表盘配置 =====
  const signalGaugeOption = useMemo(() => {
    const score = summary.avgSignalScore;
    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          radius: '95%',
          center: ['50%', '58%'],
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          splitNumber: 10,
          progress: {
            show: true,
            width: 18,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: '#ff4d4f' },
                  { offset: 0.4, color: '#faad14' },
                  { offset: 0.75, color: '#52c41a' },
                  { offset: 1, color: '#52c41a' },
                ],
              },
            },
          },
          axisLine: {
            lineStyle: {
              width: 18,
              color: [[1, 'rgba(255,255,255,0.08)']],
            },
          },
          axisTick: {
            distance: -24,
            length: 6,
            lineStyle: { color: 'rgba(255,255,255,0.2)', width: 1 },
          },
          splitLine: {
            distance: -28,
            length: 12,
            lineStyle: { color: 'rgba(255,255,255,0.3)', width: 2 },
          },
          axisLabel: {
            distance: -40,
            color: 'rgba(255,255,255,0.45)',
            fontSize: 10,
          },
          pointer: {
            show: true,
            length: '60%',
            width: 4,
            itemStyle: { color: '#ffffff' },
          },
          anchor: {
            show: true,
            size: 14,
            itemStyle: { color: '#ffffff', borderWidth: 2, borderColor: '#1677ff' },
          },
          title: {
            show: false,
          },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '15%'],
            fontSize: 28,
            fontWeight: 'bold',
            color:
              score >= 80 ? '#52c41a' : score >= 60 ? '#faad14' : '#ff4d4f',
            formatter: '{value}分',
          },
          data: [{ value: score }],
        },
      ],
    };
  }, [summary.avgSignalScore]);

  // ===== 最近20条告警（用于右侧滚动列表） =====
  const recentAlarms = useMemo(() => {
    return [...alarms].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  }, [alarms]);

  // ===== 马灯式滚动动画 =====
  useEffect(() => {
    if (recentAlarms.length <= 5) return;
    const timer = setInterval(() => {
      setScrollOffset((prev) => {
        const next = prev + 1;
        const maxOffset = recentAlarms.length * 56;
        return next >= maxOffset ? 0 : next;
      });
    }, 60);
    return () => clearInterval(timer);
  }, [recentAlarms.length]);

  // ===== 跳转到告警中心 =====
  const goToAlarmCenter = () => navigate('/alarm-center');

  // ===== 跳转到监控墙 =====
  const goToMonitor = () => navigate('/monitor');

  // ===== 跳转机房详情 =====
  const goToStationDetail = (stationId: string) => navigate(`/station/${stationId}`);

  // ===== 处理交接班 =====
  const handleHandover = () => {
    try {
      createHandover();
      navigate('/duty');
    } catch (e) {
      console.error('创建交接班失败', e);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      {/* ========== 顶部统计卡片行（4个） ========== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* 卡片1：在线机房数 */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            styles={{ body: { padding: 16 } }}
            style={{ borderRadius: 8 }}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Statistic
                title={
                  <Space size={6}>
                    <DatabaseOutlined style={{ color: '#1677ff' }} />
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 400 }}>
                      在线机房数
                    </span>
                  </Space>
                }
                value={summary.onlineStations}
                suffix={`/ ${summary.totalStations}`}
                valueStyle={{ color: '#52c41a', fontSize: 30, fontWeight: 600 }}
              />
              <Progress
                percent={onlineRate}
                showInfo
                format={() => `${onlineRate}% 在线率`}
                size="small"
                strokeColor={{
                  '0%': '#52c41a',
                  '100%': '#95de64',
                }}
                trailColor="rgba(255,255,255,0.08)"
              />
            </Space>
          </Card>
        </Col>

        {/* 卡片2：当前告警数（分三级Tag堆叠） */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            styles={{ body: { padding: 16 } }}
            style={{ borderRadius: 8 }}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div onClick={goToAlarmCenter} style={{ cursor: 'pointer' }}>
                <Statistic
                  title={
                    <Space size={6}>
                      <WarningOutlined style={{ color: '#ff4d4f' }} />
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 400 }}>
                        当前告警数
                      </span>
                    </Space>
                  }
                  value={levelCounts.total}
                  valueStyle={{
                    color: levelCounts.total > 0 ? '#ff4d4f' : '#52c41a',
                    fontSize: 30,
                    fontWeight: 600,
                  }}
                />
              </div>
              {/* 三级Tag堆叠显示 */}
              <Space size={8} wrap>
                <Tag color={LEVEL_COLORS.urgent} style={{ margin: 0, padding: '2px 10px', borderRadius: 4 }}>
                  <b>{levelCounts.urgent}</b> 紧急
                </Tag>
                <Tag color={LEVEL_COLORS.important} style={{ margin: 0, padding: '2px 10px', borderRadius: 4 }}>
                  <b>{levelCounts.important}</b> 重要
                </Tag>
                <Tag color={LEVEL_COLORS.general} style={{ margin: 0, padding: '2px 10px', borderRadius: 4 }}>
                  <b>{levelCounts.general}</b> 一般
                </Tag>
              </Space>
            </Space>
          </Card>
        </Col>

        {/* 卡片3：今日告警总量（含同比箭头） */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            styles={{ body: { padding: 16 } }}
            style={{ borderRadius: 8 }}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Statistic
                title={
                  <Space size={6}>
                    <ClockCircleOutlined style={{ color: '#722ed1' }} />
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 400 }}>
                      今日告警总量
                    </span>
                  </Space>
                }
                value={summary.todayAlarms}
                valueStyle={{ color: '#722ed1', fontSize: 30, fontWeight: 600 }}
                prefix={
                  alarmChange.isUp ? (
                    <RiseOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                  ) : (
                    <FallOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                  )
                }
              />
              <Space size={4}>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                  较昨日
                </span>
                <span
                  style={{
                    color: alarmChange.isUp ? '#ff4d4f' : '#52c41a',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {alarmChange.isUp ? '↑' : '↓'} {alarmChange.ratio}%
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                  （昨日 {yesterdayAlarms} 条）
                </span>
              </Space>
            </Space>
          </Card>
        </Col>

        {/* 卡片4：平均信号质量评分（ECharts仪表盘） */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            styles={{ body: { padding: '8px 16px 4px' } }}
            style={{ borderRadius: 8 }}
          >
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              <Space size={6} style={{ marginBottom: -8 }}>
                <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
                <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 400 }}>
                  平均信号质量评分
                </span>
              </Space>
              <div style={{ height: 130 }}>
                <ReactECharts
                  option={signalGaugeOption}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* ========== 主内容左右分栏（左70% + 右30%） ========== */}
      <Row gutter={[16, 16]}>
        {/* ===== 左侧内容区（70%） ===== */}
        <Col xs={24} xl={17}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* 精简版MonitorPanel */}
            <Card
              title={
                <Space size={8}>
                  <span>监控墙 · 核心频道</span>
                  <Tag color="blue">2×2</Tag>
                </Space>
              }
              extra={
                <Button
                  type="link"
                  icon={<ArrowRightOutlined />}
                  onClick={goToMonitor}
                  style={{ padding: 0 }}
                >
                  查看全部
                </Button>
              }
              styles={{ body: { padding: 12 } }}
              style={{ borderRadius: 8 }}
            >
              {/* 临时切换为2x2布局，展示最关键的4个频道 */}
              <MiniMonitorPanel />
            </Card>

            {/* 各地市告警分布柱状图 */}
            <Card
              title="各地市告警分布"
              extra={<span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>共{cityAlarmData.length}个地市</span>}
              styles={{ body: { padding: 12 } }}
              style={{ borderRadius: 8 }}
            >
              <div style={{ height: 300 }}>
                {cityAlarmData.length > 0 ? (
                  <ReactECharts
                    option={cityBarOption}
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'canvas' }}
                  />
                ) : (
                  <Empty description="暂无告警数据" style={{ paddingTop: 80 }} />
                )}
              </div>
            </Card>
          </Space>
        </Col>

        {/* ===== 右侧内容区（30%） ===== */}
        <Col xs={24} xl={7}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* 实时告警滚动列表 */}
            <Card
              title={
                <Space size={8}>
                  <WarningOutlined style={{ color: '#ff4d4f' }} />
                  <span>实时告警</span>
                  <Tag color="red" style={{ marginLeft: 4 }}>
                    {recentAlarms.length}
                  </Tag>
                </Space>
              }
              extra={
                <Button
                  type="link"
                  icon={<ArrowRightOutlined />}
                  onClick={goToAlarmCenter}
                  style={{ padding: 0 }}
                >
                  告警中心
                </Button>
              }
              styles={{ body: { padding: 0 } }}
              style={{ borderRadius: 8, overflow: 'hidden' }}
            >
              {/* 告警列表容器（马灯式滚动） */}
              <div
                ref={alarmListRef}
                style={{
                  height: 336,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {recentAlarms.length === 0 ? (
                  <Empty description="暂无告警" style={{ paddingTop: 100 }} />
                ) : (
                  <div
                    style={{
                      transform: `translateY(-${scrollOffset}px)`,
                      transition: 'transform 0.06s linear',
                    }}
                  >
                    <List
                      dataSource={[...recentAlarms, ...recentAlarms]}
                      renderItem={(item: AlarmItem, index: number) => {
                        const realIndex = index % recentAlarms.length;
                        const alarm = recentAlarms[realIndex];
                        return (
                          <List.Item
                            key={`${alarm.id}-${index}`}
                            onClick={goToAlarmCenter}
                            style={{
                              height: 56,
                              padding: '0 16px',
                              cursor: 'pointer',
                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                              transition: 'background 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background =
                                'rgba(255,255,255,0.04)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background =
                                'transparent';
                            }}
                          >
                            <Space size={10} style={{ width: '100%' }}>
                              {/* 告警级别色块 */}
                              <div
                                style={{
                                  width: 4,
                                  height: 32,
                                  borderRadius: 2,
                                  background: LEVEL_COLORS[alarm.level],
                                  flexShrink: 0,
                                }}
                              />
                              <Space direction="vertical" size={2} style={{ flex: 1, minWidth: 0 }}>
                                <Space size={6} align="center">
                                  <Tag
                                    color={LEVEL_COLORS[alarm.level]}
                                    style={{
                                      margin: 0,
                                      padding: '0 6px',
                                      fontSize: 11,
                                      lineHeight: '18px',
                                      height: 18,
                                    }}
                                  >
                                    {LEVEL_LABELS[alarm.level]}
                                  </Tag>
                                  <span
                                    style={{
                                      color: 'rgba(255,255,255,0.85)',
                                      fontSize: 13,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      maxWidth: 160,
                                    }}
                                    title={alarm.title}
                                  >
                                    {alarm.title}
                                  </span>
                                </Space>
                                <Space size={8}>
                                  <span
                                    style={{
                                      color: 'rgba(255,255,255,0.35)',
                                      fontSize: 11,
                                    }}
                                  >
                                    {alarm.stationName}
                                  </span>
                                  <Tooltip title={dayjs(alarm.timestamp).format('YYYY-MM-DD HH:mm:ss')}>
                                    <span
                                      style={{
                                        color: 'rgba(255,255,255,0.35)',
                                        fontSize: 11,
                                      }}
                                    >
                                      {dayjs(alarm.timestamp).fromNow()}
                                    </span>
                                  </Tooltip>
                                </Space>
                              </Space>
                            </Space>
                          </List.Item>
                        );
                      }}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* 当前班次信息卡片 */}
            <Card
              title={
                <Space size={8}>
                  <ClockCircleOutlined style={{ color: '#1677ff' }} />
                  <span>当前班次</span>
                </Space>
              }
              styles={{ body: { padding: 16 } }}
              style={{ borderRadius: 8 }}
            >
              {currentShift ? (
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  {/* 值班人信息 */}
                  <Space size={12} align="center">
                    <Avatar
                      size={48}
                      icon={<UserOutlined />}
                      src={currentUser.avatar}
                      style={{
                        background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
                      }}
                    />
                    <Space direction="vertical" size={2}>
                      <Space size={8} align="center">
                        <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
                          {currentUser.name}
                        </span>
                        <Tag color="processing" style={{ margin: 0 }}>
                          {SHIFT_LABELS[currentShift.shift]}
                        </Tag>
                      </Space>
                      <Space size={6} align="center">
                        <PhoneOutlined style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }} />
                        <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                          {currentUser.phone}
                        </span>
                      </Space>
                    </Space>
                  </Space>

                  {/* 剩余时间进度条 */}
                  <div>
                    <Space style={{ width: '100%', marginBottom: 6, justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                        本班剩余时间
                      </span>
                      <span style={{ color: '#1677ff', fontSize: 13, fontWeight: 500 }}>
                        {currentShift.hoursRemaining} 小时
                      </span>
                    </Space>
                    <Progress
                      percent={Math.round(((8 - currentShift.hoursRemaining) / 8) * 100)}
                      showInfo={false}
                      size="small"
                      strokeColor={{
                        '0%': '#1677ff',
                        '100%': '#722ed1',
                      }}
                      trailColor="rgba(255,255,255,0.08)"
                    />
                  </div>

                  {/* 快速交接班按钮 */}
                  <Button
                    type="primary"
                    block
                    icon={<SwapOutlined />}
                    onClick={handleHandover}
                    style={{
                      height: 40,
                      borderRadius: 6,
                      background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
                      border: 'none',
                    }}
                  >
                    快速交接班
                  </Button>
                </Space>
              ) : (
                <Empty description="暂无班次信息" />
              )}
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

// ===== 内部组件：精简版监控面板（固定2x2布局） =====
const MiniMonitorPanel: React.FC = () => {
  const { channels, channelOrder, setLayout, layout, initializeMockData } = useMonitorStore();
  const navigate = useNavigate();

  // 保存原布局，挂载时临时切换到2x2，卸载时恢复
  const originalLayoutRef = useRef(layout);

  useEffect(() => {
    originalLayoutRef.current = layout;
    setLayout('2x2');
    return () => {
      setLayout(originalLayoutRef.current);
    };
  }, []);

  // 确保数据已初始化
  useEffect(() => {
    if (channelOrder.length === 0) {
      initializeMockData();
    }
  }, [channelOrder.length, initializeMockData]);

  // 取前4个频道用于2x2显示
  const miniChannels = useMemo(() => {
    return channelOrder
      .slice(0, 4)
      .map((id) => channels[id])
      .filter(Boolean);
  }, [channelOrder, channels]);

  // 信号状态颜色映射
  const statusColors = {
    good: '#52c41a',
    warning: '#faad14',
    error: '#ff4d4f',
  };

  const statusLabels = {
    good: '正常',
    warning: '警告',
    error: '异常',
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: 8,
        aspectRatio: '16/9',
      }}
    >
      {miniChannels.map((channel) =>
        channel ? (
          <div
            key={channel.id}
            onClick={() => navigate('/monitor')}
            style={{
              position: 'relative',
              borderRadius: 6,
              overflow: 'hidden',
              cursor: 'pointer',
              border: `1px solid ${statusColors[channel.signalStatus]}33`,
              background: 'rgba(0,0,0,0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
              (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${statusColors[channel.signalStatus]}33`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            {/* 缩略图背景 */}
            <img
              src={channel.thumbnail}
              alt={channel.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.75,
              }}
            />
            {/* 底部信息遮罩 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: '6px 10px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
              }}
            >
              <div
                style={{
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {channel.name}
              </div>
              <Space size={6} style={{ marginTop: 2 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: statusColors[channel.signalStatus],
                    boxShadow: `0 0 6px ${statusColors[channel.signalStatus]}`,
                  }}
                />
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>
                  {statusLabels[channel.signalStatus]} · {channel.signalScore}分
                </span>
              </Space>
            </div>
            {/* 状态角标 */}
            <Tag
              color={channel.signalStatus}
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                margin: 0,
                fontSize: 10,
                padding: '0 4px',
                height: 18,
                lineHeight: '16px',
              }}
            >
              {statusLabels[channel.signalStatus]}
            </Tag>
          </div>
        ) : (
          <div
            key="empty"
            style={{
              borderRadius: 6,
              border: '1px dashed rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.2)',
              fontSize: 12,
            }}
          >
            无信号
          </div>
        ),
      )}
      {/* 补足4格空位 */}
      {Array.from({ length: Math.max(0, 4 - miniChannels.length) }).map((_, i) => (
        <div
          key={`empty-${i}`}
          style={{
            borderRadius: 6,
            border: '1px dashed rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.2)',
            fontSize: 12,
          }}
        >
          无信号
        </div>
      ))}
    </div>
  );
};

export default Dashboard;
