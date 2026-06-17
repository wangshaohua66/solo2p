import { useState, useEffect, useMemo } from 'react'
import {
  Card,
  DatePicker,
  Select,
  Space,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import ReactECharts from 'echarts-for-react'
import {
  TicketType,
  SalesChannel,
  PerformanceType
} from '@/types'
import type { SalesStats } from '@/types'
import { api } from '@/api'
import { DownloadOutlined } from '@ant-design/icons'

const { RangePicker } = DatePicker

const ticketTypeLabels: Record<TicketType, string> = {
  [TicketType.EARLY_BIRD]: '早鸟票',
  [TicketType.REGULAR]: '正价票',
  [TicketType.STUDENT]: '学生票',
  [TicketType.GROUP]: '团体票'
}

const salesChannelLabels: Record<SalesChannel, string> = {
  [SalesChannel.WEBSITE]: '官网',
  [SalesChannel.WECHAT_MINIAPP]: '微信小程序'
}

const typeLabels: Record<PerformanceType, string> = {
  [PerformanceType.DRAMA]: '话剧',
  [PerformanceType.CONCERT]: '音乐会',
  [PerformanceType.DANCE]: '舞蹈',
  [PerformanceType.OPERA]: '戏曲',
  [PerformanceType.CHILDREN]: '儿童剧'
}

export default function SalesStats() {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().subtract(1, 'month'),
    dayjs()
  ])
  const [venueFilter, setVenueFilter] = useState<string | undefined>()
  const [typeFilter, setTypeFilter] = useState<PerformanceType | undefined>()
  const [statsData, setStatsData] = useState<SalesStats[]>([])
  const [loading, setLoading] = useState(false)
  const [dailyTrend, setDailyTrend] = useState<{ date: string; revenue: number; tickets: number }[]>([])

  const loadData = async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = {}
      if (dateRange && dateRange[0]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD')
      }
      if (dateRange && dateRange[1]) {
        params.endDate = dateRange[1].format('YYYY-MM-DD')
      }
      if (venueFilter) {
        params.venueId = venueFilter
      }

      const res = await api.get('/settlements/sales-stats', { params })
      const data = res.data?.stats || res.data?.data || []
      let filtered = data

      if (typeFilter) {
        filtered = data.filter((s: any) => s.type === typeFilter)
      }

      setStatsData(filtered)

      const trendRes = await api.get('/settlements/daily-trend', { params })
      const trendData = trendRes.data?.trend || trendRes.data?.data || []
      if (trendData.length > 0) {
        setDailyTrend(trendData)
      } else {
        const trendMap = new Map<string, { date: string; revenue: number; tickets: number }>()
        filtered.forEach((s: any) => {
          const d = s.date || s.performanceDate || dayjs().format('YYYY-MM-DD')
          const key = dayjs(d).format('MM-DD')
          const existing = trendMap.get(key) || { date: key, revenue: 0, tickets: 0 }
          existing.revenue += s.totalRevenue || 0
          existing.tickets += s.soldTickets || 0
          trendMap.set(key, existing)
        })
        const mergedTrend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date))
        setDailyTrend(mergedTrend)
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || '加载统计数据失败')
      setStatsData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const totalRevenue = useMemo(() => statsData.reduce((sum, s) => sum + s.totalRevenue, 0), [statsData])
  const totalTickets = useMemo(() => statsData.reduce((sum, s) => sum + (s.totalTickets || s.soldTickets), 0), [statsData])
  const totalSold = useMemo(() => statsData.reduce((sum, s) => sum + s.soldTickets, 0), [statsData])
  const avgOccupancy = totalTickets > 0 ? Math.round((totalSold / totalTickets) * 100) : 0

  const channelData = useMemo(() => Object.values(SalesChannel).map((ch) => ({
    name: salesChannelLabels[ch],
    value: statsData.reduce((sum, s) => sum + (s.byChannel?.[ch] || 0), 0)
  })), [statsData])

  const ticketTypeData = useMemo(() => Object.values(TicketType).map((t) => ({
    name: ticketTypeLabels[t],
    value: statsData.reduce((sum, s) => sum + (s.byTicketType?.[t] || 0), 0)
  })), [statsData])

  const dailyTrendOption = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['销售额', '售票数']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dailyTrend.map(d => d.date)
    },
    yAxis: [
      {
        type: 'value',
        name: '销售额(元)',
        position: 'left'
      },
      {
        type: 'value',
        name: '售票数',
        position: 'right'
      }
    ],
    series: [
      {
        name: '销售额',
        type: 'line',
        smooth: true,
        data: dailyTrend.map(d => d.revenue),
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
            ]
          }
        },
        lineStyle: { width: 3 }
      },
      {
        name: '售票数',
        type: 'bar',
        yAxisIndex: 1,
        data: dailyTrend.map(d => d.tickets),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#52c41a' },
              { offset: 1, color: '#b7eb8f' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        }
      }
    ]
  }

  const channelPieOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: ¥{c} ({d}%)'
    },
    legend: { bottom: 0 },
    series: [{
      name: '销售渠道',
      type: 'pie',
      radius: ['45%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' }
      },
      data: channelData
    }]
  }

  const ticketTypePieOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: ¥{c} ({d}%)'
    },
    legend: { bottom: 0 },
    series: [{
      name: '票种分布',
      type: 'pie',
      radius: '60%',
      data: ticketTypeData.map((item, i) => ({
        ...item,
        itemStyle: {
          color: ['#faad14', '#1890ff', '#52c41a', '#722ed1'][i]
        }
      }))
    }]
  }

  const handleExport = async () => {
    try {
      const params: Record<string, any> = {
        export: true
      }
      if (dateRange && dateRange[0]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD')
      }
      if (dateRange && dateRange[1]) {
        params.endDate = dateRange[1].format('YYYY-MM-DD')
      }
      const res = await api.get('/settlements/sales-stats', {
        params,
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `sales-stats-${dayjs().format('YYYYMMDD')}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch {
      message.error('导出失败')
    }
  }

  const columns: ColumnsType<SalesStats> = [
    {
      title: '演出名称',
      dataIndex: 'performanceName',
      key: 'performanceName',
      fixed: 'left',
      width: 200
    },
    {
      title: '总座位',
      dataIndex: 'totalTickets',
      key: 'totalTickets',
      align: 'center',
      width: 80
    },
    {
      title: '已售',
      dataIndex: 'soldTickets',
      key: 'soldTickets',
      align: 'center',
      width: 80
    },
    {
      title: '上座率',
      key: 'occupancy',
      align: 'center',
      width: 100,
      render: (_, record) => {
        const rate = Math.round((record.soldTickets / record.totalTickets) * 100)
        return (
          <Tag color={rate >= 80 ? 'green' : rate >= 60 ? 'blue' : 'orange'}>
            {rate}%
          </Tag>
        )
      }
    },
    {
      title: '官网收入',
      key: 'website',
      align: 'right',
      width: 120,
      render: (_, record) => `¥${record.byChannel.website.toLocaleString()}`
    },
    {
      title: '小程序收入',
      key: 'wechat',
      align: 'right',
      width: 120,
      render: (_, record) => `¥${record.byChannel.wechat_miniapp.toLocaleString()}`
    },
    {
      title: '总收入',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      align: 'right',
      width: 120,
      fixed: 'right',
      render: (val) => (
        <strong style={{ color: '#f5222d' }}>¥{val.toLocaleString()}</strong>
      )
    }
  ]

  return (
    <div>
      <div className="card-header">
        <div className="card-title">票房统计</div>
        <Space>
          <Select
            placeholder="场馆"
            style={{ width: 140 }}
            allowClear
            value={venueFilter}
            onChange={setVenueFilter}
            options={[
              { label: '大剧院', value: 'grand' },
              { label: '音乐厅', value: 'concert' },
              { label: '小剧场', value: 'small' }
            ]}
          />
          <Select
            placeholder="演出类型"
            style={{ width: 120 }}
            allowClear
            value={typeFilter}
            onChange={setTypeFilter}
            options={Object.entries(typeLabels).map(([value, label]) => ({
              value,
              label
            }))}
          />
          <RangePicker value={dateRange} onChange={(v) => setDateRange(v as [Dayjs, Dayjs])} />
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>导出报表</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总收入"
              value={totalRevenue}
              prefix="¥"
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="售票总数" value={totalSold} suffix="张" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="演出场次" value={statsData.length} suffix="场" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均上座率"
              value={avgOccupancy}
              suffix="%"
              valueStyle={{ color: avgOccupancy >= 80 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <ReactECharts option={dailyTrendOption} style={{ height: 320 }} />
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="销售渠道分布">
            <ReactECharts option={channelPieOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="票种收入分布">
            <ReactECharts option={ticketTypePieOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      <Card title="按场次统计明细">
        <Table
          columns={columns}
          dataSource={statsData}
          rowKey="performanceId"
          scroll={{ x: 900 }}
          pagination={{ pageSize: 10 }}
          summary={(pageData) => {
            let totalRev = 0
            let totalWeb = 0
            let totalWx = 0
            pageData.forEach((item) => {
              totalRev += item.totalRevenue
              totalWeb += item.byChannel.website
              totalWx += item.byChannel.wechat_miniapp
            })
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <strong>本页合计</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    ¥{totalWeb.toLocaleString()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    ¥{totalWx.toLocaleString()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <strong style={{ color: '#f5222d' }}>
                      ¥{totalRev.toLocaleString()}
                    </strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )
          }}
        />
      </Card>
    </div>
  )
}
