import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Table,
  Tag,
  Spin,
  Empty,
} from 'antd'
import {
  AppstoreOutlined,
  UserOutlined,
  CalendarOutlined,
  TeamOutlined,
  EyeOutlined,
  FireOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { adminApi } from '@/api/admin'
import { Heritage, HeritageCategoryMap, HeritageLevelMap } from '@/types'

const { Title } = Typography

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await adminApi.getDashboardStats()
        setStats(res.data || {})
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const categoryChartOption = {
    tooltip: {
      trigger: 'item',
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: '#e8e8e8' },
    },
    series: [
      {
        name: '非遗类别分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#16213e',
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
            color: '#e8e8e8',
          },
        },
        labelLine: {
          show: false,
        },
        data: (stats.categoryStats || []).map((item: any) => ({
          value: item.count,
          name: HeritageCategoryMap[item._id as keyof typeof HeritageCategoryMap] || item._id,
        })),
        color: ['#c8a96e', '#52c41a', '#1890ff', '#eb2f96', '#722ed1'],
      },
    ],
  }

  const monthlyChartOption = {
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
      data: (stats.monthlyBookings || []).map((m: any) => m.month),
      axisLabel: { color: '#a0a0a0' },
      axisLine: { lineStyle: { color: '#2d3a4f' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#a0a0a0' },
      splitLine: { lineStyle: { color: '#2d3a4f' } },
    },
    series: [
      {
        name: '预约数量',
        type: 'line',
        smooth: true,
        data: (stats.monthlyBookings || []).map((m: any) => m.count),
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(200, 169, 110, 0.4)' },
              { offset: 1, color: 'rgba(200, 169, 110, 0.05)' },
            ],
          },
        },
        lineStyle: {
          color: '#c8a96e',
          width: 3,
        },
        itemStyle: {
          color: '#c8a96e',
        },
      },
    ],
  }

  const hotColumns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => (
        <span style={{ color: index < 3 ? '#c8a96e' : '#a0a0a0', fontWeight: index < 3 ? 600 : 400 }}>
          {index + 1}
        </span>
      ),
    },
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span style={{ color: '#e8e8e8' }}>{text}</span>,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => (
        <Tag color="gold">{HeritageCategoryMap[category as keyof typeof HeritageCategoryMap]}</Tag>
      ),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => (
        <Tag color="blue">{HeritageLevelMap[level as keyof typeof HeritageLevelMap]}</Tag>
      ),
    },
    {
      title: '浏览量',
      dataIndex: 'viewCount',
      key: 'viewCount',
      render: (count: number) => (
        <span style={{ color: '#c8a96e' }}>
          <EyeOutlined /> {count.toLocaleString()}
        </span>
      ),
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Title level={3} style={{ color: '#c8a96e', marginBottom: 24 }}>
        数据概览
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={6}>
          <Card className="card-hover" style={{ borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: '#a0a0a0' }}>非遗项目总数</span>}
              value={stats.totalHeritages || 0}
              valueStyle={{ color: '#c8a96e' }}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card className="card-hover" style={{ borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: '#a0a0a0' }}>传承人数</span>}
              value={stats.totalInheritors || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card className="card-hover" style={{ borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: '#a0a0a0' }}>预约总数</span>}
              value={stats.totalBookings || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card className="card-hover" style={{ borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: '#a0a0a0' }}>待审批预约</span>}
              value={stats.pendingBookings || 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card className="card-hover" style={{ borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: '#a0a0a0' }}>已批准预约</span>}
              value={stats.approvedBookings || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card className="card-hover" style={{ borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: '#a0a0a0' }}>注册用户数</span>}
              value={stats.totalUsers || 0}
              valueStyle={{ color: '#722ed1' }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card className="card-hover" style={{ borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: '#a0a0a0' }}>培养计划数</span>}
              value={stats.totalTrainingPlans || 0}
              valueStyle={{ color: '#eb2f96' }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title={<span style={{ color: '#c8a96e' }}>非遗类别分布</span>} style={{ borderRadius: 8, height: '100%' }}>
            {stats.categoryStats?.length ? (
              <ReactECharts option={categoryChartOption} style={{ height: 320 }} />
            ) : (
              <Empty style={{ padding: 32 }} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<span style={{ color: '#c8a96e' }}>近6个月预约趋势</span>} style={{ borderRadius: 8, height: '100%' }}>
            {stats.monthlyBookings?.length ? (
              <ReactECharts option={monthlyChartOption} style={{ height: 320 }} />
            ) : (
              <Empty style={{ padding: 32 }} />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <span style={{ color: '#c8a96e' }}>
            <FireOutlined style={{ color: '#ff7a45', marginRight: 8 }} />
            热门非遗项目 TOP10
          </span>
        }
        style={{ borderRadius: 8 }}
      >
        <Table
          dataSource={stats.hotHeritages || []}
          columns={hotColumns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  )
}

export default AdminDashboard
