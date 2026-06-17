import { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  message,
  Row,
  Col,
  Statistic,
  Popconfirm
} from 'antd'
import { PlusOutlined, ToolOutlined, SoundOutlined, BulbOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { DeviceCategory, DeviceStatus } from '@/types'
import type { Device } from '@/types'

const categoryIcons: Record<DeviceCategory, JSX.Element> = {
  [DeviceCategory.LIGHTING]: <BulbOutlined />,
  [DeviceCategory.SOUND]: <SoundOutlined />,
  [DeviceCategory.STAGE]: <ToolOutlined />
}

const categoryLabels: Record<DeviceCategory, string> = {
  [DeviceCategory.LIGHTING]: '灯光设备',
  [DeviceCategory.SOUND]: '音响设备',
  [DeviceCategory.STAGE]: '舞美道具'
}

const categoryColors: Record<DeviceCategory, string> = {
  [DeviceCategory.LIGHTING]: 'gold',
  [DeviceCategory.SOUND]: 'blue',
  [DeviceCategory.STAGE]: 'purple'
}

const statusLabels: Record<DeviceStatus, string> = {
  [DeviceStatus.AVAILABLE]: '可用',
  [DeviceStatus.IN_USE]: '使用中',
  [DeviceStatus.MAINTENANCE]: '维护中',
  [DeviceStatus.DAMAGED]: '损坏'
}

const statusColors: Record<DeviceStatus, string> = {
  [DeviceStatus.AVAILABLE]: 'green',
  [DeviceStatus.IN_USE]: 'orange',
  [DeviceStatus.MAINTENANCE]: 'blue',
  [DeviceStatus.DAMAGED]: 'red'
}

const mockDevices: Device[] = [
  {
    id: 'light_1',
    name: '230W摇头光束灯',
    category: DeviceCategory.LIGHTING,
    specification: '230W 7R Osram',
    quantity: 48,
    availableQuantity: 48,
    status: DeviceStatus.AVAILABLE
  },
  {
    id: 'light_2',
    name: 'LED帕灯',
    category: DeviceCategory.LIGHTING,
    specification: '54×3W RGBW',
    quantity: 80,
    availableQuantity: 60,
    status: DeviceStatus.IN_USE
  },
  {
    id: 'light_3',
    name: '追光灯',
    category: DeviceCategory.LIGHTING,
    specification: '2500W HMI',
    quantity: 4,
    availableQuantity: 4,
    status: DeviceStatus.AVAILABLE
  },
  {
    id: 'sound_1',
    name: '全频主音箱',
    category: DeviceCategory.SOUND,
    specification: 'JBL VT4888',
    quantity: 16,
    availableQuantity: 16,
    status: DeviceStatus.AVAILABLE
  },
  {
    id: 'sound_2',
    name: '超低频音箱',
    category: DeviceCategory.SOUND,
    specification: 'JBL VT4882',
    quantity: 8,
    availableQuantity: 8,
    status: DeviceStatus.AVAILABLE
  },
  {
    id: 'sound_3',
    name: '无线手持话筒',
    category: DeviceCategory.SOUND,
    specification: 'Shure SLX24/SM58',
    quantity: 24,
    availableQuantity: 20,
    status: DeviceStatus.IN_USE
  },
  {
    id: 'sound_4',
    name: '数字调音台',
    category: DeviceCategory.SOUND,
    specification: 'Yamaha CL5',
    quantity: 2,
    availableQuantity: 1,
    status: DeviceStatus.MAINTENANCE
  },
  {
    id: 'stage_1',
    name: '铝合金移动平台',
    category: DeviceCategory.STAGE,
    specification: '2m×1m，可调高度',
    quantity: 40,
    availableQuantity: 40,
    status: DeviceStatus.AVAILABLE
  },
  {
    id: 'stage_2',
    name: '背景桁架',
    category: DeviceCategory.STAGE,
    specification: '400×400mm 铝合金',
    quantity: 200,
    availableQuantity: 160,
    status: DeviceStatus.IN_USE
  }
]

export default function DeviceManagement() {
  const [categoryFilter, setCategoryFilter] = useState<DeviceCategory | undefined>()
  const [devices, setDevices] = useState<Device[]>(mockDevices)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null)
  const [form] = Form.useForm()
  const [maintenanceForm] = Form.useForm()

  const filteredDevices = categoryFilter
    ? devices.filter((d) => d.category === categoryFilter)
    : devices

  const stats = {
    total: devices.length,
    lighting: devices.filter((d) => d.category === DeviceCategory.LIGHTING).length,
    sound: devices.filter((d) => d.category === DeviceCategory.SOUND).length,
    stage: devices.filter((d) => d.category === DeviceCategory.STAGE).length,
    inMaintenance: devices.filter((d) => d.status === DeviceStatus.MAINTENANCE).length
  }

  const handleAddDevice = async () => {
    try {
      const values = await form.validateFields()
      const newDevice: Device = {
        id: `device_${Date.now()}`,
        ...values,
        availableQuantity: values.quantity,
        status: DeviceStatus.AVAILABLE
      }
      setDevices([...devices, newDevice])
      setAddModalOpen(false)
      message.success('设备已添加')
    } catch {
      // validation
    }
  }

  const handleAddMaintenance = async () => {
    try {
      const values = await maintenanceForm.validateFields()
      if (currentDevice) {
        setDevices(
          devices.map((d) =>
            d.id === currentDevice.id
              ? {
                  ...d,
                  status: DeviceStatus.MAINTENANCE,
                  maintenanceSchedule: [
                    ...(d.maintenanceSchedule || []),
                    {
                      id: `mt_${Date.now()}`,
                      deviceId: d.id,
                      startTime: values.startTime.format('YYYY-MM-DD HH:mm:ss'),
                      endTime: values.endTime.format('YYYY-MM-DD HH:mm:ss'),
                      type: values.type,
                      notes: values.notes
                    }
                  ]
                }
              : d
          )
        )
      }
      setMaintenanceModalOpen(false)
      message.success('维护计划已添加')
    } catch {
      // validation
    }
  }

  const openMaintenanceModal = (device: Device) => {
    setCurrentDevice(device)
    maintenanceForm.resetFields()
    setMaintenanceModalOpen(true)
  }

  const handleDeleteDevice = (id: string) => {
    setDevices(devices.filter((d) => d.id !== id))
    message.success('设备已删除')
  }

  const columns: ColumnsType<Device> = [
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {categoryIcons[record.category]}
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat: DeviceCategory) => <Tag color={categoryColors[cat]}>{categoryLabels[cat]}</Tag>
    },
    {
      title: '规格参数',
      dataIndex: 'specification',
      key: 'specification',
      ellipsis: true
    },
    {
      title: '总数',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center'
    },
    {
      title: '可用',
      dataIndex: 'availableQuantity',
      key: 'availableQuantity',
      width: 80,
      align: 'center',
      render: (val, record) => (
        <span style={{ color: val === record.quantity ? '#52c41a' : '#faad14' }}>{val}</span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: DeviceStatus) => <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openMaintenanceModal(record)}>
            维保
          </Button>
          <Popconfirm title="确定删除该设备？" onConfirm={() => handleDeleteDevice(record.id)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div className="card-header">
        <div className="card-title">设备管理</div>
        <Space>
          <Select
            style={{ width: 140 }}
            value={categoryFilter}
            onChange={setCategoryFilter}
            allowClear
            placeholder="全部类别"
            options={Object.entries(categoryLabels).map(([value, label]) => ({
              value,
              label
            }))}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
            添加设备
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="设备总数" value={stats.total} suffix="种" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="灯光设备"
              value={stats.lighting}
              suffix="种"
              valueStyle={{ color: '#faad14' }}
              prefix={<BulbOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="音响设备"
              value={stats.sound}
              suffix="种"
              valueStyle={{ color: '#1890ff' }}
              prefix={<SoundOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="维护中"
              value={stats.inMaintenance}
              suffix="种"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredDevices}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title="添加设备"
        open={addModalOpen}
        onOk={handleAddDevice}
        onCancel={() => setAddModalOpen(false)}
        okText="添加"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="设备名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="设备类别" rules={[{ required: true }]}>
            <Select
              options={Object.entries(categoryLabels).map(([value, label]) => ({
                value,
                label
              }))}
            />
          </Form.Item>
          <Form.Item name="specification" label="规格参数">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="quantity" label="总数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`添加维护计划 - ${currentDevice?.name}`}
        open={maintenanceModalOpen}
        onOk={handleAddMaintenance}
        onCancel={() => setMaintenanceModalOpen(false)}
        okText="确定"
        destroyOnClose
      >
        <Form form={maintenanceForm} layout="vertical" preserve={false}>
          <Form.Item name="type" label="维护类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'routine', label: '例行保养' },
                { value: 'repair', label: '故障维修' },
                { value: 'inspection', label: '安全检测' }
              ]}
            />
          </Form.Item>
          <Form.Item label="维护时段" required>
            <Form.Item
              name="startTime"
              noStyle
              rules={[{ required: true, message: '请选择开始时间' }]}
            >
              <DatePicker showTime style={{ width: '48%' }} placeholder="开始时间" />
            </Form.Item>
            <span style={{ display: 'inline-block', width: '4%', textAlign: 'center' }}>-</span>
            <Form.Item
              name="endTime"
              noStyle
              rules={[{ required: true, message: '请选择结束时间' }]}
            >
              <DatePicker showTime style={{ width: '48%' }} placeholder="结束时间" />
            </Form.Item>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
