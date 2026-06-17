import { useEffect, useState } from 'react'
import {
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Card,
  Space,
  InputNumber,
  Row,
  Col,
  Alert,
  message,
  Tag,
  Checkbox
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchVenues } from '@/store/venueSlice'
import { createPerformance } from '@/store/performanceSlice'
import { PerformanceType, VenueType, DeviceCategory } from '@/types'
import type { DeviceRequirement } from '@/types'

const { RangePicker } = DatePicker
const { TextArea } = Input

const typeOptions = Object.entries({
  [PerformanceType.DRAMA]: '话剧',
  [PerformanceType.CONCERT]: '音乐会',
  [PerformanceType.DANCE]: '舞蹈',
  [PerformanceType.OPERA]: '戏曲',
  [PerformanceType.CHILDREN]: '儿童剧'
}).map(([value, label]) => ({ value, label }))

const venueOptions = Object.entries({
  [VenueType.GRAND_THEATER]: '大剧院 (约2000座)',
  [VenueType.CONCERT_HALL]: '音乐厅 (约1500座)',
  [VenueType.SMALL_THEATER]: '小剧场 (约1000座)'
}).map(([value, label]) => ({ value, label }))

const techOptions = [
  { value: 'basic_light', label: '基础灯光' },
  { value: 'professional_light', label: '专业灯光设备' },
  { value: 'basic_sound', label: '基础音响' },
  { value: 'professional_sound', label: '专业音响设备' },
  { value: 'projector', label: '投影设备' },
  { value: 'led_screen', label: 'LED大屏' },
  { value: 'microphone_wireless', label: '无线麦克风' },
  { value: 'orchestra_pit', label: '乐池' }
]

const deviceOptions = [
  { id: 'light_1', name: '摇头灯', category: DeviceCategory.LIGHTING, maxQty: 50 },
  { id: 'light_2', name: '帕灯', category: DeviceCategory.LIGHTING, maxQty: 80 },
  { id: 'sound_1', name: '主音箱', category: DeviceCategory.SOUND, maxQty: 16 },
  { id: 'sound_2', name: '返听音箱', category: DeviceCategory.SOUND, maxQty: 12 },
  { id: 'sound_3', name: '无线话筒', category: DeviceCategory.SOUND, maxQty: 24 },
  { id: 'stage_1', name: '移动平台', category: DeviceCategory.STAGE, maxQty: 8 },
  { id: 'stage_2', name: '背景架', category: DeviceCategory.STAGE, maxQty: 4 }
]

export default function PerformanceApplication() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { venues } = useAppSelector((state) => state.venue)
  const [form] = Form.useForm()
  const [selectedDevices, setSelectedDevices] = useState<DeviceRequirement[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    dispatch(fetchVenues())
  }, [dispatch])

  const handleDeviceToggle = (deviceId: string, deviceName: string, checked: boolean) => {
    if (checked) {
      setSelectedDevices([...selectedDevices, { deviceId, deviceName, quantity: 1 }])
    } else {
      setSelectedDevices(selectedDevices.filter((d) => d.deviceId !== deviceId))
    }
  }

  const handleDeviceQtyChange = (deviceId: string, qty: number) => {
    setSelectedDevices(
      selectedDevices.map((d) => (d.deviceId === deviceId ? { ...d, quantity: qty } : d))
    )
  }

  const onFinish = async (values: any) => {
    setSubmitting(true)
    try {
      const expectedDates = values.expectedDates.map((d: dayjs.Dayjs) =>
        d.format('YYYY-MM-DD')
      )

      await dispatch(
        createPerformance({
          name: values.name,
          type: values.type,
          venueId: values.venueId,
          expectedDuration: values.expectedDuration,
          technicalRequirements: values.technicalRequirements || [],
          expectedDates,
          devices: selectedDevices
        })
      ).unwrap()

      message.success('演出申请已提交，请等待场馆审批')
      navigate('/performance/calendar')
    } catch (error: any) {
      message.error(error?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/performance/calendar')}>
          返回日历
        </Button>
      </Space>

      <Card title="提交演出申请">
        <Alert
          type="info"
          showIcon
          message="申请须知"
          description="提交后场馆方将在3个工作日内审批，审批期间可在演出日历中查看状态。若档期冲突将提示协商改期。"
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark="optional"
          initialValues={{
            expectedDuration: 120
          }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="演出名称"
                rules={[{ required: true, message: '请输入演出名称' }]}
              >
                <Input placeholder="请输入演出名称" maxLength={100} showCount />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="演出类型"
                rules={[{ required: true, message: '请选择演出类型' }]}
              >
                <Select placeholder="请选择演出类型" options={typeOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="venueId"
                label="演出场馆"
                rules={[{ required: true, message: '请选择演出场馆' }]}
              >
                <Select
                  placeholder="请选择演出场馆"
                  options={venues.map((v) => ({
                    value: v.id,
                    label: `${v.name} (${v.totalSeats}座)`
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="expectedDuration"
                label="预计时长（分钟）"
                rules={[{ required: true, message: '请输入预计时长' }]}
              >
                <InputNumber min={30} max={480} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="expectedDates"
            label="期望演出日期"
            rules={[{ required: true, message: '请选择期望演出日期' }]}
            extra="可多选，系统将自动检测档期冲突"
          >
            <RangePicker
              style={{ width: '100%' }}
              minDate={dayjs()}
              format="YYYY-MM-DD"
              multiple
              placeholder={['开始日期', '结束日期']}
            />
          </Form.Item>

          <Form.Item name="technicalRequirements" label="技术需求">
            <Checkbox.Group options={techOptions} />
          </Form.Item>

          <Form.Item label="设备需求">
            <Row gutter={[16, 16]}>
              {deviceOptions.map((device) => (
                <Col span={8} key={device.id}>
                  <Card
                    size="small"
                    styles={{ body: { padding: 12 } }}
                    style={{
                      borderColor: selectedDevices.find((d) => d.deviceId === device.id)
                        ? '#1677ff'
                        : undefined
                    }}
                  >
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Checkbox
                        checked={!!selectedDevices.find((d) => d.deviceId === device.id)}
                        onChange={(e) =>
                          handleDeviceToggle(device.id, device.name, e.target.checked)
                        }
                      >
                        {device.name}
                      </Checkbox>
                      <Tag color="blue">
                        {device.category === DeviceCategory.LIGHTING
                          ? '灯光'
                          : device.category === DeviceCategory.SOUND
                          ? '音响'
                          : '舞美'}
                      </Tag>
                      {selectedDevices.find((d) => d.deviceId === device.id) && (
                        <InputNumber
                          size="small"
                          min={1}
                          max={device.maxQty}
                          value={
                            selectedDevices.find((d) => d.deviceId === device.id)?.quantity || 1
                          }
                          onChange={(v) => handleDeviceQtyChange(device.id, v || 1)}
                          addonBefore="数量"
                          style={{ width: '100%' }}
                        />
                      )}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Form.Item>

          <Form.Item label="备注说明" name="remark">
            <TextArea rows={4} placeholder="如有其他特殊需求请在此说明..." maxLength={500} showCount />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => navigate('/performance/calendar')}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                提交申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
