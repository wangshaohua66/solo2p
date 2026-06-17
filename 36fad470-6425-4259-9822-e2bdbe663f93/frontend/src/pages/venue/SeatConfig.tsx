import { useEffect, useState, useCallback, useRef } from 'react'
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
  Empty,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  DragOutlined,
  HighlightOutlined,
  BorderOuterOutlined,
  ClearOutlined
} from '@ant-design/icons'
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

interface DrawnRect {
  x: number
  y: number
  w: number
  h: number
  sectionId?: string
}

const CANVAS_W = 720
const CANVAS_H = 460
const STAGE_H = 36
const CELL_SIZE = 6

export default function SeatConfig() {
  const dispatch = useAppDispatch()
  const { venues, currentVenue, loading } = useAppSelector((state) => state.venue)
  const [selectedSection, setSelectedSection] = useState<SeatSection | null>(null)
  const [sectionForm] = Form.useForm()
  const [newSectionModal, setNewSectionModal] = useState(false)
  const [newSectionForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawMode, setDrawMode] = useState<'select' | 'draw'>('select')
  const [drawingRect, setDrawingRect] = useState<DrawnRect | null>(null)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [pendingSectionType, setPendingSectionType] = useState<SeatSection['type']>('pool')
  const [hoveredRect, setHoveredRect] = useState<DrawnRect | null>(null)

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

  const sectionRects = useCallback((): DrawnRect[] => {
    if (!currentVenue) return []
    return currentVenue.seatConfig.map((s, idx) => {
      const perRow = 6
      const col = idx % perRow
      const row = Math.floor(idx / perRow)
      const baseX = 40 + col * 110
      const baseY = STAGE_H + 30 + row * 90
      return {
        x: baseX,
        y: baseY,
        w: Math.min(100, s.columns * CELL_SIZE + 10),
        h: Math.min(80, s.rows * CELL_SIZE + 10),
        sectionId: s.id
      }
    })
  }, [currentVenue])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, 0)
    grad.addColorStop(0, '#667eea')
    grad.addColorStop(1, '#764ba2')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(CANVAS_W * 0.2, 6)
    ctx.lineTo(CANVAS_W * 0.8, 6)
    ctx.lineTo(CANVAS_W * 0.7, STAGE_H)
    ctx.lineTo(CANVAS_W * 0.3, STAGE_H)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('舞 台', CANVAS_W / 2, STAGE_H - 12)

    const rects = sectionRects()
    const sections = currentVenue?.seatConfig || []
    rects.forEach((rect, idx) => {
      const section = sections[idx]
      if (!section) return
      const color = sectionColors[section.type] || '#909399'
      const isSelected = selectedSection?.id === section.id
      const isHovered = hoveredRect?.sectionId === rect.sectionId

      ctx.fillStyle = color + (isSelected ? 'CC' : isHovered ? '99' : '66')
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)

      ctx.strokeStyle = isSelected ? '#1677ff' : color
      ctx.lineWidth = isSelected ? 3 : 1
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)

      ctx.fillStyle = '#333'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(
        `${section.name} ${section.rows}×${section.columns}`,
        rect.x + 4,
        rect.y + 14
      )
      ctx.fillStyle = '#f5222d'
      ctx.fillText(`¥${section.basePrice}`, rect.x + 4, rect.y + 28)
    })

    if (drawingRect) {
      ctx.fillStyle = 'rgba(22, 119, 255, 0.25)'
      ctx.fillRect(drawingRect.x, drawingRect.y, drawingRect.w, drawingRect.h)
      ctx.strokeStyle = '#1677ff'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(drawingRect.x, drawingRect.y, drawingRect.w, drawingRect.h)
      ctx.setLineDash([])

      const estRows = Math.max(1, Math.round(drawingRect.h / (CELL_SIZE + 1)))
      const estCols = Math.max(1, Math.round(drawingRect.w / (CELL_SIZE + 1)))
      ctx.fillStyle = '#1677ff'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText(
        `预计 ${estRows}排 × ${estCols}列 = ${estRows * estCols}座`,
        drawingRect.x + 4,
        drawingRect.y + drawingRect.h - 4
      )
    }
  }, [sectionRects, currentVenue, selectedSection, hoveredRect, drawingRect])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const findRectAt = (x: number, y: number): DrawnRect | null => {
    const rects = sectionRects()
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i]
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return r
      }
    }
    return null
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e)
    if (drawMode === 'draw') {
      if (pos.y < STAGE_H + 10) {
        message.warning('不能在舞台区域绘制')
        return
      }
      setDrawStart(pos)
      setDrawingRect({ x: pos.x, y: pos.y, w: 0, h: 0 })
    } else {
      const rect = findRectAt(pos.x, pos.y)
      if (rect?.sectionId) {
        const section = currentVenue?.seatConfig.find((s) => s.id === rect.sectionId)
        if (section) setSelectedSection(section)
      }
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e)
    if (drawMode === 'draw' && drawStart) {
      setDrawingRect({
        x: Math.min(drawStart.x, pos.x),
        y: Math.min(drawStart.y, pos.y),
        w: Math.abs(pos.x - drawStart.x),
        h: Math.abs(pos.y - drawStart.y)
      })
    } else if (drawMode === 'select') {
      const rect = findRectAt(pos.x, pos.y)
      setHoveredRect(rect)
      const canvas = canvasRef.current
      if (canvas) {
        canvas.style.cursor = rect ? 'pointer' : 'default'
      }
    }
  }

  const handleCanvasMouseUp = () => {
    if (drawMode === 'draw' && drawingRect && drawingRect.w > 20 && drawingRect.h > 20) {
      const estRows = Math.max(1, Math.round(drawingRect.h / (CELL_SIZE + 1)))
      const estCols = Math.max(1, Math.round(drawingRect.w / (CELL_SIZE + 1)))
      const newSection: SeatSection = {
        id: `section_${Date.now()}`,
        name: `${sectionTypeOptions.find((o) => o.value === pendingSectionType)?.label}区${(currentVenue?.seatConfig.length || 0) + 1}`,
        type: pendingSectionType,
        rows: Math.min(estRows, 50),
        columns: Math.min(estCols, 60),
        startRow: 1,
        startColumn: 1,
        numberingRule: 'row_based',
        basePrice: 280,
        disabledForTypes: []
      }
      const sections = [...(currentVenue?.seatConfig || []), newSection]
      dispatch(updateSeatSections(sections))
      setSelectedSection(newSection)
      message.success(`已绘制创建区域：${newSection.name}（${newSection.rows}×${newSection.columns}=${newSection.rows * newSection.columns}座）`)
    }
    setDrawingRect(null)
    setDrawStart(null)
  }

  const handleClearAll = () => {
    if (!currentVenue || currentVenue.seatConfig.length === 0) return
    Modal.confirm({
      title: '清空所有区域',
      content: '将删除当前场馆所有座位区域配置，确定继续？',
      okText: '清空',
      okType: 'danger',
      onOk: () => {
        dispatch(updateSeatSections([]))
        setSelectedSection(null)
        message.success('已清空所有区域')
      }
    })
  }

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
          <Tooltip title="切换绘制/选择模式">
            <Button
              type={drawMode === 'draw' ? 'primary' : 'default'}
              icon={<HighlightOutlined />}
              onClick={() => setDrawMode(drawMode === 'draw' ? 'select' : 'draw')}
            >
              {drawMode === 'draw' ? '绘制模式' : '选择模式'}
            </Button>
          </Tooltip>
          {drawMode === 'draw' && (
            <Select
              style={{ width: 100 }}
              value={pendingSectionType}
              onChange={setPendingSectionType}
              options={sectionTypeOptions}
            />
          )}
          <Button icon={<PlusOutlined />} onClick={handleAddSection}>
            手动添加
          </Button>
          <Popconfirm title="确定清空所有区域？" onConfirm={handleClearAll}>
            <Button danger icon={<ClearOutlined />}>
              清空
            </Button>
          </Popconfirm>
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
            <Card
              title={`${currentVenue.name} - 座位布局`}
              extra={
                drawMode === 'draw' ? (
                  <Tag color="blue" icon={<DragOutlined />}>
                    按住鼠标拖拽绘制区域
                  </Tag>
                ) : (
                  <Tag color="default">点击区域选中编辑</Tag>
                )
              }
            >
              <div style={{ position: 'relative', overflow: 'auto' }}>
                <canvas
                  ref={canvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  style={{
                    display: 'block',
                    background: '#fafafa',
                    border: '1px solid #e8e8e8',
                    borderRadius: 8,
                    cursor: drawMode === 'draw' ? 'crosshair' : 'default',
                    maxWidth: '100%'
                  }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={() => {
                    if (drawMode === 'draw' && drawingRect) {
                      handleCanvasMouseUp()
                    }
                    setHoveredRect(null)
                  }}
                />
                {drawMode === 'draw' && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '6px 12px',
                      background: '#e6f7ff',
                      border: '1px solid #91d5ff',
                      borderRadius: 4,
                      fontSize: 12,
                      color: '#096dd9'
                    }}
                  >
                    <BorderOuterOutlined /> 绘制模式：在画布空白区域按住鼠标左键拖拽，松开即创建座位区域。拖拽时实时显示预计座位数。
                  </div>
                )}
              </div>

              <Divider />
              <div style={{ textAlign: 'center', color: '#606266' }}>
                总座位数：<strong style={{ color: '#1677ff', fontSize: 18 }}>{totalSeats}</strong> 座
                {' / '}
                区域数：<strong style={{ color: '#1677ff' }}>{currentVenue.seatConfig.length}</strong>
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
