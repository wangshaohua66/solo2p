import { useState } from 'react'
import { Card, Tabs, Table, Button, Input, Form, Upload, Modal, Tag, Rate, message, Select } from 'antd'
import { PlusOutlined, UploadOutlined, SearchOutlined } from '@ant-design/icons'
import type { TabsProps } from 'antd'
import MedicalRecordForm from '../components/medical-record/MedicalRecordForm'
import OrthodonticPanel from '../components/orthodontic/OrthodonticPanel'
import ImplantPanel from '../components/implant/ImplantPanel'
import './MedicalCenter.scss'

const { Search } = Input
const { Option } = Select

function MedicalCenter() {
  const [activeTab, setActiveTab] = useState('record')
  const [searchPatient, setSearchPatient] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [recordModalVisible, setRecordModalVisible] = useState(false)
  const [form] = Form.useForm()

  const mockPatients = [
    { id: 1, name: '张三', phone: '138****1234', lastVisit: '2024-01-15', records: 5 },
    { id: 2, name: '李四', phone: '139****5678', lastVisit: '2024-01-14', records: 3 },
    { id: 3, name: '王五', phone: '137****9012', lastVisit: '2024-01-13', records: 8 },
    { id: 4, name: '赵六', phone: '136****3456', lastVisit: '2024-01-12', records: 2 },
  ]

  const mockRecords = [
    { id: 1, date: '2024-01-15', doctor: '李医生', department: '口腔内科', diagnosis: '龋齿', treatment: '充填治疗' },
    { id: 2, date: '2024-01-10', doctor: '李医生', department: '口腔内科', diagnosis: '牙髓炎', treatment: '根管治疗' },
    { id: 3, date: '2023-12-20', doctor: '王医生', department: '正畸科', diagnosis: '牙列不齐', treatment: '正畸治疗' },
  ]

  const recordColumns = [
    { title: '就诊日期', dataIndex: 'date', key: 'date' },
    { title: '主治医生', dataIndex: 'doctor', key: 'doctor' },
    { title: '科室', dataIndex: 'department', key: 'department' },
    { title: '诊断', dataIndex: 'diagnosis', key: 'diagnosis' },
    { title: '治疗方案', dataIndex: 'treatment', key: 'treatment' },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Button type="link" size="small">查看详情</Button>
      ),
    },
  ]

  const handleSearch = (value: string) => {
    setSearchPatient(value)
  }

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient)
  }

  const handleNewRecord = () => {
    setRecordModalVisible(true)
  }

  const handleRecordSubmit = () => {
    message.success('病历保存成功')
    setRecordModalVisible(false)
    form.resetFields()
  }

  const tabItems: TabsProps['items'] = [
    {
      key: 'record',
      label: '电子病历',
      children: (
        <div className="medical-content">
          <div className="patient-search">
            <Search
              placeholder="搜索患者姓名或手机号"
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              onSearch={handleSearch}
              style={{ width: 400 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleNewRecord}>
              新建病历
            </Button>
          </div>

          <div className="patient-records">
            {selectedPatient ? (
              <div className="selected-patient">
                <Card className="patient-info-card" size="small">
                  <div className="patient-basic">
                    <span className="patient-name">{selectedPatient.name}</span>
                    <span className="patient-phone">{selectedPatient.phone}</span>
                    <Tag color="blue">历史就诊 {selectedPatient.records} 次</Tag>
                  </div>
                </Card>
                <Table
                  columns={recordColumns}
                  dataSource={mockRecords}
                  rowKey="id"
                  pagination={false}
                  className="records-table"
                />
              </div>
            ) : (
              <div className="patient-list">
                <h3>今日就诊患者</h3>
                {mockPatients.map((patient) => (
                  <Card
                    key={patient.id}
                    className="patient-card"
                    hoverable
                    onClick={() => handleSelectPatient(patient)}
                  >
                    <div className="patient-card-info">
                      <span className="patient-name">{patient.name}</span>
                      <span className="patient-phone">{patient.phone}</span>
                      <span className="patient-last">上次就诊：{patient.lastVisit}</span>
                    </div>
                    <div className="patient-records-count">
                      {patient.records} 条记录
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'orthodontic',
      label: '正畸跟踪',
      children: <OrthodonticPanel />,
    },
    {
      key: 'implant',
      label: '种植管理',
      children: <ImplantPanel />,
    },
    {
      key: 'images',
      label: '影像资料',
      children: (
        <div className="image-gallery">
          <div className="upload-section">
            <Upload.Dragger
              multiple
              showUploadList
              beforeUpload={() => {
                message.info('DICOM影像上传中...')
                return false
              }}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽上传DICOM影像文件</p>
              <p className="ant-upload-hint">支持单文件最大200MB，支持DICOM格式</p>
            </Upload.Dragger>
          </div>
          <div className="image-list">
            <h3>影像列表</h3>
            <div className="image-grid">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <Card key={item} hoverable className="image-card">
                  <div className="image-placeholder">
                    <span>CBCT影像 #{item}</span>
                  </div>
                  <div className="image-info">
                    <span className="image-name">patient_00{item}.dcm</span>
                    <span className="image-date">2024-01-{10 + item}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="medical-center">
      <Card className="main-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Card>

      <Modal
        title="新建电子病历"
        open={recordModalVisible}
        onCancel={() => setRecordModalVisible(false)}
        onOk={handleRecordSubmit}
        width={800}
        okText="保存病历"
      >
        <MedicalRecordForm form={form} />
      </Modal>
    </div>
  )
}

export default MedicalCenter
