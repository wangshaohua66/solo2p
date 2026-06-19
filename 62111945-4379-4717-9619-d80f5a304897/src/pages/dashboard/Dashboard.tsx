import { useState, useEffect } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Tabs,
  Select,
  DatePicker,
  Space,
  Tag
} from 'antd'
import {
  RiseOutlined,
  ShopOutlined,
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
  BarChartOutlined,
  PieChartOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { StatisticsData } from '@/types'
import { mockGetStatistics } from '@/mock/statistics'
import './Dashboard.css'

const { RangePicker } = DatePicker
const { TabPane } = Tabs

const Dashboard = () => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<StatisticsData | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const stats = await mockGetStatistics()
      setData(stats)
    } finally {
      setLoading(false)
    }
  }

  const monthlyTrendOption: EChartsOption = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['岗位数', '求职者数'],
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 40,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data?.monthlyData.map(d => d.month) || []
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '岗位数',
        type: 'line',
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(22, 119, 255, 0.3)' },
              { offset: 1, color: 'rgba(22, 119, 255, 0.05)' }
            ]
          }
        },
        lineStyle: {
          color: '#1677ff',
          width: 2
        },
        itemStyle: {
          color: '#1677ff'
        },
        data: data?.monthlyData.map(d => d.count) || []
      },
      {
        name: '求职者数',
        type: 'line',
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
              { offset: 1, color: 'rgba(82, 196, 26, 0.05)' }
            ]
          }
        },
        lineStyle: {
          color: '#52c41a',
          width: 2
        },
        itemStyle: {
          color: '#52c41a'
        },
        data: data?.monthlyData.map(d => Math.floor(d.count * 1.2)) || []
      }
    ]
  }

  const industryPieOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center'
    },
    series: [
      {
        name: '行业分布',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: data?.industryDistribution || []
      }
    ]
  }

  const salaryBarOption: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 20,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data?.salaryDistribution.map(d => d.name) || [],
      axisTick: {
        alignWithLabel: true
      }
    },
    yAxis: {
      type: 'value',
      name: '人数'
    },
    series: [
      {
        name: '人数',
        type: 'bar',
        barWidth: '50%',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#1677ff' },
              { offset: 1, color: '#69b1ff' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        },
        data: data?.salaryDistribution.map(d => d.value) || []
      }
    ]
  }

  const centerBarOption: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    legend: {
      data: ['招聘会', '岗位数', '参会人数'],
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 40,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data?.centerData.map(d => d.name) || [],
      axisLabel: {
        rotate: 30,
        fontSize: 11
      }
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '招聘会',
        type: 'bar',
        data: data?.centerData.map(d => d.recruitmentCount) || [],
        itemStyle: { color: '#1677ff', borderRadius: [2, 2, 0, 0] }
      },
      {
        name: '岗位数',
        type: 'bar',
        data: data?.centerData.map(d => d.jobCount) || [],
        itemStyle: { color: '#52c41a', borderRadius: [2, 2, 0, 0] }
      },
      {
        name: '参会人数',
        type: 'bar',
        data: data?.centerData.map(d => d.attendeeCount) || [],
        itemStyle: { color: '#faad14', borderRadius: [2, 2, 0, 0] }
      }
    ]
  }

  const heatmapOption: EChartsOption = {
    tooltip: {
      position: 'top'
    },
    grid: {
      height: '50%',
      top: '10%'
    },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      splitArea: {
        show: true
      }
    },
    yAxis: {
      type: 'category',
      data: ['东城区', '西城区', '朝阳区', '海淀区', '丰台区', '石景山区', '通州区', '顺义区'],
      splitArea: {
        show: true
      }
    },
    visualMap: {
      min: 0,
      max: 5000,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '5%',
      inRange: {
        color: ['#e6f4ff', '#91caff', '#1677ff', '#0958d9']
      }
    },
    series: [
      {
        name: '人才分布',
        type: 'heatmap',
        data: [
          [0, 0, 3200], [1, 0, 2800], [2, 0, 4500], [3, 0, 3800], [4, 0, 3000], [5, 0, 4200],
          [6, 0, 4800], [7, 0, 4200], [8, 0, 3500], [9, 0, 3000], [10, 0, 2500], [11, 0, 2000],
          [0, 1, 2400], [1, 1, 2100], [2, 1, 3500], [3, 1, 3000], [4, 1, 2500], [5, 1, 3200],
          [6, 1, 3800], [7, 1, 3400], [8, 1, 2800], [9, 1, 2400], [10, 1, 2000], [11, 1, 1800],
          [0, 2, 4000], [1, 2, 3600], [2, 2, 5200], [3, 2, 4800], [4, 2, 4200], [5, 2, 5500],
          [6, 2, 6000], [7, 2, 5500], [8, 2, 4500], [9, 2, 3800], [10, 2, 3200], [11, 2, 2800],
          [0, 3, 5000], [1, 3, 4500], [2, 3, 6500], [3, 3, 5800], [4, 3, 5000], [5, 3, 7000],
          [6, 3, 8000], [7, 3, 7200], [8, 3, 6000], [9, 3, 5000], [10, 3, 4200], [11, 3, 3500],
          [0, 4, 1500], [1, 4, 1200], [2, 4, 2200], [3, 4, 1800], [4, 4, 1600], [5, 4, 2400],
          [6, 4, 2800], [7, 4, 2500], [8, 4, 2000], [9, 4, 1700], [10, 4, 1400], [11, 4, 1200],
          [0, 5, 1000], [1, 5, 900], [2, 5, 1600], [3, 5, 1400], [4, 5, 1200], [5, 5, 1800],
          [6, 5, 2200], [7, 5, 2000], [8, 5, 1600], [9, 5, 1300], [10, 5, 1100], [11, 5, 900],
          [0, 6, 1200], [1, 6, 1000], [2, 6, 1800], [3, 6, 1500], [4, 6, 1300], [5, 6, 2000],
          [6, 6, 2400], [7, 6, 2200], [8, 6, 1800], [9, 6, 1500], [10, 6, 1300], [11, 6, 1100],
          [0, 7, 900], [1, 7, 800], [2, 7, 1400], [3, 7, 1200], [4, 7, 1000], [5, 7, 1600],
          [6, 7, 1800], [7, 7, 1600], [8, 7, 1300], [9, 7, 1100], [10, 7, 900], [11, 7, 700]
        ],
        label: {
          show: false
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  }

  const statCards = [
    { title: '入驻企业', value: data?.totalEnterprises.toLocaleString(), suffix: '家', icon: <ShopOutlined />, color: '#1677ff' },
    { title: '优质岗位', value: data?.totalJobs.toLocaleString(), suffix: '个', icon: <BarChartOutlined />, color: '#52c41a' },
    { title: '求职者', value: data?.totalJobseekers.toLocaleString(), suffix: '人', icon: <UserOutlined />, color: '#faad14' },
    { title: '年度招聘会', value: data?.totalRecruitments, suffix: '场', icon: <CalendarOutlined />, color: '#722ed1' }
  ]

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h2><BarChartOutlined /> 数据看板</h2>
        <Space>
          <Select defaultValue="all" style={{ width: 120 }}>
            <Select.Option value="all">全部中心</Select.Option>
            <Select.Option value="1">东城区</Select.Option>
            <Select.Option value="2">西城区</Select.Option>
          </Select>
          <RangePicker />
        </Space>
      </div>

      <Row gutter={[16, 16]} className="stats-row">
        {statCards.map((card, idx) => (
          <Col xs={12} sm={12} md={6} key={idx}>
            <Card className="stat-card" loading={loading}>
              <div className="stat-icon" style={{ background: card.color + '15', color: card.color }}>
                {card.icon}
              </div>
              <Statistic
                title={card.title}
                value={card.value || 0}
                suffix={card.suffix}
                className="stat-content"
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} className="dashboard-tabs">
        <TabPane tab={<span><RiseOutlined /> 数据概览</span>} key="overview">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Card title="岗位与求职者趋势" className="chart-card">
                <ReactECharts option={monthlyTrendOption} style={{ height: 300 }} />
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="行业人才分布" className="chart-card">
                <ReactECharts option={industryPieOption} style={{ height: 300 }} />
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <Card title="薪资分布" className="chart-card">
                <ReactECharts option={salaryBarOption} style={{ height: 280 }} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="各中心数据对比" className="chart-card">
                <ReactECharts option={centerBarOption} style={{ height: 280 }} />
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab={<span><PieChartOutlined /> 人才分布</span>} key="talent">
          <Card title="区域人才热力图" className="chart-card">
            <ReactECharts option={heatmapOption} style={{ height: 450 }} />
          </Card>
        </TabPane>

        <TabPane tab={<span><CalendarOutlined /> 招聘会统计</span>} key="recruitment">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Card title="招聘会场次趋势" className="chart-card">
                <ReactECharts option={monthlyTrendOption} style={{ height: 350 }} />
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="招聘会类型分布" className="chart-card">
                <ReactECharts option={industryPieOption} style={{ height: 350 }} />
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </div>
  )
}

export default Dashboard
