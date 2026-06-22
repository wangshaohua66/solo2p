import { useState } from 'react'
import { Card, Tabs, Table, Button, Input, Form, Upload, Modal, Tag, message, Select, Row, Col } from 'antd'
import { PlusOutlined, UploadOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons'
import type { TabsProps } from 'antd'
import MedicalRecordForm from '../components/medical-record/MedicalRecordForm'
import DicomViewer from '../components/medical-record/DicomViewer'
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
  const [viewerModalVisible, setViewerModalVisible] = useState(false)
  const [selectedImage, setSelectedImage] = useState<any>(null)
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

  const mockImages = [
    { id: 1, name: 'CBCT-2024-01-15', type: 'CBCT', date: '2024-01-15', fileSize: '156MB', slices: 180 },
    { id: 2, name: '全景片-01', type: '全景片', date: '2024-01-10', fileSize: '12MB', slices: 1 },
    { id: 3, name: '根尖片-16', type: '根尖片', date: '2024-01-10', fileSize: '5MB', slices: 1 },
    { id: 4, name: 'CBCT-治疗前', type: 'CBCT', date: '2023-12-20', fileSize: '148MB', slices: 180 },
    { id: 5, name: '侧位片', type: '头颅侧位', date: '2023-12-15', fileSize: '8MB', slices: 1 },
    { id: 6, name: 'CBCT-复查', type: 'CBCT', date: '2024-01-05', fileSize: '162MB', slices: 180 },
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

  const handleViewImage = (image: any) => {
    setSelectedImage(image)
    setViewerModalVisible(true)
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
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <div className="upload-section">
                <Upload.Dragger
                  multiple
                  showUploadList
                  accept=".dcm,.jpg,.jpeg,.png"
                  beforeUpload={() => {
                    message.info('DICOM影像上传中...')
                    return false
                  }}
                >
                  <p className="ant-upload-drag-icon">
                    <UploadOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽上传DICOM影像文件</p>
                  <p className="ant-upload-hint">支持单文件最大200MB，支持DICOM、JPG、PNG格式</p>
                </Upload.Dragger>
              </div>

              <div className="image-list-section">
                <div className="section-header">
                  <h3>影像列表</h3>
                  <Select defaultValue="all" style={{ width: 120 }} size="small">
                    <Option value="all">全部类型</Option>
                    <Option value="CBCT">CBCT</Option>
                    <Option value="全景片">全景片</Option>
                    <Option value="根尖片">根尖片</Option>
                  </Select>
                </div>
                <div className="image-grid">
                  {mockImages.map((image) => (
                    <Card
                      key={image.id}
                      hoverable
                      className="image-card"
                      actions={[
                        <Button
                          type="text"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => handleViewImage(image)}
                        >
                          查看
                        </Button>,
                      ]}
                    >
                      <div className="image-placeholder">
                        <span className="image-type-tag">{image.type}</span>
                        <span className="image-title">{image.name}</span>
                      </div>
                      <div className="image-meta">
                        <span>{image.date}</span>
                        <span>{image.fileSize}</span>
                        {image.slices > 1 && <span>{image.slices}层</span>}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </Col>

            <Col xs={24} lg={10}>
              <div className="viewer-panel">
                <div className="panel-header">
                  <h4>DICOM 预览</h4>
                </div>
                <DicomViewer />
              </div>
            </Col>
          </Row>
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

      <Modal
        title={selectedImage ? `影像查看 - ${selectedImage.name}` : '影像查看'}
        open={viewerModalVisible}
        onCancel={() => setViewerModalVisible(false)}
        width={900}
        footer={null}
      >
        <DicomViewer width={700} height={400} />
      </Modal>
    </div>
  )
}

export default MedicalCenter
