import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  DatePicker,
  TimePicker,
  Input,
  InputNumber,
  message,
  Select,
  Row,
  Col,
  Rate,
  Descriptions
} from 'antd'
import {
  VideoCameraOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import { Interview, UserRole } from '@/types'
import { mockGetInterviewList, mockCreateInterview, mockSubmitInterviewEvaluation } from '@/mock/interview'
import { RootState } from '@/store'
import './List.css'

const { RangePicker } = DatePicker
const { TextArea } = Input

const InterviewList = () => {
  const navigate = useNavigate()
  const role = useSelector((state: RootState) => state.auth.role)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Interview[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<string>('all')
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [evalModalVisible, setEvalModalVisible] = useState(false)
  const [currentInterview, setCurrentInterview] = useState<Interview | null>(null)
  const [form] = Form.useForm()
  const [evalForm] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [page, pageSize, status])

  const loadData = async () => {
    setLoading(true)
    try {
      const result: any = await mockGetInterviewList({
        page,
        pageSize,
        status: status === 'all' ? undefined : status,
        role: role === UserRole.ENTERPRISE ? 'enterprise' : 'jobseeker'
      })
      setData(result.list)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }

  const getStatusTag = (status: Interview['status']) => {
    const map: Record<string, { color: string; text: string }> = {
      pending: { color: 'orange', text: '待确认' },
      confirmed: { color: 'blue', text: '已确认' },
      completed: { color: 'green', text: '已完成' },
      cancelled: { color: 'default', text: '已取消' }
    }
    const info = map[status]
    return <Tag color={info.color}>{info.text}</Tag>
  }

  const handleJoinInterview = (record: Interview) => {
    if (record.status === 'confirmed' || record.status === 'ongoing') {
      navigate(`/interviews/${record.id}`)
    } else {
      message.warning('面试尚未开始')
    }
  }

  const handleCreateInterview = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      
      const scheduledTime = dayjs(values.date.format('YYYY-MM-DD') + ' ' + values.time.format('HH:mm')).format('YYYY-MM-DD HH:mm:ss')
      
      await mockCreateInterview({
        ...values,
        scheduledTime,
        duration: values.duration || 60,
        type: 'video',
        jobId: 'job1',
        jobTitle: '前端开发工程师',
        enterpriseId: 'ent1',
        enterpriseName: '华为技术有限公司',
        jobseekerId: 'js001',
        jobseekerName: '王小明'
      })
      
      message.success('面试邀请已发送')
      setCreateModalVisible(false)
      form.resetFields()
      loadData()
    } catch (error: any) {
      if (error.errorFields) return
      message.error(error.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitEvaluation = async () => {
    try {
      const values = await evalForm.validateFields()
      setSubmitting(true)
      
      if (currentInterview) {
        await mockSubmitInterviewEvaluation(currentInterview.id, values)
        message.success('面试评价已提交')
        setEvalModalVisible(false)
        evalForm.resetFields()
        loadData()
      }
    } catch (error: any) {
      if (error.errorFields) return
      message.error(error.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const openEvalModal = (record: Interview) => {
    setCurrentInterview(record)
    evalForm.setFieldsValue({
      evaluation: record.evaluation,
      rating: record.rating
    })
    setEvalModalVisible(true)
  }

  const columns: TableProps<Interview>['columns'] = [
    {
      title: '职位',
      dataIndex: 'jobTitle',
      key: 'jobTitle',
      width: 180
    },
    {
      title: role === UserRole.ENTERPRISE ? '候选人' : '企业',
      key: 'party',
      width: 150,
      render: (_, record) => (
        role === UserRole.ENTERPRISE ? record.jobseekerName : record.enterpriseName
      )
    },
    {
      title: '面试时间',
      key: 'time',
      width: 180,
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13 }}>{dayjs(record.scheduledTime).format('YYYY-MM-DD HH:mm')}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>时长 {record.duration} 分钟</div>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => (
        <Tag icon={type === 'video' ? <VideoCameraOutlined /> : <ClockCircleOutlined />}>
          {type === 'video' ? '视频面试' : '现场面试'}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status)
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {(record.status === 'confirmed' || record.status === 'ongoing') && (
            <Button 
              type="primary" 
              size="small" 
              icon={<PlayCircleOutlined />}
              onClick={() => handleJoinInterview(record)}
            >
              进入面试
            </Button>
          )}
          {record.status === 'pending' && role === UserRole.JOBSEEKER && (
            <Button type="link" size="small">确认</Button>
          )}
          {record.status === 'completed' && role === UserRole.ENTERPRISE && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEvalModal(record)}>
              {record.evaluation ? '查看评价' : '写评价'}
            </Button>
          )}
          {record.status === 'completed' && (
            <Button type="link" size="small">查看详情</Button>
          )}
        </Space>
      )
    }
  ]

  const statusOptions = [
    { value: 'all', label: '全部状态' },
    { value: 'pending', label: '待确认' },
    { value: 'confirmed', label: '已确认' },
    { value: 'completed', label: '已完成' },
    { value: 'cancelled', label: '已取消' }
  ]

  return (
    <div className="interview-list-page">
      <Card className="filter-card">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="选择状态"
              value={status}
              onChange={setStatus}
              style={{ width: '100%' }}
              options={statusOptions}
            />
          </Col>
          <Col xs={24} sm={12} md={18} style={{ textAlign: 'right' }}>
            {role === UserRole.ENTERPRISE && (
              <Button type="primary" icon={<VideoCameraOutlined />} onClick={() => setCreateModalVisible(true)}>
                发起面试
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      <Card className="table-card" title="面试安排">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 场面试`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            }
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title="发起面试邀请"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setCreateModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleCreateInterview}>
            发送邀请
          </Button>
        ]}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="候选人"
            name="jobseekerName"
            rules={[{ required: true, message: '请选择候选人' }]}
          >
            <Select placeholder="请选择候选人">
              <Select.Option value="王小明">王小明 - 前端开发工程师</Select.Option>
              <Select.Option value="李华">李华 - Java开发工程师</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="面试日期"
            name="date"
            rules={[{ required: true, message: '请选择面试日期' }]}
          >
            <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d < dayjs().startOf('day')} />
          </Form.Item>
          <Form.Item
            label="面试时间"
            name="time"
            rules={[{ required: true, message: '请选择面试时间' }]}
          >
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="面试时长（分钟）"
            name="duration"
            initialValue={60}
          >
            <InputNumber min={15} max={180} step={15} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <TextArea rows={3} placeholder="请输入面试注意事项等" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="面试评价"
        open={evalModalVisible}
        onCancel={() => setEvalModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setEvalModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleSubmitEvaluation}>
            提交评价
          </Button>
        ]}
        width={500}
      >
        {currentInterview && role === UserRole.ENTERPRISE && (
          <div style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="候选人">{currentInterview.jobseekerName}</Descriptions.Item>
              <Descriptions.Item label="职位">{currentInterview.jobTitle}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
        <Form form={evalForm} layout="vertical">
          <Form.Item
            label="综合评分"
            name="rating"
            rules={[{ required: true, message: '请给出评分' }]}
          >
            <Rate />
          </Form.Item>
          <Form.Item
            label="面试评价"
            name="evaluation"
            rules={[{ required: true, message: '请填写评价内容' }]}
          >
            <TextArea rows={6} placeholder="请详细描述候选人的表现，包括技术能力、沟通能力、岗位匹配度等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default InterviewList
