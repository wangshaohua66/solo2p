import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Row,
  Col,
  Button,
  DatePicker,
  Select,
  Checkbox,
  Switch,
  Form,
  Tabs,
  Table,
  Card,
  Statistic,
  Row as AntRow,
  Col as AntCol,
  Space,
  Tag,
  message,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import dayjs, { Dayjs } from 'dayjs';
import { useMonitorStore } from '@/stores/monitorStore';
import {
  generateTrendData,
  calculateStats,
  exportToCSV,
} from '@/utils/dataAggregator';
import type { TrendMetric, TimeRange, StationData } from '@/types';

const { RangePicker } = DatePicker;

// 指标选项配置
const METRIC_OPTIONS = [
  { label: '信号质量评分', value: 'signal_score', color: '#1677ff', unit: '分' },
  { label: '码率波动', value: 'bitrate', color: '#52c41a', unit: 'Mbps' },
  { label: '丢包率', value: 'packet_loss', color: '#faad14', unit: '%' },
  { label: '告警频次', value: 'alarm_frequency', color: '#ff4d4f', unit: '次/小时' },
];

// 时间范围预设按钮
const TIME_PRESETS: { label: string; value: TimeRange }[] = [
  { label: '最近1小时', value: '1h' },
  { label: '最近6小时', value: '6h' },
  { label: '最近24小时', value: '24h' },
  { label: '最近7天', value: '7d' },
];

// 趋势数据点接口
interface TrendPoint {
  time: number;
  value: number;
  [key: string]: number;
}

// 统计数据接口
interface ValueStats {
  min: number;
  max: number;
  avg: number;
  p95: number;
  stdDev: number;
}

// 表格行数据接口
interface TableRowData {
  key: string;
  time: string;
  stationName: string;
  signalScore: string;
  bitrate: string;
  packetLoss: string;
  alarmFrequency: string;
}

const TrendChart: React.FC = () => {
  // 表单实例
  const [form] = Form.useForm();

  // ECharts 实例引用，用于导出PNG
  const chartRef = useRef<ReactECharts>(null);

  // 从 monitorStore 获取机房数据
  const stations = useMonitorStore((state) => state.stations);
  const stationList = useMemo<StationData[]>(
    () => Object.values(stations),
    [stations],
  );

  // 顶部筛选条件状态
  const [activeTimePreset, setActiveTimePreset] = useState<TimeRange>('24h');
  const [customTimeRange, setCustomTimeRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<TrendMetric[]>([
    'signal_score',
    'bitrate',
  ]);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [compareStationId, setCompareStationId] = useState<string | null>(null);

  // 当前Tab
  const [activeTab, setActiveTab] = useState<string>('chart');

  // 加载状态
  const [loading, setLoading] = useState<boolean>(false);

  // 趋势数据缓存
  const [trendData, setTrendData] = useState<{
    primary: Record<TrendMetric, TrendPoint[]>;
    compare?: Record<TrendMetric, TrendPoint[]>;
  }>({
    primary: {
      signal_score: [],
      bitrate: [],
      packet_loss: [],
      alarm_frequency: [],
    },
  });

  // 表格分页
  const [tablePage, setTablePage] = useState<number>(1);
  const [tablePageSize] = useState<number>(50);

  // 初始化：默认选中全部机房
  useEffect(() => {
    if (stationList.length > 0 && selectedStations.length === 0) {
      setSelectedStations(stationList.map((s) => s.id));
    }
  }, [stationList]);

  // 查询数据
  const fetchData = () => {
    setLoading(true);

    try {
      const metricsToFetch: TrendMetric[] =
        selectedMetrics.length > 0 ? selectedMetrics : ['signal_score'];
      const stationIds =
        selectedStations.length > 0 ? selectedStations : undefined;
      const timeRange =
        activeTimePreset === 'custom' && customTimeRange
          ? 'custom'
          : activeTimePreset;

      // 生成主机房数据
      const primaryData: Record<TrendMetric, TrendPoint[]> = {
        signal_score: [],
        bitrate: [],
        packet_loss: [],
        alarm_frequency: [],
      };

      metricsToFetch.forEach((metric) => {
        primaryData[metric] = generateTrendData(metric, timeRange, stationIds);
      });

      const result: {
        primary: Record<TrendMetric, TrendPoint[]>;
        compare?: Record<TrendMetric, TrendPoint[]>;
      } = { primary: primaryData };

      // 对比模式下生成对比机房数据
      if (compareMode && compareStationId) {
        const compareData: Record<TrendMetric, TrendPoint[]> = {
          signal_score: [],
          bitrate: [],
          packet_loss: [],
          alarm_frequency: [],
        };

        metricsToFetch.forEach((metric) => {
          compareData[metric] = generateTrendData(metric, timeRange, [
            compareStationId,
          ]);
        });

        result.compare = compareData;
      }

      setTrendData(result);
      message.success('数据加载成功');
    } catch (error) {
      console.error('加载趋势数据失败:', error);
      message.error('加载趋势数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载一次数据
  useEffect(() => {
    if (stationList.length > 0) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationList.length]);

  // 重置筛选条件
  const handleReset = () => {
    setActiveTimePreset('24h');
    setCustomTimeRange(null);
    setSelectedStations(stationList.map((s) => s.id));
    setSelectedMetrics(['signal_score', 'bitrate']);
    setCompareMode(false);
    setCompareStationId(null);
    form.resetFields();
    message.info('筛选条件已重置');
  };

  // 导出PNG图片
  const handleExportPNG = () => {
    if (!chartRef.current) {
      message.error('图表实例不存在');
      return;
    }

    try {
      const echartsInstance = chartRef.current.getEchartsInstance();
      const dataUrl = echartsInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `趋势分析_${dayjs().format('YYYYMMDD_HHmmss')}.png`;
      link.href = dataUrl;
      link.click();
      message.success('PNG导出成功');
    } catch (error) {
      console.error('导出PNG失败:', error);
      message.error('导出PNG失败');
    }
  };

  // 导出CSV
  const handleExportCSV = () => {
    try {
      const headers = [
        '时间',
        '机房',
        '信号评分(分)',
        '码率(Mbps)',
        '丢包率(%)',
        '告警频次(次/小时)',
      ];

      const rows: any[][] = [];
      const stationName =
        selectedStations.length === 1
          ? stations[selectedStations[0]]?.name || '全部机房'
          : '全部机房';

      // 使用信号评分数组的时间轴作为基准
      const baseData = trendData.primary.signal_score;
      const sampleRate = Math.max(1, Math.floor(baseData.length / 500));

      for (let i = 0; i < baseData.length; i += sampleRate) {
        const point = baseData[i];
        rows.push([
          dayjs(point.time).format('YYYY-MM-DD HH:mm:ss'),
          stationName,
          trendData.primary.signal_score[i]?.value ?? '',
          trendData.primary.bitrate[i]?.value ?? '',
          trendData.primary.packet_loss[i]?.value ?? '',
          trendData.primary.alarm_frequency[i]?.value ?? '',
        ]);
      }

      exportToCSV(
        headers,
        rows,
        `趋势数据导出_${dayjs().format('YYYYMMDD_HHmmss')}`,
      );
      message.success('CSV导出成功');
    } catch (error) {
      console.error('导出CSV失败:', error);
      message.error('导出CSV失败');
    }
  };

  // 计算各指标的统计数据（min/max/avg/p95）
  const metricsStats = useMemo(() => {
    const stats: Record<string, ValueStats> = {};
    METRIC_OPTIONS.forEach((opt) => {
      const values = trendData.primary[opt.value as TrendMetric]?.map(
        (p) => p.value,
      ) || [0];
      stats[opt.value] = calculateStats(values);
    });
    return stats;
  }, [trendData]);

  // 构建ECharts Option
  const chartOption = useMemo<EChartsOption>(() => {
    const metricsToShow: TrendMetric[] =
      selectedMetrics.length > 0 ? selectedMetrics : ['signal_score'];

    // 时间轴（以第一个选中指标为基准）
    const baseMetric = metricsToShow[0] as TrendMetric;
    const baseData = trendData.primary[baseMetric] || [];
    const xAxisData = baseData.map((p: TrendPoint) =>
      dayjs(p.time).format('MM-DD HH:mm'),
    );

    // 构建Series
    const series: any[] = [];
    const legendData: string[] = [];

    metricsToShow.forEach((metric: TrendMetric) => {
      const metricConfig = METRIC_OPTIONS.find((m) => m.value === metric)!;
      const isLeftAxis = metric === 'signal_score' || metric === 'packet_loss';
      const data =
        trendData.primary[metric]?.map((p: TrendPoint) => p.value) || [];

      legendData.push(metricConfig.label);
      series.push({
        name: metricConfig.label,
        type: 'line',
        yAxisIndex: isLeftAxis ? 0 : 1,
        data,
        smooth: true,
        large: true,
        sampling: 'lttb',
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        lineStyle: {
          width: 2,
          color: metricConfig.color,
        },
        itemStyle: {
          color: metricConfig.color,
        },
        areaStyle: {
          opacity: 0.05,
          color: metricConfig.color,
        },
      });

      // 对比模式下添加对比机房虚线
      if (compareMode && compareStationId && trendData.compare) {
        const compareData =
          trendData.compare[metric]?.map((p: TrendPoint) => p.value) || [];
        const compareStation = stations[compareStationId];
        legendData.push(`${metricConfig.label}(对比:${compareStation?.name || ''})`);
        series.push({
          name: `${metricConfig.label}(对比:${compareStation?.name || ''})`,
          type: 'line',
          yAxisIndex: isLeftAxis ? 0 : 1,
          data: compareData,
          smooth: true,
          large: true,
          sampling: 'lttb',
          symbol: 'circle',
          symbolSize: 4,
          showSymbol: false,
          lineStyle: {
            width: 2,
            type: 'dashed',
            color: metricConfig.color,
            opacity: 0.6,
          },
          itemStyle: {
            color: metricConfig.color,
            opacity: 0.6,
          },
        });
      }
    });

    return {
      color: METRIC_OPTIONS.map((m) => m.color),
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985',
          },
        },
      },
      legend: {
        data: legendData,
        top: 0,
        type: 'scroll',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true,
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
          bottom: 10,
          height: 20,
        },
      ],
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxisData,
        axisLabel: {
          rotate: 30,
          fontSize: 10,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: '评分/丢包率',
          position: 'left',
          axisLabel: {
            formatter: '{value}',
          },
          splitLine: {
            lineStyle: {
              type: 'dashed',
            },
          },
        },
        {
          type: 'value',
          name: 'Mbps/频次',
          position: 'right',
          axisLabel: {
            formatter: '{value}',
          },
          splitLine: {
            show: false,
          },
        },
      ],
      series,
    } as EChartsOption;
  }, [selectedMetrics, trendData, compareMode, compareStationId, stations]);

  // 构建表格数据（模拟服务端分页）
  const tableData = useMemo<TableRowData[]>(() => {
    const baseData = trendData.primary.signal_score;
    if (baseData.length === 0) return [];

    const stationName =
      selectedStations.length === 1
        ? stations[selectedStations[0]]?.name || '全部机房'
        : '全部机房';

    // 模拟全量数据，然后分页截取
    const allData: TableRowData[] = [];
    const sampleRate = Math.max(1, Math.floor(baseData.length / 1000));

    for (let i = 0; i < baseData.length; i += sampleRate) {
      allData.push({
        key: `row_${i}`,
        time: dayjs(baseData[i].time).format('YYYY-MM-DD HH:mm:ss'),
        stationName,
        signalScore:
          trendData.primary.signal_score[i]?.value?.toFixed(1) || '0',
        bitrate: trendData.primary.bitrate[i]?.value?.toFixed(3) || '0',
        packetLoss:
          trendData.primary.packet_loss[i]?.value?.toFixed(2) || '0',
        alarmFrequency:
          trendData.primary.alarm_frequency[i]?.value?.toFixed(1) || '0',
      });
    }

    const startIndex = (tablePage - 1) * tablePageSize;
    return allData.slice(startIndex, startIndex + tablePageSize);
  }, [trendData, selectedStations, stations, tablePage, tablePageSize]);

  // 表格总记录数（模拟）
  const tableTotal = useMemo(() => {
    const baseData = trendData.primary.signal_score;
    if (baseData.length === 0) return 0;
    const sampleRate = Math.max(1, Math.floor(baseData.length / 1000));
    return Math.ceil(baseData.length / sampleRate);
  }, [trendData]);

  // 表格列配置
  const tableColumns = [
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 180,
      sorter: (a: TableRowData, b: TableRowData) =>
        new Date(a.time).getTime() - new Date(b.time).getTime(),
    },
    {
      title: '机房',
      dataIndex: 'stationName',
      key: 'stationName',
      width: 200,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '信号评分',
      dataIndex: 'signalScore',
      key: 'signalScore',
      width: 100,
      render: (val: number) => {
        const num = Number(val);
        const color = num >= 85 ? 'green' : num >= 60 ? 'orange' : 'red';
        return <Tag color={color}>{val} 分</Tag>;
      },
    },
    {
      title: '码率(Mbps)',
      dataIndex: 'bitrate',
      key: 'bitrate',
      width: 120,
      render: (val: number) => <span>{val}</span>,
    },
    {
      title: '丢包率(%)',
      dataIndex: 'packetLoss',
      key: 'packetLoss',
      width: 110,
      render: (val: number) => {
        const num = Number(val);
        const color = num < 1 ? 'green' : num < 3 ? 'orange' : 'red';
        return <Tag color={color}>{val}%</Tag>;
      },
    },
    {
      title: '告警频次',
      dataIndex: 'alarmFrequency',
      key: 'alarmFrequency',
      width: 110,
      render: (val: number) => {
        const num = Number(val);
        const color = num < 5 ? 'green' : num < 10 ? 'orange' : 'red';
        return <Tag color={color}>{val} 次/h</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: 16, background: '#f5f5f5', minHeight: '100vh' }}>
      {/* 顶部筛选条件栏 */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title={<span style={{ fontSize: 14 }}>筛选条件</span>}
      >
        <Form form={form} layout="vertical">
          <Row gutter={[12, 8]} align="middle">
            {/* 时间范围预设按钮 */}
            <Col span={24}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
                  时间范围：
                </span>
                {TIME_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    size="small"
                    type={activeTimePreset === preset.value ? 'primary' : 'default'}
                    onClick={() => {
                      setActiveTimePreset(preset.value);
                      setCustomTimeRange(null);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
                <RangePicker
                  size="small"
                  showTime
                  value={customTimeRange}
                  onChange={(dates) => {
                    setCustomTimeRange(dates as [Dayjs, Dayjs]);
                    if (dates) setActiveTimePreset('custom');
                  }}
                  style={{ width: 340 }}
                />
              </div>
            </Col>

            {/* 机房多选 */}
            <Col xs={24} sm={24} md={12} lg={10} xl={8}>
              <Form.Item label="机房选择" style={{ marginBottom: 0 }}>
                <Select
                  mode="multiple"
                  size="small"
                  allowClear
                  showSearch
                  placeholder="选择机房（支持搜索）"
                  value={selectedStations}
                  onChange={setSelectedStations}
                  optionFilterProp="label"
                  maxTagCount={2}
                  maxTagTextLength={6}
                  options={stationList.map((s) => ({
                    label: s.name,
                    value: s.id,
                  }))}
                />
              </Form.Item>
            </Col>

            {/* 对比模式开关 + 对比机房选择 */}
            <Col xs={24} sm={24} md={12} lg={7} xl={6}>
              <Form.Item label="对比模式" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch
                    size="small"
                    checked={compareMode}
                    onChange={setCompareMode}
                  />
                  {compareMode && (
                    <Select
                      size="small"
                      style={{ flex: 1 }}
                      placeholder="选择对比机房"
                      value={compareStationId}
                      onChange={setCompareStationId}
                      showSearch
                      optionFilterProp="label"
                      options={stationList.map((s) => ({
                        label: s.name,
                        value: s.id,
                      }))}
                    />
                  )}
                </div>
              </Form.Item>
            </Col>

            {/* 指标多选 */}
            <Col xs={24} sm={24} md={24} lg={7} xl={6}>
              <Form.Item label="分析指标" style={{ marginBottom: 0 }}>
                <Checkbox.Group
                  value={selectedMetrics}
                  onChange={(vals) => setSelectedMetrics(vals as TrendMetric[])}
                  options={METRIC_OPTIONS.map((m) => ({
                    label: m.label,
                    value: m.value,
                  }))}
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
                />
              </Form.Item>
            </Col>

            {/* 操作按钮 */}
            <Col xs={24} sm={24} md={24} lg={0} xl={4} style={{ textAlign: 'right' }}>
              <Space size={6}>
                <Button
                  size="small"
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={fetchData}
                  loading={loading}
                >
                  查询
                </Button>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                >
                  重置
                </Button>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={handleExportPNG}
                  disabled={activeTab !== 'chart'}
                >
                  PNG
                </Button>
                <Button
                  size="small"
                  icon={<FileExcelOutlined />}
                  onClick={handleExportCSV}
                >
                  CSV
                </Button>
              </Space>
            </Col>
          </Row>

          {/* 小屏幕下的操作按钮行 */}
          <AntRow style={{ marginTop: 12 }} className="ant-layout-lg-hidden ant-layout-xl-hidden">
            <AntCol span={24} style={{ textAlign: 'right' }}>
              <Space size={6} wrap>
                <Button
                  size="small"
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={fetchData}
                  loading={loading}
                >
                  查询
                </Button>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                >
                  重置
                </Button>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={handleExportPNG}
                  disabled={activeTab !== 'chart'}
                >
                  PNG
                </Button>
                <Button
                  size="small"
                  icon={<FileExcelOutlined />}
                  onClick={handleExportCSV}
                >
                  CSV
                </Button>
              </Space>
            </AntCol>
          </AntRow>
        </Form>
      </Card>

      {/* 双Tab切换区域 */}
      <Card size="small" bodyStyle={{ padding: 0 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ margin: 0 }}
          items={[
            {
              key: 'chart',
              label: '📈 图表视图',
              children: (
                <div style={{ padding: 16 }}>
                  {/* ECharts 图表 */}
                  <div
                    style={{
                      background: '#fff',
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 16,
                    }}
                  >
                    <Spin spinning={loading}>
                      <ReactECharts
                        ref={chartRef}
                        option={chartOption}
                        style={{ height: 420, width: '100%' }}
                        notMerge
                        lazyUpdate
                      />
                    </Spin>
                  </div>

                  {/* 指标统计卡片 */}
                  <AntRow gutter={[12, 12]}>
                    {METRIC_OPTIONS.filter((m) =>
                      selectedMetrics.includes(m.value as TrendMetric),
                    ).map((metric) => {
                      const stats = metricsStats[metric.value] || {
                        min: 0,
                        max: 0,
                        avg: 0,
                        p95: 0,
                      };
                      return (
                        <AntCol xs={24} sm={12} md={12} lg={6} xl={6} key={metric.value}>
                          <Card
                            size="small"
                            style={{
                              borderTop: `3px solid ${metric.color}`,
                              height: '100%',
                            }}
                            title={
                              <span>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: metric.color,
                                    marginRight: 6,
                                  }}
                                />
                                {metric.label}
                              </span>
                            }
                          >
                            <AntRow gutter={[8, 8]}>
                              <AntCol span={12}>
                                <Statistic
                                  title="最小值"
                                  value={stats.min}
                                  suffix={metric.unit}
                                  valueStyle={{ fontSize: 14 }}
                                />
                              </AntCol>
                              <AntCol span={12}>
                                <Statistic
                                  title="最大值"
                                  value={stats.max}
                                  suffix={metric.unit}
                                  valueStyle={{ fontSize: 14, color: '#fa541c' }}
                                />
                              </AntCol>
                              <AntCol span={12}>
                                <Statistic
                                  title="平均值"
                                  value={stats.avg}
                                  suffix={metric.unit}
                                  valueStyle={{ fontSize: 14, color: '#1677ff' }}
                                />
                              </AntCol>
                              <AntCol span={12}>
                                <Statistic
                                  title="P95"
                                  value={stats.p95}
                                  suffix={metric.unit}
                                  valueStyle={{ fontSize: 14, color: '#722ed1' }}
                                />
                              </AntCol>
                            </AntRow>
                          </Card>
                        </AntCol>
                      );
                    })}
                  </AntRow>
                </div>
              ),
            },
            {
              key: 'table',
              label: '📋 表格视图',
              children: (
                <div style={{ padding: 16 }}>
                  <Table
                    size="small"
                    columns={tableColumns}
                    dataSource={tableData}
                    loading={loading}
                    pagination={{
                      current: tablePage,
                      pageSize: tablePageSize,
                      total: tableTotal,
                      showSizeChanger: false,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 条记录`,
                      onChange: (page) => setTablePage(page),
                    }}
                    scroll={{ x: 900 }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default TrendChart;
