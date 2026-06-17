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
  Input,
  Form,
  InputNumber,
  Modal
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
import { api } from '@/api'
import { TicketType } from '@/types'
import type { PriceChangeLog } from '@/types'

const { RangePicker } = DatePicker

const ticketTypeLabels: Record<TicketType, string> = {
  [TicketType.EARLY_BIRD]: '早鸟票',
  [TicketType.REGULAR]: '正价票',
  [TicketType.STUDENT]: '学生票',
  [TicketType.GROUP]: '团体票'
}

export default function PriceLog() {
  const dispatch = useAppDispatch()
  const { logs: reduxLogs, loading } = useAppSelector((state) => state.priceLog)

  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [performanceFilter, setPerformanceFilter] = useState<string | undefined>()
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string | undefined>()
  const [operatorFilter, setOperatorFilter] = useState<string | undefined>()
  const [operatorKeyword, setOperatorKeyword] = useState('')
  const [logs, setLogs] = useState<PriceChangeLog[]>([])
  const [modifyModalOpen, setModifyModalOpen] = useState(false)
  const [modifyForm] = Form.useForm()
  const [modifyLoading, setModifyLoading] = useState(false)
  const [performanceOptions, setPerformanceOptions] = useState<{value: string; label: string}[]>([])
  const [operatorOptions, setOperatorOptions] = useState<{value: string; label: string}[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)

  const loadOptions = async () => {
    setOptionsLoading(true)
    try {
      const [perfRes, userRes] = await Promise.all([
        api.get('/performances', { params: { pageSize: 100 } }),
        api.get('/users', { params: { pageSize: 100 } })
      ])
      const performances = perfRes.data?.performances || perfRes.data?.data || []
      const users = userRes.data?.users || userRes.data?.data || []
      setPerformanceOptions(
        performances.map((p: any) => ({
          value: p.id || p._id,
          label: p.name
        }))
      )
      setOperatorOptions(
        users.map((u: any) => ({
          value: u.id || u._id,
          label: u.name || u.username
        }))
      )
    } catch {
      message.error('加载选项失败')
    } finally {
      setOptionsLoading(false)
    }
  }

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
      const result = await dispatch(fetchPriceLogs(params)).unwrap()
      let data: PriceChangeLog[] = []
      if (Array.isArray(result)) {
        data = result
      } else if (result && Array.isArray(result.logs)) {
        data = result.logs
      }
      if (operatorKeyword) {
        data = data.filter((log) => log.operatorName?.includes(operatorKeyword))
      }
      setLogs(data)
    } catch {
      message.error('加载价格变更日志失败')
      setLogs([])
    }
  }

  useEffect(() => {
    loadOptions()
    loadData()
  }, [])

  const handleReset = () => {
    setDateRange(null)
    setPerformanceFilter(undefined)
    setTicketTypeFilter(undefined)
    setOperatorFilter(undefined)
    setOperatorKeyword('')
    setLogs([])
    loadData()
    message.info('已重置筛选条件')
  }

  const handleOpenModifyModal = () => {
    modifyForm.resetFields()
    modifyForm.setFieldsValue({
      ticketType: TicketType.REGULAR,
      newPrice: 380
    })
    setModifyModalOpen(true)
  }

  const handleModifyPrice = async () => {
    try {
      const values = await modifyForm.validateFields()
      setModifyLoading(true)
      await api.post('/price-logs/update-price', {
        performanceId: values.performanceId,
        sectionId: values.sectionId || undefined,
        ticketType: values.ticketType,
        newPrice: values.newPrice,
        reason: values.reason || undefined
      })
      message.success('票价修改成功，日志已记录')
      setModifyModalOpen(false)
      loadData()
    } catch (error: any) {
      if (error?.response?.data?.message) {
        message.error(error.response.data.message)
      } else if (error?.message) {
        message.error(error.message)
      }
    } finally {
      setModifyLoading(false)
    }
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
          <Button type="primary" icon={<FundOutlined />} onClick={handleOpenModifyModal}>
            修改票价
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
          <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>
            查询
          </Button>
        </Space>
      </div>

      <Modal
        title="修改票价"
        open={modifyModalOpen}
        onOk={handleModifyPrice}
        onCancel={() => setModifyModalOpen(false)}
        confirmLoading={modifyLoading}
        okText="确认修改"
        destroyOnClose
      >
        <Form form={modifyForm} layout="vertical" preserve={false}>
          <Form.Item
            name="performanceId"
            label="演出"
            rules={[{ required: true, message: '请选择演出' }]}
          >
            <Select
              placeholder="选择演出"
              showSearch
              optionFilterProp="label"
              options={performanceOptions}
              loading={optionsLoading}
            />
          </Form.Item>
          <Form.Item name="sectionId" label="区域ID（可选）">
            <Input placeholder="留空则修改全部区域" />
          </Form.Item>
          <Form.Item name="ticketType" label="票种" rules={[{ required: true }]}>
            <Select
              options={Object.entries(ticketTypeLabels).map(([value, label]) => ({
                value,
                label
              }))}
            />
          </Form.Item>
          <Form.Item
            name="newPrice"
            label="新票价（元）"
            rules={[{ required: true, message: '请输入新票价' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item name="reason" label="修改原因">
            <Input.TextArea rows={2} placeholder="如：临近演出调整、促销降价等" />
          </Form.Item>
        </Form>
      </Modal>

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
              loading={optionsLoading}
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
              loading={optionsLoading}
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
