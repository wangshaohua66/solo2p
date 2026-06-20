import { useState } from 'react'
import {
  Card,
  Space,
  Tag,
  Progress,
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  Button,
  message,
  InputNumber,
  Row,
  Col,
  Tooltip,
  Badge,
  Dropdown,
} from 'antd'
import {
  PlusOutlined,
  UserOutlined,
  ClockCircleOutlined,
  MoreOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { DesignTask, TaskStatus, ProfessionType, ProjectStage } from '@/types'
import {
  taskStatusMap,
  professionMap,
  professionColorMap,
  projectStageMap,
} from '@/utils/enumMap'
import { mockTasks, mockProjects } from '@/utils/mockData'
import dayjs from 'dayjs'

const columns: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'REVIEWING', 'COMPLETED']

export default function TaskBoard() {
  const [tasks, setTasks] = useState<DesignTask[]>(mockTasks)
  const [modalOpen, setModalOpen] = useState(false)
  const [filterProject, setFilterProject] = useState<number | undefined>()
  const [filterProfession, setFilterProfession] = useState<ProfessionType | undefined>()
  const [form] = Form.useForm()

  const filteredTasks = tasks.filter((t) => {
    if (filterProject && t.projectId !== filterProject) return false
    if (filterProfession && t.profession !== filterProfession) return false
    return true
  })

  const getColumnTasks = (status: TaskStatus) => filteredTasks.filter((t) => t.status === status)

  const handleCreate = () => {
    form.resetFields()
    setModalOpen(true)
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      const newTask: DesignTask = {
        ...values,
        id: Math.max(...tasks.map((t) => t.id), 0) + 1,
        projectName: mockProjects.find((p) => p.id === values.projectId)?.name || '',
        status: 'PENDING' as TaskStatus,
        progress: 0,
        plannedStartDate: values.plannedStartDate?.format('YYYY-MM-DD'),
        plannedEndDate: values.plannedEndDate?.format('YYYY-MM-DD'),
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }
      setTasks([...tasks, newTask])
      setModalOpen(false)
      message.success('创建成功')
    } catch (e) {}
  }

  const handleClaim = (task: DesignTask) => {
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status: 'IN_PROGRESS' as TaskStatus, assigneeName: '当前用户', actualStartDate: dayjs().format('YYYY-MM-DD') } : t)))
    message.success('已领取任务')
  }

  const handleSubmitReview = (task: DesignTask) => {
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status: 'REVIEWING' as TaskStatus } : t)))
    message.success('已提交校审')
  }

  const handleComplete = (task: DesignTask) => {
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status: 'COMPLETED' as TaskStatus, progress: 100, actualEndDate: dayjs().format('YYYY-MM-DD') } : t)))
    message.success('任务已完成')
  }

  const handleUpdateProgress = (task: DesignTask, progress: number) => {
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, progress } : t)))
  }

  const renderTaskCard = (task: DesignTask) => {
    const actionMenu = {
      items: [
        task.status === 'PENDING' && { key: 'claim', label: '领取任务', onClick: () => handleClaim(task) },
        task.status === 'IN_PROGRESS' && { key: 'submit', label: '提交校审', onClick: () => handleSubmitReview(task) },
        task.status === 'REVIEWING' && { key: 'complete', label: '标记完成', onClick: () => handleComplete(task) },
      ].filter(Boolean) as any[],
    }

    return (
      <div className="task-card" key={task.id} draggable>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div className="task-card-title">{task.name}</div>
          <Dropdown menu={actionMenu} trigger={['click']}>
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Tag color={professionColorMap[task.profession]}>{professionMap[task.profession]}</Tag>
          <Tag>{projectStageMap[task.stage]}</Tag>
        </div>
        <Progress percent={task.progress} size="small" style={{ marginBottom: 8 }} />
        <div className="task-card-meta">
          <Tooltip title={task.projectName}>
            <span>{task.projectName}</span>
          </Tooltip>
        </div>
        <div className="task-card-meta" style={{ marginTop: 4 }}>
          <span>
            <UserOutlined /> {task.assigneeName || '未分配'}
          </span>
          <span>
            <ClockCircleOutlined /> {task.plannedEndDate}
          </span>
        </div>
      </div>
    )
  }

  const renderColumnHeader = (status: TaskStatus) => {
    const count = getColumnTasks(status).length
    const statusConfig: Record<TaskStatus, { color: string; icon: any }> = {
      PENDING: { color: 'default', icon: <ClockCircleOutlined /> },
      IN_PROGRESS: { color: 'processing', icon: <Badge status="processing" /> },
      REVIEWING: { color: 'warning', icon: <Badge status="warning" /> },
      COMPLETED: { color: 'success', icon: <CheckCircleOutlined style={{ color: '#52c41a' }} /> },
    }
    return (
      <div className="task-column-header">
        <Space>
          {statusConfig[status].icon}
          <span>{taskStatusMap[status]}</span>
          <Badge count={count} style={{ backgroundColor: statusConfig[status].color === 'default' ? '#999' : undefined }} />
        </Space>
        {status === 'PENDING' && (
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleCreate} />
        )}
      </div>
    )
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={12}>
            <Space>
              <span>所属项目：</span>
              <Select
                placeholder="全部项目"
                allowClear
                style={{ width: 250 }}
                value={filterProject}
                onChange={setFilterProject}
                options={mockProjects.map((p) => ({ value: p.id, label: p.name }))}
              />
              <span>专业：</span>
              <Select
                placeholder="全部专业"
                allowClear
                style={{ width: 150 }}
                value={filterProfession}
                onChange={setFilterProfession}
                options={Object.entries(professionMap).map(([k, v]) => ({ value: k, label: v }))}
              />
            </Space>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建任务
            </Button>
          </Col>
        </Row>
      </Card>

      <div className="task-board">
        {columns.map((status) => (
          <div className="task-column" key={status}>
            {renderColumnHeader(status)}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {getColumnTasks(status).map(renderTaskCard)}
              {getColumnTasks(status).length === 0 && (
                <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>暂无任务</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        title="新建任务"
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        width={700}
        okText="确定"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="projectId" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
                <Select
                  placeholder="请选择项目"
                  options={mockProjects.map((p) => ({ value: p.id, label: p.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="stage" label="设计阶段" rules={[{ required: true, message: '请选择设计阶段' }]}>
                <Select
                  placeholder="请选择设计阶段"
                  options={Object.entries(projectStageMap).map(([k, v]) => ({ value: k, label: v }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="profession" label="专业" rules={[{ required: true, message: '请选择专业' }]}>
                <Select
                  placeholder="请选择专业"
                  options={Object.entries(professionMap).map(([k, v]) => ({ value: k, label: v }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assigneeName" label="负责人">
                <Input placeholder="请输入负责人姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="plannedStartDate" label="计划开始日期" rules={[{ required: true, message: '请选择开始日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="plannedEndDate" label="计划结束日期" rules={[{ required: true, message: '请选择结束日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="deliverables" label="交付物要求">
            <Input placeholder="请输入交付物要求" />
          </Form.Item>
          <Form.Item name="description" label="任务描述">
            <Input.TextArea rows={3} placeholder="请输入任务描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
