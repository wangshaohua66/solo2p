import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Upload,
  Row,
  Col,
  Switch
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  EyeOutlined,
  DownOutlined
} from '@ant-design/icons'
import type { TableProps, UploadProps } from 'antd'
import { Job } from '@/types'
import { mockGetJobList, mockPublishJob, mockBatchImportJobs } from '@/mock/job'
import './Manage.css'

const { TextArea } = Input

const JobManage = () => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<string>('all')
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [page, pageSize, status])

  const loadData = async () => {
    setLoading(true)
    try {
      const result: any = await mockGetJobList({
        page,
        pageSize,
        status: status === 'all' ? undefined : status,
        enterpriseId: 'ent001'
      })
      setData(result.list)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      
      const tags = values.tags ? values.tags.split(/[,，]/).filter((t: string) => t.trim()) : []
      
      await mockPublishJob({
        ...values,
        salaryMin: values.salaryMin * 1000,
        salaryMax: values.salaryMax * 1000,
        tags,
        enterpriseId: 'ent001',
        enterpriseName: '测试企业'
      })
      
      message.success('岗位发布成功，系统将自动进行敏感词审核')
      setModalVisible(false)
      form.resetFields()
      loadData()
    } catch (error: any) {
      if (error.errorFields) return
      message.error(error.message || '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOffline = (id: string) => {
    Modal.confirm({
      title: '确认下架',
      content: '确定要下架该岗位吗？',
      onOk: () => {
        message.success('岗位已下架')
        loadData()
      }
    })
  }

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该岗位吗？此操作不可恢复。',
      onOk: () => {
        message.success('删除成功')
        loadData()
      }
    })
  }

  const uploadProps: UploadProps = {
    name: 'file',
    showUploadList: false,
    beforeUpload: (file) => {
      const isExcel = file.type === 'application/vnd.ms-excel' || 
                     file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      if (!isExcel) {
        message.error('只能上传Excel文件!')
        return false
      }
      handleBatchImport()
      return false
    }
  }

  const handleBatchImport = async () => {
    setLoading(true)
    try {
      const result = await mockBatchImportJobs([{}, {}, {}, {}, {}])
      message.success(`批量导入成功：成功${result.success}条，失败${result.failed}条`)
      loadData()
    } finally {
      setLoading(false)
    }
  }

  const getStatusTag = (status: Job['status']) => {
    const map: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: '草稿' },
      pending: { color: 'orange', text: '审核中' },
      online: { color: 'green', text: '已上线' },
      offline: { color: 'default', text: '已下架' },
      rejected: { color: 'red', text: '审核拒绝' }
    }
    const info = map[status]
    return <Tag color={info.color}>{info.text}</Tag>
  }

  const columns: TableProps<Job>['columns'] = [
    {
      title: '岗位名称',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (text, record) => (
        <a onClick={() => message.info('查看详情')}>{text}</a>
      )
    },
    {
      title: '薪资范围',
      key: 'salary',
      width: 120,
      render: (_, record) => (
        <span style={{ color: '#ff4d4f', fontWeight: 500 }}>
          {record.salaryMin / 1000}K-{record.salaryMax / 1000}K
        </span>
      )
    },
    {
      title: '工作地点',
      dataIndex: 'location',
      key: 'location',
      width: 100
    },
    {
      title: '经验要求',
      dataIndex: 'experience',
      key: 'experience',
      width: 100
    },
    {
      title: '学历要求',
      dataIndex: 'education',
      key: 'education',
      width: 100
    },
    {
      title: '投递数',
      dataIndex: 'applyCount',
      key: 'applyCount',
      width: 80,
      align: 'center'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status) => getStatusTag(status)
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />}>
            预览
          </Button>
          {record.status === 'online' && (
            <Button type="link" size="small" onClick={() => handleOffline(record.id)}>
              下架
            </Button>
          )}
          {record.status === 'offline' && (
            <Button type="link" size="small">
              上架
            </Button>
          )}
          <Button type="link" size="small" icon={<EditOutlined />}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      )
    }
  ]

  const statusOptions = [
    { value: 'all', label: '全部状态' },
    { value: 'online', label: '已上线' },
    { value: 'pending', label: '审核中' },
    { value: 'offline', label: '已下架' },
    { value: 'rejected', label: '审核拒绝' }
  ]

  return (
    <div className="job-manage-page">
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
            <Space>
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>批量导入</Button>
              </Upload>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
                发布岗位
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card className="table-card" title="岗位管理">
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
            showTotal: (total) => `共 ${total} 个岗位`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            }
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title="发布岗位"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
            发布
          </Button>
        ]}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="岗位名称"
                name="title"
                rules={[{ required: true, message: '请输入岗位名称' }]}
              >
                <Input placeholder="请输入岗位名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="工作地点"
                name="location"
                rules={[{ required: true, message: '请选择工作地点' }]}
              >
                <Select placeholder="请选择城市" options={[
                  { value: '北京', label: '北京' },
                  { value: '上海', label: '上海' },
                  { value: '广州', label: '广州' },
                  { value: '深圳', label: '深圳' },
                  { value: '杭州', label: '杭州' }
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="薪资范围(K)" required>
                <Input.Group compact>
                  <Form.Item
                    name="salaryMin"
                    noStyle
                    rules={[{ required: true, message: '请输入最低薪资' }]}
                  >
                    <InputNumber min={3} max={100} placeholder="最低" style={{ width: '50%' }} />
                  </Form.Item>
                  <span style={{ padding: '0 8px' }}>-</span>
                  <Form.Item
                    name="salaryMax"
                    noStyle
                    rules={[{ required: true, message: '请输入最高薪资' }]}
                  >
                    <InputNumber min={3} max={200} placeholder="最高" style={{ width: '50%' }} />
                  </Form.Item>
                </Input.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="工作经验"
                name="experience"
                rules={[{ required: true, message: '请选择工作经验' }]}
              >
                <Select placeholder="请选择" options={[
                  { value: '不限', label: '不限' },
                  { value: '应届', label: '应届' },
                  { value: '1-3年', label: '1-3年' },
                  { value: '3-5年', label: '3-5年' },
                  { value: '5-10年', label: '5-10年' }
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="学历要求"
                name="education"
                rules={[{ required: true, message: '请选择学历要求' }]}
              >
                <Select placeholder="请选择" options={[
                  { value: '不限', label: '不限' },
                  { value: '大专', label: '大专' },
                  { value: '本科', label: '本科' },
                  { value: '硕士', label: '硕士' },
                  { value: '博士', label: '博士' }
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="岗位标签" name="tags">
                <Input placeholder="多个标签用逗号分隔，如：五险一金,年终奖" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="岗位职责"
            name="description"
            rules={[{ required: true, message: '请输入岗位职责' }]}
          >
            <TextArea rows={4} placeholder="请输入岗位职责" />
          </Form.Item>
          <Form.Item
            label="任职要求"
            name="requirements"
            rules={[{ required: true, message: '请输入任职要求' }]}
          >
            <TextArea rows={4} placeholder="请输入任职要求" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default JobManage
