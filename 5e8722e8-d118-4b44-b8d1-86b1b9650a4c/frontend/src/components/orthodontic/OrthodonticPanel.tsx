import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Timeline, Progress, Tag, message } from 'antd'
import { PlusOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import './OrthodonticPanel.scss'

const { Option } = Select

function OrthodonticPanel() {
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [addVisitVisible, setAddVisitVisible] = useState(false)
  const [form] = Form.useForm()

  const patients = [
    { id: 1, name: '李四', startDate: '2023-06-15', bracketType: '金属托槽', progress: 65, totalVisits: 12, nextVisit: '2024-01-20' },
    { id: 2, name: '陈七', startDate: '2023-09-01', bracketType: '隐形矫正', progress: 30, totalVisits: 8, nextVisit: '2024-01-22' },
    { id: 3, name: '周八', startDate: '2023-03-10', bracketType: '陶瓷托槽', progress: 85, totalVisits: 18, nextVisit: '2024-01-18' },
  ]

  const visits = [
    { id: 1, date: '2023-06-15', type: '初诊', doctor: '王医生', movement: 0, adjustment: '安装托槽和初始弓丝', notes: '患者适应良好' },
    { id: 2, date: '2023-08-15', type: '复诊', doctor: '王医生', movement: 1.2, adjustment: '更换镍钛圆丝为方丝', notes: '牙齿移动良好' },
    { id: 3, date: '2023-10-15', type: '复诊', doctor: '王医生', movement: 2.5, adjustment: '关闭间隙', notes: '注意口腔卫生' },
    { id: 4, date: '2023-12-15', type: '复诊', doctor: '王医生', movement: 3.8, adjustment: '精细调整', notes: '继续保持' },
  ]

  const chartOption = {
    title: { text: '牙齿移动进度', left: 'center', textStyle: { fontSize: 12 } },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['第1次', '第2次', '第3次', '第4次', '第5次', '第6次'],
    },
    yAxis: { type: 'value', name: '移动量(mm)' },
    series: [
      {
        data: [0, 1.2, 2.5, 3.8, 4.2, 4.8],
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#1890ff', width: 2 },
        itemStyle: { color: '#1890ff' },
        areaStyle: { color: 'rgba(24, 144, 255, 0.1)' },
      },
    ],
  }

  const handleViewDetail = (patient: any) => {
    setSelectedPatient(patient)
  }

  const handleAddVisit = () => {
    setAddVisitVisible(true)
  }

  const handleVisitSubmit = () => {
    form.validateFields().then(() => {
      message.success('复诊记录已添加')
      setAddVisitVisible(false)
      form.resetFields()
    })
  }

  return (
    <div className="orthodontic-panel">
      {!selectedPatient ? (
        <div className="patient-list">
          <div className="panel-header">
            <h3>正畸患者列表</h3>
            <Button type="primary" icon={<PlusOutlined />}>
              新增患者
            </Button>
          </div>
          <Table
            dataSource={patients}
            rowKey="id"
            pagination={false}
            columns={[
              { title: '患者姓名', dataIndex: 'name', key: 'name' },
              { title: '矫正类型', dataIndex: 'bracketType', key: 'bracketType' },
              { title: '开始日期', dataIndex: 'startDate', key: 'startDate' },
              {
                title: '治疗进度',
                dataIndex: 'progress',
                key: 'progress',
                render: (progress: number) => (
                  <Progress percent={progress} size="small" />
                ),
              },
              { title: '下次复诊', dataIndex: 'nextVisit', key: 'nextVisit' },
              {
                title: '操作',
                key: 'action',
                render: (_, record) => (
                  <Button type="link" onClick={() => handleViewDetail(record)}>
                    查看详情
                  </Button>
                ),
              },
            ]}
          />
        </div>
      ) : (
        <div className="patient-detail">
          <div className="detail-header">
            <Button onClick={() => setSelectedPatient(null)}>返回列表</Button>
            <h3>{selectedPatient.name} - 正畸治疗跟踪</h3>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddVisit}>
              添加复诊
            </Button>
          </div>

          <div className="detail-content">
            <div className="info-section">
              <Card title="治疗方案" size="small" className="info-card">
                <div className="info-row">
                  <span className="label">托槽类型：</span>
                  <Tag color="blue">{selectedPatient.bracketType}</Tag>
                </div>
                <div className="info-row">
                  <span className="label">开始日期：</span>
                  <span>{selectedPatient.startDate}</span>
                </div>
                <div className="info-row">
                  <span className="label">总复诊次数：</span>
                  <span>{selectedPatient.totalVisits} 次</span>
                </div>
                <div className="info-row">
                  <span className="label">治疗进度：</span>
                  <Progress percent={selectedPatient.progress} size="small" />
                </div>
              </Card>

              <Card title="进度对比" size="small" className="chart-card">
                <ReactECharts option={chartOption} style={{ height: 200 }} />
              </Card>
            </div>

            <Card title="复诊时间轴" size="small" className="timeline-card">
              <Timeline
                mode="left"
                items={visits.map((visit) => ({
                  color: visit.type === '初诊' ? 'blue' : 'green',
                  children: (
                    <div className="timeline-item">
                      <div className="timeline-date">{visit.date}</div>
                      <div className="timeline-content">
                        <Tag color={visit.type === '初诊' ? 'blue' : 'green'}>{visit.type}</Tag>
                        <span className="doctor">主治：{visit.doctor}</span>
                        <div className="movement">
                          牙齿移动量：{visit.movement}mm
                        </div>
                        <div className="adjustment">
                          调整内容：{visit.adjustment}
                        </div>
                        <div className="notes">备注：{visit.notes}</div>
                      </div>
                    </div>
                  ),
                }))}
              />
            </Card>
          </div>
        </div>
      )}

      <Modal
        title="添加复诊记录"
        open={addVisitVisible}
        onOk={handleVisitSubmit}
        onCancel={() => setAddVisitVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <div className="form-row">
            <Form.Item name="date" label="复诊日期" className="form-item-half" rules={[{ required: true }]}>
              <Input type="date" />
            </Form.Item>
            <Form.Item name="doctor" label="主治医生" className="form-item-half" rules={[{ required: true }]}>
              <Select placeholder="请选择">
                <Option value="1">王医生</Option>
                <Option value="2">李医生</Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="movement" label="牙齿移动量(mm)">
            <Input type="number" step="0.1" />
          </Form.Item>
          <Form.Item name="adjustment" label="调整内容">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="nextVisit" label="下次复诊时间">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default OrthodonticPanel
