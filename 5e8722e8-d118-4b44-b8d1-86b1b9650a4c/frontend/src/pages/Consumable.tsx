import { useState } from 'react'
import { Card, Table, Button, Input, Select, Tag, Modal, Form, InputNumber, message, Tabs } from 'antd'
import { PlusOutlined, WarningOutlined, InboxOutlined, FileTextOutlined } from '@ant-design/icons'
import type { TabsProps } from 'antd'
import './Consumable.scss'

const { Search } = Input
const { Option } = Select
const { TabPane } = Tabs

function Consumable() {
  const [activeTab, setActiveTab] = useState('stock')
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [inModalVisible, setInModalVisible] = useState(false)
  const [outModalVisible, setOutModalVisible] = useState(false)
  const [form] = Form.useForm()

  const consumables = [
    { id: 1, name: '牙科复合树脂', category: '修复材料', spec: 'A2色 4g/支', unit: '支', stock: 25, minStock: 10, price: 280, clinic: '中心门诊' },
    { id: 2, name: '根管锉', category: '器械耗材', spec: '25mm #15-40', unit: '盒', stock: 8, minStock: 15, price: 450, clinic: '中心门诊' },
    { id: 3, name: '种植体', category: '种植材料', spec: 'Nobel Active 4.3x10mm', unit: '颗', stock: 12, minStock: 5, price: 5800, clinic: '中心门诊' },
    { id: 4, name: '牙托槽', category: '正畸材料', spec: '金属托槽 标准型', unit: '副', stock: 30, minStock: 10, price: 1200, clinic: '城东门诊' },
    { id: 5, name: '一次性手套', category: '防护用品', spec: 'M号 100只/盒', unit: '盒', stock: 5, minStock: 20, price: 45, clinic: '城西门诊' },
    { id: 6, name: '局部麻醉剂', category: '药品', spec: '阿替卡因 1.7ml/支', unit: '支', stock: 50, minStock: 30, price: 25, clinic: '中心门诊' },
    { id: 7, name: '牙科印模材料', category: '修复材料', spec: '加聚型硅橡胶', unit: '套', stock: 18, minStock: 8, price: 320, clinic: '城东门诊' },
    { id: 8, name: '一次性口罩', category: '防护用品', spec: '医用外科 50只/盒', unit: '盒', stock: 3, minStock: 25, price: 35, clinic: '城西门诊' },
  ]

  const inOutRecords = [
    { id: 1, type: 'in', date: '2024-01-15', name: '牙科复合树脂', quantity: 20, operator: '张护士长', remark: '常规补货' },
    { id: 2, type: 'out', date: '2024-01-15', name: '根管锉', quantity: 2, operator: '李医生', remark: '治疗使用' },
    { id: 3, type: 'out', date: '2024-01-14', name: '种植体', quantity: 1, operator: '赵医生', remark: '种植手术' },
    { id: 4, type: 'in', date: '2024-01-13', name: '一次性手套', quantity: 30, operator: '张护士长', remark: '集中采购' },
    { id: 5, type: 'out', date: '2024-01-12', name: '局部麻醉剂', quantity: 10, operator: '王医生', remark: '日常诊疗' },
  ]

  const stockColumns = [
    { title: '耗材名称', dataIndex: 'name', key: 'name' },
    { title: '类别', dataIndex: 'category', key: 'category' },
    { title: '规格', dataIndex: 'spec', key: 'spec' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    {
      title: '库存数量',
      dataIndex: 'stock',
      key: 'stock',
      render: (stock: number, record: any) => (
        <span className={stock < record.minStock ? 'low-stock' : ''}>
          {stock} {record.unit}
          {stock < record.minStock && <WarningOutlined style={{ color: '#f5222d', marginLeft: 4 }} />}
        </span>
      ),
    },
    { title: '预警阈值', dataIndex: 'minStock', key: 'minStock' },
    { title: '单价(元)', dataIndex: 'price', key: 'price' },
    { title: '所属门诊', dataIndex: 'clinic', key: 'clinic' },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: any) => (
        <Tag color={record.stock < record.minStock ? 'red' : 'green'}>
          {record.stock < record.minStock ? '库存不足' : '库存充足'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <>
          <Button type="link" size="small">入库</Button>
          <Button type="link" size="small">出库</Button>
        </>
      ),
    },
  ]

  const recordColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'in' ? 'green' : 'orange'}>
          {type === 'in' ? '入库' : '出库'}
        </Tag>
      ),
    },
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '耗材名称', dataIndex: 'name', key: 'name' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '操作人', dataIndex: 'operator', key: 'operator' },
    { title: '备注', dataIndex: 'remark', key: 'remark' },
  ]

  const filteredConsumables = consumables.filter(
    (item) =>
      (!searchText || item.name.includes(searchText)) &&
      (!categoryFilter || item.category === categoryFilter)
  )

  const handleInSubmit = () => {
    form.validateFields().then(() => {
      message.success('入库成功')
      setInModalVisible(false)
      form.resetFields()
    })
  }

  const handleOutSubmit = () => {
    form.validateFields().then(() => {
      message.success('出库成功')
      setOutModalVisible(false)
      form.resetFields()
    })
  }

  const tabItems: TabsProps['items'] = [
    {
      key: 'stock',
      label: '库存台账',
      children: (
        <div className="stock-section">
          <div className="section-header">
            <div className="filters">
              <Search
                placeholder="搜索耗材名称"
                allowClear
                onSearch={setSearchText}
                style={{ width: 200 }}
              />
              <Select
                placeholder="全部类别"
                style={{ width: 150 }}
                allowClear
                onChange={setCategoryFilter}
              >
                <Option value="修复材料">修复材料</Option>
                <Option value="种植材料">种植材料</Option>
                <Option value="正畸材料">正畸材料</Option>
                <Option value="器械耗材">器械耗材</Option>
                <Option value="防护用品">防护用品</Option>
                <Option value="药品">药品</Option>
              </Select>
            </div>
            <div className="actions">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setInModalVisible(true)}>
                入库
              </Button>
              <Button icon={<InboxOutlined />} onClick={() => setOutModalVisible(true)}>
                出库
              </Button>
            </div>
          </div>
          <Table
            columns={stockColumns}
            dataSource={filteredConsumables}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            rowClassName={(record) =>
              record.stock < record.minStock ? 'row-warning' : ''
            }
          />
        </div>
      ),
    },
    {
      key: 'records',
      label: '出入库记录',
      children: (
        <div className="records-section">
          <div className="section-header">
            <div className="filters">
              <Select placeholder="全部类型" style={{ width: 120 }} allowClear>
                <Option value="in">入库</Option>
                <Option value="out">出库</Option>
              </Select>
              <Select placeholder="全部门诊" style={{ width: 150 }} allowClear>
                <Option value="1">中心门诊</Option>
                <Option value="2">城东门诊</Option>
                <Option value="3">城西门诊</Option>
              </Select>
            </div>
          </div>
          <Table
            columns={recordColumns}
            dataSource={inOutRecords}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </div>
      ),
    },
    {
      key: 'warning',
      label: '库存预警',
      children: (
        <div className="warning-section">
          <div className="warning-list">
            {consumables
              .filter((item) => item.stock < item.minStock)
              .map((item) => (
                <Card key={item.id} className="warning-card">
                  <div className="warning-icon">
                    <WarningOutlined />
                  </div>
                  <div className="warning-info">
                    <h4>{item.name}</h4>
                    <p>{item.spec}</p>
                    <div className="warning-stats">
                      <span>当前库存：<strong className="low">{item.stock} {item.unit}</strong></span>
                      <span>最低阈值：{item.minStock} {item.unit}</span>
                    </div>
                  </div>
                  <Button type="primary" size="small">生成采购单</Button>
                </Card>
              ))}
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="consumable-page">
      <Card className="main-card">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      <Modal title="耗材入库" open={inModalVisible} onCancel={() => setInModalVisible(false)} onOk={handleInSubmit}>
        <Form form={form} layout="vertical">
          <Form.Item name="consumable" label="耗材名称" rules={[{ required: true }]}>
            <Select placeholder="请选择耗材">
              {consumables.map((item) => (
                <Option key={item.id} value={item.id}>
                  {item.name} - {item.spec}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="入库数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="耗材出库" open={outModalVisible} onCancel={() => setOutModalVisible(false)} onOk={handleOutSubmit}>
        <Form form={form} layout="vertical">
          <Form.Item name="consumable" label="耗材名称" rules={[{ required: true }]}>
            <Select placeholder="请选择耗材">
              {consumables.map((item) => (
                <Option key={item.id} value={item.id}>
                  {item.name} - {item.spec}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="出库数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="operator" label="使用医生">
            <Select placeholder="请选择">
              <Option value="1">李医生</Option>
              <Option value="2">王医生</Option>
              <Option value="3">赵医生</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="用途">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Consumable
