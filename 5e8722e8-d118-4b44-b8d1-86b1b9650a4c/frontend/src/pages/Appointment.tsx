import { useState } from 'react'
import { Row, Col, Card, Select, Radio, Calendar, List, Tag, Button, Modal, Form, Input, message } from 'antd'
import { ClockCircleOutlined, UserOutlined, StarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import './Appointment.scss'

const { Option } = Select

const departments = [
  { id: 1, name: '口腔内科' },
  { id: 2, name: '口腔外科' },
  { id: 3, name: '正畸科' },
  { id: 4, name: '修复科' },
  { id: 5, name: '种植科' },
]

const clinics = [
  { id: 1, name: '中心门诊', address: '市中心区88号' },
  { id: 2, name: '城东门诊', address: '城东区56号' },
  { id: 3, name: '城西门诊', address: '城西区123号' },
]

const doctors = [
  { id: 1, name: '李医生', title: '主任医师', department: '口腔内科', rating: 4.9, specialty: ['根管治疗', '牙周病'] },
  { id: 2, name: '王医生', title: '副主任医师', department: '正畸科', rating: 4.8, specialty: ['隐形矫正', '儿童正畸'] },
  { id: 3, name: '赵医生', title: '主任医师', department: '种植科', rating: 4.9, specialty: ['种植牙', '骨增量'] },
  { id: 4, name: '钱医生', title: '主治医师', department: '修复科', rating: 4.7, specialty: ['烤瓷牙', '全瓷冠'] },
]

const timeSlots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00',
]

function Appointment() {
  const [selectedDate, setSelectedDate] = useState(dayjs())
  const [selectedClinic, setSelectedClinic] = useState(1)
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('rating')
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [form] = Form.useForm()

  const filteredDoctors = doctors.filter(
    (doc) => !selectedDept || doc.department === selectedDept
  )

  const sortedDoctors = [...filteredDoctors].sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating
    if (sortBy === 'specialty') return b.specialty.length - a.specialty.length
    return 0
  })

  const handleDateSelect = (date: dayjs.Dayjs) => {
    setSelectedDate(date)
  }

  const handleTimeClick = (time: string) => {
    setSelectedTime(time)
    setIsModalVisible(true)
  }

  const handleConfirm = () => {
    form.validateFields().then(() => {
      message.success('预约成功！已发送短信通知')
      setIsModalVisible(false)
      setSelectedTime(null)
      form.resetFields()
    })
  }

  const disabledDate = (current: dayjs.Dayjs) => {
    return current && (current < dayjs().startOf('day') || current > dayjs().add(14, 'day'))
  }

  return (
    <div className="appointment-page">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="预约挂号" className="main-card">
            <div className="filter-bar">
              <div className="filter-item">
                <span className="filter-label">选择门诊：</span>
                <Select value={selectedClinic} style={{ width: 150 }} onChange={setSelectedClinic}>
                  {clinics.map((clinic) => (
                    <Option key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </Option>
                  ))}
                </Select>
              </div>
              <div className="filter-item">
                <span className="filter-label">选择科室：</span>
                <Select
                  placeholder="全部科室"
                  style={{ width: 150 }}
                  allowClear
                  onChange={setSelectedDept}
                >
                  {departments.map((dept) => (
                    <Option key={dept.id} value={dept.name}>
                      {dept.name}
                    </Option>
                  ))}
                </Select>
              </div>
              <div className="filter-item">
                <span className="filter-label">排序方式：</span>
                <Radio.Group value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <Radio.Button value="rating">评分优先</Radio.Button>
                  <Radio.Button value="specialty">专长</Radio.Button>
                </Radio.Group>
              </div>
            </div>

            <div className="doctor-list">
              <List
                dataSource={sortedDoctors}
                renderItem={(doctor) => (
                  <List.Item
                    className={`doctor-card ${selectedDoctor === doctor.id ? 'selected' : ''}`}
                    onClick={() => setSelectedDoctor(doctor.id)}
                  >
                    <List.Item.Meta
                      avatar={
                        <div className="doctor-avatar">
                          <UserOutlined />
                        </div>
                      }
                      title={
                        <div className="doctor-title">
                          <span className="doctor-name">{doctor.name}</span>
                          <span className="doctor-title-tag">{doctor.title}</span>
                          <Tag color="blue">{doctor.department}</Tag>
                        </div>
                      }
                      description={
                        <div className="doctor-info">
                          <div className="doctor-specialty">
                            专长：{doctor.specialty.join('、')}
                          </div>
                          <div className="doctor-rating">
                            <StarOutlined style={{ color: '#faad14' }} /> {doctor.rating}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>

            <div className="time-slots">
              <h4 className="section-title">
                <ClockCircleOutlined /> {selectedDate.format('YYYY年MM月DD日')} 可预约时段
              </h4>
              <div className="time-grid">
                {timeSlots.map((time) => {
                  const isBooked = Math.random() > 0.6
                  return (
                    <Button
                      key={time}
                      className={`time-btn ${isBooked ? 'booked' : ''}`}
                      disabled={isBooked}
                      onClick={() => handleTimeClick(time)}
                      type={selectedTime === time ? 'primary' : 'default'}
                    >
                      {time}
                      {isBooked ? <Tag color="red">已满</Tag> : <Tag color="green">可约</Tag>}
                    </Button>
                  )
                })}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="选择日期" className="calendar-card">
            <Calendar
              fullscreen={false}
              value={selectedDate}
              onSelect={handleDateSelect}
              disabledDate={disabledDate}
            />
          </Card>

          <Card title="预约须知" className="notice-card">
            <ul className="notice-list">
              <li>请提前15分钟到达门诊</li>
              <li>携带身份证和医保卡</li>
              <li>如需改约请提前24小时</li>
              <li>首次就诊需建立档案</li>
              <li>儿童就诊需家长陪同</li>
            </ul>
          </Card>
        </Col>
      </Row>

      <Modal
        title="确认预约"
        open={isModalVisible}
        onOk={handleConfirm}
        onCancel={() => setIsModalVisible(false)}
        okText="确认预约"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="就诊日期">
            <span>{selectedDate.format('YYYY年MM月DD日')} {selectedTime}</span>
          </Form.Item>
          <Form.Item name="patientName" label="患者姓名" rules={[{ required: true }]}>
            <Input placeholder="请输入患者姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号码" rules={[{ required: true, pattern: /^1[3-9]\d{9}$/ }]}>
            <Input placeholder="请输入手机号码" />
          </Form.Item>
          <Form.Item name="symptom" label="症状描述">
            <Input.TextArea rows={3} placeholder="请简要描述症状" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Appointment
