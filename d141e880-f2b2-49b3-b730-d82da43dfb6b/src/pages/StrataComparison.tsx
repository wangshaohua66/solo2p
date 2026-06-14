import React, { useState, useMemo } from 'react';
import {
  Layout,
  Card,
  Select,
  Space,
  Button,
  Table,
  Tag,
  Empty,
  Statistic,
  Row,
  Col,
  Progress,
  Tooltip,
  Alert,
} from 'antd';
import { useStrataSync } from '@/hooks/useStrataSync';
import { useSiteStore } from '@/stores/siteStore';
import { useArtifactStore } from '@/stores/artifactStore';
import { getPeriodColor } from '@/utils/color';
import { AlertCircle, BarChart3, GitCompare, Download } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

const { Content } = Layout;
const { Option } = Select;

const StrataComparison: React.FC = () => {
  const sites = useSiteStore((state) => state.sites);
  const strata = useArtifactStore((state) => state.strata);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);

  const selectedSites = useMemo(() => {
    return sites.filter((s) => selectedSiteIds.includes(s.id));
  }, [sites, selectedSiteIds]);

  const { comparisonResult, alignedStrata, consistencyScore, differences } = useStrataSync(
    selectedSiteIds
  );

  const chartOption = useMemo(() => {
    if (alignedStrata.length === 0) return {} as EChartsOption;

    const siteNames = selectedSites.map((s) => s.name);
    const periodOrder = [
      '旧石器时代',
      '新石器时代',
      '青铜时代',
      '铁器时代',
      '汉代',
      '唐代',
      '宋代',
      '明代',
      '清代',
      '近现代',
    ];

    const series = selectedSites.map((site) => {
      const siteStrata = strata.filter((s) => s.siteId === site.id);
      const data = alignedStrata.map((aligned) => {
        const matched = siteStrata.find(
          (s) => s.period === aligned.period || s.layer === aligned.layer
        );
        return matched
          ? [
              periodOrder.indexOf(aligned.period || '近现代'),
              siteNames.indexOf(site.name),
              matched.thickness,
            ]
          : null;
      });

      return {
        name: site.name,
        type: 'bar' as const,
        data: data.filter(Boolean) as number[][],
        label: {
          show: true,
          position: 'inside',
          formatter: (params: any) => {
            const thickness = params.data[2];
            return `${thickness}m`;
          },
        },
      };
    });

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const period = periodOrder[params.data[0]];
          const site = params.seriesName;
          const thickness = params.data[2];
          return `${site}<br/>${period}<br/>厚度: ${thickness}m`;
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
        data: periodOrder.filter((_, i) =>
          alignedStrata.some((s) => periodOrder.indexOf(s.period || '') === i)
        ),
        axisLabel: {
          rotate: 45,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'category',
        data: siteNames,
        axisLabel: {
          fontSize: 12,
        },
      },
      series,
      color: ['#8B4513', '#D4AF37', '#22c55e', '#3b82f6'],
    };
  }, [alignedStrata, selectedSites, strata]);

  const columns = [
    {
      title: '年代',
      dataIndex: 'period',
      key: 'period',
      width: 120,
      render: (period: string) =>
        period ? (
          <Tag color={getPeriodColor(period)} style={{ margin: 0 }}>
            {period}
          </Tag>
        ) : (
          <span className="text-stone-400">-</span>
        ),
    },
    ...selectedSites.map((site) => ({
      title: (
        <div className="text-center">
          <div>{site.name}</div>
          <div className="text-xs text-stone-400">{site.location}</div>
        </div>
      ),
      key: site.id,
      children: [
        {
          title: '层位',
          dataIndex: `${site.id}_layer`,
          key: `${site.id}_layer`,
          width: 80,
          align: 'center' as const,
          render: (_: any, record: any) => {
            const siteStratum = strata.find(
              (s) => s.siteId === site.id && s.period === record.period
            );
            return siteStratum ? `${siteStratum.layer}层` : '-';
          },
        },
        {
          title: '厚度(m)',
          dataIndex: `${site.id}_thickness`,
          key: `${site.id}_thickness`,
          width: 80,
          align: 'center' as const,
          render: (_: any, record: any) => {
            const siteStratum = strata.find(
              (s) => s.siteId === site.id && s.period === record.period
            );
            return siteStratum ? siteStratum.thickness : '-';
          },
        },
        {
          title: '土质',
          dataIndex: `${site.id}_soil`,
          key: `${site.id}_soil`,
          render: (_: any, record: any) => {
            const siteStratum = strata.find(
              (s) => s.siteId === site.id && s.period === record.period
            );
            return siteStratum ? siteStratum.soilType : '-';
          },
        },
      ],
    })),
    {
      title: '差异度',
      key: 'diff',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const diff = differences.find((d) => d.period === record.period);
        if (!diff) return <Tag color="green">一致</Tag>;
        return (
          <Tooltip title={diff.description}>
            <Tag color={diff.severity === 'high' ? 'red' : 'orange'}>
              {diff.severity === 'high' ? '显著差异' : '轻微差异'}
            </Tag>
          </Tooltip>
        );
      },
    },
  ];

  const handleExport = () => {
    if (!comparisonResult) return;
    const dataStr = JSON.stringify(comparisonResult, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `地层对比报告_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout className="min-h-screen">
      <Content className="p-6 bg-stone-50">
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <GitCompare size={24} className="text-amber-700" />
              <h2 className="text-xl font-semibold text-stone-800 m-0">跨工地地层对比</h2>
            </div>
            {selectedSiteIds.length >= 2 && (
              <Button icon={<Download size={16} />} onClick={handleExport}>
                导出报告
              </Button>
            )}
          </div>

          <Select
            mode="multiple"
            placeholder="请选择2个及以上工地进行对比..."
            style={{ width: '100%' }}
            value={selectedSiteIds}
            onChange={setSelectedSiteIds}
            size="large"
          >
            {sites.map((site) => (
              <Option key={site.id} value={site.id}>
                {site.name} - {site.location}
              </Option>
            ))}
          </Select>

          {selectedSiteIds.length > 0 && selectedSiteIds.length < 2 && (
            <Alert
              message="请选择至少2个工地进行对比"
              type="warning"
              showIcon
              icon={<AlertCircle size={16} />}
              className="mt-3"
            />
          )}
        </Card>

        {selectedSiteIds.length >= 2 && comparisonResult ? (
          <>
            <Row gutter={16} className="mb-4">
              <Col span={8}>
                <Card>
                  <Statistic
                    title="已对齐地层层数"
                    value={alignedStrata.length}
                    prefix={<BarChart3 size={18} className="text-amber-700" />}
                    valueStyle={{ color: '#8B4513' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-stone-500 mb-1">地层一致性评分</div>
                      <div className="text-2xl font-bold text-stone-800">
                        {consistencyScore}
                        <span className="text-sm text-stone-400 ml-1">/ 100</span>
                      </div>
                    </div>
                    <Progress
                      type="circle"
                      percent={consistencyScore}
                      width={60}
                      strokeColor={
                        consistencyScore >= 80
                          ? '#22c55e'
                          : consistencyScore >= 60
                          ? '#eab308'
                          : '#ef4444'
                      }
                    />
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="发现差异点"
                    value={differences.length}
                    prefix={<AlertCircle size={18} className="text-red-500" />}
                    valueStyle={{ color: differences.length > 0 ? '#ef4444' : '#22c55e' }}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="地层厚度对比图" className="mb-4">
              <ReactECharts option={chartOption} style={{ height: 300 }} />
            </Card>

            <Card title="地层序列详情对比">
              {alignedStrata.length > 0 ? (
                <Table
                  dataSource={alignedStrata}
                  columns={columns}
                  rowKey="period"
                  pagination={false}
                  scroll={{ x: true }}
                />
              ) : (
                <Empty description="暂无匹配的地层序列" />
              )}
            </Card>
          </>
        ) : (
          <Card>
            <Empty
              description="选择多个工地后，将自动按地层年代对齐生成对比分析"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        )}
      </Content>
    </Layout>
  );
};

export default StrataComparison;
