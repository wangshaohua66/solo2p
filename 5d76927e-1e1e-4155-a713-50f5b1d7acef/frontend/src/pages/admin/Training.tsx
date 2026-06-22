import React, { useEffect, useState } from 'react'
import {
  Card, Table, Tag, Button, Space, Modal, Form, Input, InputNumber, DatePicker, message, Progress, Select, List
} from 'antd'
import { PlusOutlined, EditOutlined, FileTextOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { trainingApi, inheritorApi, heritageApi } from '@/api/admin'
import { TrainingPlan, TrainingRecord, Inheritor, Heritage, PageResult } from '@/types'

const { Option } = Select
const { TextArea } = Input

const AdminTraining: React.FC = () => {
  const [data, setData] = useState<TrainingPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [modalVisible, setModalVisible] = useState(false)
  const [recordModalVisible, setRecordModalVisible] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<TrainingPlan | null>(null)
  const [reportVisible, setReportVisible] = useState(false)
  const [reportContent, setReportContent] = useState('')
  const [inheritors, setInheritors] = useState<Inheritor[]>([])
  const [heritages, setHeritages] = useState<Heritage[]>([])
  const [form] = Form.useForm()
  const [recordForm] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await trainingApi.getAllPlans({ page, size })
      const result = res.data as unknown as PageResult<TrainingPlan>
      setData(result?.content || [])
      setTotal(result?.totalElements || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    inheritorApi.getPublicList({ size: 100 }).then((r: any) => setInheritors(r.data?.content || []))
    heritageApi.getPublicList({ size: 100 }).then((r: any) => setHeritages(r.data?.content || []))
  }, [page, size])

  const handleAdd = () => {
    form.resetFields()
    setModalVisible(true)
  }

  const handleAddRecord = (plan: TrainingPlan) => {
    setCurrentPlan(plan)
    recordForm.resetFields()
    setRecordModalVisible(true)
  }

  const handleSubmit = async (values: any) => {
    try {
      await trainingApi.createPlan({
        ...values,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
      })
      message.success('创建成功')
      setModalVisible(false)
      fetchData()
    } catch (e) { console.error(e) }
  }

  const handleSubmitRecord = async (values: any) => {
    if (!currentPlan) return
    try {
      await trainingApi.addTrainingRecord(currentPlan.id, {
        ...values,
        trainingDate: values.trainingDate?.format('YYYY-MM-DD'),
      })
      message.success('记录添加成功')
      setRecordModalVisible(false)
      fetchData()
    } catch (e) { console.error(e) }
  }

  const handleGenerateReport = async (id: string) => {
    try {
      const res = await trainingApi.generateReport(id)
      setReportContent(res.data || '')
      setReportVisible(true)
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (id: string) => {
    try {
      await trainingApi.deletePlan(id)
      message.success('删除成功')
      fetchData()
    } catch (e) { console.error(e) }
  }

  const getProgressStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success'
      case 'IN_PROGRESS': return 'active'
      default: return 'normal'
    }
  }

  const columns = [
    { title: '计划名称', dataIndex: 'planName', key: 'planName', render: (t: string) => <span style={{ color: '#e8e8e8' }}>{t}</span> },
    { title: '年度', dataIndex: 'year', key: 'year' },
    { title: '目标时长', dataIndex: 'targetTeachingHours', key: 'targetTeachingHours', render: (h: number) => `${h}小时` },
    {
      title: '进度', key: 'progress', render: (_: any, r: TrainingPlan) => {
        const pct = r.targetTeachingHours > 0 ? Math.min(100, Math.round((r.completedHours / r.targetTeachingHours) * 100)) : 0
        return <Progress percent={pct} status={getProgressStatusColor(r.progressStatus)} size="small" />
      }
    },
    { title: '已完成', dataIndex: 'completedHours', key: 'completedHours', render: (h: number) => `${h}小时` },
    { title: '考核次数', dataIndex: 'completedAssessments', key: 'completedAssessments' },
    { title: '状态', dataIndex: 'progressStatus', key: 'progressStatus', render: (s: string) => {
      const map: Record<string, string> = { NOT_STARTED: '未开始', IN_PROGRESS: '进行中', COMPLETED: '已完成' }
      return <Tag color={getProgressStatusColor(s)}>{map[s] || s}</Tag>
    }},
    {
      title: '操作', key: 'actions', render: (_: any, record: TrainingPlan) => (
        <Space>
          <Button type="link" onClick={() => handleAddRecord(record)}>添加记录</Button>
          <Button type="link" icon={<FileTextOutlined />} onClick={() => handleGenerateReport(record.id)}>生成报告</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card style={{ borderRadius: 8, marginBottom: 16 }} title={<span style={{ color: '#c8a96e' }}>传承培养计划管理</span>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增培养计划</Button>}>
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={{
          current: page + 1, pageSize: size, total, showSizeChanger: true,
          onChange: (p, s) => { setPage(p - 1); setSize(s) }
        }}
        expandedRowRender={(record) => (
          <List
            dataSource={record.trainingRecords}
            locale={{ emptyText: '暂无培训记录' }}
            renderItem={(item: TrainingRecord) => (
              <List.Item>
                <List.Item.Meta
                  title={`${dayjs(item.trainingDate).format('YYYY-MM-DD')} · ${item.content}`}
                  description={
                    <div>
                      <span>学徒：{item.apprenticeName}</span>
                      <span style={{ margin: '0 8px' }}>|</span>
                      <span>时长：{item.durationHours}小时</span>
                      {item.assessmentScore && (<><span style={{ margin: '0 8px' }}>|</span><span>考核：{item.assessmentScore}</span></>)}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )} />
      </Card>

      <Modal title="新增培养计划" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="planName" label="计划名称" rules={[{ required: true }]}><Input /></Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="year" label="年度" rules={[{ required: true }] style={{ flex: 1 }}>
              <Select placeholder="选择年度">
                {['2024', '2025', '2026'].map(y => <Option key={y} value={y}>{y}年</Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="inheritorId" label="传承人" rules={[{ required: true }] style={{ flex: 1 }}>
              <Select showSearch optionFilterProp="children">
                {inheritors.map(i => <Option key={i.id} value={i.id}>{i.name}</Option>)}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="heritageId" label="非遗项目" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children">
              {heritages.map(h => <Option key={h.id} value={h.id}>{h.name}</Option>)}
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="startDate" label="开始日期" rules={[{ required: true }] style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="endDate" label="结束日期" rules={[{ required: true }] style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="targetApprenticeCount" label="目标收徒数" rules={[{ required: true }] style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="targetTeachingHours" label="目标授课时长(小时)" rules={[{ required: true }] style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="objectives" label="培养目标" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space><Button onClick={() => setModalVisible(false)}>取消</Button><Button type="primary" htmlType="submit">保存</Button></Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="添加培训记录" open={recordModalVisible} onCancel={() => setRecordModalVisible(false)} footer={null}>
        <Form form={recordForm} layout="vertical" onFinish={handleSubmitRecord}>
          <Form.Item name="trainingDate" label="培训日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="content" label="培训内容" rules={[{ required: true }]}>
            <TextArea rows={2} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="durationHours" label="时长(小时)" rules={[{ required: true }] style={{ flex: 1 }}>
              <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="apprenticeName" label="学徒姓名" rules={[{ required: true }] style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="assessmentScore" label="考核成绩">
            <Input placeholder="如：优秀、良好、合格等" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space><Button onClick={() => setRecordModalVisible(false)}>取消</Button><Button type="primary" htmlType="submit">保存</Button></Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="培养进度报告" open={reportVisible} onCancel={() => setReportVisible(false)} footer={null} width={600}>
        <pre style={{ background: '#1a1a2e', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', color: '#e8e8e8' }}>
          {reportContent}
        </pre>
      </Modal>
    </div>
  )
}

export default AdminTraining
