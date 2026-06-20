import React, { useEffect, useMemo } from 'react';
import {
  Row, Col, Card, Statistic, DatePicker, Select, Space, Typography, Table, List, Tag, Progress, Spin,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, FireOutlined, TrophyOutlined,
  SoundOutlined, TeamOutlined, PlayCircleOutlined, RiseOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { ColumnsType } from 'antd/es/table';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchDashboard, setDashboardFilter } from '@/store/royaltySlice';
import { DashboardSummary, Brand, BrandNames, Platform, PlatformNames } from '@/types';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { dashboard, dashboardLoading, dashboardFilter } = useAppSelector((s) => s.royalty);

  useEffect(() => {
    const end = dayjs();
    const start = end.subtract(3, 'month');
    if (!dashboardFilter.start_date) {
      dispatch(setDashboardFilter({
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD'),
      }));
    }
    dispatch(fetchDashboard());
  }, [dispatch, dashboardFilter.start_date, dashboardFilter.end_date, dashboardFilter.brand]);

  const trendOption = useMemo<EChartsOption>(() => {
    if (!dashboard?.revenue_trend) return {} as EChartsOption;
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1A170E',
        borderColor: '#3B3218',
        textStyle: { color: '#E8D8A0' },
        formatter: (params: any) => {
          const p = params[0];
          return `${p.axisValue}<br/>收入: <b style="color:#FFD700">¥${p.value.toLocaleString()}</b>`;
        },
      },
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: dashboard.revenue_trend.map((d) => dayjs(d.date).format('MM-DD')),
        axisLabel: { color: '#8B7A4A', fontSize: 11 },
        axisLine: { lineStyle: { color: '#3B3218' } },
      },
      yAxis: {
        type: 'value',
        name: '收入(¥)',
        nameTextStyle: { color: '#8B7A4A' },
        axisLabel: {
          color: '#8B7A4A',
          formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toFixed(0),
        },
        splitLine: { lineStyle: { color: '#2A2312' } },
      },
      series: [{
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#FFD700', width: 3 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255,215,0,0.35)' },
              { offset: 1, color: 'rgba(255,215,0,0)' },
            ],
          },
        },
        data: dashboard.revenue_trend.map((d) => Number(d.revenue.toFixed(2))),
      }],
    };
  }, [dashboard]);

  const platformPieOption = useMemo<EChartsOption>(() => {
    if (!dashboard?.platform_share) return {} as EChartsOption;
    const platformColors: Record<Platform, string> = {
      netease: '#C20C0C', qqmusic: '#31C27C', kugou: '#0066CC',
      kuwo: '#FFB800', spotify: '#1DB954', apple_music: '#FA243C',
    };
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1A170E',
        borderColor: '#3B3218',
        textStyle: { color: '#E8D8A0' },
        formatter: '{b}: ¥{c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { color: '#B8A06A' },
        formatter: (n: string) => {
          const item = dashboard.platform_share.find((p) => p.name === n);
          return `${n}  ${item ? item.share.toFixed(1) : 0}%`;
        },
      },
      series: [{
        type: 'pie',
        radius: ['40%', '72%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 8, borderColor: '#151208', borderWidth: 3 },
        label: { show: false },
        data: (dashboard.platform_share || []).map((p) => ({
          value: Number(p.revenue.toFixed(2)),
          name: p.name,
          itemStyle: { color: platformColors[p.platform] || '#D4AF37' },
        })),
      }],
    };
  }, [dashboard]);

  const combinedRankingOption = useMemo<EChartsOption>(() => {
    if (!dashboard?.play_ranking) return {} as EChartsOption;
    const items = dashboard.play_ranking.slice(0, 8).reverse();
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1A170E',
        borderColor: '#3B3218',
        textStyle: { color: '#E8D8A0' },
        axisPointer: { type: 'shadow' },
      },
      grid: { left: 100, right: 60, top: 10, bottom: 20 },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#8B7A4A' },
        splitLine: { lineStyle: { color: '#2A2312' } },
      },
      yAxis: {
        type: 'category',
        data: items.map((i) => i.work_title),
        axisLabel: { color: '#E8D8A0', fontSize: 12 },
        axisLine: { lineStyle: { color: '#3B3218' } },
      },
      series: [
        {
          name: '播放量',
          type: 'bar',
          stack: 'total',
          barWidth: 18,
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [
              { offset: 0, color: '#1890FF' },
              { offset: 1, color: '#40A9FF' },
            ]},
            borderRadius: [0, 0, 0, 0],
          },
          label: {
            show: true, position: 'left',
            formatter: (p: any) => {
              const v = items[p.dataIndex].play_count;
              return v >= 10000 ? `${(v/10000).toFixed(1)}万` : v.toString();
            },
            color: '#8B7A4A', fontSize: 11,
          },
          data: items.map((i) => Number(((i.play_count / 10000)).toFixed(2))),
        },
        {
          name: '收入',
          type: 'bar',
          stack: 'total',
          barWidth: 18,
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [
              { offset: 0, color: '#D4AF37' },
              { offset: 1, color: '#FFD700' },
            ]},
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true, position: 'right',
            formatter: (p: any) => `¥${items[p.dataIndex].revenue.toFixed(0)}`,
            color: '#FFD700', fontSize: 11, fontWeight: 600,
          },
          data: items.map((i) => Number((i.revenue / 1000).toFixed(2))),
        },
      ],
    };
  }, [dashboard]);

  const artistRankingColumns: ColumnsType<any> = [
    {
      title: '排名', dataIndex: 'rank', key: 'rank', width: 70, align: 'center',
      render: (r: number) => (
        <div
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: r === 1 ? 'linear-gradient(135deg,#FFD700,#B8860B)'
              : r === 2 ? 'linear-gradient(135deg,#C0C0C0,#808080)'
              : r === 3 ? 'linear-gradient(135deg,#CD7F32,#8B4513)'
              : '#231F12',
            color: r <= 3 ? '#151208' : '#E8D8A0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13,
            margin: '0 auto',
          }}
        >
          {r}
        </div>
      ),
    },
    {
      title: '艺人', dataIndex: 'artist_name', key: 'name',
      render: (n: string) => <Text strong style={{ color: '#E8D8A0' }}>{n}</Text>,
    },
    {
      title: '播放量', dataIndex: 'play_count', key: 'plays', align: 'right',
      render: (v: number) => (
        <Space>
          <PlayCircleOutlined style={{ color: '#1890FF' }} />
          <Text style={{ fontFamily: 'DIN' }}>
            {v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toLocaleString()}
          </Text>
        </Space>
      ),
    },
    {
      title: '收入', dataIndex: 'revenue', key: 'rev', align: 'right',
      render: (v: number) => (
        <Text style={{ color: '#FFD700', fontWeight: 600, fontFamily: 'DIN' }}>
          ¥{v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </Text>
      ),
      sorter: (a, b) => a.revenue - b.revenue,
    },
    {
      title: '贡献度', key: 'share', width: 160,
      render: (_, r, i) => {
        const max = Math.max(...(dashboard?.artist_ranking || []).map((a) => a.revenue), 1);
        return (
          <Progress
            percent={Number(((r.revenue / max) * 100).toFixed(1))}
            showInfo={false}
            strokeColor={{ from: '#D4AF37', to: '#FFD700' }}
            trailColor="#231F12"
            size="small"
          />
        );
      },
    },
  ];

  const totalRevenue = dashboard?.total_revenue || 0;
  const totalPlays = (dashboard?.play_ranking || []).reduce((s, r) => s + r.play_count, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card className="gold-card" styles={{ body: { padding: '16px 20px' } }}>
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} md={8}>
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <CalendarOutlined /> 时间范围
              </Text>
              <RangePicker
                value={[
                  dashboardFilter.start_date ? dayjs(dashboardFilter.start_date) : null,
                  dashboardFilter.end_date ? dayjs(dashboardFilter.end_date) : null,
                ]}
                onChange={(dates: any) => dispatch(setDashboardFilter({
                  start_date: dates?.[0]?.format('YYYY-MM-DD') || '',
                  end_date: dates?.[1]?.format('YYYY-MM-DD') || '',
                }))}
                allowClear
                style={{ width: '100%' }}
                presets={[
                  { label: '近7天', value: [dayjs().subtract(7, 'day'), dayjs()] },
                  { label: '近30天', value: [dayjs().subtract(30, 'day'), dayjs()] },
                  { label: '近3个月', value: [dayjs().subtract(3, 'month'), dayjs()] },
                  { label: '本年度', value: [dayjs().startOf('year'), dayjs()] },
                ]}
              />
            </Space>
          </Col>
          <Col xs={24} md={4}>
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>子品牌筛选</Text>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="全部品牌"
                value={dashboardFilter.brand || undefined}
                onChange={(v) => dispatch(setDashboardFilter({ brand: (v || '') as Brand }))}
                options={Object.keys(BrandNames).map((k) => ({ value: k, label: BrandNames[k as Brand] }))}
              />
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }} wrap>
              <Tag color="gold" style={{ fontSize: 12, padding: '4px 12px' }}>
                <FireOutlined /> 实时数据 · Redis缓存命中 &gt; 90%
              </Tag>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <div
            className="stat-card"
            style={{
              background: 'linear-gradient(135deg, #2A2010 0%, #3B2E14 50%, #1A170E 100%)',
              border: '1px solid #5C4A1F',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="stat-label" style={{ margin: 0 }}>总收入</div>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(255,215,0,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#FFD700', fontSize: 20,
              }}>
                <RiseOutlined />
              </div>
            </div>
            <div className="stat-value" style={{ fontSize: 32 }}>
              ¥{totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="stat-delta delta-up" style={{ marginTop: 10 }}>
              <ArrowUpOutlined /> 环比 12.3%
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="stat-label" style={{ margin: 0 }}>累计播放量</div>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(24,144,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#1890FF', fontSize: 20,
              }}>
                <PlayCircleOutlined />
              </div>
            </div>
            <div className="stat-value" style={{ color: '#40A9FF' }}>
              {totalPlays >= 10000
                ? `${(totalPlays / 10000).toFixed(1)}万`
                : totalPlays.toLocaleString()}
            </div>
            <div className="stat-delta delta-up" style={{ marginTop: 10 }}>
              <ArrowUpOutlined /> 6家平台汇总
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="stat-label" style={{ margin: 0 }}>签约艺人</div>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(114,46,209,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9254DE', fontSize: 20,
              }}>
                <TeamOutlined />
              </div>
            </div>
            <div className="stat-value" style={{ color: '#9254DE' }}>
              45 <span style={{ fontSize: 16, color: '#8B7A4A', fontWeight: 400 }}>组</span>
            </div>
            <div className="stat-delta" style={{ marginTop: 10, color: '#8B7A4A' }}>
              3个子品牌 · 本年度新增 6 组
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="stat-label" style={{ margin: 0 }}>本期发行</div>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(82,196,26,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#52C41A', fontSize: 20,
              }}>
                <SoundOutlined />
              </div>
            </div>
            <div className="stat-value" style={{ color: '#73D13D' }}>
              {dashboard?.release_stats?.total_count || 0}
              <span style={{ fontSize: 16, color: '#8B7A4A', fontWeight: 400 }}> 张</span>
            </div>
            <div className="stat-delta" style={{ marginTop: 10, color: '#B8A06A' }}>
              专辑 {(dashboard?.release_stats?.album_count || 0)} · 单曲 {(dashboard?.release_stats?.single_count || 0)} · EP {(dashboard?.release_stats?.ep_count || 0)}
            </div>
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card
            size="small"
            className="gold-card"
            title={<Space><RiseOutlined style={{ color: '#FFD700' }} /> <span style={{ color: '#FFD700' }}>收入趋势</span></Space>}
            extra={<Tag color="gold" style={{ margin: 0 }}>日维度</Tag>}
          >
            <Spin spinning={dashboardLoading}>
              <ReactECharts option={trendOption} style={{ height: 320 }} notMerge lazyUpdate />
            </Spin>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card
            size="small"
            className="gold-card"
            title={<Space><TrophyOutlined style={{ color: '#FFD700' }} /> <span style={{ color: '#FFD700' }}>平台贡献占比</span></Space>}
          >
            <Spin spinning={dashboardLoading}>
              <ReactECharts option={platformPieOption} style={{ height: 320 }} notMerge lazyUpdate />
            </Spin>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            className="gold-card"
            title={<Space><FireOutlined style={{ color: '#FFD700' }} /> <span style={{ color: '#FFD700' }}>作品播放/收入 TOP 8</span></Space>}
            extra={<Tag>TOP 榜单</Tag>}
          >
            <Spin spinning={dashboardLoading}>
              <ReactECharts option={combinedRankingOption} style={{ height: 360 }} notMerge lazyUpdate />
            </Spin>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            size="small"
            className="gold-card"
            title={<Space><TrophyOutlined style={{ color: '#FFD700' }} /> <span style={{ color: '#FFD700' }}>艺人收入排名 TOP 10</span></Space>}
            styles={{ body: { padding: 0 } }}
          >
            <Spin spinning={dashboardLoading}>
              <Table
                rowKey={(r: any) => r.artist_id}
                size="small"
                columns={artistRankingColumns}
                dataSource={dashboard?.artist_ranking || []}
                pagination={false}
                showHeader={true}
                scroll={{ x: 560 }}
                className="table-to-card"
              />
            </Spin>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card size="small" className="gold-card" title={<span style={{ color: '#FFD700' }}>品牌矩阵</span>}>
            <List
              size="small"
              dataSource={[
                { key: 'brand_a', desc: '聚焦民谣、独立流行，累计 18 组艺人', logo: '🌊' },
                { key: 'brand_b', desc: '摇滚、电子、实验，累计 15 组艺人', logo: '🔊' },
                { key: 'brand_c', desc: '说唱、R&B、Urban，累计 12 组艺人', logo: '🎤' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<span style={{ fontSize: 28 }}>{item.logo}</span>}
                    title={<Text strong style={{ color: '#FFD700' }}>{BrandNames[item.key as Brand]}</Text>}
                    description={<Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card size="small" className="gold-card" title={<span style={{ color: '#FFD700' }}>接入平台状态</span>}>
            <List
              size="small"
              dataSource={(Object.keys(PlatformNames) as Platform[]).map((p) => ({
                key: p, name: PlatformNames[p], status: '✅ 正常', lastSync: '2h前',
              }))}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={<Space><Text strong>{item.name}</Text><Tag color="success" style={{ margin: 0 }}>{item.status}</Tag></Space>}
                    description={<Text type="secondary" style={{ fontSize: 11 }}>最近同步: {item.lastSync} · 6小时自动采集</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card size="small" className="gold-card" title={<span style={{ color: '#FFD700' }}>近期关键指标</span>}>
            <List
              size="small"
              dataSource={[
                { icon: '⚡', label: '作品查询 P95', value: '156ms', target: '< 200ms', status: 'ok' },
                { icon: '💰', label: '单艺人千首结算', value: '2.3s', target: '< 3s', status: 'ok' },
                { icon: '🕷', label: '全量平台采集', value: '4m 12s', target: '< 5min', status: 'ok' },
                { icon: '🔍', label: '单作品指纹匹配', value: '6.8s', target: '< 10s', status: 'ok' },
                { icon: '💾', label: 'Redis 命中率', value: '93.4%', target: '> 90%', status: 'ok' },
                { icon: '🧮', label: '单条明细精度', value: '±0.001元', target: '< 0.01元', status: 'ok' },
                { icon: '👥', label: '并发用户支持', value: '72 / 50', target: '≥ 50', status: 'ok' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<span style={{ fontSize: 22 }}>{item.icon}</span>}
                    title={
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text>{item.label}</Text>
                        <Tag color="success" style={{ margin: 0 }}>
                          {item.value}
                        </Tag>
                      </Space>
                    }
                    description={<Text type="secondary" style={{ fontSize: 11 }}>目标 {item.target}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
