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
  Select,
  InputNumber,
  message,
  Steps,
  Row,
  Col,
  Descriptions,
  Drawer,
  Timeline,
  Badge,
} from 'antd'
import {
  PlusOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { ChangeRequest, ChangeStatus } from '@/types'
import { changeStatusMap, changeStatusColorMap } from '@/utils/enumMap'
import { mockChanges, mockProjects } from '@/utils/mockData'
import dayjs from 'dayjs'

const { Step } = Steps

export default function ChangeRequestPage() {
  const [changes, setChanges] = useState<ChangeRequest[]>(mockChanges)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentChange, setCurrentChange] = useState<ChangeRequest | null>(null)
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [isApprove, setIsApprove] = useState(true)
  const [createForm] = Form.useForm()
  const [approveForm] = Form.useForm()

  const handleCreate = () => {
    createForm.resetFields()
    setCreateModalOpen(true)
  }

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields()
      const newChange: ChangeRequest = {
        ...values,
        id: Math.max(...changes.map((c) => c.id), 0) + 1,
        projectName: mockProjects.find((p) => p.id === values.projectId)?.name || '',
        changeNo: `CR-${dayjs().year()}-${String(changes.length + 1).padStart(3, '0')}`,
        status: 'DRAFT' as ChangeStatus,
        applicantId: 1,
        applicantName: '当前用户',
        applicantType: 'INTERNAL',
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        approvalRecords: [],
      }
      setChanges([newChange, ...changes])
      setCreateModalOpen(false)
      message.success('创建成功')
    } catch (e) {}
  }

  const handleViewDetail = (record: ChangeRequest) => {
    setCurrentChange(record)
    setDrawerOpen(true)
  }

  const handleSubmit = (record: ChangeRequest) => {
    setChanges(
      changes.map((c) =>
        c.id === record.id ? { ...c, status: 'SUBMITTED' as ChangeStatus, currentApproverId: record.currentApproverId } : c
      )
    )
    message.success('已提交审批')
  }

  const handleApprove = (approved: boolean) => {
    setIsApprove(approved)
    approveForm.resetFields()
    setApproveModalOpen(true)
  }

  const handleApproveSubmit = async () => {
    try {
      const values = await approveForm.validateFields()
      if (currentChange) {
        let newStatus: ChangeStatus = currentChange.status
        if (isApprove) {
          if (currentChange.status === 'SUBMITTED') newStatus = 'PM_APPROVED'
          else if (currentChange.status === 'PM_APPROVED') newStatus = 'LEAD_APPROVED'
          else if (currentChange.status === 'LEAD_APPROVED') newStatus = 'CLIENT_APPROVED'
          else if (currentChange.status === 'CLIENT_APPROVED') newStatus = 'IMPLEMENTED'
        } else {
          newStatus = 'REJECTED'
        }

        const approvalRecord = {
          id: Math.random(),
          changeRequestId: currentChange.id,
          approverId: 1,
          approverName: '当前用户',
          approverRole: isApprove ? 'PROJECT_MANAGER' : 'ADMIN',
          comment: values.comment,
          approved: isApprove,
          approvedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }

        setChanges(
          changes.map((c) =>
            c.id === currentChange.id
              ? {
                  ...c,
                  status: newStatus,
                  approvalRecords: [...c.approvalRecords, approvalRecord],
                }
              : c
          )
        )
        setApproveModalOpen(false)
        message.success(isApprove ? '审批通过' : '已驳回')
      }
    } catch (e) {}
  }

  const getApprovalSteps = (status: ChangeStatus) => {
    type StepStatus = 'wait' | 'error' | 'finish' | 'process'
    const stepList: { title: string; status: StepStatus }[] = [
      { title: '提交申请', status: 'finish' },
      { title: '项目经理审批', status: 'wait' },
      { title: '专业负责人审批', status: 'wait' },
      { title: '客户审批', status: 'wait' },
      { title: '变更实施', status: 'wait' },
    ]
    if (status === 'DRAFT') return stepList.map((s, i) => (i === 0 ? { ...s, status: 'process' as StepStatus } : s))
    if (status === 'SUBMITTED') {
      stepList[1].status = 'process'
    } else if (status === 'PM_APPROVED') {
      stepList[1].status = 'finish'
      stepList[2].status = 'process'
    } else if (status === 'LEAD_APPROVED') {
      stepList[1].status = 'finish'
      stepList[2].status = 'finish'
      stepList[3].status = 'process'
    } else if (status === 'CLIENT_APPROVED') {
      stepList[1].status = 'finish'
      stepList[2].status = 'finish'
      stepList[3].status = 'finish'
      stepList[4].status = 'process'
    } else if (status === 'IMPLEMENTED') {
      stepList.forEach((s) => (s.status = 'finish'))
    } else if (status === 'REJECTED') {
      stepList.forEach((s, i) => (i === 0 ? (s.status = 'finish') : (s.status = 'error')))
    }
    return stepList
  }

  const columns = [
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
      title: '变更标题',
      dataIndex: 'title',
      width: 200,
    },
    {
      title: '变更原因',
      dataIndex: 'reason',
      width: 150,
      ellipsis: true,
    },
    {
      title: '变更费用',
      dataIndex: 'additionalFee',
      width: 110,
      render: (fee: number) => <span style={{ color: '#cf1322', fontWeight: 'bold' }}>¥{fee.toLocaleString()}</span>,
    },
    {
      title: '工作量',
      dataIndex: 'workload',
      width: 100,
      render: (w: number) => `${w} 人天`,
    },
    {
      title: '申请人',
      dataIndex: 'applicantName',
      width: 100,
      render: (name: string, record: ChangeRequest) => (
        <Space>
          {record.applicantType === 'CLIENT' && <Tag color="purple">客户</Tag>}
          {name}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 160,
      render: (status: ChangeStatus) => (
        <Tag color={changeStatusColorMap[status]}>{changeStatusMap[status]}</Tag>
      ),
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: ChangeRequest) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status === 'DRAFT' && (
            <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => handleSubmit(record)}>
              提交审批
            </Button>
          )}
          {(record.status === 'SUBMITTED' ||
            record.status === 'PM_APPROVED' ||
            record.status === 'LEAD_APPROVED' ||
            record.status === 'CLIENT_APPROVED') && (
            <Space>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => { setCurrentChange(record); handleApprove(true) }}>
                通过
              </Button>
              <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => { setCurrentChange(record); handleApprove(false) }}>
                驳回
              </Button>
            </Space>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>变更申请列表</div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            发起变更
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={changes}
          rowKey="id"
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title="发起设计变更"
        open={createModalOpen}
        onOk={handleCreateSubmit}
        onCancel={() => setCreateModalOpen(false)}
        width={800}
        okText="保存草稿"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
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
              <Form.Item name="title" label="变更标题" rules={[{ required: true, message: '请输入变更标题' }]}>
                <Input placeholder="请输入变更标题" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="变更原因" rules={[{ required: true, message: '请输入变更原因' }]}>
            <Input.TextArea rows={2} placeholder="请说明变更原因" />
          </Form.Item>
          <Form.Item name="content" label="变更内容" rules={[{ required: true, message: '请输入变更内容' }]}>
            <Input.TextArea rows={3} placeholder="请详细描述变更内容" />
          </Form.Item>
          <Form.Item name="impactScope" label="影响范围" rules={[{ required: true, message: '请输入影响范围' }]}>
            <Input.TextArea rows={2} placeholder="请说明涉及的专业、图纸等影响范围" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="workload" label="预估工作量(人天)" rules={[{ required: true, message: '请输入预估工作量' }]}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入人天" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="additionalFee" label="追加设计费(元)" rules={[{ required: true, message: '请输入追加费用' }]}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入费用金额" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title="变更详情"
        width={700}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
      >
        {currentChange && (
          <div>
            <div className="change-flow" style={{ marginBottom: 16 }}>
              <Steps
                size="small"
                current={0}
                items={getApprovalSteps(currentChange.status)}
                direction="horizontal"
              />
            </div>

            <Card style={{ marginBottom: 16 }} size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="变更编号">{currentChange.changeNo}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={changeStatusColorMap[currentChange.status]}>
                    {changeStatusMap[currentChange.status]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="所属项目" span={2}>{currentChange.projectName}</Descriptions.Item>
                <Descriptions.Item label="申请人">{currentChange.applicantName}</Descriptions.Item>
                <Descriptions.Item label="申请时间">{currentChange.createdAt}</Descriptions.Item>
                <Descriptions.Item label="预估工作量">{currentChange.workload} 人天</Descriptions.Item>
                <Descriptions.Item label="追加费用">
                  <span style={{ color: '#cf1322', fontWeight: 'bold' }}>
                    ¥{currentChange.additionalFee.toLocaleString()}
                  </span>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card style={{ marginBottom: 16 }} size="small" title="变更详情">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="变更标题">{currentChange.title}</Descriptions.Item>
                <Descriptions.Item label="变更原因">{currentChange.reason}</Descriptions.Item>
                <Descriptions.Item label="变更内容">{currentChange.content}</Descriptions.Item>
                <Descriptions.Item label="影响范围">{currentChange.impactScope}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="审批记录">
              {currentChange.approvalRecords.length === 0 ? (
                <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>暂无审批记录</div>
              ) : (
                <Timeline
                  items={currentChange.approvalRecords.map((record) => ({
                    color: record.approved ? 'green' : 'red',
                    dot: record.approved ? <CheckCircleOutlined /> : <CloseCircleOutlined />,
                    children: (
                      <div>
                        <div style={{ fontWeight: 'bold' }}>
                          {record.approverName} ({record.approverRole})
                          <Tag color={record.approved ? 'success' : 'error'} style={{ marginLeft: 8 }}>
                            {record.approved ? '审批通过' : '审批驳回'}
                          </Tag>
                        </div>
                        {record.comment && <div style={{ color: '#666', marginTop: 4 }}>{record.comment}</div>}
                        <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>{record.approvedAt}</div>
                      </div>
                    ),
                  }))}
                />
              )}
            </Card>
          </div>
        )}
      </Drawer>

      <Modal
        title={isApprove ? '审批通过' : '审批驳回'}
        open={approveModalOpen}
        onOk={handleApproveSubmit}
        onCancel={() => setApproveModalOpen(false)}
        okText={isApprove ? '确认通过' : '确认驳回'}
        cancelText="取消"
        okButtonProps={{ danger: !isApprove }}
        destroyOnClose
      >
        <Form form={approveForm} layout="vertical">
          <Form.Item name="comment" label={isApprove ? '审批意见(可选)' : '驳回原因'} rules={!isApprove ? [{ required: true, message: '请输入驳回原因' }] : []}>
            <Input.TextArea rows={4} placeholder={isApprove ? '请输入审批意见...' : '请详细说明驳回原因...'} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
