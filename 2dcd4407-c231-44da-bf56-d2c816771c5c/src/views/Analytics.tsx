import { useState, useEffect } from 'react';
import { Card, Button, Space, Select, DatePicker, Row, Col, Statistic, Tabs, Table, Tag, message } from 'antd';
import { ReloadOutlined, DownloadOutlined, LineChartOutlined, BarChartOutlined, PieChartOutlined, CalendarOutlined, UserOutlined, DollarOutlined, RiseOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { generateMockAnalytics, generateMockSchedules } from '../utils/mockData';
import type { AnalyticsData } from '../types';
import { formatCurrency, formatLargeNumber, formatPercent } from '../utils/exportUtils';
import { exportToExcel } from '../utils/exportUtils';

const { RangePicker } = DatePicker;
const { Option } = Select;

const AnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'year' | 'quarter' | 'month'>('year');

  const currencyFormatter = (value: number | string) => formatCurrency(Number(value));
  const percentFormatter = (value: number | string) => formatPercent(Number(value));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setAnalytics(generateMockAnalytics());
      setLoading(false);
    };
    fetchData();
  }, [timeRange]);

  const handleExport = () => {
    if (analytics) {
      const exportData = [
        { '指标': '年度总客流', '数值': analytics.totalVisitors },
        { '指标': '年度总收入', '数值': analytics.totalRevenue },
        { '指标': '档期利用率', '数值': formatPercent(analytics.scheduleUtilization) },
        { '指标': '展位利用率', '数值': formatPercent(analytics.boothUtilization) },
      ];
      const columns = [
        { key: '指标', title: '指标' },
        { key: '数值', title: '数值' },
      ];
      exportToExcel(exportData, columns, '数据分析报表');
      message.success('导出成功');
    }
  };

  const visitorTrendOption = {
    tooltip: {
      trigger: 'axis',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: analytics?.visitorTrend.map(v => v.date.slice(5)) || [],
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '客流量',
        type: 'line',
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(22, 93, 255, 0.3)' },
              { offset: 1, color: 'rgba(22, 93, 255, 0.05)' },
            ],
          },
        },
        lineStyle: {
          color: '#165DFF',
          width: 2,
        },
        itemStyle: {
          color: '#165DFF',
        },
        data: analytics?.visitorTrend.map(v => v.count) || [],
      },
    ],
  };

  const revenueTrendOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0];
        return `${data.name}<br/>收入: ${formatCurrency(data.value)}`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: analytics?.revenueTrend.map(r => r.month) || [],
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => (value / 10000) + '万',
      },
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        barWidth: '60%',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#52c41a' },
              { offset: 1, color: '#95de64' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        data: analytics?.revenueTrend.map(r => r.amount) || [],
      },
    ],
  };

  const exhibitorDistOption = {
    tooltip: {
      trigger: 'item',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '参展商分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: false,
        },
        data: analytics?.exhibitorDistribution.map(e => ({
          value: e.count,
          name: e.type,
        })) || [],
      },
    ],
  };

  const visitorSourceOption = {
    tooltip: {
      trigger: 'item',
    },
    series: [
      {
        name: '访客来源',
        type: 'pie',
        radius: '60%',
        data: analytics?.visitorSource.map(v => ({
          value: v.count,
          name: v.source,
        })) || [],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  const scheduleUtilOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0];
        return `${data.name}<br/>利用率: ${formatPercent(data.value)}`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: analytics?.scheduleUtilizationByMonth.map(s => s.month) || [],
    },
    yAxis: {
      type: 'value',
      max: 1,
      axisLabel: {
        formatter: (value: number) => formatPercent(value),
      },
    },
    series: [
      {
        name: '利用率',
        type: 'bar',
        data: analytics?.scheduleUtilizationByMonth.map(s => s.rate) || [],
        itemStyle: {
          color: (params: any) => {
            return params.value >= 0.8 ? '#52c41a' : params.value >= 0.6 ? '#faad14' : '#ff4d4f';
          },
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: '50%',
        markLine: {
          data: [
            { type: 'average', name: '平均利用率' },
          ],
        },
      },
    ],
  };

  const topExhibitorsColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 80,
      render: (_: any, __: any, index: number) => (
        <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'orange' : 'default'}>
          {index + 1}
        </Tag>
      ),
    },
    {
      title: '参展商名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '访客数',
      dataIndex: 'visitors',
      key: 'visitors',
      render: (num: number) => num.toLocaleString() + ' 人',
      sorter: (a: any, b: any) => a.visitors - b.visitors,
    },
  ];

  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="年度总客流"
              value={analytics?.totalVisitors || 0}
              formatter={formatLargeNumber}
              prefix={<UserOutlined className="text-blue-500" />}
              valueStyle={{ color: '#165DFF' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="年度总收入"
              value={analytics?.totalRevenue || 0}
              formatter={currencyFormatter}
              prefix={<DollarOutlined className="text-green-500" />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="档期利用率"
              value={analytics?.scheduleUtilization || 0}
              formatter={percentFormatter}
              prefix={<CalendarOutlined className="text-purple-500" />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="展位利用率"
              value={analytics?.boothUtilization || 0}
              formatter={percentFormatter}
              prefix={<RiseOutlined className="text-orange-500" />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <LineChartOutlined className="text-blue-500" />
            数据分析
          </Space>
        }
        extra={
          <Space wrap>
            <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }} size="small">
              <Option value="year">本年度</Option>
              <Option value="quarter">本季度</Option>
              <Option value="month">本月</Option>
            </Select>
            <RangePicker size="small" />
            <Button icon={<ReloadOutlined />} size="small">刷新</Button>
            <Button icon={<DownloadOutlined />} size="small" onClick={handleExport}>
              导出报表
            </Button>
          </Space>
        }
      >
        <Tabs
          items={[
            {
              key: 'visitor',
              label: (
                <Space>
                  <LineChartOutlined />
                  客流趋势
                </Space>
              ),
              children: (
                <Card loading={loading}>
                  <ReactECharts option={visitorTrendOption} style={{ height: 400 }} />
                </Card>
              ),
            },
            {
              key: 'revenue',
              label: (
                <Space>
                  <BarChartOutlined />
                  收入分析
                </Space>
              ),
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={16}>
                    <Card loading={loading} title="月度收入趋势">
                      <ReactECharts option={revenueTrendOption} style={{ height: 400 }} />
                    </Card>
                  </Col>
                  <Col xs={24} lg={8}>
                    <Card loading={loading} title="档期利用率">
                      <ReactECharts option={scheduleUtilOption} style={{ height: 400 }} />
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'exhibitor',
              label: (
                <Space>
                  <PieChartOutlined />
                  参展商分析
                </Space>
              ),
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <Card loading={loading} title="参展商行业分布">
                      <ReactECharts option={exhibitorDistOption} style={{ height: 400 }} />
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card loading={loading} title="热门参展商TOP5">
                      <Table
                        columns={topExhibitorsColumns}
                        dataSource={analytics?.topExhibitors || []}
                        rowKey="name"
                        pagination={false}
                        size="small"
                      />
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'source',
              label: (
                <Space>
                  <PieChartOutlined />
                  访客来源
                </Space>
              ),
              children: (
                <Card loading={loading}>
                  <ReactECharts option={visitorSourceOption} style={{ height: 400 }} />
                </Card>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AnalyticsPage;
