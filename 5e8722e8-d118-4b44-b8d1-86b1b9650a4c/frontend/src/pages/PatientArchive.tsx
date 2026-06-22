import { useState } from 'react'
import { Card, Table, Input, Button, Select, Tag, Modal, Descriptions, Tabs, List } from 'antd'
import { SearchOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons'
import type { TabsProps } from 'antd'
import './PatientArchive.scss'

const { Search } = Input
const { Option } = Select

function PatientArchive() {
  const [searchText, setSearchText] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [addModalVisible, setAddModalVisible] = useState(false)

  const patients = [
    { id: 1, name: '张三', gender: '男', age: 35, phone: '138****1234', firstVisit: '2022-03-15', totalVisits: 12, lastVisit: '2024-01-15', status: 'active' },
    { id: 2, name: '李四', gender: '女', age: 28, phone: '139****5678', firstVisit: '2023-06-01', totalVisits: 8, lastVisit: '2024-01-14', status: 'active' },
    { id: 3, name: '王五', gender: '男', age: 45, phone: '137****9012', firstVisit: '2021-09-10', totalVisits: 20, lastVisit: '2024-01-13', status: 'active' },
    { id: 4, name: '赵六', gender: '女', age: 52, phone: '136****3456', firstVisit: '2022-11-20', totalVisits: 6, lastVisit: '2023-12-20', status: 'inactive' },
    { id: 5, name: '孙七', gender: '男', age: 30, phone: '135****7890', firstVisit: '2023-01-05', totalVisits: 10, lastVisit: '2024-01-10', status: 'active' },
  ]

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '性别', dataIndex: 'gender', key: 'gender' },
    { title: '年龄', dataIndex: 'age', key: 'age' },
    { title: '联系电话', dataIndex: 'phone', key: 'phone' },
    { title: '首次就诊', dataIndex: 'firstVisit', key: 'firstVisit' },
    { title: '最近就诊', dataIndex: 'lastVisit', key: 'lastVisit' },
    { title: '就诊次数', dataIndex: 'totalVisits', key: 'totalVisits' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '活跃' : '休眠'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" onClick={() => handleViewDetail(record)}>
          查看详情
        </Button>
      ),
    },
  ]

  const treatmentHistory = [
    { id: 1, date: '2024-01-15', type: '充填治疗', doctor: '李医生', department: '口腔内科' },
    { id: 2, date: '2024-01-10', type: '根管治疗', doctor: '李医生', department: '口腔内科' },
    { id: 3, date: '2023-11-20', type: '洗牙', doctor: '王医生', department: '口腔内科' },
  ]

  const handleViewDetail = (patient: any) => {
    setSelectedPatient(patient)
    setModalVisible(true)
  }

  const detailTabItems: TabsProps['items'] = [
    {
      key: 'basic',
      label: '基本信息',
      children: (
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="姓名">{selectedPatient?.name}</Descriptions.Item>
          <Descriptions.Item label="性别">{selectedPatient?.gender}</Descriptions.Item>
          <Descriptions.Item label="年龄">{selectedPatient?.age}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{selectedPatient?.phone}</Descriptions.Item>
          <Descriptions.Item label="首次就诊">{selectedPatient?.firstVisit}</Descriptions.Item>
          <Descriptions.Item label="最近就诊">{selectedPatient?.lastVisit}</Descriptions.Item>
          <Descriptions.Item label="就诊次数" span={2}>{selectedPatient?.totalVisits} 次</Descriptions.Item>
          <Descriptions.Item label="过敏史" span={2}>青霉素过敏</Descriptions.Item>
          <Descriptions.Item label="既往史" span={2}>高血压病史5年</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'history',
      label: '就诊记录',
      children: (
        <List
          dataSource={treatmentHistory}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={<span>{item.date} - {item.type}</span>}
                description={`${item.department} · ${item.doctor}`}
              />
            </List.Item>
          )}
        />
      ),
    },
    {
      key: 'recheck',
      label: '复诊计划',
      children: (
        <List
          dataSource={[
            { id: 1, date: '2024-02-15', type: '复查', status: 'pending' },
            { id: 2, date: '2024-03-15', type: '复诊', status: 'pending' },
          ]}
          renderItem={(item: any) => (
            <List.Item>
              <List.Item.Meta
                title={item.date}
                description={item.type}
              />
              <Tag color={item.status === 'pending' ? 'orange' : 'green'}>
                {item.status === 'pending' ? '待确认' : '已确认'}
              </Tag>
            </List.Item>
          )}
        />
      ),
    },
  ]

  return (
    <div className="patient-archive">
      <Card className="main-card">
        <div className="page-header">
          <div className="search-bar">
            <Search
              placeholder="搜索患者姓名、手机号"
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              onSearch={setSearchText}
              style={{ width: 400 }}
            />
            <Select placeholder="全部状态" style={{ width: 120 }} allowClear>
              <Option value="active">活跃</Option>
              <Option value="inactive">休眠</Option>
            </Select>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
            新增患者
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={patients}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="患者详情"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedPatient && (
          <div className="patient-detail">
            <div className="patient-header">
              <div className="patient-avatar">
                <UserOutlined />
              </div>
              <div className="patient-info">
                <h3>{selectedPatient.name}</h3>
                <p>{selectedPatient.gender} · {selectedPatient.age}岁 · {selectedPatient.phone}</p>
              </div>
            </div>
            <Tabs items={detailTabItems} />
          </div>
        )}
      </Modal>

      <Modal
        title="新增患者"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={() => setAddModalVisible(false)}
        width={500}
      >
        {/* Form will be here */}
        <p>新增患者表单</p>
      </Modal>
    </div>
  )
}

export default PatientArchive
