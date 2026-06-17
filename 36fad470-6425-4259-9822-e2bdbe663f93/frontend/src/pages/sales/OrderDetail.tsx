import { useEffect, useRef, useState, useCallback } from 'react'
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
  Alert,
  Modal,
  App
} from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, QrcodeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { QRCodeCanvas } from 'qrcode.react'
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

  const { modal } = App.useApp()
  const qrWrapperRef = useRef<HTMLDivElement>(null)
  const highQrWrapperRef = useRef<HTMLDivElement>(null)

  const getQrCanvas = (high = false): HTMLCanvasElement | null => {
    const wrapper = high ? highQrWrapperRef.current : qrWrapperRef.current
    if (!wrapper) return null
    return wrapper.querySelector('canvas')
  }
  const touchTimerRef = useRef<number | null>(null)
  const touchMovedRef = useRef(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [cardImageUrl, setCardImageUrl] = useState('')
  const [actionSheetOpen, setActionSheetOpen] = useState(false)

  useEffect(() => {
    if (orderId && currentOrder?.id !== orderId) {
      dispatch(fetchSeats(currentOrder?.performanceId || ''))
    }
  }, [orderId, currentOrder, dispatch])

  const isMobile = useCallback(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  }, [])

  const generateCardImage = useCallback(async (): Promise<string> => {
    if (!currentOrder) return ''

    const highQrForWait = getQrCanvas(true)
    if (highQrForWait) {
      if (typeof highQrForWait.toDataURL === 'function') {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    const cardWidth = 750
    const cardHeight = 1100
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = cardWidth
    tempCanvas.height = cardHeight
    const ctx = tempCanvas.getContext('2d')
    if (!ctx) return ''

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, cardWidth, cardHeight)

    ctx.fillStyle = '#000000'
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    const performanceName = currentOrder.performanceName || ''
    const maxWidth = 650
    let displayName = performanceName
    if (ctx.measureText(performanceName).width > maxWidth) {
      let truncated = performanceName
      while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1)
      }
      displayName = truncated + '...'
    }
    ctx.fillText(displayName, cardWidth / 2, 70)

    const highQrCanvas = getQrCanvas(true)
    if (highQrCanvas) {
      const qrSize = 512
      const qrX = (cardWidth - qrSize) / 2
      const qrY = 120
      ctx.drawImage(highQrCanvas, qrX, qrY, qrSize, qrSize)

      ctx.strokeStyle = '#e8e8e8'
      ctx.lineWidth = 2
      ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20)
    }

    ctx.fillStyle = '#333333'
    ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'

    const infoStartY = 700
    ctx.fillText(`订单号：${currentOrder.orderNo}`, cardWidth / 2, infoStartY)
    ctx.fillText(
      `座位数：${currentOrder.seats.length} 张`,
      cardWidth / 2,
      infoStartY + 50
    )
    ctx.fillStyle = '#f5222d'
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(
      `订单金额：¥${currentOrder.payAmount}`,
      cardWidth / 2,
      infoStartY + 110
    )

    ctx.fillStyle = '#999999'
    ctx.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText('请在入场时出示此二维码核销', cardWidth / 2, infoStartY + 180)

    return tempCanvas.toDataURL('image/png')
  }, [currentOrder])

  const handleDownload = useCallback(async () => {
    if (!currentOrder) return
    try {
      await new Promise((resolve) => setTimeout(resolve, 200))
      const dataUrl = await generateCardImage()
      if (!dataUrl) {
        message.error('生成图片失败')
        return
      }
      const link = document.createElement('a')
      link.download = `订单二维码-${currentOrder.orderNo}.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      message.success('图片已保存')
    } catch (error) {
      console.error('下载失败', error)
      message.error('保存图片失败')
    }
  }, [currentOrder, generateCardImage])

  const handleSaveQrCode = useCallback(async () => {
    if (!currentOrder) return
    try {
      await new Promise((resolve) => setTimeout(resolve, 100))
      const canvas = getQrCanvas(true) || getQrCanvas(false)
      if (!canvas) {
        message.error('获取二维码失败')
        return
      }
      const dataUrl = canvas.toDataURL('image/png')
      if (isMobile()) {
        setCardImageUrl(dataUrl)
        setQrModalOpen(true)
        modal.info({
          title: '保存提示',
          content: '请长按图片，选择"保存到相册"或通过浏览器菜单保存',
          okText: '我知道了'
        })
      } else {
        const link = document.createElement('a')
        link.download = `order-${currentOrder.orderNo}.png`
        link.href = dataUrl
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        message.success('图片已开始下载')
      }
      setActionSheetOpen(false)
    } catch (error) {
      console.error('保存二维码失败', error)
      message.error('保存图片失败')
    }
  }, [currentOrder, isMobile, modal])

  const handleCopyQrContent = useCallback(async () => {
    if (!currentOrder) return
    try {
      const content = currentOrder.qrCode || currentOrder.orderNo
      await navigator.clipboard.writeText(content)
      message.success('二维码内容已复制')
      setActionSheetOpen(false)
    } catch (error) {
      console.error('复制失败', error)
      message.error('复制失败，请手动复制')
    }
  }, [currentOrder])

  const handleLongPress = useCallback(() => {
    if (!currentOrder) return
    setActionSheetOpen(true)
  }, [currentOrder])

  const handleTouchStart = useCallback(() => {
    touchMovedRef.current = false
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
    }
    touchTimerRef.current = window.setTimeout(() => {
      if (!touchMovedRef.current) {
        handleLongPress()
      }
    }, 500)
  }, [handleLongPress])

  const handleTouchMove = useCallback(() => {
    touchMovedRef.current = true
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      handleLongPress()
    },
    [handleLongPress]
  )

  useEffect(() => {
    return () => {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current)
      }
    }
  }, [])

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

              {currentOrder.status === OrderStatus.USED && (
                <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
                  <Descriptions.Item label="核销时间" span={2}>
                    <Tag color="blue">已核销</Tag>{' '}
                    {currentOrder.usedAt
                      ? dayjs(currentOrder.usedAt).format('YYYY-MM-DD HH:mm:ss')
                      : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="核销人" span={2}>
                    {currentOrder.verifiedByName || '-'}
                  </Descriptions.Item>
                </Descriptions>
              )}

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
                  <Button
                    icon={<QrcodeOutlined />}
                    size="small"
                    onClick={() => {
                      setQrModalOpen(true)
                      handleLongPress()
                    }}
                  >
                    查看二维码
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    size="small"
                    onClick={handleDownload}
                  >
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
                    borderRadius: 8,
                    cursor: 'pointer',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none'
                  }}
                  onContextMenu={handleContextMenu}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <div ref={qrWrapperRef}>
                  <QRCodeCanvas
                    value={currentOrder.qrCode || currentOrder.orderNo}
                    size={200}
                    level="H"
                  />
                </div>
                </div>
                <div style={{ display: 'none' }} onContextMenu={(e) => e.preventDefault()}>
                  <div ref={highQrWrapperRef}>
                    <QRCodeCanvas
                      value={currentOrder.qrCode || currentOrder.orderNo}
                      size={512}
                      level="H"
                    />
                  </div>
                </div>
                <div style={{ marginTop: 16, color: '#606266', fontSize: 13 }}>
                  请在入场时出示此二维码核销
                </div>
                <div
                  style={{
                    marginTop: 12,
                    color: '#909399',
                    fontSize: 12
                  }}
                >
                  长按二维码可保存图片
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

      <Modal
        open={qrModalOpen}
        footer={null}
        onCancel={() => setQrModalOpen(false)}
        centered
      >
        <div style={{ textAlign: 'center', padding: 16 }}>
          {cardImageUrl ? (
            <img
              src={cardImageUrl}
              alt="订单二维码"
              style={{ maxWidth: '100%', maxHeight: '70vh' }}
            />
          ) : (
            currentOrder && (
              <QRCodeCanvas
                value={currentOrder.qrCode || currentOrder.orderNo}
                size={320}
                level="H"
              />
            )
          )}
          <div style={{ marginTop: 16, color: '#909399', fontSize: 12 }}>
            长按图片可保存到相册
          </div>
        </div>
      </Modal>

      <Modal
        open={actionSheetOpen}
        footer={null}
        onCancel={() => setActionSheetOpen(false)}
        centered
        style={{ maxWidth: 320 }}
        styles={{ body: { padding: 0 } }}
      >
        <div
          onClick={handleSaveQrCode}
          style={{
            padding: '16px 24px',
            fontSize: 16,
            textAlign: 'center',
            borderBottom: '1px solid #f0f0f0',
            cursor: 'pointer'
          }}
        >
          保存到相册
        </div>
        <div
          onClick={handleCopyQrContent}
          style={{
            padding: '16px 24px',
            fontSize: 16,
            textAlign: 'center',
            borderBottom: '1px solid #f0f0f0',
            cursor: 'pointer'
          }}
        >
          复制二维码内容
        </div>
        <div
          onClick={() => setActionSheetOpen(false)}
          style={{
            padding: '16px 24px',
            fontSize: 16,
            textAlign: 'center',
            color: '#909399',
            cursor: 'pointer'
          }}
        >
          取消
        </div>
      </Modal>
    </div>
  )
}
