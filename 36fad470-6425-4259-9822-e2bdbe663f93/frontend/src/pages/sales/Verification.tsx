import { useState, useRef, useEffect } from 'react'
import {
  Card,
  Tabs,
  Input,
  Button,
  Space,
  Tag,
  List,
  Table,
  Statistic,
  Row,
  Col,
  Descriptions,
  message,
  Upload,
  Alert,
  Modal,
  Empty
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  QrcodeOutlined,
  SearchOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UploadOutlined,
  ScanOutlined,
  InboxOutlined
} from '@ant-design/icons'
import { useAppDispatch } from '@/store/hooks'
import { verifyTicket, verifyBatch } from '@/store/ticketSlice'
import { OrderStatus, TicketType } from '@/types'
import type { Order } from '@/types'
import type { UploadFile } from 'antd/es/upload/interface'

const { Dragger } = Upload

const ticketTypeLabels: Record<TicketType, string> = {
  [TicketType.EARLY_BIRD]: '早鸟票',
  [TicketType.REGULAR]: '正价票',
  [TicketType.STUDENT]: '学生票',
  [TicketType.GROUP]: '团体票'
}

const orderStatusLabels: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: '待支付',
  [OrderStatus.PAID]: '已支付',
  [OrderStatus.CANCELLED]: '已取消',
  [OrderStatus.REFUNDED]: '已退款',
  [OrderStatus.USED]: '已使用'
}

const orderStatusColors: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'orange',
  [OrderStatus.PAID]: 'blue',
  [OrderStatus.CANCELLED]: 'default',
  [OrderStatus.REFUNDED]: 'red',
  [OrderStatus.USED]: 'green'
}

interface BatchItem {
  key: string
  orderNo: string
}

interface BatchResult {
  key: string
  orderNo: string
  status: 'success' | 'failure' | 'skipped'
  message: string
}

interface VerifyResult {
  success: boolean
  order?: Order
  message?: string
  alreadyVerified?: boolean
}

const mockVerifyResult: (orderNo: string) => VerifyResult = (orderNo) => {
  const seed = orderNo.charCodeAt(orderNo.length - 1)
  if (seed % 5 === 0) {
    return { success: false, message: '订单不存在' }
  }
  if (seed % 5 === 1) {
    return {
      success: true,
      alreadyVerified: true,
      message: '该订单已核销',
      order: {
        id: 'o_' + orderNo,
        orderNo,
        performanceId: 'p1',
        performanceName: '《雷雨》经典话剧',
        userId: 'u1',
        userName: '张观众',
        seats: [
          {
            id: 's1',
            performanceId: 'p1',
            sectionId: 'sec1',
            row: 5,
            column: 8,
            seatNumber: '5排8号',
            status: 'used' as any,
            price: 380,
            ticketType: TicketType.REGULAR
          },
          {
            id: 's2',
            performanceId: 'p1',
            sectionId: 'sec1',
            row: 5,
            column: 9,
            seatNumber: '5排9号',
            status: 'used' as any,
            price: 380,
            ticketType: TicketType.REGULAR
          }
        ],
        totalAmount: 760,
        discountAmount: 0,
        payAmount: 760,
        ticketType: TicketType.REGULAR,
        status: OrderStatus.USED,
        salesChannel: 'website' as any,
        createdAt: '2026-06-15T10:30:00Z',
        usedAt: '2026-06-16T19:00:00Z',
        verifiedByName: '李检票'
      }
    }
  }
  return {
    success: true,
    order: {
      id: 'o_' + orderNo,
      orderNo,
      performanceId: 'p1',
      performanceName: '《雷雨》经典话剧',
      userId: 'u1',
      userName: '张观众',
      seats: [
        {
          id: 's1',
          performanceId: 'p1',
          sectionId: 'sec1',
          row: 5,
          column: 8,
          seatNumber: '5排8号',
          status: 'sold' as any,
          price: 380,
          ticketType: TicketType.REGULAR
        },
        {
          id: 's2',
          performanceId: 'p1',
          sectionId: 'sec1',
          row: 5,
          column: 9,
          seatNumber: '5排9号',
          status: 'sold' as any,
          price: 380,
          ticketType: TicketType.REGULAR
        }
      ],
      totalAmount: 760,
      discountAmount: 0,
      payAmount: 760,
      ticketType: TicketType.REGULAR,
      status: OrderStatus.PAID,
      salesChannel: 'website' as any,
      createdAt: '2026-06-15T10:30:00Z'
    }
  }
}

export default function Verification() {
  const dispatch = useAppDispatch()
  const [activeTab, setActiveTab] = useState('single')
  const [orderNoInput, setOrderNoInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraSupported, setCameraSupported] = useState(true)

  const [batchInput, setBatchInput] = useState('')
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [batchVerifying, setBatchVerifying] = useState(false)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])

  useEffect(() => {
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      setCameraSupported(true)
    } else {
      setCameraSupported(false)
    }
    return () => {
      stopCamera()
    }
  }, [])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraOpen(true)
      message.info('摄像头已开启，请将二维码对准画面。因浏览器限制，暂不支持原生解析，请手动输入订单号')
    } catch {
      setCameraSupported(false)
      message.warning('无法访问摄像头，请手动输入订单号')
    }
  }

  const closeCamera = () => {
    stopCamera()
    setCameraOpen(false)
  }

  const handleSingleVerify = async () => {
    const orderNo = orderNoInput.trim()
    if (!orderNo) {
      message.warning('请输入订单号')
      return
    }
    setVerifying(true)
    setVerifyResult(null)
    try {
      await dispatch(verifyTicket({ orderNo }))
      const result = mockVerifyResult(orderNo)
      setVerifyResult(result)
      if (result.success && !result.alreadyVerified) {
        message.success('核销成功')
      } else if (result.success && result.alreadyVerified) {
        message.warning(result.message)
      } else {
        message.error(result.message || '核销失败')
      }
    } catch {
      message.error('核销失败')
    } finally {
      setVerifying(false)
    }
  }

  const addBatchItems = () => {
    const lines = batchInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (lines.length === 0) {
      message.warning('请输入订单号')
      return
    }
    const existingNos = new Set(batchItems.map((item) => item.orderNo))
    const newItems: BatchItem[] = []
    lines.forEach((line) => {
      if (!existingNos.has(line)) {
        newItems.push({
          key: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          orderNo: line
        })
        existingNos.add(line)
      }
    })
    setBatchItems([...batchItems, ...newItems])
    setBatchInput('')
    message.success(`已添加 ${newItems.length} 条订单`)
  }

  const removeBatchItem = (key: string) => {
    setBatchItems(batchItems.filter((item) => item.key !== key))
  }

  const clearBatchItems = () => {
    setBatchItems([])
    setBatchResults([])
  }

  const handleBatchVerify = async () => {
    if (batchItems.length === 0) {
      message.warning('请先添加待核销的订单')
      return
    }
    setBatchVerifying(true)
    setBatchResults([])
    try {
      await dispatch(
        verifyBatch(batchItems.map((item) => ({ orderNo: item.orderNo })))
      )
      const results: BatchResult[] = batchItems.map((item) => {
        const result = mockVerifyResult(item.orderNo)
        let status: BatchResult['status'] = 'success'
        if (!result.success) {
          status = 'failure'
        } else if (result.alreadyVerified) {
          status = 'skipped'
        }
        return {
          key: item.key,
          orderNo: item.orderNo,
          status,
          message: result.message || (status === 'success' ? '核销成功' : status === 'skipped' ? '已核销，跳过' : '核销失败')
        }
      })
      setBatchResults(results)
      const successCount = results.filter((r) => r.status === 'success').length
      const failCount = results.filter((r) => r.status === 'failure').length
      const skipCount = results.filter((r) => r.status === 'skipped').length
      message.success(`批量核销完成：成功${successCount}，失败${failCount}，跳过${skipCount}`)
    } catch {
      message.error('批量核销失败')
    } finally {
      setBatchVerifying(false)
    }
  }

  const uploadProps = {
    accept: '.txt',
    multiple: false,
    showUploadList: false,
    beforeUpload: (file: UploadFile) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = (e.target?.result as string) || ''
        const lines = text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
        if (lines.length === 0) {
          message.warning('文件为空')
          return
        }
        setBatchInput(lines.join('\n'))
        message.success(`已读取 ${lines.length} 条订单号`)
      }
      reader.readAsText(file as unknown as File)
      return false
    }
  }

  const batchResultColumns: ColumnsType<BatchResult> = [
    {
      title: '序号',
      key: 'index',
      width: 80,
      render: (_, __, index) => index + 1
    },
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: BatchResult['status']) => {
        const map = {
          success: { color: 'green', text: '核销成功', icon: <CheckCircleOutlined /> },
          failure: { color: 'red', text: '核销失败', icon: <CloseCircleOutlined /> },
          skipped: { color: 'orange', text: '已跳过', icon: <CloseCircleOutlined /> }
        }
        const conf = map[status]
        return (
          <Tag color={conf.color} icon={conf.icon}>
            {conf.text}
          </Tag>
        )
      }
    },
    {
      title: '说明',
      dataIndex: 'message',
      key: 'message'
    }
  ]

  const totalCount = batchResults.length
  const successCount = batchResults.filter((r) => r.status === 'success').length
  const failCount = batchResults.filter((r) => r.status === 'failure').length
  const skipCount = batchResults.filter((r) => r.status === 'skipped').length

  const renderSingleTab = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="扫码/输入订单号">
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="请输入订单号或扫码"
            value={orderNoInput}
            onChange={(e) => setOrderNoInput(e.target.value)}
            onPressEnter={handleSingleVerify}
            size="large"
            allowClear
          />
          {cameraSupported && (
            <Button
              size="large"
              icon={<ScanOutlined />}
              onClick={cameraOpen ? closeCamera : startCamera}
            >
              {cameraOpen ? '关闭扫码' : '扫码'}
            </Button>
          )}
          <Button
            type="primary"
            size="large"
            icon={<SearchOutlined />}
            onClick={handleSingleVerify}
            loading={verifying}
          >
            核销
          </Button>
        </Space.Compact>
        {!cameraSupported && (
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            showIcon
            message="当前浏览器不支持摄像头访问，请手动输入订单号进行核销"
          />
        )}
      </Card>

      {cameraOpen && (
        <Card title="摄像头扫码">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                width: '100%',
                maxWidth: 480,
                aspectRatio: '4 / 3',
                background: '#000',
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none'
                }}
              >
                <div
                  style={{
                    width: 200,
                    height: 200,
                    border: '2px dashed #52c41a',
                    borderRadius: 8
                  }}
                />
              </div>
            </div>
          </div>
          <Alert
            style={{ marginTop: 12 }}
            type="warning"
            showIcon
            message="浏览器原生条码解析受限，请直接在上方输入框手动输入订单号进行核销"
          />
        </Card>
      )}

      <Card title="核销结果">
        {verifyResult === null ? (
          <Empty description="请输入订单号并点击核销" />
        ) : verifyResult.success ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Alert
              type={verifyResult.alreadyVerified ? 'warning' : 'success'}
              showIcon
              icon={verifyResult.alreadyVerified ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              message={
                verifyResult.alreadyVerified ? '该订单已核销过' : '核销成功'
              }
              description={verifyResult.message || ''}
            />
            {verifyResult.order && (
              <>
                <Descriptions column={2} bordered size="small" title="订单信息">
                  <Descriptions.Item label="订单号">
                    {verifyResult.order.orderNo}
                  </Descriptions.Item>
                  <Descriptions.Item label="订单状态">
                    <Tag color={orderStatusColors[verifyResult.order.status]}>
                      {orderStatusLabels[verifyResult.order.status]}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="演出名称" span={2}>
                    {verifyResult.order.performanceName}
                  </Descriptions.Item>
                  <Descriptions.Item label="购票人">
                    {verifyResult.order.userName}
                  </Descriptions.Item>
                  <Descriptions.Item label="票种">
                    {ticketTypeLabels[verifyResult.order.ticketType]}
                  </Descriptions.Item>
                  <Descriptions.Item label="应付金额">
                    <span style={{ color: '#f5222d', fontWeight: 500 }}>
                      ¥{verifyResult.order.payAmount.toLocaleString()}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="下单时间">
                    {new Date(verifyResult.order.createdAt).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                  {verifyResult.order.usedAt && (
                    <Descriptions.Item label="核销时间">
                      {new Date(verifyResult.order.usedAt).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                  )}
                  {verifyResult.order.verifiedByName && (
                    <Descriptions.Item label="核销人">
                      {verifyResult.order.verifiedByName}
                    </Descriptions.Item>
                  )}
                </Descriptions>
                <Descriptions column={1} bordered size="small" title={`座位列表（${verifyResult.order.seats.length}个座位）`}>
                  {verifyResult.order.seats.map((seat, idx) => (
                    <Descriptions.Item key={seat.id} label={`座位${idx + 1}`}>
                      <Space>
                        <Tag color="blue">{seat.seatNumber}</Tag>
                        <Tag>{ticketTypeLabels[seat.ticketType || TicketType.REGULAR]}</Tag>
                        <span>¥{seat.price.toLocaleString()}</span>
                      </Space>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </>
            )}
          </Space>
        ) : (
          <Alert
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
            message="核销失败"
            description={verifyResult.message || '订单号无效或其他错误'}
          />
        )}
      </Card>
    </Space>
  )

  const renderBatchTab = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="批量输入订单号">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input.TextArea
            rows={5}
            placeholder="每行输入一个订单号，支持粘贴"
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
          />
          <Space>
            <Button icon={<InboxOutlined />} onClick={addBatchItems}>
              解析到待核销列表
            </Button>
            <Dragger {...uploadProps} style={{ display: 'inline-block', width: 'auto' }}>
              <Button icon={<UploadOutlined />}>上传TXT文件</Button>
            </Dragger>
          </Space>
        </Space>
      </Card>

      <Card
        title={`待核销列表（${batchItems.length}条）`}
        extra={
          <Space>
            <Button onClick={clearBatchItems} disabled={batchItems.length === 0}>
              清空列表
            </Button>
            <Button
              type="primary"
              icon={<QrcodeOutlined />}
              onClick={handleBatchVerify}
              loading={batchVerifying}
              disabled={batchItems.length === 0}
            >
              开始核销
            </Button>
          </Space>
        }
      >
        {batchItems.length === 0 ? (
          <Empty description="暂无待核销订单" />
        ) : (
          <List
            size="small"
            bordered
            dataSource={batchItems}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <Button
                    key="delete"
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeBatchItem(item.key)}
                  />
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#e6f4ff',
                        color: '#1677ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 500
                      }}
                    >
                      {index + 1}
                    </div>
                  }
                  title={item.orderNo}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {batchResults.length > 0 && (
        <>
          <Card title="核销统计">
            <Row gutter={16}>
              <Col span={6}>
                <Card>
                  <Statistic title="总数" value={totalCount} suffix="单" />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="成功"
                    value={successCount}
                    suffix="单"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="失败"
                    value={failCount}
                    suffix="单"
                    valueStyle={{ color: '#f5222d' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="跳过"
                    value={skipCount}
                    suffix="单"
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
            </Row>
          </Card>

          <Card title="核销明细">
            <Table
              columns={batchResultColumns}
              dataSource={batchResults}
              rowKey="key"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </>
      )}
    </Space>
  )

  return (
    <div>
      <div className="card-header">
        <div className="card-title">入场扫码核销</div>
      </div>
      <Card
        bodyStyle={{ paddingTop: 0 }}
        tabList={[
          { key: 'single', label: '单张核销' },
          { key: 'batch', label: '批量核销' }
        ]}
        activeTabKey={activeTab}
        onTabChange={setActiveTab}
        tabBarExtraContent={
          <Tag icon={<QrcodeOutlined />} color="blue">
            实时核销
          </Tag>
        }
      >
        <Tabs.TabPane tab="" key="single">
          {renderSingleTab()}
        </Tabs.TabPane>
        <Tabs.TabPane tab="" key="batch">
          {renderBatchTab()}
        </Tabs.TabPane>
      </Card>

      <Modal
        title="扫码核销"
        open={cameraOpen}
        onCancel={closeCamera}
        footer={null}
        width={560}
        destroyOnClose
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              aspectRatio: '4 / 3',
              background: '#000',
              borderRadius: 8,
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
