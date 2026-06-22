import React, { useEffect, useState } from 'react'
import { Card, Table, Tag, Button, Space, Select, Modal, Form, Input, message } from 'antd'
import { SearchOutlined, CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { bookingApi } from '@/api/booking'
import { Booking, BookingStatus, BookingStatusMap, PageResult } from '@/types'

const { Option } = Select
const { TextArea } = Input

const AdminBookings: React.FC = () => {
  const [data, setData] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [status, setStatus] = useState<BookingStatus | undefined>()
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null)
  const [remarkForm] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await bookingApi.getAll({ status, page, size })
      const result = res.data as unknown as PageResult<Booking>
      setData(result?.content || [])
      setTotal(result?.totalElements || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page, size, status])

  const handleApprove = async (id: string) => {
    Modal.confirm({
      title: '批准预约',
      content: (
        <Form form={remarkForm}>
          <Form.Item name="remark" label="审批备注">
            <TextArea rows={2} placeholder="请输入备注（选填）" />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const values = remarkForm.getFieldsValue()
        try {
          await bookingApi.approve(id, values.remark)
          message.success('预约已批准')
          fetchData()
        } catch (e) { console.error(e) }
      },
    })
  }

  const handleReject = async (id: string) => {
    Modal.confirm({
      title: '拒绝预约',
      content: (
        <Form form={remarkForm}>
          <Form.Item name="remark" label="拒绝原因" rules={[{ required: true, message: '请输入拒绝原因' }]}>
            <TextArea rows={2} placeholder="请输入拒绝原因" />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const values = remarkForm.getFieldsValue()
        try {
          await bookingApi.reject(id, values.remark)
          message.success('预约已拒绝')
          fetchData()
        } catch (e) { console.error(e) }
      },
    })
  }

  const getStatusColor = (s: BookingStatus) => {
    switch (s) {
      case BookingStatus.PENDING: return 'warning'
      case BookingStatus.APPROVED: return 'success'
      case BookingStatus.REJECTED: return 'error'
      case BookingStatus.COMPLETED: return 'default'
      case BookingStatus.CANCELLED: return 'default'
    }
  }

  const columns = [
    { title: '机构名称', dataIndex: 'institutionName', key: 'institutionName', render: (t: string) => <span style={{ color: '#e8e8e8' }}>{t}</span> },
    { title: '联系人', dataIndex: 'contactPerson', key: 'contactPerson' },
    { title: '联系电话', dataIndex: 'contactPhone', key: 'contactPhone' },
    { title: '参与人数', dataIndex: 'participantCount', key: 'participantCount' },
    { title: '预约时间', key: 'time', render: (_: any, r: Booking) => (
      <div>
        <div>{dayjs(r.startTime).format('YYYY-MM-DD HH:mm')}</div>
        <div style={{ color: '#707070', fontSize: 12 }}>至 {dayjs(r.endTime).format('MM-DD HH:mm')}</div>
      </div>
    )},
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: BookingStatus) => <Tag color={getStatusColor(s)}>{BookingStatusMap[s]}</Tag> },
    {
      title: '操作', key: 'actions', render: (_: any, record: Booking) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => { setCurrentBooking(record); setDetailVisible(true) }}>详情</Button>
          {record.status === BookingStatus.PENDING && (
            <>
              <Button type="link" icon={<CheckOutlined />} onClick={() => handleApprove(record.id)}>批准</Button>
              <Button type="link" danger icon={<CloseOutlined />} onClick={() => handleReject(record.id)}>拒绝</Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card style={{ borderRadius: 8, marginBottom: 16 }} title={<span style={{ color: '#c8a96e' }}>研学预约管理</span>}
        extra={
          <Select placeholder="按状态筛选" value={status} onChange={(v) => { setStatus(v); setPage(0) }} allowClear style={{ width: 160 }}>
            {Object.entries(BookingStatusMap).map(([k, v]) => (
              <Option key={k} value={k}>{v}</Option>
            ))}
          </Select>
        }>
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={{
          current: page + 1, pageSize: size, total, showSizeChanger: true,
          onChange: (p, s) => { setPage(p - 1); setSize(s) }
        }} />
      </Card>

      <Modal title="预约详情" open={detailVisible} onCancel={() => setDetailVisible(false)} footer={null} width={600}>
        {currentBooking && (
          <div style={{ lineHeight: 2 }}>
            <p><strong>机构名称：</strong>{currentBooking.institutionName}</p>
            <p><strong>联系人：</strong>{currentBooking.contactPerson} / {currentBooking.contactPhone}</p>
            <p><strong>邮箱：</strong>{currentBooking.contactEmail || '-'}</p>
            <p><strong>参与人数：</strong>{currentBooking.participantCount}人</p>
            <p><strong>时间：</strong>{dayjs(currentBooking.startTime).format('YYYY-MM-DD HH:mm')} 至 {dayjs(currentBooking.endTime).format('YYYY-MM-DD HH:mm')}</p>
            <p><strong>地点：</strong>{currentBooking.location}</p>
            <p><strong>研学内容：</strong></p>
            <p style={{ background: '#1a1a2e', padding: 12, borderRadius: 4 }}>{currentBooking.content}</p>
            {currentBooking.specialRequirements && (
              <>
                <p><strong>特殊需求：</strong></p>
                <p style={{ background: '#1a1a2e', padding: 12, borderRadius: 4 }}>{currentBooking.specialRequirements}</p>
              </>
            )}
            {currentBooking.approvalRemark && (
              <p><strong>审批备注：</strong>{currentBooking.approvalRemark}</p>
            )}
            <p><strong>状态：</strong><Tag color={getStatusColor(currentBooking.status)}>{BookingStatusMap[currentBooking.status]}</Tag></p>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default AdminBookings
