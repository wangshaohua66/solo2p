import React, { useState, useMemo, useCallback } from 'react';
import {
  Layout,
  Card,
  Select,
  Input,
  Button,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  DatePicker,
  Tooltip,
  message,
  Empty,
} from 'antd';
import {
  Search,
  Download,
  Filter,
  BarChart3,
  PieChart,
  TrendingUp,
  Package,
  Calendar,
  MapPin,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useArtifactStore } from '@/stores/artifactStore';
import { useSiteStore } from '@/stores/siteStore';
import { useArtifactSearch } from '@/hooks/useStrataSync';
import { ARTIFACT_CATEGORIES, CONDITION_OPTIONS, PERIOD_OPTIONS } from '@/constants';
import type { EChartsOption } from 'echarts';
import type { Artifact } from '@/types';

const { Content } = Layout;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search: SearchInput } = Input;

const Statistics: React.FC = () => {
  const artifacts = useArtifactStore((state) => state.artifacts);
  const sites = useSiteStore((state) => state.sites);
  const getArtifactsStats = useArtifactStore((state) => state.getArtifactsStats);

  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  const { searchResults, searchTime } = useArtifactSearch(
    searchText,
    useMemo(
      () => ({
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        siteId: siteFilter !== 'all' ? siteFilter : undefined,
        period: periodFilter !== 'all' ? periodFilter : undefined,
        condition: conditionFilter !== 'all' ? conditionFilter : undefined,
        startDate: dateRange?.[0]?.toDate(),
        endDate: dateRange?.[1]?.toDate(),
      }),
      [categoryFilter, siteFilter, periodFilter, conditionFilter, dateRange]
    )
  );

  const stats = useMemo(() => getArtifactsStats(), [getArtifactsStats]);

  const categoryChartOption = useMemo<EChartsOption>(() => {
    const categoryData = stats.byCategory.map((item) => ({
      value: item.count,
      name: item.category,
    }));

    if (chartType === 'pie') {
      return {
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c}件 ({d}%)',
        },
        legend: {
          orient: 'vertical',
          left: 'left',
          textStyle: { fontSize: 11 },
        },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 6,
              borderColor: '#fff',
              borderWidth: 2,
            },
            label: {
              show: true,
              formatter: '{b}\n{c}件',
              fontSize: 11,
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 14,
                fontWeight: 'bold',
              },
            },
            data: categoryData,
            color: ['#8B4513', '#D4AF37', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f97316'],
          },
        ],
      };
    }

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categoryData.map((d) => d.name),
        axisLabel: {
          rotate: 45,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        name: '数量(件)',
      },
      series: [
        {
          type: 'bar',
          data: categoryData.map((d) => d.value),
          itemStyle: {
            color: '#8B4513',
            borderRadius: [4, 4, 0, 0],
          },
          label: {
            show: true,
            position: 'top',
            fontSize: 11,
          },
          barWidth: '60%',
        },
      ],
    };
  }, [stats.byCategory, chartType]);

  const periodChartOption = useMemo<EChartsOption>(() => {
    const periodData = PERIOD_OPTIONS.map((period) => {
      const found = stats.byPeriod.find((p) => p.period === period.value);
      return {
        name: period.label,
        value: found?.count || 0,
      };
    }).filter((d) => d.value > 0);

    return {
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
        data: periodData.map((d) => d.name),
        axisLabel: {
          rotate: 30,
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'value',
        name: '数量(件)',
      },
      series: [
        {
          type: 'line',
          data: periodData.map((d) => d.value),
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            color: '#8B4513',
            width: 2,
          },
          itemStyle: {
            color: '#D4AF37',
            borderColor: '#8B4513',
            borderWidth: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(139, 69, 19, 0.3)' },
                { offset: 1, color: 'rgba(139, 69, 19, 0.05)' },
              ],
            },
          },
        },
      ],
    };
  }, [stats.byPeriod]);

  const siteChartOption = useMemo<EChartsOption>(() => {
    const siteData = stats.bySite
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => {
        const site = sites.find((s) => s.id === item.siteId);
        return {
          name: site?.name || '未知工地',
          value: item.count,
        };
      });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      yAxis: {
        type: 'category',
        data: siteData.map((d) => d.name),
        axisLabel: {
          fontSize: 10,
        },
      },
      xAxis: {
        type: 'value',
        name: '数量(件)',
      },
      series: [
        {
          type: 'bar',
          data: siteData.map((d) => d.value),
          itemStyle: {
            color: '#D4AF37',
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: 'right',
            fontSize: 11,
          },
          barWidth: '60%',
        },
      ],
    };
  }, [stats.bySite, sites]);

  const columns = [
    {
      title: '遗物名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span className="font-medium text-stone-800">{name}</span>,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => (
        <Tag color="#8B4513" style={{ margin: 0, fontSize: '11px' }}>
          {category}
        </Tag>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 60,
      align: 'center' as const,
    },
    {
      title: '保存状况',
      dataIndex: 'condition',
      key: 'condition',
      width: 80,
      render: (condition: string) => (
        <Tag
          color={
            condition === '完好'
              ? 'green'
              : condition === '残损'
              ? 'orange'
              : 'red'
          }
          style={{ margin: 0, fontSize: '11px' }}
        >
          {condition}
        </Tag>
      ),
    },
    {
      title: '年代',
      dataIndex: 'period',
      key: 'period',
      width: 100,
      render: (period: string) => period || '-',
    },
    {
      title: '所属工地',
      dataIndex: 'siteId',
      key: 'siteId',
      width: 140,
      render: (siteId: string) => {
        const site = sites.find((s) => s.id === siteId);
        return (
          <div className="flex items-center gap-1">
            <MapPin size={12} className="text-stone-400" />
            <span className="text-xs">{site?.name || '未知'}</span>
          </div>
        );
      },
    },
    {
      title: '出土深度',
      dataIndex: 'depth',
      key: 'depth',
      width: 80,
      align: 'center' as const,
      render: (depth: number) => `${depth}m`,
    },
    {
      title: '登记时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => (
        <div className="flex items-center gap-1 text-xs text-stone-500">
          <Calendar size={12} />
          {new Date(date).toLocaleDateString('zh-CN')}
        </div>
      ),
    },
  ];

  const handleExport = useCallback(() => {
    const dataToExport = searchResults.length > 0 ? searchResults : artifacts;
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `遗物数据_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`成功导出 ${dataToExport.length} 条遗物数据`);
  }, [searchResults, artifacts]);

  const handleReset = () => {
    setSearchText('');
    setCategoryFilter('all');
    setSiteFilter('all');
    setPeriodFilter('all');
    setConditionFilter('all');
    setDateRange(null);
  };

  const displayedArtifacts = searchResults.length > 0 ? searchResults : artifacts;

  return (
    <Layout className="min-h-screen">
      <Content className="p-6 bg-stone-50">
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 size={24} className="text-amber-700" />
              <h2 className="text-xl font-semibold text-stone-800 m-0">遗物检索统计</h2>
              {searchTime > 0 && (
                <Tag color="default" style={{ fontSize: '11px' }}>
                  搜索耗时 {searchTime.toFixed(0)}ms
                </Tag>
              )}
            </div>
            <Space>
              <Tooltip title="导出当前结果">
                <Button
                  icon={<Download size={16} />}
                  onClick={handleExport}
                  disabled={displayedArtifacts.length === 0}
                >
                  导出 JSON
                </Button>
              </Tooltip>
            </Space>
          </div>

          <div className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <div style={{ flex: 1, minWidth: 200 }}>
                <SearchInput
                  placeholder="全文搜索遗物名称、备注..."
                  allowClear
                  prefix={<Search size={16} className="text-stone-400" />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              <Select
                placeholder="类别"
                style={{ width: 130 }}
                value={categoryFilter}
                onChange={setCategoryFilter}
                allowClear
              >
                <Option value="all">全部类别</Option>
                {Object.keys(ARTIFACT_CATEGORIES).map((cat) => (
                  <Option key={cat} value={cat}>
                    {cat}
                  </Option>
                ))}
              </Select>
              <Select
                placeholder="工地"
                style={{ width: 150 }}
                value={siteFilter}
                onChange={setSiteFilter}
                allowClear
              >
                <Option value="all">全部工地</Option>
                {sites.map((site) => (
                  <Option key={site.id} value={site.id}>
                    {site.name}
                  </Option>
                ))}
              </Select>
              <Select
                placeholder="年代"
                style={{ width: 120 }}
                value={periodFilter}
                onChange={setPeriodFilter}
                allowClear
              >
                <Option value="all">全部年代</Option>
                {PERIOD_OPTIONS.map((p) => (
                  <Option key={p.value} value={p.value}>
                    {p.label}
                  </Option>
                ))}
              </Select>
              <Select
                placeholder="保存状况"
                style={{ width: 110 }}
                value={conditionFilter}
                onChange={setConditionFilter}
                allowClear
              >
                <Option value="all">全部状况</Option>
                {CONDITION_OPTIONS.map((c) => (
                  <Option key={c.value} value={c.value}>
                    {c.label}
                  </Option>
                ))}
              </Select>
              <RangePicker
                placeholder={['开始日期', '结束日期']}
                value={dateRange}
                onChange={setDateRange}
                allowClear
              />
              <Button onClick={handleReset} icon={<Filter size={14} />}>
                重置
              </Button>
            </div>
          </div>
        </Card>

        <Row gutter={16} className="mb-4">
          <Col span={6}>
            <Card>
              <Statistic
                title="出土遗物总数"
                value={stats.total}
                prefix={<Package size={18} className="text-amber-700" />}
                valueStyle={{ color: '#8B4513' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="涉及工地数"
                value={stats.bySite.length}
                prefix={<MapPin size={18} className="text-blue-600" />}
                valueStyle={{ color: '#3b82f6' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="遗物品类"
                value={stats.byCategory.length}
                prefix={<TrendingUp size={18} className="text-green-600" />}
                valueStyle={{ color: '#22c55e' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="完好率"
                value={stats.total > 0 ? Math.round((stats.goodCondition / stats.total) * 100) : 0}
                suffix="%"
                prefix={<PieChart size={18} className="text-purple-600" />}
                valueStyle={{ color: '#a855f7' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} className="mb-4">
          <Col span={12}>
            <Card
              title="遗物类别分布"
              extra={
                <Space size="small">
                  <Button
                    type={chartType === 'bar' ? 'primary' : 'default'}
                    size="small"
                    icon={<BarChart3 size={14} />}
                    onClick={() => setChartType('bar')}
                  >
                    柱状图
                  </Button>
                  <Button
                    type={chartType === 'pie' ? 'primary' : 'default'}
                    size="small"
                    icon={<PieChart size={14} />}
                    onClick={() => setChartType('pie')}
                  >
                    饼图
                  </Button>
                </Space>
              }
            >
              <ReactECharts option={categoryChartOption} style={{ height: 320 }} />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="年代分布趋势">
              <ReactECharts option={periodChartOption} style={{ height: 320 }} />
            </Card>
          </Col>
        </Row>

        <Card title="工地出土数量排行 (Top 10)" className="mb-4">
          <ReactECharts option={siteChartOption} style={{ height: 300 }} />
        </Card>

        <Card
          title={
            <div className="flex items-center gap-2">
              <span>检索结果</span>
              <Tag color="#8B4513" style={{ margin: 0 }}>
                {displayedArtifacts.length} 条
              </Tag>
            </div>
          }
        >
          {displayedArtifacts.length > 0 ? (
            <Table
              dataSource={displayedArtifacts}
              columns={columns}
              rowKey="id"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
              scroll={{ x: true }}
            />
          ) : (
            <Empty description="暂无遗物数据" />
          )}
        </Card>
      </Content>
    </Layout>
  );
};

export default Statistics;
