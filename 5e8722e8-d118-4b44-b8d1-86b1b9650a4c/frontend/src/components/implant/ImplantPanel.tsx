import { useState } from 'react'
import { Card, Table, Button, Steps, Checkbox, Tag, Modal, Form, Input, Select, message, Progress } from 'antd'
import { PlusOutlined, CheckOutlined, ClockCircleOutlined } from '@ant-design/icons'
import './ImplantPanel.scss'

const { Step } = Steps
const { Option } = Select

function ImplantPanel() {
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [currentStage, setCurrentStage] = useState(2)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const patients = [
    { id: 1, name: '王五', implantBrand: 'Nobel', implantModel: 'Active', position: '右上6号牙', stage: 2, stageName: '骨结合期', startDate: '2023-11-01', boneGraft: 0.5 },
    { id: 2, name: '吴九', implantBrand: 'Straumann', implantModel: 'BLX', position: '左下4号牙', stage: 3, stageName: '二期手术', startDate: '2023-08-15', boneGraft: 0.3 },
    { id: 3, name: '郑十', implantBrand: 'Dentsply', implantModel: 'Ankylos', position: '左上3号牙', stage: 1, stageName: '手术植入', startDate: '2024-01-10', boneGraft: 0 },
  ]

  const stages = [
    { title: '术前检查', status: 'finish' },
    { title: '手术植入', status: 'finish' },
    { title: '骨结合期', status: 'process' },
    { title: '二期手术', status: 'wait' },
    { title: '牙冠修复', status: 'wait' },
  ]

  const stageChecklist: Record<number, string[]> = {
    0: ['口腔检查', 'CBCT拍摄', '血压测量', '血糖检测', '过敏史询问', '手术知情同意'],
    1: ['局部麻醉', '种植窝预备', '植入种植体', '缝合伤口', '术后拍片', '医嘱告知'],
    2: ['创口检查', '牙龈健康评估', '骨结合影像评估', '口腔卫生指导', '预约复查'],
    3: ['二期手术', '愈合基台安装', '牙龈成形', '取模记录', '牙冠制作'],
    4: ['牙冠试戴', '咬合调整', '粘接固定', '术后拍片', '使用指导', '定期复查'],
  }

  const handleViewDetail = (patient: any) => {
    setSelectedPatient(patient)
    setCurrentStage(patient.stage)
  }

  const handleStageComplete = (stageIndex: number) => {
    message.success(`${stages[stageIndex].title} 阶段已完成`)
    if (stageIndex === currentStage && stageIndex < stages.length - 1) {
      setCurrentStage(stageIndex + 1)
    }
  }

  const handleAddPatient = () => {
    setModalVisible(true)
  }

  const handleSubmit = () => {
    form.validateFields().then(() => {
      message.success('种植患者档案创建成功')
      setModalVisible(false)
      form.resetFields()
    })
  }

  const completedChecklist = stageChecklist[currentStage]?.slice(0, 3) || []

  return (
    <div className="implant-panel">
      {!selectedPatient ? (
        <div className="patient-list">
          <div className="panel-header">
            <h3>种植患者列表</h3>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPatient}>
              新增患者
            </Button>
          </div>
          <Table
            dataSource={patients}
            rowKey="id"
            pagination={false}
            columns={[
              { title: '患者姓名', dataIndex: 'name', key: 'name' },
              { title: '种植体品牌', dataIndex: 'implantBrand', key: 'implantBrand' },
              { title: '植入位置', dataIndex: 'position', key: 'position' },
              {
                title: '当前阶段',
                dataIndex: 'stageName',
                key: 'stageName',
                render: (text: string) => <Tag color="blue">{text}</Tag>,
              },
              { title: '开始日期', dataIndex: 'startDate', key: 'startDate' },
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
            <h3>{selectedPatient.name} - 种植治疗管理</h3>
          </div>

          <Card title="种植体信息" size="small" className="info-card">
            <div className="info-grid">
              <div className="info-item">
                <span className="label">品牌：</span>
                <span className="value">{selectedPatient.implantBrand}</span>
              </div>
              <div className="info-item">
                <span className="label">型号：</span>
                <span className="value">{selectedPatient.implantModel}</span>
              </div>
              <div className="info-item">
                <span className="label">位置：</span>
                <span className="value">{selectedPatient.position}</span>
              </div>
              <div className="info-item">
                <span className="label">骨粉用量：</span>
                <span className="value">{selectedPatient.boneGraft}g</span>
              </div>
              <div className="info-item">
                <span className="label">开始日期：</span>
                <span className="value">{selectedPatient.startDate}</span>
              </div>
              <div className="info-item">
                <span className="label">总进度：</span>
                <Progress percent={((currentStage + 1) / stages.length) * 100} size="small" />
              </div>
            </div>
          </Card>

          <Card title="治疗阶段" size="small" className="stages-card">
            <Steps current={currentStage} items={stages} size="small" />
          </Card>

          <Card
            title={`${stages[currentStage].title} - 检查清单`}
            size="small"
            className="checklist-card"
            extra={
              <Button type="primary" size="small" onClick={() => handleStageComplete(currentStage)}>
                完成本阶段
              </Button>
            }
          >
            <div className="checklist">
              {stageChecklist[currentStage]?.map((item, index) => (
                <div key={index} className="checklist-item">
                  <Checkbox checked={index < completedChecklist.length}>
                    {item}
                  </Checkbox>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Modal
        title="新增种植患者"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <div className="form-row">
            <Form.Item name="patientName" label="患者姓名" className="form-item-half" rules={[{ required: true }]}>
              <Input placeholder="请输入患者姓名" />
            </Form.Item>
            <Form.Item name="position" label="植入位置" className="form-item-half" rules={[{ required: true }]}>
              <Select placeholder="请选择">
                <Option value="右上6号牙">右上6号牙</Option>
                <Option value="左上6号牙">左上6号牙</Option>
                <Option value="左下4号牙">左下4号牙</Option>
                <Option value="右下4号牙">右下4号牙</Option>
              </Select>
            </Form.Item>
          </div>
          <div className="form-row">
            <Form.Item name="implantBrand" label="种植体品牌" className="form-item-half" rules={[{ required: true }]}>
              <Select placeholder="请选择">
                <Option value="Nobel">Nobel</Option>
                <Option value="Straumann">Straumann</Option>
                <Option value="Dentsply">Dentsply</Option>
                <Option value="Osstem">Osstem</Option>
              </Select>
            </Form.Item>
            <Form.Item name="implantModel" label="种植体型号" className="form-item-half">
              <Input placeholder="请输入型号" />
            </Form.Item>
          </div>
          <Form.Item name="boneGraft" label="骨粉用量(g)">
            <Input type="number" step="0.1" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ImplantPanel
