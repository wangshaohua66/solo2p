import { useState, useEffect } from 'react'
import { Card, Button, Select, Tag, Table, Statistic, Row, Col, Modal, Form, Input, message, Space, Badge } from 'antd'
import { 
  UserOutlined, 
  PlayCircleOutlined, 
  CheckCircleOutlined, 
  PauseCircleOutlined, 
  RollbackOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  SoundOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import './Triage.scss'

const { Option } = Select

function Triage() {
  const [clinicId, setClinicId] = useState(1)
  const [department, setDepartment] = useState('')
  const [queueList, setQueueList] = useState([])
  const [stats, setStats] = useState<any>({})
  const [currentCall, setCurrentCall] = useState<any>(null)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const departments = [
    { value: '', label: '全部科室' },
    { value: '口腔内科', label: '口腔内科' },
    { value: '口腔外科', label: '口腔外科' },
    { value: '正畸科', label: '正畸科' },
    { value: '修复科', label: '修复科' },
    { value: '种植科', label: '种植科' },
    { value: '儿童牙科', label: '儿童牙科' },
  ]

  const mockQueue = [
    { id: 1, queue_number: 1, patient_name: '张三', status: 'completed', department: '口腔内科', doctor_name: '李医生', arrived_at: '08:30' },
    { id: 2, queue_number: 2, patient_name: '李四', status: 'completed', department: '口腔内科', doctor_name: '李医生', arrived_at: '08:35' },
    { id: 3, queue_number: 3, patient_name: '王五', status: 'called', department: '口腔内科', doctor_name: '李医生', arrived_at: '08:40', called_at: '09:05' },
    { id: 4, queue_number: 4, patient_name: '赵六', status: 'waiting', department: '口腔内科', arrived_at: '08:45' },
    { id: 5, queue_number: 5, patient_name: '钱七', status: 'waiting', department: '正畸科', arrived_at: '08:50' },
    { id: 6, queue_number: 6, patient_name: '孙八', status: 'waiting', department: '口腔内科', arrived_at: '08:55' },
    { id: 7, queue_number: 7, patient_name: '周九', status: 'skipped', department: '口腔外科', arrived_at: '09:00' },
    { id: 8, queue_number: 8, patient_name: '吴十', status: 'waiting', department: '种植科', arrived_at: '09:05' },
  ]

  const mockStats = {
    total: 8,
    waiting: 4,
    called: 1,
    completed: 2,
    skipped: 1,
    cancelled: 0,
  }

  const mockCurrentCall = {
    id: 3,
    queue_number: 3,
    patient_name: '王五',
    department: '口腔内科',
    doctor_name: '李医生',
  }

  useEffect(() => {
    loadQueueData()
    const interval = setInterval(loadQueueData, 10000)
    return () => clearInterval(interval)
  }, [clinicId, department])

  const loadQueueData = () => {
    setQueueList(mockQueue.filter(q => !department || q.department === department))
    setStats(mockStats)
    setCurrentCall(mockCurrentCall)
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { text: string; color: string; icon: any }> = {
      waiting: { text: '等待中', color: 'default', icon: <PauseCircleOutlined /> },
      called: { text: '已呼叫', color: 'processing', icon: <SoundOutlined /> },
      completed: { text: '已完成', color: 'success', icon: <CheckCircleOutlined /> },
      skipped: { text: '已跳过', color: 'warning', icon: <RollbackOutlined /> },
      cancelled: { text: '已取消', color: 'error', icon: <CloseCircleOutlined /> },
    }
    return statusMap[status] || statusMap.waiting
  }

  const handleCall = (record: any) => {
    Modal.confirm({
      title: '确认呼叫',
      content: `确定呼叫 ${record.patient_name}（${record.queue_number}号）？`,
      onOk: () => {
        message.success(`已呼叫 ${record.patient_name}`)
        loadQueueData()
      },
    })
  }

  const handleComplete = (record: any) => {
    message.success(`已完成 ${record.patient_name} 的分诊`)
    loadQueueData()
  }

  const handleSkip = (record: any) => {
    Modal.confirm({
      title: '跳过患者',
      content: `确定跳过 ${record.patient_name}？`,
      okType: 'warning',
      onOk: () => {
        message.info(`已跳过 ${record.patient_name}`)
        loadQueueData()
      },
    })
  }

  const handleRecall = (record: any) => {
    message.success(`已重新加入排队：${record.patient_name}`)
    loadQueueData()
  }

  const handleCancel = (record: any) => {
    Modal.confirm({
      title: '取消排队',
      content: `确定取消 ${record.patient_name} 的排队？`,
      okType: 'danger',
      onOk: () => {
        message.success(`已取消 ${record.patient_name} 的排队`)
        loadQueueData()
      },
    })
  }

  const handleAddSubmit = () => {
    form.validateFields().then((values) => {
      message.success('已添加到分诊队列')
      setAddModalVisible(false)
      form.resetFields()
      loadQueueData()
    })
  }

  const columns = [
    {
      title: '序号',
      dataIndex: 'queue_number',
      key: 'queue_number',
      width: 80,
      render: (num: number) => (
        <Badge count={num} size="small" style={{ backgroundColor: '#1890ff' }} />
      ),
    },
    {
      title: '患者姓名',
      dataIndex: 'patient_name',
      key: 'patient_name',
      render: (name: string) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserOutlined style={{ color: '#1890ff' }} />
          {name}
        </span>
      ),
    },
    {
      title: '科室',
      dataIndex: 'department',
      key: 'department',
      render: (dept: string) => <Tag color="blue">{dept}</Tag>,
    },
    {
      title: '医生',
      dataIndex: 'doctor_name',
      key: 'doctor_name',
      render: (name: string) => name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const info = getStatusInfo(status)
        return <Tag color={info.color} icon={info.icon}>{info.text}</Tag>
      },
    },
    {
      title: '到院时间',
      dataIndex: 'arrived_at',
      key: 'arrived_at',
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_: any, record: any) => {
        const actions = []
        
        if (record.status === 'waiting') {
          actions.push(
            <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handleCall(record)}>
              呼叫
            </Button>
          )
          actions.push(
            <Button size="small" onClick={() => handleSkip(record)}>
              跳过
            </Button>
          )
        }
        
        if (record.status === 'called') {
          actions.push(
            <Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => handleComplete(record)}>
              完成
            </Button>
          )
        }
        
        if (record.status === 'skipped') {
          actions.push(
            <Button size="small" icon={<RollbackOutlined />} onClick={() => handleRecall(record)}>
              重新排队
            </Button>
          )
        }
        
        if (record.status !== 'completed' && record.status !== 'cancelled') {
          actions.push(
            <Button danger size="small" onClick={() => handleCancel(record)}>
              取消
            </Button>
          )
        }
        
        return <Space size={4}>{actions}</Space>
      },
    },
  ]

  return (
    <div className="triage-page">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title="分诊排队"
            className="main-card"
            extra={
              <Space>
                <Select
                  value={clinicId}
                  style={{ width: 130 }}
                  onChange={setClinicId}
                >
                  <Option value={1}>中心门诊</Option>
                  <Option value={2}>城东门诊</Option>
                  <Option value={3}>城西门诊</Option>
                </Select>
                <Select
                  value={department}
                  style={{ width: 130 }}
                  onChange={setDepartment}
                  allowClear
                  placeholder="全部科室"
                >
                  {departments.map(d => (
                    <Option key={d.value} value={d.value}>{d.label}</Option>
                  ))}
                </Select>
                <Button icon={<ReloadOutlined />} onClick={loadQueueData}>
                  刷新
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
                  添加患者
                </Button>
              </Space>
            }
          >
            <Table
              dataSource={queueList}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="small"
              rowClassName={(record) => {
                if (record.status === 'called') return 'row-called'
                if (record.status === 'completed') return 'row-completed'
                if (record.status === 'skipped') return 'row-skipped'
                return ''
              }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="当前呼叫" className="current-call-card">
            {currentCall ? (
              <div className="current-call-info">
                <div className="call-number">
                  <span className="number">{String(currentCall.queue_number).padStart(3, '0')}</span>
                  <span className="label">号</span>
                </div>
                <div className="call-patient">{currentCall.patient_name}</div>
                <div className="call-detail">
                  <Tag color="blue">{currentCall.department}</Tag>
                  <span>{currentCall.doctor_name}</span>
                </div>
                <div className="call-animation">
                  <SoundOutlined spin /> 正在呼叫
                </div>
              </div>
            ) : (
              <div className="no-call">
                <SoundOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                <p>暂无呼叫</p>
              </div>
            )}
          </Card>

          <Card title="今日统计" className="stats-card">
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Statistic title="总接诊" value={stats.total} prefix={<UserOutlined />} />
              </Col>
              <Col span={12}>
                <Statistic 
                  title="等待中" 
                  value={stats.waiting} 
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={12}>
                <Statistic 
                  title="已完成" 
                  value={stats.completed} 
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={12}>
                <Statistic 
                  title="已跳过" 
                  value={stats.skipped} 
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
            </Row>
          </Card>

          <Card title="待呼叫列表" className="waiting-list-card">
            <div className="waiting-list">
              {queueList.filter(q => q.status === 'waiting').slice(0, 5).map((item, index) => (
                <div key={item.id} className="waiting-item">
                  <span className="waiting-number">{index + 1}</span>
                  <span className="waiting-name">{item.patient_name}</span>
                  <Tag color="blue" size="small">{item.department}</Tag>
                </div>
              ))}
              {queueList.filter(q => q.status === 'waiting').length === 0 && (
                <div className="empty">暂无等待患者</div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title="添加分诊患者"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={handleAddSubmit}
        okText="添加"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="patient_name" label="患者姓名" rules={[{ required: true, message: '请输入患者姓名' }]}>
            <Input placeholder="请输入患者姓名" />
          </Form.Item>
          <Form.Item name="department" label="科室" rules={[{ required: true, message: '请选择科室' }]}>
            <Select placeholder="请选择科室">
              {departments.filter(d => d.value).map(d => (
                <Option key={d.value} value={d.value}>{d.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="doctor_id" label="主治医生">
            <Select placeholder="请选择医生（可选）" allowClear>
              <Option value={1}>李医生 - 口腔内科</Option>
              <Option value={2}>王医生 - 正畸科</Option>
              <Option value={3}>赵医生 - 种植科</Option>
            </Select>
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Triage
