import { useState } from 'react'
import { Card, Row, Col, Select, Tabs, Table, Tag } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { TabsProps } from 'antd'
import './Statistics.scss'

const { Option } = Select

function Statistics() {
  const [timeRange, setTimeRange] = useState('month')
  const [activeTab, setActiveTab] = useState('business')

  const businessLineOption = {
    title: { text: '各门诊接诊量趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['中心门诊', '城东门诊', '城西门诊'], bottom: 0 },
    grid: { bottom: 40 },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月'],
    },
    yAxis: { type: 'value' },
    series: [
      { name: '中心门诊', data: [450, 520, 480, 600, 550, 620], type: 'line', smooth: true },
      { name: '城东门诊', data: [280, 320, 350, 380, 400, 420], type: 'line', smooth: true },
      { name: '城西门诊', data: [200, 240, 280, 300, 320, 350], type: 'line', smooth: true },
    ],
  }

  const revenueOption = {
    title: { text: '科室收入占比', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['60%', '50%'],
        data: [
          { value: 385000, name: '种植科' },
          { value: 276000, name: '正畸科' },
          { value: 198000, name: '修复科' },
          { value: 156000, name: '口腔内科' },
          { value: 89000, name: '口腔外科' },
        ],
        label: {
          formatter: '{b}: ¥{c}',
        },
      },
    ],
  }

  const barOption = {
    title: { text: '医生接诊量排名', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 80 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: ['周医生', '吴医生', '郑医生', '钱医生', '赵医生', '王医生', '李医生'],
    },
    series: [
      {
        data: [85, 92, 105, 128, 145, 168, 185],
        type: 'bar',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#1890ff' },
              { offset: 1, color: '#69c0ff' },
            ],
          },
          borderRadius: [0, 4, 4, 0],
        },
      },
    ],
  }

  const deviceOption = {
    title: { text: '设备利用率', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        data: [65, 72, 68, 75, 70, 85, 45],
        type: 'bar',
        itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] },
      },
    ],
  }

  const doctorPerformance = [
    { rank: 1, name: '李医生', department: '口腔内科', patients: 185, revenue: 85600, satisfaction: 4.9, consumables: 12500 },
    { rank: 2, name: '王医生', department: '正畸科', patients: 168, revenue: 128000, satisfaction: 4.8, consumables: 18600 },
    { rank: 3, name: '赵医生', department: '种植科', patients: 145, revenue: 156000, satisfaction: 4.9, consumables: 32800 },
    { rank: 4, name: '钱医生', department: '修复科', patients: 128, revenue: 78900, satisfaction: 4.7, consumables: 15200 },
    { rank: 5, name: '周医生', department: '口腔外科', patients: 85, revenue: 45600, satisfaction: 4.6, consumables: 8900 },
  ]

  const perfColumns = [
    { title: '排名', dataIndex: 'rank', key: 'rank', width: 60,
      render: (rank: number) => (
        <Tag color={rank <= 3 ? 'gold' : 'default'}>{rank}</Tag>
      )
    },
    { title: '医生', dataIndex: 'name', key: 'name' },
    { title: '科室', dataIndex: 'department', key: 'department' },
    { title: '接诊量', dataIndex: 'patients', key: 'patients' },
    { title: '营收(元)', dataIndex: 'revenue', key: 'revenue' },
    { title: '满意度', dataIndex: 'satisfaction', key: 'satisfaction',
      render: (val: number) => `${val} 分`
    },
    { title: '耗材费用', dataIndex: 'consumables', key: 'consumables',
      render: (val: number) => `¥ ${val.toLocaleString()}`
    },
  ]

  const tabItems: TabsProps['items'] = [
    {
      key: 'business',
      label: '经营数据',
      children: (
        <div className="tab-content">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Card className="chart-card">
                <ReactECharts option={businessLineOption} style={{ height: 320 }} />
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card className="chart-card">
                <ReactECharts option={revenueOption} style={{ height: 320 }} />
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <Card className="chart-card">
                <ReactECharts option={deviceOption} style={{ height: 280 }} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card className="chart-card">
                <ReactECharts option={barOption} style={{ height: 280 }} />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'performance',
      label: '医生绩效',
      children: (
        <div className="tab-content">
          <Card className="perf-table">
            <Table
              columns={perfColumns}
              dataSource={doctorPerformance}
              rowKey="rank"
              pagination={false}
            />
          </Card>
        </div>
      ),
    },
    {
      key: 'consumable',
      label: '耗材分析',
      children: (
        <div className="tab-content">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="耗材分类占比" className="chart-card">
                <ReactECharts
                  option={{
                    tooltip: { trigger: 'item' },
                    series: [{
                      type: 'pie',
                      radius: '60%',
                      data: [
                        { value: 35, name: '修复材料' },
                        { value: 25, name: '种植材料' },
                        { value: 20, name: '正畸材料' },
                        { value: 12, name: '防护用品' },
                        { value: 8, name: '其他' },
                      ],
                    }],
                  }}
                  style={{ height: 280 }}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="月度耗材消耗趋势" className="chart-card">
                <ReactECharts
                  option={{
                    tooltip: { trigger: 'axis' },
                    legend: { data: ['修复', '种植', '正畸'] },
                    xAxis: { type: 'category', data: ['1月', '2月', '3月', '4月', '5月', '6月'] },
                    yAxis: { type: 'value' },
                    series: [
                      { name: '修复', data: [12000, 14500, 13200, 15800, 14200, 16500], type: 'line', smooth: true },
                      { name: '种植', data: [28000, 32000, 29500, 35000, 31000, 38000], type: 'line', smooth: true },
                      { name: '正畸', data: [18000, 21000, 19500, 23000, 20500, 25000], type: 'line', smooth: true },
                    ],
                  }}
                  style={{ height: 280 }}
                />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'patient',
      label: '患者分析',
      children: (
        <div className="tab-content">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="患者年龄分布" className="chart-card">
                <ReactECharts
                  option={{
                    tooltip: { trigger: 'item' },
                    series: [{
                      type: 'pie',
                      radius: ['40%', '70%'],
                      data: [
                        { value: 15, name: '0-18岁' },
                        { value: 30, name: '19-35岁' },
                        { value: 35, name: '36-55岁' },
                        { value: 20, name: '55岁以上' },
                      ],
                    }],
                  }}
                  style={{ height: 280 }}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="患者来源渠道" className="chart-card">
                <ReactECharts
                  option={{
                    tooltip: { trigger: 'item' },
                    series: [{
                      type: 'pie',
                      radius: '60%',
                      roseType: 'radius',
                      data: [
                        { value: 35, name: '朋友推荐' },
                        { value: 25, name: '线上搜索' },
                        { value: 20, name: '周边社区' },
                        { value: 12, name: '医保定点' },
                        { value: 8, name: '其他' },
                      ],
                    }],
                  }}
                  style={{ height: 280 }}
                />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
  ]

  return (
    <div className="statistics-page">
      <Card className="main-card">
        <div className="page-header">
          <h3>数据统计</h3>
          <div className="time-selector">
            <span>时间范围：</span>
            <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }}>
              <Option value="week">本周</Option>
              <Option value="month">本月</Option>
              <Option value="quarter">本季度</Option>
              <Option value="year">本年</Option>
            </Select>
          </div>
        </div>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>
    </div>
  )
}

export default Statistics
