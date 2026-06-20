import { useState } from 'react'
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Progress,
  Row,
  Col,
  Statistic,
  Avatar,
  Timeline,
  Descriptions,
  Tabs,
  Drawer,
  List,
  message,
  Steps,
  InputNumber,
  Select,
} from 'antd'
import {
  ProjectOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  EditOutlined,
  EyeOutlined,
  UserOutlined,
  FileDoneOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { Project, ChangeRequest, DesignVersion } from '@/types'
import {
  projectStatusMap,
  projectStatusColorMap,
  projectTypeMap,
  changeStatusMap,
  changeStatusColorMap,
} from '@/utils/enumMap'
import { mockProjects, mockChanges, mockVersions, mockTasks } from '@/utils/mockData'
import dayjs from 'dayjs'

export default function ClientPortal() {
  const [projects] = useState<Project[]>(mockProjects.slice(0, 3))
  const [changes] = useState<ChangeRequest[]>(mockChanges.filter((c) => c.applicantType === 'CLIENT' || true))
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [changeModalOpen, setChangeModalOpen] = useState(false)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [versionsDrawerOpen, setVersionsDrawerOpen] = useState(false)
  const [selectedProjectVersions, setSelectedProjectVersions] = useState<DesignVersion[]>([])
  const [confirmForm] = Form.useForm()
  const [changeForm] = Form.useForm()

  const myProjects = projects

  const handleViewDetail = (project: Project) => {
    setCurrentProject(project)
    setDetailDrawerOpen(true)
  }

  const handleViewVersions = (project: Project) => {
    setSelectedProjectVersions(mockVersions.filter((v) => v.projectId === project.id && v.isReleased))
    setVersionsDrawerOpen(true)
  }

  const handleConfirmScheme = (project: Project) => {
    setCurrentProject(project)
    confirmForm.resetFields()
    setConfirmModalOpen(true)
  }

  const handleConfirmSubmit = async () => {
    try {
      await confirmForm.validateFields()
      message.success('方案已确认，系统已记录您的确认信息')
      setConfirmModalOpen(false)
    } catch (e) {}
  }

  const handleInitiateChange = () => {
    changeForm.resetFields()
    setChangeModalOpen(true)
  }

  const handleChangeSubmit = async () => {
    try {
      const values = await changeForm.validateFields()
      message.success('变更申请已提交，请等待处理')
      setChangeModalOpen(false)
    } catch (e) {}
  }

  const stats = {
    totalProjects: myProjects.length,
    inProgress: myProjects.filter((p) => p.status === 'IN_PROGRESS').length,
    pendingChanges: changes.filter((c) => c.status !== 'IMPLEMENTED' && c.status !== 'REJECTED').length,
    releasedVersions: mockVersions.filter((v) => v.isReleased).length,
  }

  const projectColumns = [
    {
      title: '项目编号',
      dataIndex: 'projectNo',
      width: 140,
    },
    {
      title: '项目名称',
      dataIndex: 'name',
      width: 220,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (type: string) => projectTypeMap[type as keyof typeof projectTypeMap],
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={projectStatusColorMap[status as keyof typeof projectStatusColorMap]}>
          {projectStatusMap[status as keyof typeof projectStatusMap]}
        </Tag>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 180,
      render: (progress: number) => <Progress percent={progress} size="small" />,
    },
    {
      title: '周期',
      render: (_: any, record: Project) => `${record.startDate} ~ ${record.endDate}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_: any, record: Project) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button size="small" icon={<FileDoneOutlined />} onClick={() => handleViewVersions(record)}>
            图纸
          </Button>
          {record.progress > 0 && record.progress < 100 && (
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleConfirmScheme(record)}>
              确认方案
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const changeColumns = [
    {
      title: '变更编号',
      dataIndex: 'changeNo',
      width: 130,
    },
    {
      title: '项目',
      dataIndex: 'projectName',
      width: 200,
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 200,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 160,
      render: (status: string) => (
        <Tag color={changeStatusColorMap[status as keyof typeof changeStatusColorMap]}>
          {changeStatusMap[status as keyof typeof changeStatusColorMap]}
        </Tag>
      ),
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 180,
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={
                  <Space>
                    <ProjectOutlined />
                    我的项目
                  </Space>
                }
                value={stats.totalProjects}
                prefix={<ProjectOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={
                  <Space>
                    <ClockCircleOutlined />
                    进行中
                  </Space>
                }
                value={stats.inProgress}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={
                  <Space>
                    <EditOutlined />
                    待处理变更
                  </Space>
                }
                value={stats.pendingChanges}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={
                  <Space>
                    <FileDoneOutlined />
                    已发布图纸
                  </Space>
                }
                value={stats.releasedVersions}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card>
        <Tabs
          items={[
            {
              key: 'projects',
              label: '我的项目',
              children: (
                <div>
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button type="primary" icon={<EditOutlined />} onClick={handleInitiateChange}>
                      提出变更需求
                    </Button>
                  </div>
                  <Table
                    columns={projectColumns}
                    dataSource={myProjects}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                  />
                </div>
              ),
            },
            {
              key: 'changes',
              label: '变更记录',
              children: (
                <Table
                  columns={changeColumns}
                  dataSource={changes}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'todos',
              label: '待办事项',
              children: (
                <List
                  dataSource={[
                    {
                      id: 1,
                      type: '方案确认',
                      title: '市民文化中心 - 方案设计确认',
                      time: '2024-06-15',
                      status: 'pending',
                    },
                    {
                      id: 2,
                      type: '变更审批',
                      title: 'CR-2024-001 剧场舞台区域层高调整',
                      time: '2024-06-14',
                      status: 'pending',
                    },
                    {
                      id: 3,
                      type: '图纸确认',
                      title: '高端住宅社区一期 - 建筑施工图发布',
                      time: '2024-05-30',
                      status: 'done',
                    },
                  ]}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        item.status === 'pending' && (
                          <Button size="small" type="primary">
                            去处理
                          </Button>
                        ),
                      ].filter(Boolean)}
                    >
                      <List.Item.Meta
                        avatar={
                          item.status === 'pending' ? (
                            <Avatar style={{ backgroundColor: '#faad14' }} icon={<ExclamationCircleOutlined />} />
                          ) : (
                            <Avatar style={{ backgroundColor: '#52c41a' }} icon={<CheckCircleOutlined />} />
                          )
                        }
                        title={
                          <Space>
                            <Tag>{item.type}</Tag>
                            {item.title}
                          </Space>
                        }
                        description={item.time}
                      />
                    </List.Item>
                  )}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="确认设计方案"
        open={confirmModalOpen}
        onOk={handleConfirmSubmit}
        onCancel={() => setConfirmModalOpen(false)}
        okText="确认方案"
        cancelText="取消"
        okButtonProps={{ type: 'primary' }}
        width={600}
        destroyOnClose
      >
        {currentProject && (
          <div>
            <div style={{ marginBottom: 16, padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                <ExclamationCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                法律声明
              </div>
              <div style={{ fontSize: 12, color: '#666', lineHeight: 1.8 }}>
                您即将确认项目「{currentProject.name}」的设计方案。确认后将视为您已同意该方案内容，
                系统将记录您的确认时间（{dayjs().format('YYYY-MM-DD HH:mm:ss')}）和IP地址作为法律依据。
                如有疑问，请先与项目经理沟通。
              </div>
            </div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="项目编号">{currentProject.projectNo}</Descriptions.Item>
                <Descriptions.Item label="项目名称">{currentProject.name}</Descriptions.Item>
                <Descriptions.Item label="设计阶段">方案设计</Descriptions.Item>
                <Descriptions.Item label="当前进度">
                  <Progress percent={currentProject.progress} size="small" />
                </Descriptions.Item>
              </Descriptions>
            </Card>
            <Form form={confirmForm} layout="vertical">
              <Form.Item
                name="confirmContent"
                label="确认意见（可选）"
              >
                <Input.TextArea rows={3} placeholder="请输入您的确认意见或备注..." />
              </Form.Item>
              <Form.Item
                name="agreed"
                valuePropName="checked"
                rules={[
                  {
                    validator: (_, value) =>
                      value ? Promise.resolve() : Promise.reject(new Error('请阅读并同意法律声明')),
                  },
                ]}
              >
                <span>我已阅读并同意以上法律声明，确认该设计方案</span>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title="提出设计变更需求"
        open={changeModalOpen}
        onOk={handleChangeSubmit}
        onCancel={() => setChangeModalOpen(false)}
        okText="提交"
        cancelText="取消"
        width={700}
        destroyOnClose
      >
        <Form form={changeForm} layout="vertical">
          <Form.Item name="projectId" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select
              placeholder="请选择需要变更的项目"
              options={myProjects.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Form.Item>
          <Form.Item name="title" label="变更标题" rules={[{ required: true, message: '请输入变更标题' }]}>
            <Input placeholder="请简要描述变更内容" />
          </Form.Item>
          <Form.Item name="reason" label="变更原因" rules={[{ required: true, message: '请输入变更原因' }]}>
            <Input.TextArea rows={2} placeholder="请说明变更的原因和背景" />
          </Form.Item>
          <Form.Item name="content" label="变更内容" rules={[{ required: true, message: '请输入变更内容' }]}>
            <Input.TextArea rows={4} placeholder="请详细描述需要变更的具体内容" />
          </Form.Item>
          <Form.Item name="contact" label="联系方式" rules={[{ required: true, message: '请输入联系方式' }]}>
            <Input placeholder="请输入您的联系电话，方便我们与您沟通" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="项目详情"
        width={600}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        destroyOnClose
      >
        {currentProject && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions title={currentProject.name} column={2} bordered size="small">
                <Descriptions.Item label="项目编号">{currentProject.projectNo}</Descriptions.Item>
                <Descriptions.Item label="类型">{projectTypeMap[currentProject.type]}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={projectStatusColorMap[currentProject.status]}>
                    {projectStatusMap[currentProject.status]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="整体进度">
                  <Progress percent={currentProject.progress} size="small" />
                </Descriptions.Item>
                <Descriptions.Item label="合同金额" span={2}>
                  ¥{currentProject.contractAmount.toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="设计周期" span={2}>
                  {currentProject.startDate} ~ {currentProject.endDate}
                </Descriptions.Item>
                <Descriptions.Item label="项目描述" span={2}>
                  {currentProject.description}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="设计阶段进度" style={{ marginBottom: 16 }}>
              <Steps
                direction="vertical"
                size="small"
                current={2}
                items={[
                  { title: '方案设计', status: 'finish', description: '2024-01-15 ~ 2024-03-20，已完成' },
                  { title: '初步设计', status: 'finish', description: '2024-03-25 ~ 2024-05-10，已完成' },
                  { title: '施工图设计', status: 'process', description: '2024-05-15 至今，进行中（65%）' },
                ]}
              />
            </Card>

            <Card size="small" title="项目动态">
              <Timeline
                items={[
                  { color: 'green', children: '方案设计确认完成 - 2024-03-20 10:00' },
                  { color: 'blue', children: '初步设计校审通过 - 2024-05-10 16:00' },
                  { color: 'processing', children: '施工图设计进行中 - 2024-06-15' },
                ]}
              />
            </Card>
          </div>
        )}
      </Drawer>

      <Drawer
        title="已发布图纸"
        width={700}
        open={versionsDrawerOpen}
        onClose={() => setVersionsDrawerOpen(false)}
        destroyOnClose
      >
        {selectedProjectVersions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <div>暂无已发布的图纸版本</div>
          </div>
        ) : (
          <List
            dataSource={selectedProjectVersions}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button size="small" type="primary" icon={<EyeOutlined />}>
                    在线预览
                  </Button>,
                  <Button size="small" icon={<FileDoneOutlined />}>
                    下载
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<FileTextOutlined />} style={{ backgroundColor: '#1677ff' }} />}
                  title={
                    <Space>
                      <Tag color="success">{item.versionNo}</Tag>
                      {item.fileName}
                    </Space>
                  }
                  description={
                    <Space>
                      <span>
                        <UserOutlined /> {item.uploadedByName}
                      </span>
                      <span>
                        <ClockCircleOutlined /> {item.createdAt}
                      </span>
                      <span>{(item.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </div>
  )
}
