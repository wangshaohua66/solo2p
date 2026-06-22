import React, { useEffect, useState } from 'react'
import {
  Calendar,
  Card,
  Typography,
  Row,
  Col,
  Select,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  Tag,
  List,
  Badge,
  Alert,
  message,
  Spin,
  Empty,
} from 'antd'
import {
  CalendarOutlined,
  UserOutlined,
  AppstoreOutlined,
  TeamOutlined,
  PhoneOutlined,
  MailOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { bookingApi } from '@/api/booking'
import { inheritorApi } from '@/api/inheritor'
import { heritageApi } from '@/api/heritage'
import { Booking, Inheritor, Heritage, BookingStatusMap, BookingStatus } from '@/types'
import type { BadgeProps } from 'antd'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { Option } = Select
const { TextArea } = Input

const BookingCalendar: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [selectedInheritor, setSelectedInheritor] = useState<string>('')
  const [selectedHeritage, setSelectedHeritage] = useState<string>('')
  const [inheritors, setInheritors] = useState<Inheritor[]>([])
  const [heritages, setHeritages] = useState<Heritage[]>([])
  const [dayBookings, setDayBookings] = useState<Booking[]>([])
  const [monthBookings, setMonthBookings] = useState<Booking[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [inhRes, herRes] = await Promise.all([
          inheritorApi.getPublicList({ size: 100 }),
          heritageApi.getPublicList({ size: 100 }),
        ])
        const inhData = inhRes.data as any
        const herData = herRes.data as any
        setInheritors(inhData?.content || [])
        setHeritages(herData?.content || [])
      } catch (error) {
        console.error('Failed to fetch data:', error)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedInheritor) {
      fetchMonthBookings(selectedInheritor, selectedDate)
    } else {
      setMonthBookings([])
      setDayBookings([])
    }
  }, [selectedInheritor, selectedDate])

  const fetchMonthBookings = async (inheritorId: string, date: Dayjs) => {
    setLoading(true)
    try {
      const start = date.startOf('month').toISOString()
      const end = date.endOf('month').toISOString()
      const res = await bookingApi.getCalendar(inheritorId, start, end)
      setMonthBookings(res.data || [])
      const dayRes = dayBookings.filter(
        (b) => dayjs(b.startTime).format('YYYY-MM-DD') === date.format('YYYY-MM-DD')
      )
      setDayBookings(dayRes)
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDate = async (date: Dayjs) => {
    setSelectedDate(date)
    if (selectedInheritor) {
      try {
        const start = date.startOf('day').toISOString()
        const end = date.endOf('day').toISOString()
        const res = await bookingApi.getCalendar(selectedInheritor, start, end)
        setDayBookings(res.data || [])
      } catch (error) {
        console.error('Failed to fetch day bookings:', error)
      }
    }
  }

  const handleSubmitBooking = async (values: any) => {
    const token = localStorage.getItem('heritage_token')
    if (!token) {
      message.warning('请先登录后再预约')
      return
    }

    setSubmitting(true)
    try {
      const [startTime, endTime] = values.timeRange
      const res = await bookingApi.checkConflict(
        selectedInheritor,
        startTime.toISOString(),
        endTime.toISOString()
      )

      if (res.data?.hasConflict) {
        message.error('所选时间段已有预约，请重新选择时间')
        return
      }

      await bookingApi.create({
        heritageId: selectedHeritage,
        inheritorId: selectedInheritor,
        institutionName: values.institutionName,
        contactPerson: values.contactPerson,
        contactPhone: values.contactPhone,
        contactEmail: values.contactEmail,
        participantCount: values.participantCount,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        location: values.location || '非遗保护中心',
        content: values.content,
        specialRequirements: values.specialRequirements,
        status: BookingStatus.PENDING,
      })

      message.success('预约申请已提交，请等待审批')
      setModalVisible(false)
      form.resetFields()
      fetchMonthBookings(selectedInheritor, selectedDate)
    } catch (error) {
      console.error('Failed to submit booking:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: BookingStatus): BadgeProps['status'] => {
    switch (status) {
      case BookingStatus.PENDING:
        return 'warning'
      case BookingStatus.APPROVED:
        return 'success'
      case BookingStatus.REJECTED:
        return 'error'
      case BookingStatus.COMPLETED:
        return 'default'
      case BookingStatus.CANCELLED:
        return 'default'
    }
  }

  const dateCellRender = (value: Dayjs) => {
    const dateStr = value.format('YYYY-MM-DD')
    const bookings = monthBookings.filter((b) => {
      const bStart = dayjs(b.startTime).format('YYYY-MM-DD')
      const bEnd = dayjs(b.endTime).format('YYYY-MM-DD')
      return dateStr >= bStart && dateStr <= bEnd
    })

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {bookings.slice(0, 2).map((b) => (
          <li key={b.id}>
            <Badge
              status={getStatusColor(b.status)}
              text={
                <span style={{ fontSize: 11, color: '#a0a0a0' }}>
                  {dayjs(b.startTime).format('HH:mm')} {b.institutionName}
                </span>
              }
            />
          </li>
        ))}
        {bookings.length > 2 && (
          <li style={{ fontSize: 11, color: '#707070' }}>还有 {bookings.length - 2} 个预约</li>
        )}
      </ul>
    )
  }

  return (
    <div>
      <Title level={2} style={{ color: '#c8a96e', marginBottom: 24 }}>
        <CalendarOutlined /> 研学预约
      </Title>

      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="预约须知"
        description={
          <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
            <li>请提前至少3天提交预约申请</li>
            <li>提交后1-2个工作日内完成审批</li>
            <li>如需取消请提前24小时操作</li>
          </ul>
        }
        style={{ marginBottom: 24, borderRadius: 8 }}
      />

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            style={{ borderRadius: 12 }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ color: '#c8a96e' }}>预约日历</span>
                <Select
                  placeholder="选择传承人"
                  style={{ width: 200 }}
                  value={selectedInheritor}
                  onChange={(val) => setSelectedInheritor(val)}
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {inheritors.map((i) => (
                    <Option key={i.id} value={i.id}>
                      {i.name} - {i.region}
                    </Option>
                  ))}
                </Select>
                <Select
                  placeholder="选择非遗项目"
                  style={{ width: 200 }}
                  value={selectedHeritage}
                  onChange={(val) => setSelectedHeritage(val)}
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {heritages.map((h) => (
                    <Option key={h.id} value={h.id}>
                      {h.name}
                    </Option>
                  ))}
                </Select>
              </div>
            }
            extra={
              <Button
                type="primary"
                icon={<CalendarOutlined />}
                disabled={!selectedInheritor}
                onClick={() => setModalVisible(true)}
              >
                提交预约
              </Button>
            }
          >
            {!selectedInheritor ? (
              <Empty description="请先选择传承人以查看档期" style={{ padding: 48 }} />
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <Spin size="large" />
              </div>
            ) : (
              <Calendar
                value={selectedDate}
                onSelect={handleSelectDate}
                dateCellRender={dateCellRender}
                cellRender={dateCellRender as any}
                fullscreen
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <span style={{ color: '#c8a96e' }}>
                {selectedDate.format('YYYY年MM月DD日')} 档期
              </span>
            }
            style={{ borderRadius: 12, marginBottom: 24 }}
          >
            {dayBookings.length === 0 ? (
              <Empty description="当日暂无预约" style={{ padding: 24 }} />
            ) : (
              <List
                dataSource={dayBookings}
                renderItem={(item) => (
                  <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #2d3a4f' }}>
                    <List.Item.Meta
                      title={
                        <div>
                          <Badge status={getStatusColor(item.status)} />
                          <span style={{ color: '#e8e8e8', marginLeft: 8 }}>
                            {item.institutionName}
                          </span>
                        </div>
                      }
                      description={
                        <div>
                          <div style={{ color: '#a0a0a0', fontSize: 12 }}>
                            {dayjs(item.startTime).format('HH:mm')} - {dayjs(item.endTime).format('HH:mm')}
                          </div>
                          <div style={{ color: '#707070', fontSize: 12, marginTop: 4 }}>
                            {BookingStatusMap[item.status]} · {item.participantCount}人
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card title={<span style={{ color: '#c8a96e' }}>预约状态说明</span>} style={{ borderRadius: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <Badge status="warning" /> <Text style={{ color: '#e8e8e8' }}>待审批 - 等待工作人员审核</Text>
              </div>
              <div>
                <Badge status="success" /> <Text style={{ color: '#e8e8e8' }}>已批准 - 预约确认成功</Text>
              </div>
              <div>
                <Badge status="error" /> <Text style={{ color: '#e8e8e8' }}>已拒绝 - 预约申请未通过</Text>
              </div>
              <div>
                <Badge status="default" /> <Text style={{ color: '#e8e8e8' }}>已完成/已取消</Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title="提交研学预约申请"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitBooking}
          initialValues={{
            participantCount: 20,
            location: '非遗保护中心',
            timeRange: [
              selectedDate.hour(9).minute(0),
              selectedDate.hour(11).minute(30),
            ],
          }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span><AppstoreOutlined /> 非遗项目</span>}
                name="heritageId"
                rules={[{ required: true, message: '请选择非遗项目' }]}
              >
                <Select placeholder="请选择非遗项目" value={selectedHeritage} onChange={setSelectedHeritage}>
                  {heritages.map((h) => (
                    <Option key={h.id} value={h.id}>
                      {h.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span><UserOutlined /> 传承人</span>}
                name="inheritorId"
                rules={[{ required: true, message: '请选择传承人' }]}
              >
                <Select placeholder="请选择传承人" value={selectedInheritor} onChange={setSelectedInheritor}>
                  {inheritors.map((i) => (
                    <Option key={i.id} value={i.id}>
                      {i.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span><TeamOutlined /> 机构/学校名称</span>}
                name="institutionName"
                rules={[{ required: true, message: '请输入机构名称' }]}
              >
                <Input placeholder="请输入机构/学校名称" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span><TeamOutlined /> 参与人数</span>}
                name="participantCount"
                rules={[{ required: true, message: '请输入参与人数' }]}
              >
                <InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="请输入人数" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label={<span><CalendarOutlined /> 预约时间</span>}
            name="timeRange"
            rules={[{ required: true, message: '请选择预约时间' }]}
          >
            <RangePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span><UserOutlined /> 联系人</span>}
                name="contactPerson"
                rules={[{ required: true, message: '请输入联系人姓名' }]}
              >
                <Input placeholder="请输入联系人姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span><PhoneOutlined /> 联系电话</span>}
                name="contactPhone"
                rules={[
                  { required: true, message: '请输入联系电话' },
                  { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' },
                ]}
              >
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label={<span><MailOutlined /> 联系邮箱</span>}
            name="contactEmail"
            rules={[
              { type: 'email', message: '请输入正确的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入联系邮箱（选填）" />
          </Form.Item>

          <Form.Item
            label={<span><AppstoreOutlined /> 活动地点</span>}
            name="location"
          >
            <Input placeholder="请输入活动地点" />
          </Form.Item>

          <Form.Item
            label={<span><AppstoreOutlined /> 研学内容</span>}
            name="content"
            rules={[{ required: true, message: '请输入研学内容' }]}
          >
            <TextArea rows={3} placeholder="请描述研学活动内容及目标" />
          </Form.Item>

          <Form.Item
            label="特殊需求"
            name="specialRequirements"
          >
            <TextArea rows={2} placeholder="如有特殊需求请在此说明（选填）" />
          </Form.Item>

          <Tag color="gold" style={{ marginBottom: 16 }}>
            预约提交后将在1-2个工作日内完成审批
          </Tag>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setModalVisible(false)} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              提交预约申请
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default BookingCalendar
