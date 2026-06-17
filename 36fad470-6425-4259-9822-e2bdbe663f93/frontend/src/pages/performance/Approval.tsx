import { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  message,
  Drawer,
  Descriptions,
  List,
  Alert
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  fetchPerformances,
  approvePerformance,
  rejectPerformance,
  negotiatePerformance
} from '@/store/performanceSlice'
import { PerformanceStatus, PerformanceType } from '@/types'
import type { Performance } from '@/types'

const { TextArea } = Input

const statusColors: Record<PerformanceStatus, string> = {
  [PerformanceStatus.PENDING]: 'orange',
  [PerformanceStatus.APPROVED]: 'green',
  [PerformanceStatus.REJECTED]: 'red',
  [PerformanceStatus.NEGOTIATING]: 'blue'
}

const statusLabels: Record<PerformanceStatus, string> = {
  [PerformanceStatus.PENDING]: '待审批',
  [PerformanceStatus.APPROVED]: '已通过',
  [PerformanceStatus.REJECTED]: '已驳回',
  [PerformanceStatus.NEGOTIATING]: '协商改期'
}

const typeLabels: Record<PerformanceType, string> = {
  [PerformanceType.DRAMA]: '话剧',
  [PerformanceType.CONCERT]: '音乐会',
  [PerformanceType.DANCE]: '舞蹈',
  [PerformanceType.OPERA]: '戏曲',
  [PerformanceType.CHILDREN]: '儿童剧'
}

export default function PerformanceApproval() {
  const dispatch = useAppDispatch()
  const { performances, loading } = useAppSelector((state) => state.performance)
  const [statusFilter, setStatusFilter] = useState<PerformanceStatus | undefined>(
    PerformanceStatus.PENDING
  )
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [negotiateModalOpen, setNegotiateModalOpen] = useState(false)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [currentPerformance, setCurrentPerformance] = useState<Performance | null>(null)
  const [approveForm] = Form.useForm()
  const [rejectForm] = Form.useForm()
  const [negotiateForm] = Form.useForm()

  useEffect(() => {
    dispatch(fetchPerformances(statusFilter ? { status: statusFilter } : undefined))
  }, [dispatch, statusFilter])

  const openApproveModal = (record: Performance) => {
    setCurrentPerformance(record)
    approveForm.resetFields()
    const defaultStart = dayjs(record.expectedDates[0]).hour(19).minute(30)
    approveForm.setFieldsValue({
      startTime: defaultStart,
      endTime: defaultStart.add(record.expectedDuration, 'minute')
    })
    setApproveModalOpen(true)
  }

  const openRejectModal = (record: Performance) => {
    setCurrentPerformance(record)
    rejectForm.resetFields()
    setRejectModalOpen(true)
  }

  const openNegotiateModal = (record: Performance) => {
    setCurrentPerformance(record)
    negotiateForm.resetFields()
    setNegotiateModalOpen(true)
  }

  const openDetailDrawer = (record: Performance) => {
    setCurrentPerformance(record)
    setDetailDrawerOpen(true)
  }

  const handleApprove = async () => {
    if (!currentPerformance) return
    try {
      const values = await approveForm.validateFields()
      await dispatch(
        approvePerformance({
          id: currentPerformance.id,
          startTime: values.startTime.format('YYYY-MM-DD HH:mm:ss'),
          endTime: values.endTime.format('YYYY-MM-DD HH:mm:ss')
        })
      ).unwrap()
      message.success('审批通过')
      setApproveModalOpen(false)
      dispatch(fetchPerformances(statusFilter ? { status: statusFilter } : undefined))
    } catch (error: any) {
      message.error(error?.message || '操作失败')
    }
  }

  const handleReject = async () => {
    if (!currentPerformance) return
    try {
      const values = await rejectForm.validateFields()
      await dispatch(
        rejectPerformance({
          id: currentPerformance.id,
          reason: values.reason
        })
      ).unwrap()
      message.success('已驳回申请')
      setRejectModalOpen(false)
      dispatch(fetchPerformances(statusFilter ? { status: statusFilter } : undefined))
    } catch (error: any) {
      message.error(error?.message || '操作失败')
    }
  }

  const handleNegotiate = async () => {
    if (!currentPerformance) return
    try {
      const values = await negotiateForm.validateFields()
      await dispatch(
        negotiatePerformance({
          id: currentPerformance.id,
          suggestedDates: values.suggestedDates.map((d: dayjs.Dayjs) => d.format('YYYY-MM-DD')),
          note: values.note
        })
      ).unwrap()
      message.success('已发送协商通知')
      setNegotiateModalOpen(false)
      dispatch(fetchPerformances(statusFilter ? { status: statusFilter } : undefined))
    } catch (error: any) {
      message.error(error?.message || '操作失败')
    }
  }

  const columns: ColumnsType<Performance> = [
    {
      title: '演出名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => openDetailDrawer(record)}>{text}</a>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: PerformanceType) => <Tag color="blue">{typeLabels[type]}</Tag>
    },
    {
      title: '主办方',
      dataIndex: 'organizerName',
      key: 'organizerName',
      width: 120
    },
    {
      title: '场馆',
      dataIndex: 'venueName',
      key: 'venueName',
      width: 100
    },
    {
      title: '期望日期',
      key: 'expectedDates',
      width: 180,
      render: (_, record) =>
        record.expectedDates.map((d) => dayjs(d).format('MM-DD')).join('、')
    },
    {
      title: '时长',
      dataIndex: 'expectedDuration',
      key: 'expectedDuration',
      width: 80,
      render: (val) => `${val}分钟`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: PerformanceStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      )
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {record.status === PerformanceStatus.PENDING && (
            <>
              <Button type="link" size="small" onClick={() => openApproveModal(record)}>
                通过
              </Button>
              <Button type="link" size="small" danger onClick={() => openRejectModal(record)}>
                驳回
              </Button>
              <Button type="link" size="small" onClick={() => openNegotiateModal(record)}>
                协商改期
              </Button>
            </>
          )}
          <Button type="link" size="small" onClick={() => openDetailDrawer(record)}>
            详情
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div className="card-header">
        <div className="card-title">演出审批</div>
        <Space>
          <Select
            style={{ width: 140 }}
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            placeholder="全部状态"
            options={Object.entries(statusLabels).map(([value, label]) => ({
              value,
              label
            }))}
          />
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={performances}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title="审批通过"
        open={approveModalOpen}
        onOk={handleApprove}
        onCancel={() => setApproveModalOpen(false)}
        okText="确认通过"
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          message="请确认档期"
          description="系统将自动检测场馆档期冲突，相邻场次需保证至少60分钟转场时间"
          style={{ marginBottom: 16 }}
        />
        <Form form={approveForm} layout="vertical">
          <Form.Item name="startTime" label="演出开始时间" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endTime" label="演出结束时间" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="驳回申请"
        open={rejectModalOpen}
        onOk={handleReject}
        onCancel={() => setRejectModalOpen(false)}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="驳回原因"
            rules={[{ required: true, message: '请填写驳回原因' }]}
          >
            <TextArea rows={4} placeholder="请详细说明驳回原因..." maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="协商改期"
        open={negotiateModalOpen}
        onOk={handleNegotiate}
        onCancel={() => setNegotiateModalOpen(false)}
        okText="发送协商"
        destroyOnClose
      >
        <Form form={negotiateForm} layout="vertical">
          <Form.Item
            name="suggestedDates"
            label="建议日期"
            rules={[{ required: true, message: '请选择建议日期' }]}
          >
            <DatePicker
              multiple
              style={{ width: '100%' }}
              minDate={dayjs()}
              placeholder="选择建议的演出日期"
            />
          </Form.Item>
          <Form.Item name="note" label="协商说明">
            <TextArea rows={3} placeholder="说明改期原因及建议..." />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="演出申请详情"
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={600}
      >
        {currentPerformance && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="演出名称">{currentPerformance.name}</Descriptions.Item>
              <Descriptions.Item label="演出类型">
                <Tag color="blue">{typeLabels[currentPerformance.type]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="主办方">{currentPerformance.organizerName}</Descriptions.Item>
              <Descriptions.Item label="场馆">{currentPerformance.venueName}</Descriptions.Item>
              <Descriptions.Item label="期望日期">
                {currentPerformance.expectedDates.map((d) => dayjs(d).format('YYYY-MM-DD')).join('、')}
              </Descriptions.Item>
              <Descriptions.Item label="预计时长">
                {currentPerformance.expectedDuration}分钟
              </Descriptions.Item>
              <Descriptions.Item label="审批状态">
                <Tag color={statusColors[currentPerformance.status]}>
                  {statusLabels[currentPerformance.status]}
                </Tag>
              </Descriptions.Item>
              {currentPerformance.rejectReason && (
                <Descriptions.Item label="驳回原因">
                  {currentPerformance.rejectReason}
                </Descriptions.Item>
              )}
            </Descriptions>

            <div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>技术需求：</div>
              <Space wrap>
                {currentPerformance.technicalRequirements?.map((req) => (
                  <Tag key={req}>{req}</Tag>
                )) || <span style={{ color: '#909399' }}>无</span>}
              </Space>
            </div>

            {currentPerformance.devices && currentPerformance.devices.length > 0 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>设备需求：</div>
                <List
                  size="small"
                  bordered
                  dataSource={currentPerformance.devices}
                  renderItem={(item) => (
                    <List.Item>
                      <span>{item.deviceName}</span>
                      <Tag>× {item.quantity}</Tag>
                    </List.Item>
                  )}
                />
              </div>
            )}

            <div style={{ textAlign: 'right' }}>
              {currentPerformance.status === PerformanceStatus.PENDING && (
                <Space>
                  <Button type="primary" onClick={() => openApproveModal(currentPerformance)}>
                    通过
                  </Button>
                  <Button danger onClick={() => openRejectModal(currentPerformance)}>
                    驳回
                  </Button>
                  <Button onClick={() => openNegotiateModal(currentPerformance)}>
                    协商改期
                  </Button>
                </Space>
              )}
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  )
}
