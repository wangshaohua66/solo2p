import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Button,
  Space,
  Tag,
  Radio,
  Row,
  Col,
  Statistic,
  Divider,
  message,
  Modal,
  Form,
  Input,
  Select
} from 'antd'
import { ArrowLeftOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  fetchSeats,
  toggleSeatSelection,
  clearSelectedSeats,
  setTicketType,
  createOrder,
  payOrder
} from '@/store/ticketSlice'
import { fetchPerformance } from '@/store/performanceSlice'
import {
  SeatStatus,
  TicketType,
  PerformanceType,
  OrderStatus,
  PaymentChannel,
  SalesChannel
} from '@/types'
import type { Seat } from '@/types'
import { QRCodeSVG } from 'qrcode.react'

const ticketTypeLabels: Record<TicketType, string> = {
  [TicketType.EARLY_BIRD]: '早鸟票',
  [TicketType.REGULAR]: '正价票',
  [TicketType.STUDENT]: '学生票',
  [TicketType.GROUP]: '团体票'
}

const ticketTypeColors: Record<TicketType, string> = {
  [TicketType.EARLY_BIRD]: 'orange',
  [TicketType.REGULAR]: 'blue',
  [TicketType.STUDENT]: 'green',
  [TicketType.GROUP]: 'purple'
}

const typeLabels: Record<PerformanceType, string> = {
  [PerformanceType.DRAMA]: '话剧',
  [PerformanceType.CONCERT]: '音乐会',
  [PerformanceType.DANCE]: '舞蹈',
  [PerformanceType.OPERA]: '戏曲',
  [PerformanceType.CHILDREN]: '儿童剧'
}

export default function SeatSelector() {
  const { performanceId } = useParams<{ performanceId: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { seats, selectedSeats, currentTicketType, loading, currentOrder } = useAppSelector(
    (state) => state.ticket
  )
  const { currentPerformance } = useAppSelector((state) => state.performance)
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null)
  const [payModalVisible, setPayModalVisible] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [orderDetailVisible, setOrderDetailVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (performanceId) {
      dispatch(fetchSeats(performanceId))
      dispatch(fetchPerformance(performanceId))
    }
  }, [performanceId, dispatch])

  const seatMap = useMemo(() => {
    const map: Record<string, Seat[]> = {}
    seats.forEach((seat) => {
      if (!map[seat.sectionId]) {
        map[seat.sectionId] = []
      }
      map[seat.sectionId].push(seat)
    })
    return map
  }, [seats])

  const groupedByRow = useMemo(() => {
    const result: Record<string, Record<number, Seat[]>> = {}
    Object.entries(seatMap).forEach(([sectionId, sectionSeats]) => {
      result[sectionId] = {}
      sectionSeats.forEach((seat) => {
        if (!result[sectionId][seat.row]) {
          result[sectionId][seat.row] = []
        }
        result[sectionId][seat.row].push(seat)
      })
      Object.keys(result[sectionId]).forEach((row) => {
        result[sectionId][Number(row)].sort((a, b) => a.column - b.column)
      })
    })
    return result
  }, [seatMap])

  const sectionNames: Record<string, string> = useMemo(() => {
    const names: Record<string, string> = {}
    seats.forEach((s) => {
      if (!names[s.sectionId]) {
        const sectionMap: Record<string, string> = {
          pool: '池座',
          balcony: '楼座',
          box: '包厢',
          side: '侧翼'
        }
        names[s.sectionId] = sectionMap[s.sectionId] || s.sectionId
      }
    })
    return names
  }, [seats])

  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((sum, seat) => {
      let price = seat.price
      if (currentTicketType === TicketType.EARLY_BIRD) {
        price = Math.round(price * 0.85)
      } else if (currentTicketType === TicketType.STUDENT) {
        price = Math.round(price * 0.5)
      } else if (currentTicketType === TicketType.GROUP && selectedSeats.length >= 10) {
        price = Math.round(price * 0.8)
      }
      return sum + price
    }, 0)
  }, [selectedSeats, currentTicketType])

  const handleSeatClick = (seat: Seat) => {
    if (
      seat.status !== SeatStatus.AVAILABLE &&
      !selectedSeats.find((s) => s.id === seat.id)
    ) {
      return
    }
    dispatch(toggleSeatSelection(seat))
  }

  const handleCreateOrder = async () => {
    if (selectedSeats.length === 0) {
      message.warning('请先选择座位')
      return
    }
    if (currentTicketType === TicketType.GROUP && selectedSeats.length < 10) {
      message.warning('团体票需至少购买10张')
      return
    }
    if (currentTicketType === TicketType.STUDENT) {
      Modal.confirm({
        title: '学生票验证',
        content: '请确认持票人携带有效学生证入场，否则需补足差价',
        onOk: () => setPayModalVisible(true)
      })
    } else {
      setPayModalVisible(true)
    }
  }

  const handlePay = async () => {
    try {
      const values = await form.validateFields()
      setPayLoading(true)

      const result = await dispatch(
        createOrder({
          performanceId: performanceId!,
          seatIds: selectedSeats.map((s) => s.id),
          ticketType: currentTicketType,
          salesChannel: SalesChannel.WEBSITE
        })
      ).unwrap()

      await dispatch(
        payOrder({
          orderId: result.order.id,
          paymentChannel: values.paymentChannel
        })
      ).unwrap()

      message.success('支付成功！')
      setPayModalVisible(false)
      setOrderDetailVisible(true)
      dispatch(clearSelectedSeats())
    } catch (error: any) {
      message.error(error?.message || '支付失败')
    } finally {
      setPayLoading(false)
    }
  }

  const getSeatClass = (seat: Seat) => {
    const classes = ['seat-item']
    if (selectedSeats.find((s) => s.id === seat.id)) {
      classes.push('selected')
    } else {
      classes.push(seat.status)
    }
    return classes.join(' ')
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/performance/calendar')}>
          返回日历
        </Button>
      </Space>

      {currentPerformance && (
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <h2 style={{ marginBottom: 8 }}>{currentPerformance.name}</h2>
              <Space>
                <Tag color="blue">{typeLabels[currentPerformance.type]}</Tag>
                <Tag>{currentPerformance.venueName}</Tag>
                <Tag>
                  时长：{currentPerformance.expectedDuration}分钟
                </Tag>
              </Space>
              <div style={{ marginTop: 8, color: '#606266' }}>
                {currentPerformance.startTime &&
                  dayjs(currentPerformance.startTime).format('YYYY年MM月DD日 HH:mm')}
              </div>
            </Col>
            <Col>
              <Statistic title="已选座位" value={selectedSeats.length} suffix="个" />
            </Col>
            <Col>
              <Statistic
                title={
                  <Space>
                    应付金额
                    <Tag color={ticketTypeColors[currentTicketType]}>
                      {ticketTypeLabels[currentTicketType]}
                    </Tag>
                  </Space>
                }
                value={totalPrice}
                prefix="¥"
                valueStyle={{ color: '#f5222d' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">票价类型</div>
        </div>
        <Radio.Group
          value={currentTicketType}
          onChange={(e) => dispatch(setTicketType(e.target.value))}
          style={{ marginBottom: 16 }}
        >
          <Radio.Button value={TicketType.EARLY_BIRD}>
            早鸟票 (85折，开演前14天截止)
          </Radio.Button>
          <Radio.Button value={TicketType.REGULAR}>正价票</Radio.Button>
          <Radio.Button value={TicketType.STUDENT}>学生票 (5折)</Radio.Button>
          <Radio.Button value={TicketType.GROUP}>团体票 (满10张8折)</Radio.Button>
        </Radio.Group>

        <Divider />

        <div className="card-header">
          <div className="card-title">座位图例</div>
        </div>
        <Space wrap>
          <Space>
            <div className="seat-item available" style={{ cursor: 'default' }} />
            <span>可选</span>
          </Space>
          <Space>
            <div className="seat-item selected" style={{ cursor: 'default' }} />
            <span>已选</span>
          </Space>
          <Space>
            <div className="seat-item sold" style={{ cursor: 'default' }} />
            <span>已售</span>
          </Space>
          <Space>
            <div className="seat-item locked" style={{ cursor: 'default' }} />
            <span>锁定</span>
          </Space>
          <Space>
            <div className="seat-item maintenance" style={{ cursor: 'default' }} />
            <span>维修</span>
          </Space>
        </Space>
      </Card>

      {Object.entries(groupedByRow).map(([sectionId, rows]) => (
        <Card key={sectionId} style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title">{sectionNames[sectionId]}</div>
          </div>
          <div className="stage-diagram">舞 台</div>
          <div className="seat-grid">
            {Object.keys(rows)
              .sort((a, b) => Number(a) - Number(b))
              .map((rowNum) => (
                <div key={rowNum} className="seat-row">
                  <div
                    style={{
                      width: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#909399',
                      fontSize: 12
                    }}
                  >
                    {rowNum}排
                  </div>
                  {rows[Number(rowNum)].map((seat) => (
                    <div
                      key={seat.id}
                      className={getSeatClass(seat)}
                      onClick={() => handleSeatClick(seat)}
                      onMouseEnter={() => setHoveredSeat(seat)}
                      onMouseLeave={() => setHoveredSeat(null)}
                      title={`${seat.seatNumber} - ¥${seat.price}`}
                    >
                      {seat.column}
                    </div>
                  ))}
                  <div
                    style={{
                      width: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#909399',
                      fontSize: 12
                    }}
                  >
                    {rowNum}排
                  </div>
                </div>
              ))}
          </div>
        </Card>
      ))}

      {hoveredSeat && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 4,
            zIndex: 1000
          }}
        >
          {hoveredSeat.seatNumber} - ¥{hoveredSeat.price}
        </div>
      )}

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: '#fff',
          padding: '16px 24px',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
          borderRadius: 8,
          marginTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Space>
          <span>
            已选 <strong style={{ color: '#1677ff' }}>{selectedSeats.length}</strong> 个座位
          </span>
          <span>
            {selectedSeats.length > 0 && (
              <span>
                ({selectedSeats.map((s) => s.seatNumber).join(', ')})
              </span>
            )}
          </span>
          <span>
            合计：<strong style={{ color: '#f5222d', fontSize: 20 }}>¥{totalPrice}</strong>
          </span>
        </Space>
        <Space>
          <Button onClick={() => dispatch(clearSelectedSeats())}>清空选择</Button>
          <Button
            type="primary"
            icon={<ShoppingCartOutlined />}
            size="large"
            onClick={handleCreateOrder}
            disabled={selectedSeats.length === 0}
          >
            确认购票
          </Button>
        </Space>
      </div>

      <Modal
        title="选择支付方式"
        open={payModalVisible}
        onCancel={() => setPayModalVisible(false)}
        onOk={handlePay}
        confirmLoading={payLoading}
        okText="确认支付"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="paymentChannel"
            label="支付渠道"
            rules={[{ required: true, message: '请选择支付方式' }]}
            initialValue={PaymentChannel.WECHAT}
          >
            <Radio.Group>
              <Radio.Button value={PaymentChannel.ALIPAY}>支付宝</Radio.Button>
              <Radio.Button value={PaymentChannel.WECHAT}>微信支付</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <div style={{ padding: 16, background: '#f5f7fa', borderRadius: 4 }}>
            <div style={{ marginBottom: 8 }}>订单信息：</div>
            <div>演出：{currentPerformance?.name}</div>
            <div>座位：{selectedSeats.map((s) => s.seatNumber).join(', ')}</div>
            <div>
              票种：{ticketTypeLabels[currentTicketType]}
            </div>
            <div style={{ marginTop: 8, fontSize: 18, color: '#f5222d', fontWeight: 600 }}>
              支付金额：¥{totalPrice}
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#909399' }}>
            提示：支付超时10分钟自动取消订单
          </div>
        </Form>
      </Modal>

      <Modal
        title="订单详情"
        open={orderDetailVisible}
        onCancel={() => {
          setOrderDetailVisible(false)
          navigate(`/sales/order/${currentOrder?.id}`)
        }}
        footer={[
          <Button key="view" type="primary" onClick={() => navigate(`/sales/order/${currentOrder?.id}`)}>
            查看订单详情
          </Button>
        ]}
        width={500}
      >
        {currentOrder && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                color: '#52c41a',
                padding: '12px 24px',
                borderRadius: 4,
                marginBottom: 24,
                fontSize: 16,
                fontWeight: 500
              }}
            >
              支付成功！
            </div>
            <QRCodeSVG value={currentOrder.qrCode || currentOrder.orderNo} size={180} />
            <div style={{ marginTop: 16, fontSize: 16, fontWeight: 500 }}>
              订单号：{currentOrder.orderNo}
            </div>
            <div style={{ marginTop: 8, color: '#606266' }}>
              请出示此二维码入场核销
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
