import React, { useState } from 'react'
import { Card, Row, Col, Statistic, Button, DatePicker, Select, message, Descriptions } from 'antd'
import {
  AppstoreOutlined,
  CalendarOutlined,
  EyeOutlined,
  UserOutlined,
  DownloadOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs, { Dayjs } from 'dayjs'
import { adminApi } from '@/api/admin'

const { Option } = Select
const { MonthPicker } = DatePicker

const AdminReports: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs())
  const [report, setReport] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getMonthlyReport(selectedMonth.format('YYYY-MM'))
      setReport(res.data || null)
      message.success('报告生成成功')
    } catch (error) {
      console.error(error)
      message.error('报告生成失败')
    } finally {
      setLoading(false)
    }
  }

  const bookingsChart = report ? {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#e8e8e8' } },
    series: [{
      type: 'pie', radius: ['40%', '70%'],
      data: [
        { value: report.approvedBookings || 0, name: '已批准', itemStyle: { color: '#52c41a' } },
        { value: report.rejectedBookings || 0, name: '已拒绝', itemStyle: { color: '#ff4d4f' } },
        { value: (report.totalBookings || 0) - (report.approvedBookings || 0) - (report.rejectedBookings || 0), name: '其他', itemStyle: { color: '#c8a96e' } },
      ],
      label: { color: '#e8e8e8' }
    }]
  } : null

  return (
    <div>
      <Card style={{ borderRadius: 8, marginBottom: 16 }}
        title={<span style={{ color: '#c8a96e' }}><FileTextOutlined /> 统计报表</span>}
        extra={
          <Space2>
            <MonthPicker value={selectedMonth} onChange={(date) => date && setSelectedMonth(date)} />
            <Button type="primary" icon={<DownloadOutlined />} loading={loading} onClick={handleGenerate}>
              生成月报
            </Button>
          </Space2>
        }>
      </Card>

      {report && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Card style={{ borderRadius: 8 }}>
                <Statistic title={<span style={{ color: '#a0a0a0' }}>总预约数</span>}
                  value={report.totalBookings || 0} valueStyle={{ color: '#c8a96e' }} prefix={<CalendarOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card style={{ borderRadius: 8 }}>
                <Statistic title={<span style={{ color: '#a0a0a0' }}>已批准</span>}
                  value={report.approvedBookings || 0} valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card style={{ borderRadius: 8 }}>
                <Statistic title={<span style={{ color: '#a0a0a0' }}>已拒绝</span>}
                  value={report.rejectedBookings || 0} valueStyle={{ color: '#ff4d4f' }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card style={{ borderRadius: 8 }}>
                <Statistic title={<span style={{ color: '#a0a0a0' }}>新增项目</span>}
                  value={report.newHeritages || 0} valueStyle={{ color: '#1890ff' }} prefix={<AppstoreOutlined />} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ color: '#c8a96e' }}>预约状态分布</span>} style={{ borderRadius: 8, height: '100%' }}>
                {bookingsChart && <ReactECharts option={bookingsChart} style={{ height: 300 }} />}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ color: '#c8a96e' }}>运营数据</span>} style={{ borderRadius: 8 }}>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="报告周期" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                    {report.period}
                  </Descriptions.Item>
                  <Descriptions.Item label="总浏览量" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                    <EyeOutlined /> {(report.totalViews || 0).toLocaleString()}
                  </Descriptions.Item>
                  <Descriptions.Item label="传承人平均年龄" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                    <UserOutlined /> {report.averageInheritorAge?.toFixed(1) || '-'} 岁
                  </Descriptions.Item>
                  <Descriptions.Item label="预约批准率" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                    {report.totalBookings > 0 ? (((report.approvedBookings || 0) / report.totalBookings) * 100).toFixed(1) : '0'}%
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>

          <Card title={<span style={{ color: '#c8a96e' }}>报告摘要</span>} style={{ borderRadius: 8 }}>
            <div style={{ lineHeight: 2, color: '#e8e8e8' }}>
              <p><strong>{report.period} 运营报告摘要：</strong></p>
              <p>本报告期间内，平台共处理研学预约 <strong style={{ color: '#c8a96e' }}>{report.totalBookings}</strong> 次，
                其中批准 <strong style={{ color: '#52c41a' }}>{report.approvedBookings}</strong> 次，
                拒绝 <strong style={{ color: '#ff4d4f' }}>{report.rejectedBookings}</strong> 次。</p>
              <p>新增非遗项目 <strong style={{ color: '#1890ff' }}>{report.newHeritages}</strong> 项，
                全平台累计浏览量达到 <strong style={{ color: '#c8a96e' }}>{(report.totalViews || 0).toLocaleString()}</strong> 次。</p>
              <p>目前平台在册传承人平均年龄为 <strong style={{ color: '#c8a96e' }}>{report.averageInheritorAge?.toFixed(1) || '-'}</strong> 岁，
                传承培养工作需继续加强年轻传承人的引入。</p>
            </div>
          </Card>
        </>
      )}

      {!report && (
        <div style={{ textAlign: 'center', padding: 64, color: '#707070' }}>
          <FileTextOutlined style={{ fontSize: 64, color: '#2d3a4f', marginBottom: 16 }} />
          <p>请选择月份并点击"生成月报"按钮查看统计报告</p>
        </div>
      )}
    </div>
  )
}

function Space2(props: { children: React.ReactNode }) {
  return <span style={{ display: 'flex', gap: 8 }}>{props.children}</span>
}

export default AdminReports
