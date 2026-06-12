import React, { useEffect, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Progress,
  Tag,
  List,
  Avatar,
  Badge,
  Empty,
  Spin,
  Space,
  Button,
  Tooltip
} from 'antd';
import {
  ShoppingCartOutlined,
  BoxPlotOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ArrowUpOutlined,
  FileDoneOutlined,
  EyeOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, workOrderApi } from '@/api';
import type { DashboardStats, WorkOrder } from '@/types';
import { STATUS_COLOR, STATUS_LABEL } from '@/types';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<WorkOrder[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, orders] = await Promise.all([
        dashboardApi.stats(),
        workOrderApi.list({ page: 1, pageSize: 5 })
      ]);
      setStats(s);
      setRecentOrders(orders.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const statusChartOption = stats
    ? {
        tooltip: { trigger: 'item' },
        legend: { bottom: 0 },
        series: [
          {
            type: 'pie',
            radius: ['45%', '70%'],
            avoidLabelOverlap: false,
            label: { show: false },
            emphasis: {
              label: { show: true, fontSize: 14, fontWeight: 'bold' }
            },
            data: stats.ordersByStatus.map((o) => ({
              name: o.name,
              value: o.value,
              itemStyle: { color: o.color }
            }))
          }
        ]
      }
    : null;

  const weeklyChartOption = stats
    ? {
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
          type: 'category',
          data: stats.weeklyOrders.map((w) => w.date)
        },
        yAxis: { type: 'value' },
        series: [
          {
            data: stats.weeklyOrders.map((w) => w.count),
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
                  { offset: 0, color: 'rgba(22, 119, 255, 0.3)' },
                  { offset: 1, color: 'rgba(22, 119, 255, 0.02)' }
                ]
              }
            },
            lineStyle: { width: 3, color: '#1677ff' },
            itemStyle: { color: '#1677ff' }
          }
        ]
      }
    : null;

  const revenueChartOption = stats
    ? {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
          type: 'category',
          data: stats.revenueByServiceType.map((r) => r.name)
        },
        yAxis: { type: 'value' },
        series: [
          {
            name: '营收',
            type: 'bar',
            data: stats.revenueByServiceType.map((r) => r.value),
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: '#722ed1' },
                  { offset: 1, color: '#1677ff' }
                ]
              },
              borderRadius: [4, 4, 0, 0]
            },
            barWidth: '40%'
          }
        ]
      }
    : null;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/work-orders')}>
            <Statistic
              title="本周工单"
              value={stats?.thisWeekOrders || 0}
              prefix={<ShoppingCartOutlined style={{ color: '#1677ff' }} />}
              suffix={
                <span style={{ fontSize: 14, color: '#52c41a' }}>
                  <ArrowUpOutlined /> 12%
                </span>
              }
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/work-orders?status=ready_for_pickup')}>
            <Statistic
              title="待取件"
              value={stats?.pendingPickup || 0}
              prefix={<BoxPlotOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="平均维修周期"
              value={stats?.avgRepairDays || 0}
              suffix="天"
              prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/parts?lowStock=true')}>
            <Statistic
              title="库存预警"
              value={stats?.lowStockParts || 0}
              prefix={<WarningOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
            <Progress
              percent={Math.min((stats?.lowStockParts || 0) * 5, 100)}
              showInfo={false}
              size="small"
              strokeColor="#fa8c16"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="本周工单趋势" extra={<Tag color="blue">近7天</Tag>}>
            <ReactECharts option={weeklyChartOption!} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="工单状态分布">
            <ReactECharts option={statusChartOption!} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title="近期工单"
            extra={
              <Button
                type="link"
                onClick={() => navigate('/work-orders')}
                icon={<EyeOutlined />}
              >
                查看全部
              </Button>
            }
          >
            {recentOrders.length === 0 ? (
              <Empty description="暂无工单" />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={recentOrders}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        key="view"
                        type="link"
                        onClick={() => navigate(`/work-orders/${item.id}`)}
                      >
                        详情
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Badge
                          color={STATUS_COLOR[item.status]}
                          text={null}
                        >
                          <Avatar
                            style={{
                              backgroundColor: STATUS_COLOR[item.status]
                            }}
                            icon={<ClockCircleOutlined />}
                          />
                        </Badge>
                      }
                      title={
                        <Space>
                          <strong>{item.orderNumber}</strong>
                          <span>{item.brand} {item.model}</span>
                          <Tag
                            color={STATUS_COLOR[item.status]}
                            style={{ borderRadius: 4 }}
                          >
                            {STATUS_LABEL[item.status]}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space size="large">
                          <span>
                            <TeamOutlined /> {item.customer?.name || '-'}
                          </span>
                          <span>
                            <ClockCircleOutlined />{' '}
                            {new Date(item.createdAt).toLocaleString('zh-CN')}
                          </span>
                          <span style={{ fontWeight: 600, color: '#fa8c16' }}>
                            ¥{item.totalPrice.toFixed(2)}
                          </span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="营收按服务类型">
            <ReactECharts option={revenueChartOption!} style={{ height: 280 }} />
          </Card>
          <Card
            title="技工排行"
            style={{ marginTop: 16 }}
            bodyStyle={{ padding: 12 }}
          >
            <List
              size="small"
              dataSource={stats?.topTechnicians || []}
              renderItem={(t, i) => (
                <List.Item>
                  <Space style={{ width: '100%' }}>
                    <Tag
                      color={i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default'}
                      style={{ minWidth: 32, textAlign: 'center' }}
                    >
                      {i + 1}
                    </Tag>
                    <span style={{ flex: 1 }}>{t.name}</span>
                    <span style={{ color: '#1677ff', fontWeight: 600 }}>
                      {t.count}单
                    </span>
                    <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                      平均{t.avgDays}天
                    </span>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default DashboardPage;
