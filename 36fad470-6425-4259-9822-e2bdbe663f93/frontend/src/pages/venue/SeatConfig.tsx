import { useEffect, useState, useCallback } from 'react'
import {
  Card,
  Button,
  Select,
  Space,
  Form,
  Input,
  InputNumber,
  Row,
  Col,
  Divider,
  message,
  Modal,
  Tag,
  Popconfirm,
  Empty
} from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchVenues, saveSeatConfig, updateSeatSections, setCurrentVenue } from '@/store/venueSlice'
import { PerformanceType, SeatSection } from '@/types'

const sectionTypeOptions = [
  { value: 'pool', label: '池座' },
  { value: 'balcony', label: '楼座' },
  { value: 'box', label: '包厢' },
  { value: 'side', label: '侧翼' }
]

const disabledForTypeOptions = [
  { value: PerformanceType.CONCERT, label: '音乐会' },
  { value: PerformanceType.DRAMA, label: '话剧' },
  { value: PerformanceType.DANCE, label: '舞蹈' },
  { value: PerformanceType.OPERA, label: '戏曲' },
  { value: PerformanceType.CHILDREN, label: '儿童剧' }
]

const numberingRuleOptions = [
  { value: 'continuous', label: '连续编号' },
  { value: 'row_based', label: '按排编号' },
  { value: 'custom', label: '自定义' }
]

const sectionColors: Record<string, string> = {
  pool: '#67c23a',
  balcony: '#409eff',
  box: '#e6a23c',
  side: '#909399'
}

export default function SeatConfig() {
  const dispatch = useAppDispatch()
  const { venues, currentVenue, loading } = useAppSelector((state) => state.venue)
  const [selectedSection, setSelectedSection] = useState<SeatSection | null>(null)
  const [sectionForm] = Form.useForm()
  const [newSectionModal, setNewSectionModal] = useState(false)
  const [newSectionForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dispatch(fetchVenues())
  }, [dispatch])

  useEffect(() => {
    if (venues.length > 0 && !currentVenue) {
      dispatch(setCurrentVenue(venues[0]))
    }
  }, [venues, currentVenue, dispatch])

  useEffect(() => {
    if (selectedSection) {
      sectionForm.setFieldsValue(selectedSection)
    }
  }, [selectedSection, sectionForm])

  const handleVenueChange = (venueId: string) => {
    const venue = venues.find((v) => v.id === venueId)
    if (venue) {
      dispatch(setCurrentVenue(venue))
      setSelectedSection(null)
    }
  }

  const handleAddSection = () => {
    newSectionForm.resetFields()
    newSectionForm.setFieldsValue({
      type: 'pool',
      rows: 10,
      columns: 20,
      startRow: 1,
      startColumn: 1,
      numberingRule: 'row_based',
      basePrice: 280
    })
    setNewSectionModal(true)
  }

  const handleConfirmAddSection = async () => {
    try {
      const values = await newSectionForm.validateFields()
      const newSection: SeatSection = {
        id: `section_${Date.now()}`,
        name: values.name,
        type: values.type,
        rows: values.rows,
        columns: values.columns,
        startRow: values.startRow,
        startColumn: values.startColumn,
        numberingRule: values.numberingRule,
        basePrice: values.basePrice,
        disabledForTypes: values.disabledForTypes || []
      }
      const sections = [...(currentVenue?.seatConfig || []), newSection]
      dispatch(updateSeatSections(sections))
      setNewSectionModal(false)
      message.success('区域已添加')
    } catch {
      // validation failed
    }
  }

  const handleDeleteSection = (sectionId: string) => {
    const sections = (currentVenue?.seatConfig || []).filter((s) => s.id !== sectionId)
    dispatch(updateSeatSections(sections))
    if (selectedSection?.id === sectionId) {
      setSelectedSection(null)
    }
    message.success('区域已删除')
  }

  const handleSectionFieldChange = useCallback(
    (changedFields: any, allFields: any) => {
      if (!selectedSection || !currentVenue) return
      const updated = { ...selectedSection, ...allFields }
      const sections = currentVenue.seatConfig.map((s) =>
        s.id === selectedSection.id ? updated : s
      )
      dispatch(updateSeatSections(sections))
      setSelectedSection(updated)
    },
    [selectedSection, currentVenue, dispatch]
  )

  const handleSave = async () => {
    if (!currentVenue) return
    setSaving(true)
    try {
      await dispatch(
        saveSeatConfig({
          venueId: currentVenue.id,
          sections: currentVenue.seatConfig
        })
      ).unwrap()
      message.success('座位配置已保存')
    } catch (error: any) {
      message.error(error?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const renderSeatGrid = (section: SeatSection) => {
    const cells = []
    for (let r = 0; r < Math.min(section.rows, 8); r++) {
      for (let c = 0; c < Math.min(section.columns, 15); c++) {
        cells.push(
          <div
            key={`${r}-${c}`}
            style={{
              width: 12,
              height: 12,
              backgroundColor: sectionColors[section.type],
              borderRadius: 2,
              margin: 1
            }}
          />
        )
      }
    }
    if (section.rows > 8 || section.columns > 15) {
      cells.push(
        <div
          key="more"
          style={{
            fontSize: 10,
            color: '#909399',
            padding: '4px 0',
            textAlign: 'center',
            width: '100%'
          }}
        >
          ...共{section.rows * section.columns}座
        </div>
      )
    }
    return cells
  }

  const totalSeats = currentVenue?.seatConfig.reduce(
    (sum, s) => sum + s.rows * s.columns,
    0
  ) || 0

  return (
    <div>
      <div className="card-header">
        <div className="card-title">座位图配置</div>
        <Space>
          <Select
            style={{ width: 200 }}
            value={currentVenue?.id}
            onChange={handleVenueChange}
            placeholder="选择场馆"
            options={venues.map((v) => ({ label: v.name, value: v.id }))}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSection}>
            添加区域
          </Button>
          <Popconfirm title="确定保存座位配置？" onConfirm={handleSave}>
            <Button type="primary" icon={<SaveOutlined />} loading={saving}>
              保存配置
            </Button>
          </Popconfirm>
        </Space>
      </div>

      {currentVenue ? (
        <Row gutter={16}>
          <Col span={16}>
            <Card title={`${currentVenue.name} - 座位布局`}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  height: 36,
                  borderRadius: '0 0 50% 50%',
                  margin: '0 auto 24px',
                  width: '60%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 500
                }}
              >
                舞 台
              </div>

              {currentVenue.seatConfig.length === 0 ? (
                <Empty description="暂无座位区域，请点击右上角添加" />
              ) : (
                <Row gutter={[16, 16]} style={{ padding: 16 }}>
                  {currentVenue.seatConfig.map((section) => (
                    <Col span={12} key={section.id}>
                      <Card
                        size="small"
                        hoverable
                        onClick={() => setSelectedSection(section)}
                        style={{
                          borderColor:
                            selectedSection?.id === section.id ? '#1677ff' : undefined,
                          borderWidth: selectedSection?.id === section.id ? 2 : 1
                        }}
                        title={
                          <Space>
                            <span>{section.name}</span>
                            <Tag color={sectionColors[section.type]}>
                              {sectionTypeOptions.find((o) => o.value === section.type)?.label}
                            </Tag>
                            <span style={{ fontSize: 12, color: '#909399' }}>
                              {section.rows}×{section.columns} = {section.rows * section.columns}座
                            </span>
                            <span style={{ fontSize: 12, color: '#f5222d' }}>
                              ¥{section.basePrice}
                            </span>
                          </Space>
                        }
                        extra={
                          <Popconfirm
                            title="确定删除此区域？"
                            onConfirm={() => handleDeleteSection(section.id)}
                          >
                            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                          </Popconfirm>
                        }
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            padding: 8,
                            background: '#f5f7fa',
                            borderRadius: 4
                          }}
                        >
                          {renderSeatGrid(section)}
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}

              <Divider />
              <div style={{ textAlign: 'center', color: '#606266' }}>
                总座位数：<strong style={{ color: '#1677ff', fontSize: 18 }}>{totalSeats}</strong> 座
              </div>
            </Card>
          </Col>

          <Col span={8}>
            <Card title="区域属性" styles={{ body: { padding: 16 } }}>
              {selectedSection ? (
                <Form
                  form={sectionForm}
                  layout="vertical"
                  size="small"
                  onValuesChange={handleSectionFieldChange}
                  initialValues={selectedSection}
                >
                  <Form.Item name="name" label="区域名称" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="type" label="区域类型" rules={[{ required: true }]}>
                    <Select options={sectionTypeOptions} />
                  </Form.Item>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item name="rows" label="行数" rules={[{ required: true }]}>
                        <InputNumber min={1} max={50} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="columns" label="列数" rules={[{ required: true }]}>
                        <InputNumber min={1} max={60} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item name="startRow" label="起始排号">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="startColumn" label="起始座号">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="numberingRule" label="编号规则">
                    <Select options={numberingRuleOptions} />
                  </Form.Item>
                  <Form.Item name="basePrice" label="基础票价（元）" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
                  </Form.Item>
                  <Form.Item name="disabledForTypes" label="禁用演出类型">
                    <Select
                      mode="multiple"
                      options={disabledForTypeOptions}
                      placeholder="选择对哪些类型禁用"
                    />
                  </Form.Item>
                  <div style={{ fontSize: 12, color: '#909399', marginTop: 8 }}>
                    提示：例如音乐会可禁用后排视野差的区域，话剧可禁用侧翼区域
                  </div>
                </Form>
              ) : (
                <Empty description="点击左侧区域查看属性" style={{ marginTop: 40 }} />
              )}
            </Card>
          </Col>
        </Row>
      ) : (
        <Card loading={loading} />
      )}

      <Modal
        title="添加座位区域"
        open={newSectionModal}
        onOk={handleConfirmAddSection}
        onCancel={() => setNewSectionModal(false)}
        okText="添加"
        destroyOnClose
      >
        <Form form={newSectionForm} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="区域名称"
            rules={[{ required: true, message: '请输入区域名称' }]}
          >
            <Input placeholder="如：池座A区、楼座B区等" />
          </Form.Item>
          <Form.Item name="type" label="区域类型" rules={[{ required: true }]}>
            <Select options={sectionTypeOptions} />
          </Form.Item>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="rows" label="行数" rules={[{ required: true }]}>
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="columns" label="列数" rules={[{ required: true }]}>
                <InputNumber min={1} max={60} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="startRow" label="起始排号">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="startColumn" label="起始座号">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="numberingRule" label="编号规则">
            <Select options={numberingRuleOptions} />
          </Form.Item>
          <Form.Item name="basePrice" label="基础票价（元）" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item name="disabledForTypes" label="禁用演出类型">
            <Select
              mode="multiple"
              options={disabledForTypeOptions}
              placeholder="选择对哪些类型禁用"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
