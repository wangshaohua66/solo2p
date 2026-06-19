import { useState } from 'react'
import { Card, Form, Input, Select, DatePicker, InputNumber, Button, Row, Col, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { mockCreateRecruitment, mockGetCenters } from '@/mock/recruitment'
import './Create.css'

const { RangePicker } = DatePicker
const { TextArea } = Input

const RecruitmentCreate = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const centers = mockGetCenters()

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const [startTime, endTime] = values.timeRange
      await mockCreateRecruitment({
        title: values.title,
        description: values.description,
        startTime: startTime.format('YYYY-MM-DD HH:mm:ss'),
        endTime: endTime.format('YYYY-MM-DD HH:mm:ss'),
        location: values.location,
        centerId: values.centerId,
        boothCount: values.boothCount
      })
      message.success('招聘会创建成功，系统将自动进行企业资质审核和展位分配')
      navigate('/recruitment')
    } catch (error: any) {
      message.error(error.message || '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="recruitment-create-page">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        返回列表
      </Button>

      <Card title="创建招聘会" className="form-card">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            boothCount: 50
          }}
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                label="招聘会名称"
                name="title"
                rules={[{ required: true, message: '请输入招聘会名称' }]}
              >
                <Input placeholder="请输入招聘会名称" maxLength={100} showCount />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="举办中心"
                name="centerId"
                rules={[{ required: true, message: '请选择举办中心' }]}
              >
                <Select placeholder="请选择人才服务中心" options={centers.map(c => ({ value: c.id, label: c.name }))} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                label="举办时间"
                name="timeRange"
                rules={[{ required: true, message: '请选择举办时间' }]}
              >
                <RangePicker
                  showTime={{ format: 'HH:mm' }}
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  placeholder={['开始时间', '结束时间']}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="举办地点"
                name="location"
                rules={[{ required: true, message: '请输入举办地点' }]}
              >
                <Input placeholder="请输入详细地址" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                label="展位数量"
                name="boothCount"
                rules={[{ required: true, message: '请输入展位数量' }]}
              >
                <InputNumber min={10} max={500} style={{ width: '100%' }} placeholder="请输入展位数量" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="招聘会类型" name="type">
                <Select
                  placeholder="请选择招聘会类型"
                  options={[
                    { value: 'comprehensive', label: '综合招聘会' },
                    { value: 'industry', label: '行业专场' },
                    { value: 'campus', label: '校园招聘' },
                    { value: 'talent', label: '高层次人才' }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="招聘会简介"
            name="description"
            rules={[{ required: true, message: '请输入招聘会简介' }]}
          >
            <TextArea rows={6} placeholder="请输入招聘会详细介绍，包括参会行业、目标人群等" maxLength={2000} showCount />
          </Form.Item>

          <Form.Item>
            <div className="form-actions">
              <Button onClick={() => navigate(-1)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                创建招聘会
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default RecruitmentCreate
