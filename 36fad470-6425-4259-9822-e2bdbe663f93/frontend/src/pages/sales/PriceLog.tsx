import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Space,
  Select,
  DatePicker,
  Button,
  Statistic,
  Row,
  Col,
  Tag,
  message,
  Input
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import {
  SearchOutlined,
  ReloadOutlined,
  RiseOutlined,
  FallOutlined,
  SwapOutlined,
  FundOutlined
} from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchPriceLogs } from '@/store/priceLogSlice'
import type { PriceLogQueryParams } from '@/store/priceLogSlice'
import { TicketType } from '@/types'
import type { PriceChangeLog } from '@/types'

const { RangePicker } = DatePicker

const ticketTypeLabels: Record<TicketType, string> = {
  [TicketType.EARLY_BIRD]: '早鸟票',
  [TicketType.REGULAR]: '正价票',
  [TicketType.STUDENT]: '学生票',
  [TicketType.GROUP]: '团体票'
}

const performanceOptions = [
  { value: 'p1', label: '《雷雨》经典话剧' },
  { value: 'p2', label: '新年交响音乐会' },
  { value: 'p3', label: '儿童剧《白雪公主》' },
  { value: 'p4', label: '天鹅湖芭蕾舞' },
  { value: 'p5', label: '《茶馆》老舍经典' }
]

const operatorOptions = [
  { value: 'op1', label: '李管理员' },
  { value: 'op2', label: '王财务' },
  { value: 'op3', label: '张运营' },
  { value: 'op4', label: '赵主管' }
]

const mockPriceLogs: PriceChangeLog[] = [
  {
    id: 'pl_1',
    performanceId: 'p1',
    performanceName: '《雷雨》经典话剧',
    sectionId: 'sec1',
    sectionName: '池座A区',
    ticketType: TicketType.REGULAR,
    oldPrice: 380,
    newPrice: 420,
    operatorId: 'op1',
    operatorName: '李管理员',
    reason: '临近演出调整价格',
    createdAt: '2026-06-15T09:30:00Z',
    changeAmount: 40,
    changePercent: 10.53,
    ticketTypeLabel: '正价票'
  },
  {
    id: 'pl_2',
    performanceId: 'p1',
    performanceName: '《雷雨》经典话剧',
    sectionId: 'sec2',
    sectionName: '楼座B区',
    ticketType: TicketType.EARLY_BIRD,
    oldPrice: 320,
    newPrice: 280,
    operatorId: 'op2',
    operatorName: '王财务',
    reason: '早鸟票促销降价',
    createdAt: '2026-06-14T14:20:00Z',
    changeAmount: -40,
    changePercent: -12.5,
    ticketTypeLabel: '早鸟票'
  },
  {
    id: 'pl_3',
    performanceId: 'p2',
    performanceName: '新年交响音乐会',
    sectionId: 'sec1',
    sectionName: 'VIP区',
    ticketType: TicketType.REGULAR,
    oldPrice: 880,
    newPrice: 980,
    operatorId: 'op3',
    operatorName: '张运营',
    reason: 'VIP区域供不应求涨价',
    createdAt: '2026-06-13T10:15:00Z',
    changeAmount: 100,
    changePercent: 11.36,
    ticketTypeLabel: '正价票'
  },
  {
    id: 'pl_4',
    performanceId: 'p3',
    performanceName: '儿童剧《白雪公主》',
    sectionId: 'sec1',
    sectionName: '家庭区',
    ticketType: TicketType.GROUP,
    oldPrice: 200,
    newPrice: 180,
    operatorId: 'op1',
    operatorName: '李管理员',
    reason: '儿童节团体优惠',
    createdAt: '2026-06-12T16:45:00Z',
    changeAmount: -20,
    changePercent: -10,
    ticketTypeLabel: '团体票'
  },
  {
    id: 'pl_5',
    performanceId: 'p4',
    performanceName: '天鹅湖芭蕾舞',
    sectionId: 'sec3',
    sectionName: '侧座C区',
    ticketType: TicketType.STUDENT,
    oldPrice: 180,
    newPrice: 150,
    operatorId: 'op4',
    operatorName: '赵主管',
    reason: '学生票专属折扣',
    createdAt: '2026-06-11T11:00:00Z',
    changeAmount: -30,
    changePercent: -16.67,
    ticketTypeLabel: '学生票'
  },
  {
    id: 'pl_6',
    performanceId: 'p2',
    performanceName: '新年交响音乐会',
    sectionId: 'sec2',
    sectionName: '普通区',
    ticketType: TicketType.REGULAR,
    oldPrice: 480,
    newPrice: 520,
    operatorId: 'op3',
    operatorName: '张运营',
    reason: '临近演出日期价格调整',
    createdAt: '2026-06-10T08:30:00Z',
    changeAmount: 40,
    changePercent: 8.33,
    ticketTypeLabel: '正价票'
  },
  {
    id: 'pl_7',
    performanceId: 'p5',
    performanceName: '《茶馆》老舍经典',
    sectionId: 'sec1',
    sectionName: '池座A区',
    ticketType: TicketType.EARLY_BIRD,
    oldPrice: 420,
    newPrice: 380,
    operatorId: 'op2',
    operatorName: '王财务',
    reason: '新上映首周优惠',
    createdAt: '2026-06-09T15:20:00Z',
    changeAmount: -40,
    changePercent: -9.52,
    ticketTypeLabel: '早鸟票'
  },
  {
    id: 'pl_8',
    performanceId: 'p1',
    performanceName: '《雷雨》经典话剧',
    sectionId: 'sec4',
    sectionName: '包厢区',
    ticketType: TicketType.REGULAR,
    oldPrice: 1280,
    newPrice: 1380,
    operatorId: 'op4',
    operatorName: '赵主管',
    reason: '包厢需求旺盛调整',
    createdAt: '2026-06-08T13:10:00Z',
    changeAmount: 100,
    changePercent: 7.81,
    ticketTypeLabel: '正价票'
  }
]

export default function PriceLog() {
  const dispatch = useAppDispatch()
  const { logs: reduxLogs, loading } = useAppSelector((state) => state.priceLog)

  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [performanceFilter, setPerformanceFilter] = useState<string | undefined>()
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string | undefined>()
  const [operatorFilter, setOperatorFilter] = useState<string | undefined>()
  const [operatorKeyword, setOperatorKeyword] = useState('')
  const [logs, setLogs] = useState<PriceChangeLog[]>(mockPriceLogs)

  const loadData = async () => {
    const params: PriceLogQueryParams = {}
    if (dateRange && dateRange[0]) {
      params.startDate = dateRange[0].format('YYYY-MM-DD')
    }
    if (dateRange && dateRange[1]) {
      params.endDate = dateRange[1].format('YYYY-MM-DD')
    }
    if (performanceFilter) {
      params.performanceId = performanceFilter
    }
    if (ticketTypeFilter) {
      params.ticketType = ticketTypeFilter
    }
    if (operatorFilter) {
      params.operatorId = operatorFilter
    }

    try {
      await dispatch(fetchPriceLogs(params))
      if (reduxLogs && reduxLogs.length > 0) {
        setLogs(reduxLogs)
      } else {
        let filtered = mockPriceLogs
        if (dateRange && dateRange[0]) {
          filtered = filtered.filter((log) =>
            dayjs(log.createdAt).isAfter(dateRange[0]!.subtract(1, 'day'))
          )
        }
        if (dateRange && dateRange[1]) {
          filtered = filtered.filter((log) =>
            dayjs(log.createdAt).isBefore(dateRange[1]!.add(1, 'day'))
          )
        }
        if (performanceFilter) {
          filtered = filtered.filter((log) => log.performanceId === performanceFilter)
        }
        if (ticketTypeFilter) {
          filtered = filtered.filter((log) => log.ticketType === ticketTypeFilter)
        }
        if (operatorFilter) {
          filtered = filtered.filter((log) => log.operatorId === operatorFilter)
        }
        if (operatorKeyword) {
          filtered = filtered.filter((log) =>
            log.operatorName.includes(operatorKeyword)
          )
        }
        setLogs(filtered)
      }
    } catch {
      message.error('加载价格变更日志失败')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleReset = () => {
    setDateRange(null)
    setPerformanceFilter(undefined)
    setTicketTypeFilter(undefined)
    setOperatorFilter(undefined)
    setOperatorKeyword('')
    setLogs(mockPriceLogs)
    message.info('已重置筛选条件')
  }

  const totalChanges = logs.length
  const increases = logs.filter((log) => (log.changeAmount ?? log.newPrice - log.oldPrice) > 0).length
  const decreases = logs.filter((log) => (log.changeAmount ?? log.newPrice - log.oldPrice) < 0).length
  const netChange = logs.reduce((sum, log) => sum + ((log.changeAmount ?? log.newPrice - log.oldPrice)), 0)

  const columns: ColumnsType<PriceChangeLog> = [
    {
      title: '变更时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '演出',
      dataIndex: 'performanceName',
      key: 'performanceName',
      ellipsis: true,
      render: (val, record) => (
        <Space direction="vertical" size={0}>
          <span>{val}</span>
          {record.sectionName && (
            <Tag color="blue" style={{ marginTop: 4 }}>
              {record.sectionName}
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '票种',
      dataIndex: 'ticketType',
      key: 'ticketType',
      width: 100,
      render: (type: TicketType) => (
        <Tag color="purple">
          {ticketTypeLabels[type] || type}
        </Tag>
      )
    },
    {
      title: '原价',
      dataIndex: 'oldPrice',
      key: 'oldPrice',
      width: 100,
      align: 'right',
      render: (val) => <span style={{ color: '#666' }}>¥{val.toLocaleString()}</span>
    },
    {
      title: '新价',
      dataIndex: 'newPrice',
      key: 'newPrice',
      width: 100,
      align: 'right',
      render: (val) => <strong>¥{val.toLocaleString()}</strong>
    },
    {
      title: '差价',
      key: 'diff',
      width: 130,
      align: 'right',
      sorter: (a, b) => {
        const diffA = a.changeAmount ?? a.newPrice - a.oldPrice
        const diffB = b.changeAmount ?? b.newPrice - b.oldPrice
        return diffA - diffB
      },
      render: (_, record) => {
        const diff = record.changeAmount ?? record.newPrice - record.oldPrice
        const percent = record.changePercent ?? ((diff / record.oldPrice) * 100)
        const isPositive = diff > 0
        const isNegative = diff < 0
        const color = isPositive ? '#f5222d' : isNegative ? '#52c41a' : '#8c8c8c'
        const icon = isPositive ? <RiseOutlined /> : isNegative ? <FallOutlined /> : null
        const prefix = isPositive ? '+' : ''
        return (
          <Space direction="vertical" size={0} align="end">
            <span style={{ color, fontWeight: 600, fontSize: 14 }}>
              {icon} {prefix}¥{Math.abs(diff).toLocaleString()}
            </span>
            {percent !== 0 && (
              <span style={{ color, fontSize: 12 }}>
                {prefix}{percent.toFixed(2)}%
              </span>
            )}
          </Space>
        )
      }
    },
    {
      title: '操作人',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 110,
      render: (val) => <span style={{ color: '#1677ff' }}>{val}</span>
    },
    {
      title: '变更原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (val) => val || <span style={{ color: '#bfbfbf' }}>-</span>
    }
  ]

  return (
    <div>
      <div className="card-header">
        <div className="card-title">价格变更日志</div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
          >
            重置
          </Button>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={loadData}
          >
            查询
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>日期范围</div>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange as any}
              onChange={(val) => setDateRange(val as any)}
              allowClear
            />
          </Col>
          <Col span={5}>
            <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>演出</div>
            <Select
              style={{ width: '100%' }}
              placeholder="全部演出"
              allowClear
              showSearch
              optionFilterProp="label"
              value={performanceFilter}
              onChange={setPerformanceFilter}
              options={performanceOptions}
            />
          </Col>
          <Col span={4}>
            <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>票种</div>
            <Select
              style={{ width: '100%' }}
              placeholder="全部票种"
              allowClear
              value={ticketTypeFilter}
              onChange={setTicketTypeFilter}
              options={Object.entries(ticketTypeLabels).map(([value, label]) => ({
                value,
                label
              }))}
            />
          </Col>
          <Col span={4}>
            <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>操作人</div>
            <Select
              style={{ width: '100%' }}
              placeholder="全部操作人"
              allowClear
              showSearch
              optionFilterProp="label"
              value={operatorFilter}
              onChange={setOperatorFilter}
              options={operatorOptions}
              dropdownRender={(menu) => (
                <div>
                  <div style={{ padding: '4px 8px' }}>
                    <Input
                      size="small"
                      placeholder="搜索操作人"
                      value={operatorKeyword}
                      onChange={(e) => setOperatorKeyword(e.target.value)}
                    />
                  </div>
                  {menu}
                </div>
              )}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="变更总数"
              value={totalChanges}
              suffix="次"
              prefix={<SwapOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="涨价次数"
              value={increases}
              suffix="次"
              valueStyle={{ color: '#f5222d' }}
              prefix={<RiseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="降价次数"
              value={decreases}
              suffix="次"
              valueStyle={{ color: '#52c41a' }}
              prefix={<FallOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="净变化金额"
              value={netChange}
              precision={2}
              prefix="¥"
              valueStyle={{
                color: netChange >= 0 ? '#f5222d' : '#52c41a'
              }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="价格变更明细">
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>
    </div>
  )
}
