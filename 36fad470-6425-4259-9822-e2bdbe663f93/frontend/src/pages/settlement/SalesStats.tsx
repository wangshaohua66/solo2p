import { useState } from 'react'
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
  Tabs,
  Button
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

const mockStats: SalesStats[] = [
  {
    performanceId: 'p1',
    performanceName: '《雷雨》经典话剧',
    totalTickets: 1200,
    soldTickets: 986,
    totalRevenue: 285680,
    byChannel: {
      [SalesChannel.WEBSITE]: 156420,
      [SalesChannel.WECHAT_MINIAPP]: 129260
    },
    byTicketType: {
      [TicketType.EARLY_BIRD]: 72400,
      [TicketType.REGULAR]: 189680,
      [TicketType.STUDENT]: 12600,
      [TicketType.GROUP]: 11000
    }
  },
  {
    performanceId: 'p2',
    performanceName: '新年交响音乐会',
    totalTickets: 1500,
    soldTickets: 1420,
    totalRevenue: 682400,
    byChannel: {
      [SalesChannel.WEBSITE]: 412300,
      [SalesChannel.WECHAT_MINIAPP]: 270100
    },
    byTicketType: {
      [TicketType.EARLY_BIRD]: 136000,
      [TicketType.REGULAR]: 489400,
      [TicketType.STUDENT]: 28000,
      [TicketType.GROUP]: 29000
    }
  },
  {
    performanceId: 'p3',
    performanceName: '儿童剧《白雪公主》',
    totalTickets: 800,
    soldTickets: 756,
    totalRevenue: 158760,
    byChannel: {
      [SalesChannel.WEBSITE]: 68420,
      [SalesChannel.WECHAT_MINIAPP]: 90340
    },
    byTicketType: {
      [TicketType.EARLY_BIRD]: 28600,
      [TicketType.REGULAR]: 104560,
      [TicketType.STUDENT]: 8600,
      [TicketType.GROUP]: 17000
    }
  },
  {
    performanceId: 'p4',
    performanceName: '天鹅湖芭蕾舞',
    totalTickets: 1200,
    soldTickets: 1080,
    totalRevenue: 425800,
    byChannel: {
      [SalesChannel.WEBSITE]: 245600,
      [SalesChannel.WECHAT_MINIAPP]: 180200
    },
    byTicketType: {
      [TicketType.EARLY_BIRD]: 98500,
      [TicketType.REGULAR]: 291300,
      [TicketType.STUDENT]: 18000,
      [TicketType.GROUP]: 18000
    }
  }
]

export default function SalesStats() {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().subtract(1, 'month'),
    dayjs()
  ])
  const [venueFilter, setVenueFilter] = useState<string | undefined>()
  const [typeFilter, setTypeFilter] = useState<PerformanceType | undefined>()

  const totalRevenue = mockStats.reduce((sum, s) => sum + s.totalRevenue, 0)
  const totalTickets = mockStats.reduce((sum, s) => sum + s.totalTickets, 0)
  const totalSold = mockStats.reduce((sum, s) => sum + s.soldTickets, 0)
  const avgOccupancy = totalTickets > 0 ? Math.round((totalSold / totalTickets) * 100) : 0

  const channelData = Object.values(SalesChannel).map((ch) => ({
    name: salesChannelLabels[ch],
    value: mockStats.reduce((sum, s) => sum + s.byChannel[ch], 0)
  }))

  const ticketTypeData = Object.values(TicketType).map((t) => ({
    name: ticketTypeLabels[t],
    value: mockStats.reduce((sum, s) => sum + s.byTicketType[t], 0)
  }))

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
      data: Array.from({ length: 7 }, (_, i) =>
        dayjs().subtract(6 - i, 'day').format('MM-DD')
      )
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
        data: [45600, 58200, 72800, 61400, 89200, 95600, 78900],
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
            ]
          }
        },
        lineStyle: {
          width: 3
        }
      },
      {
        name: '售票数',
        type: 'bar',
        yAxisIndex: 1,
        data: [120, 156, 198, 168, 245, 268, 212],
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
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
    legend: {
      bottom: 0
    },
    series: [
      {
        name: '销售渠道',
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data: channelData
      }
    ]
  }

  const ticketTypePieOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: ¥{c} ({d}%)'
    },
    legend: {
      bottom: 0
    },
    series: [
      {
        name: '票种分布',
        type: 'pie',
        radius: '60%',
        data: ticketTypeData.map((item, i) => ({
          ...item,
          itemStyle: {
            color: ['#faad14', '#1890ff', '#52c41a', '#722ed1'][i]
          }
        }))
      }
    ]
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
          <Button type="primary">导出报表</Button>
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
            <Statistic title="演出场次" value={mockStats.length} suffix="场" />
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
          dataSource={mockStats}
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
