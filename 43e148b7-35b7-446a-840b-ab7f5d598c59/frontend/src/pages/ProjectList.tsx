import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Modal,
  Form,
  DatePicker,
  InputNumber,
  Progress,
  Popconfirm,
  message,
  Card,
  Row,
  Col,
  Statistic,
} from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Project, ProjectType, ProjectStage, ProjectStatus } from '@/types'
import { projectTypeMap, projectStageMap, projectStatusMap, projectStatusColorMap } from '@/utils/enumMap'
import { mockProjects } from '@/utils/mockData'
import { useAppStore } from '@/store'

const { RangePicker } = DatePicker

export default function ProjectList() {
  const navigate = useNavigate()
  const setCurrentProject = useAppStore((state) => state.setCurrentProject)
  const [data, setData] = useState<Project[]>(mockProjects)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [form] = Form.useForm()
  const [searchForm] = Form.useForm()

  const handleSearch = async () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 300)
  }

  const handleCreate = () => {
    setEditingProject(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record: Project) => {
    setEditingProject(record)
    form.setFieldsValue({
      ...record,
      dateRange: [dayjs(record.startDate), dayjs(record.endDate)],
    })
    setModalOpen(true)
  }

  const handleDelete = (id: number) => {
    setData(data.filter((p) => p.id !== id))
    message.success('删除成功')
  }

  const handleView = (record: Project) => {
    setCurrentProject(record)
    navigate(`/projects/${record.id}`)
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      if (editingProject) {
        setData(data.map((p) => (p.id === editingProject.id ? { ...p, ...values } : p)))
        message.success('更新成功')
      } else {
        const newProject: Project = {
          ...values,
          id: Math.max(...data.map((p) => p.id)) + 1,
          projectNo: `PRJ-${dayjs().year()}-${String(data.length + 1).padStart(3, '0')}`,
          progress: 0,
          status: 'PENDING' as ProjectStatus,
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          startDate: values.dateRange[0].format('YYYY-MM-DD'),
          endDate: values.dateRange[1].format('YYYY-MM-DD'),
        }
        setData([newProject, ...data])
        message.success('创建成功')
      }
      setModalOpen(false)
    } catch (e) {}
  }

  const columns = [
    {
      title: '项目编号',
      dataIndex: 'projectNo',
      width: 140,
      fixed: 'left' as const,
    },
    {
      title: '项目名称',
      dataIndex: 'name',
      width: 200,
      render: (text: string, record: Project) => (
        <a onClick={() => handleView(record)}>{text}</a>
      ),
    },
    {
      title: '项目类型',
      dataIndex: 'type',
      width: 100,
      render: (type: ProjectType) => projectTypeMap[type],
    },
    {
      title: '设计阶段',
      dataIndex: 'stage',
      width: 100,
      render: (stage: ProjectStage) => projectStageMap[stage],
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: ProjectStatus) => (
        <Tag color={projectStatusColorMap[status]}>{projectStatusMap[status]}</Tag>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 150,
      render: (progress: number) => <Progress percent={progress} size="small" />,
    },
    {
      title: '合同金额(元)',
      dataIndex: 'contractAmount',
      width: 130,
      render: (amount: number) => amount.toLocaleString(),
    },
    {
      title: '项目经理',
      dataIndex: 'projectManagerName',
      width: 100,
    },
    {
      title: '客户',
      dataIndex: 'clientName',
      width: 150,
    },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      width: 110,
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      width: 110,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, record: Project) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            详情
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const stats = {
    total: data.length,
    inProgress: data.filter((p) => p.status === 'IN_PROGRESS').length,
    reviewing: data.filter((p) => p.status === 'REVIEWING').length,
    completed: data.filter((p) => p.status === 'COMPLETED').length,
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="项目总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="进行中" value={stats.inProgress} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="校审中" value={stats.reviewing} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Form form={searchForm} layout="inline" style={{ marginBottom: 16 }}>
          <Form.Item name="keyword" label="关键词">
            <Input placeholder="项目名称/编号" prefix={<SearchOutlined />} allowClear />
          </Form.Item>
          <Form.Item name="type" label="类型">
            <Select
              placeholder="项目类型"
              allowClear
              style={{ width: 130 }}
              options={Object.entries(projectTypeMap).map(([k, v]) => ({ value: k, label: v }))}
            />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              placeholder="项目状态"
              allowClear
              style={{ width: 130 }}
              options={Object.entries(projectStatusMap).map(([k, v]) => ({ value: k, label: v }))}
            />
          </Form.Item>
          <Form.Item name="dateRange" label="日期">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                查询
              </Button>
              <Button
                onClick={() => {
                  searchForm.resetFields()
                  handleSearch()
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建项目
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editingProject ? '编辑项目' : '新建项目'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        width={800}
        okText="确定"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="项目类型" rules={[{ required: true, message: '请选择项目类型' }]}>
                <Select
                  placeholder="请选择项目类型"
                  options={Object.entries(projectTypeMap).map(([k, v]) => ({ value: k, label: v }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="stage" label="设计阶段" rules={[{ required: true, message: '请选择设计阶段' }]}>
                <Select
                  placeholder="请选择设计阶段"
                  options={Object.entries(projectStageMap).map(([k, v]) => ({ value: k, label: v }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contractAmount" label="合同金额(元)" rules={[{ required: true, message: '请输入合同金额' }]}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入合同金额" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dateRange" label="设计周期" rules={[{ required: true, message: '请选择设计周期' }]}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="projectManagerName" label="项目经理">
                <Input placeholder="请输入项目经理姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="clientName" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
                <Input placeholder="请输入客户名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="clientContact" label="联系人" rules={[{ required: true, message: '请输入联系人' }]}>
                <Input placeholder="请输入联系人" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="clientPhone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea rows={3} placeholder="请输入项目描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
