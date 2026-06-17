import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Row,
  Col,
  Divider,
  List,
  message,
  Popconfirm,
  Alert
} from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, QrcodeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { QRCodeSVG } from 'qrcode.react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchSeats, refundOrder } from '@/store/ticketSlice'
import {
  OrderStatus,
  TicketType,
  PaymentChannel,
  SalesChannel,
  PerformanceType,
  SeatStatus
} from '@/types'

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

const paymentChannelLabels: Record<PaymentChannel, string> = {
  [PaymentChannel.ALIPAY]: '支付宝',
  [PaymentChannel.WECHAT]: '微信支付'
}

const salesChannelLabels: Record<SalesChannel, string> = {
  [SalesChannel.WEBSITE]: '场馆官网',
  [SalesChannel.WECHAT_MINIAPP]: '微信小程序'
}

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { currentOrder, seats } = useAppSelector((state) => state.ticket)

  useEffect(() => {
    if (orderId && currentOrder?.id !== orderId) {
      dispatch(fetchSeats(currentOrder?.performanceId || ''))
    }
  }, [orderId, currentOrder, dispatch])

  const handleRefund = async () => {
    if (!currentOrder) return
    try {
      await dispatch(refundOrder(currentOrder.id)).unwrap()
      message.success('退票申请已提交')
    } catch (error: any) {
      message.error(error?.message || '退票失败')
    }
  }

  const getRefundTip = () => {
    if (!currentOrder?.performanceId) return null
    const startTime = seats[0]?.performanceId
      ? dayjs().add(2, 'day')
      : dayjs().add(1, 'day')
    const daysDiff = startTime.diff(dayjs(), 'day')
    if (daysDiff >= 7) {
      return { type: 'success' as const, text: '距演出超过7天，退票免费' }
    } else if (daysDiff >= 3) {
      return { type: 'warning' as const, text: '距演出3-7天，退票收取20%手续费' }
    } else {
      return { type: 'error' as const, text: '距演出不足3天，不可退票' }
    }
  }

  const canRefund = currentOrder?.status === OrderStatus.PAID

  const tip = getRefundTip()
  const daysToShow = dayjs().add(5, 'day').diff(dayjs(), 'day')

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/performance/calendar')}>
          返回
        </Button>
      </Space>

      {currentOrder ? (
        <Row gutter={16}>
          <Col span={16}>
            <Card title="订单信息">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="订单号" span={2}>
                  <strong>{currentOrder.orderNo}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="订单状态">
                  <Tag color={statusColors[currentOrder.status]}>
                    {statusLabels[currentOrder.status]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="票种">
                  {ticketTypeLabels[currentOrder.ticketType]}
                </Descriptions.Item>
                <Descriptions.Item label="销售渠道">
                  {salesChannelLabels[currentOrder.salesChannel]}
                </Descriptions.Item>
                <Descriptions.Item label="支付渠道">
                  {currentOrder.paymentChannel
                    ? paymentChannelLabels[currentOrder.paymentChannel]
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="下单时间">
                  {dayjs(currentOrder.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                {currentOrder.paidAt && (
                  <Descriptions.Item label="支付时间" span={2}>
                    {dayjs(currentOrder.paidAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                )}
              </Descriptions>

              <Divider orientation="left">演出信息</Divider>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="演出名称" span={2}>
                  <strong>{currentOrder.performanceName}</strong>
                </Descriptions.Item>
              </Descriptions>

              <Divider orientation="left">座位信息</Divider>
              <List
                dataSource={currentOrder.seats}
                renderItem={(seat) => (
                  <List.Item>
                    <Row style={{ width: '100%' }} align="middle">
                      <Col span={8}>座位号：{seat.seatNumber}</Col>
                      <Col span={8}>
                        状态：
                        <Tag color={seat.status === SeatStatus.SOLD ? 'green' : 'default'}>
                          {seat.status === SeatStatus.SOLD ? '已售' : seat.status}
                        </Tag>
                      </Col>
                      <Col span={8} style={{ textAlign: 'right' }}>
                        <strong>¥{seat.price}</strong>
                      </Col>
                    </Row>
                  </List.Item>
                )}
              />

              <Divider orientation="left">费用明细</Divider>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="订单总额">¥{currentOrder.totalAmount}</Descriptions.Item>
                <Descriptions.Item label="优惠金额">¥{currentOrder.discountAmount}</Descriptions.Item>
                <Descriptions.Item label="实付金额" span={2}>
                  <strong style={{ color: '#f5222d', fontSize: 16 }}>
                    ¥{currentOrder.payAmount}
                  </strong>
                </Descriptions.Item>
                {currentOrder.status === OrderStatus.REFUNDED && (
                  <>
                    <Descriptions.Item label="退款金额">
                      ¥{currentOrder.refundAmount || 0}
                    </Descriptions.Item>
                    <Descriptions.Item label="退款手续费">
                      ¥{currentOrder.refundFee || 0}
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>

              {canRefund && tip && (
                <div style={{ marginTop: 16 }}>
                  <Alert
                    type={tip.type}
                    showIcon
                    message={tip.text}
                    action={
                      tip.type !== 'error' ? (
                        <Popconfirm
                          title={
                            tip.type === 'warning'
                              ? `将扣除20%手续费（¥${Math.round(currentOrder.payAmount * 0.2)}），确认退票？`
                              : '确认免费退票？'
                          }
                          onConfirm={handleRefund}
                        >
                          <Button danger size="small">
                            申请退票
                          </Button>
                        </Popconfirm>
                      ) : null
                    }
                  />
                </div>
              )}
            </Card>
          </Col>

          <Col span={8}>
            <Card
              title="电子票"
              extra={
                <Space>
                  <Button icon={<QrcodeOutlined />} size="small">
                    查看二维码
                  </Button>
                  <Button icon={<DownloadOutlined />} size="small">
                    保存图片
                  </Button>
                </Space>
              }
            >
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div
                  style={{
                    display: 'inline-block',
                    padding: 16,
                    background: '#fff',
                    border: '1px solid #e8e8e8',
                    borderRadius: 8
                  }}
                >
                  <QRCodeSVG
                    value={currentOrder.qrCode || currentOrder.orderNo}
                    size={200}
                    level="H"
                  />
                </div>
                <div style={{ marginTop: 16, color: '#606266' }}>
                  请在入场时出示此二维码核销
                </div>
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    background: '#f5f7fa',
                    borderRadius: 4,
                    fontSize: 12,
                    color: '#909399'
                  }}
                >
                  <div>订单号：{currentOrder.orderNo}</div>
                  <div>共 {currentOrder.seats.length} 张票</div>
                  <div>
                    座位：{currentOrder.seats.map((s) => s.seatNumber).join(', ')}
                  </div>
                </div>
              </div>
            </Card>

            <Card title="温馨提示" style={{ marginTop: 16 }}>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#606266', fontSize: 13, lineHeight: 2 }}>
                <li>请提前30分钟到场，配合安检入场</li>
                <li>一人一票，对号入座</li>
                <li>学生票请携带有效学生证</li>
                <li>演出开始后谢绝入场</li>
                <li>场内禁止摄像、录音</li>
              </ul>
            </Card>
          </Col>
        </Row>
      ) : (
        <Card loading>
          <div>订单加载中...</div>
        </Card>
      )}
    </div>
  )
}
