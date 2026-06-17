import { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Select,
  DatePicker,
  Modal,
  Descriptions,
  List,
  Alert,
  message,
  Row,
  Col,
  Statistic,
  Popconfirm
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { FileExcelOutlined, CheckOutlined, EyeOutlined } from '@ant-design/icons'
import { SalesChannel } from '@/types'
import type { Settlement } from '@/types'

const { MonthPicker } = DatePicker

const statusLabels: Record<string, string> = {
  pending: '待确认',
  confirmed_venue: '场馆已确认',
  confirmed_organizer: '主办方已确认',
  completed: '已完成'
}

const statusColors: Record<string, string> = {
  pending: 'orange',
  confirmed_venue: 'blue',
  confirmed_organizer: 'cyan',
  completed: 'green'
}

const salesChannelLabels: Record<SalesChannel, string> = {
  [SalesChannel.WEBSITE]: '官网',
  [SalesChannel.WECHAT_MINIAPP]: '微信小程序'
}

const mockSettlements: Settlement[] = [
  {
    id: 'set_1',
    month: '2026-05',
    performanceId: 'p1',
    performanceName: '《雷雨》经典话剧',
    organizerId: 'org_1',
    organizerName: '某话剧艺术中心',
    totalRevenue: 285680,
    websiteRevenue: 156420,
    wechatRevenue: 129260,
    totalRefunds: 8560,
    serviceFee: 14284,
    netAmount: 262836,
    status: 'completed',
    orders: [
      {
        orderId: 'o1',
        orderNo: 'TT202605150001',
        salesChannel: SalesChannel.WEBSITE,
        amount: 560,
        isMatched: true
      },
      {
        orderId: 'o2',
        orderNo: 'TT202605150002',
        salesChannel: SalesChannel.WECHAT_MINIAPP,
        amount: 840,
        isMatched: true
      }
    ],
    createdAt: '2026-06-01T10:00:00Z',
    confirmedVenueAt: '2026-06-02T14:00:00Z',
    confirmedOrganizerAt: '2026-06-03T09:30:00Z'
  },
  {
    id: 'set_2',
    month: '2026-05',
    performanceId: 'p2',
    performanceName: '新年交响音乐会',
    organizerId: 'org_2',
    organizerName: '某市交响乐团',
    totalRevenue: 682400,
    websiteRevenue: 412300,
    wechatRevenue: 270100,
    totalRefunds: 12800,
    serviceFee: 34120,
    netAmount: 635480,
    status: 'confirmed_venue',
    orders: [],
    createdAt: '2026-06-01T10:00:00Z',
    confirmedVenueAt: '2026-06-02T11:00:00Z'
  },
  {
    id: 'set_3',
    month: '2026-05',
    performanceId: 'p3',
    performanceName: '儿童剧《白雪公主》',
    organizerId: 'org_3',
    organizerName: '某儿童艺术剧团',
    totalRevenue: 158760,
    websiteRevenue: 68420,
    wechatRevenue: 90340,
    totalRefunds: 3200,
    serviceFee: 7938,
    netAmount: 147622,
    status: 'pending',
    orders: [
      {
        orderId: 'o3',
        orderNo: 'TT202605200015',
        salesChannel: SalesChannel.WEBSITE,
        amount: 280,
        isMatched: false
      }
    ],
    createdAt: '2026-06-01T10:00:00Z'
  },
  {
    id: 'set_4',
    month: '2026-04',
    performanceId: 'p4',
    performanceName: '天鹅湖芭蕾舞',
    organizerId: 'org_4',
    organizerName: '某芭蕾舞团',
    totalRevenue: 425800,
    websiteRevenue: 245600,
    wechatRevenue: 180200,
    totalRefunds: 6400,
    serviceFee: 21290,
    netAmount: 398110,
    status: 'completed',
    orders: [],
    createdAt: '2026-05-01T10:00:00Z',
    confirmedVenueAt: '2026-05-02T10:00:00Z',
    confirmedOrganizerAt: '2026-05-03T16:00:00Z'
  }
]

export default function SettlementList() {
  const [monthFilter, setMonthFilter] = useState<Dayjs | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [currentSettlement, setCurrentSettlement] = useState<Settlement | null>(null)

  const filteredSettlements = mockSettlements.filter((s) => {
    if (monthFilter && s.month !== monthFilter.format('YYYY-MM')) return false
    if (statusFilter && s.status !== statusFilter) return false
    return true
  })

  const totalAmount = filteredSettlements.reduce((sum, s) => sum + s.totalRevenue, 0)
  const totalNet = filteredSettlements.reduce((sum, s) => sum + s.netAmount, 0)
  const totalFee = filteredSettlements.reduce((sum, s) => sum + s.serviceFee, 0)
  const pendingCount = filteredSettlements.filter((s) => s.status === 'pending').length

  const openDetail = (record: Settlement) => {
    setCurrentSettlement(record)
    setDetailModalOpen(true)
  }

  const handleConfirmVenue = () => {
    message.success('场馆方已确认结算单')
    setDetailModalOpen(false)
  }

  const handleConfirmOrganizer = () => {
    message.success('主办方已确认结算单')
    setDetailModalOpen(false)
  }

  const handleExport = () => {
    message.success('结算单导出中，请稍候...')
  }

  const mismatchedCount = (currentSettlement?.orders || []).filter(
    (o) => !o.isMatched
  ).length

  const columns: ColumnsType<Settlement> = [
    {
      title: '结算月份',
      dataIndex: 'month',
      key: 'month',
      width: 110,
      render: (val) => val.replace('-', '年') + '月'
    },
    {
      title: '演出名称',
      dataIndex: 'performanceName',
      key: 'performanceName'
    },
    {
      title: '主办方',
      dataIndex: 'organizerName',
      key: 'organizerName'
    },
    {
      title: '总收入',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      align: 'right',
      width: 120,
      render: (val) => `¥${val.toLocaleString()}`
    },
    {
      title: '退款',
      dataIndex: 'totalRefunds',
      key: 'totalRefunds',
      align: 'right',
      width: 100,
      render: (val) => <span style={{ color: '#f5222d' }}>¥{val.toLocaleString()}</span>
    },
    {
      title: '手续费',
      dataIndex: 'serviceFee',
      key: 'serviceFee',
      align: 'right',
      width: 100,
      render: (val) => `¥${val.toLocaleString()}`
    },
    {
      title: '结算金额',
      dataIndex: 'netAmount',
      key: 'netAmount',
      align: 'right',
      width: 120,
      render: (val) => (
        <strong style={{ color: '#52c41a' }}>¥{val.toLocaleString()}</strong>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<FileExcelOutlined />}
            onClick={handleExport}
          >
            导出
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div className="card-header">
        <div className="card-title">财务结算单</div>
        <Space>
          <MonthPicker
            value={monthFilter}
            onChange={setMonthFilter}
            placeholder="选择月份"
            allowClear
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(statusLabels).map(([value, label]) => ({
              value,
              label
            }))}
          />
          <Popconfirm
            title={`是否生成 ${dayjs().format('YYYY年MM月')} 结算单？`}
            onConfirm={() => message.success('正在生成月度结算单...')}
          >
            <Button type="primary">生成月度结算</Button>
          </Popconfirm>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总收入" value={totalAmount} prefix="¥" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="结算净额" value={totalNet} prefix="¥" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="手续费" value={totalFee} prefix="¥" valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待确认"
              value={pendingCount}
              suffix="单"
              valueStyle={{ color: pendingCount > 0 ? '#f5222d' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredSettlements}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="结算单详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        width={720}
        footer={
          currentSettlement ? (
            <Space>
              <Button icon={<FileExcelOutlined />} onClick={handleExport}>
                导出Excel
              </Button>
              {(currentSettlement.status === 'pending' ||
                currentSettlement.status === 'confirmed_organizer') && (
                <Button type="primary" icon={<CheckOutlined />} onClick={handleConfirmVenue}>
                  场馆确认
                </Button>
              )}
              {(currentSettlement.status === 'pending' ||
                currentSettlement.status === 'confirmed_venue') && (
                <Button type="primary" icon={<CheckOutlined />} onClick={handleConfirmOrganizer}>
                  主办方确认
                </Button>
              )}
            </Space>
          ) : null
        }
      >
        {currentSettlement && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Alert
              type={mismatchedCount > 0 ? 'warning' : 'success'}
              showIcon
              message={
                mismatchedCount > 0
                  ? `发现 ${mismatchedCount} 条差异订单，请核对`
                  : '所有订单渠道数据已匹配一致'
              }
            />

            <Descriptions column={2} bordered size="small" title="基本信息">
              <Descriptions.Item label="结算月份">
                {currentSettlement.month.replace('-', '年')}月
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[currentSettlement.status]}>
                  {statusLabels[currentSettlement.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="演出名称" span={2}>
                {currentSettlement.performanceName}
              </Descriptions.Item>
              <Descriptions.Item label="主办方">{currentSettlement.organizerName}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(currentSettlement.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions column={2} bordered size="small" title="收入明细">
              <Descriptions.Item label="官网收入">
                ¥{currentSettlement.websiteRevenue.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="小程序收入">
                ¥{currentSettlement.wechatRevenue.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="总收入">
                <strong>¥{currentSettlement.totalRevenue.toLocaleString()}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="退款支出">
                <span style={{ color: '#f5222d' }}>
                  ¥{currentSettlement.totalRefunds.toLocaleString()}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="平台手续费(5%)">
                ¥{currentSettlement.serviceFee.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="应结算金额">
                <strong style={{ color: '#52c41a', fontSize: 16 }}>
                  ¥{currentSettlement.netAmount.toLocaleString()}
                </strong>
              </Descriptions.Item>
            </Descriptions>

            {currentSettlement.orders.length > 0 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  订单明细（共 {currentSettlement.orders.length} 条）
                </div>
                <List
                  size="small"
                  bordered
                  dataSource={currentSettlement.orders}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        item.isMatched ? (
                          <Tag color="green">已匹配</Tag>
                        ) : (
                          <Tag color="red">差异</Tag>
                        )
                      ]}
                    >
                      <List.Item.Meta
                        title={item.orderNo}
                        description={
                          <>
                            <Tag>{salesChannelLabels[item.salesChannel]}</Tag>
                            <span>金额：¥{item.amount.toLocaleString()}</span>
                          </>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  )
}
