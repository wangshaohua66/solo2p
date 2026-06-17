import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, List, Tag, Skeleton, Empty, Button, Space, Select } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { OrderStatus, Order, TicketType } from '@/types'

const statusColors: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'orange',
  [OrderStatus.PAID]: 'green',
  [OrderStatus.CANCELLED]: 'default',
  [OrderStatus.REFUNDED]: 'red',
  [OrderStatus.USED]: 'blue'
}

const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: '待支付',
  [OrderStatus.PAID]: '已支付',
  [OrderStatus.CANCELLED]: '已取消',
  [OrderStatus.REFUNDED]: '已退款',
  [OrderStatus.USED]: '已使用'
}

const ticketTypeLabels: Record<TicketType, string> = {
  [TicketType.EARLY_BIRD]: '早鸟票',
  [TicketType.REGULAR]: '正价票',
  [TicketType.STUDENT]: '学生票',
  [TicketType.GROUP]: '团体票'
}

const mockOrders: Order[] = [
  {
    id: '1',
    orderNo: 'YT202401150001',
    performanceId: 'p1',
    performanceName: '经典话剧《茶馆》',
    userId: 'u1',
    userName: '观众',
    seats: [],
    totalAmount: 580,
    discountAmount: 0,
    payAmount: 580,
    ticketType: TicketType.REGULAR,
    status: OrderStatus.PAID,
    salesChannel: 'website' as any,
    createdAt: '2024-01-15T10:30:00Z',
    paidAt: '2024-01-15T10:35:00Z'
  },
  {
    id: '2',
    orderNo: 'YT202401100002',
    performanceId: 'p2',
    performanceName: '新年交响音乐会',
    userId: 'u1',
    userName: '观众',
    seats: [],
    totalAmount: 1280,
    discountAmount: 128,
    payAmount: 1152,
    ticketType: TicketType.EARLY_BIRD,
    status: OrderStatus.USED,
    salesChannel: 'website' as any,
    createdAt: '2024-01-10T14:20:00Z',
    paidAt: '2024-01-10T14:25:00Z',
    usedAt: '2024-01-12T19:30:00Z'
  },
  {
    id: '3',
    orderNo: 'YT202401080003',
    performanceId: 'p3',
    performanceName: '儿童剧《白雪公主》',
    userId: 'u1',
    userName: '观众',
    seats: [],
    totalAmount: 360,
    discountAmount: 0,
    payAmount: 360,
    ticketType: TicketType.STUDENT,
    status: OrderStatus.PENDING,
    salesChannel: 'website' as any,
    createdAt: '2024-01-08T09:15:00Z'
  }
]

export default function OrderList() {
  const navigate = useNavigate()
  const [loading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  const filteredOrders = statusFilter
    ? mockOrders.filter((order) => order.status === statusFilter)
    : mockOrders

  return (
    <div>
      <Card
        title="我的订单"
        extra={
          <Space>
            <Select
              placeholder="全部状态"
              allowClear
              style={{ width: 140 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={Object.entries(statusLabels).map(([value, label]) => ({
                value,
                label
              }))}
            />
          </Space>
        }
      >
        {loading ? (
          <List
            itemLayout="vertical"
            dataSource={[1, 2, 3]}
            renderItem={() => (
              <List.Item>
                <Skeleton active paragraph={{ rows: 3 }} />
              </List.Item>
            )}
          />
        ) : filteredOrders.length > 0 ? (
          <List
            itemLayout="vertical"
            dataSource={filteredOrders}
            renderItem={(order) => (
              <List.Item
                key={order.id}
                extra={
                  <Button
                    type="link"
                    onClick={() => navigate(`/sales/order/${order.id}`)}
                  >
                    查看详情 <ArrowRightOutlined />
                  </Button>
                }
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span style={{ fontSize: 16, fontWeight: 500 }}>
                        {order.performanceName}
                      </span>
                      <Tag color={statusColors[order.status]}>
                        {statusLabels[order.status]}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div style={{ color: '#909399', fontSize: 13 }}>
                      订单号：{order.orderNo}
                    </div>
                  }
                />
                <Space split={<span style={{ color: '#dcdfe6' }}>|</span>} size="middle">
                  <span>
                    <Tag color="blue">{ticketTypeLabels[order.ticketType]}</Tag>
                  </span>
                  <span>下单时间：{dayjs(order.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                  <span style={{ color: '#f5222d', fontWeight: 500 }}>
                    实付：¥{order.payAmount}
                  </span>
                </Space>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无订单记录" />
        )}
      </Card>
    </div>
  )
}
