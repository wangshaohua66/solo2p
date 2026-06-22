import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Slider, Button, Space, Tabs, message, Spin } from 'antd'
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  ArrowsAltOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons'
import type { TabsProps } from 'antd'
import './DicomViewer.scss'

interface DicomViewerProps {
  imageUrl?: string
  dicomData?: ArrayBuffer
  width?: number
  height?: number
}

interface Viewport {
  scale: number
  translation: { x: number; y: number }
  voi: { windowWidth: number; windowCenter: number }
  rotation: number
  hflip: boolean
  vflip: boolean
  invert: boolean
}

const defaultViewport: Viewport = {
  scale: 1,
  translation: { x: 0, y: 0 },
  voi: { windowWidth: 400, windowCenter: 100 },
  rotation: 0,
  hflip: false,
  vflip: false,
  invert: false,
}

const presets = [
  { name: '软组织', width: 400, center: 40 },
  { name: '肺窗', width: 1500, center: -500 },
  { name: '骨窗', width: 1500, center: 400 },
  { name: '纵隔', width: 350, center: 50 },
  { name: '脑窗', width: 80, center: 40 },
]

function DicomViewer({ imageUrl, dicomData, width = 512, height = 512 }: DicomViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState<Viewport>(defaultViewport)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTool, setActiveTool] = useState<string>('ww/wl')
  const [activePlane, setActivePlane] = useState('axial')
  const [imageLoaded, setImageLoaded] = useState(false)
  const imageDataRef = useRef<ImageData | null>(null)
  const originalPixelsRef = useRef<number[] | null>(null)
  const isDraggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })

  const applyWindowLevel = useCallback((windowWidth: number, windowCenter: number) => {
    if (!canvasRef.current || !originalPixelsRef.current || !imageDataRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pixels = imageDataRef.current.data
    const original = originalPixelsRef.current
    const len = original.length

    const minValue = windowCenter - windowWidth / 2
    const maxValue = windowCenter + windowWidth / 2

    for (let i = 0; i < len; i++) {
      const value = original[i]
      let outputValue: number

      if (value <= minValue) {
        outputValue = 0
      } else if (value >= maxValue) {
        outputValue = 255
      } else {
        outputValue = ((value - minValue) / windowWidth) * 255
      }

      const idx = i * 4
      pixels[idx] = outputValue
      pixels[idx + 1] = outputValue
      pixels[idx + 2] = outputValue
      pixels[idx + 3] = 255
    }

    ctx.putImageData(imageDataRef.current, 0, 0)
  }, [])

  const loadMockDicom = useCallback(() => {
    setIsLoading(true)
    setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const mockWidth = 256
      const mockHeight = 256
      canvas.width = mockWidth
      canvas.height = mockHeight

      const imageData = ctx.createImageData(mockWidth, mockHeight)
      const pixels: number[] = []

      for (let y = 0; y < mockHeight; y++) {
        for (let x = 0; x < mockWidth; x++) {
          const dx = x - mockWidth / 2
          const dy = y - mockHeight / 2
          const dist = Math.sqrt(dx * dx + dy * dy)

          let value = 0
          if (dist < 80) {
            value = 80 + Math.sin(dist * 0.3) * 30
          } else if (dist < 100) {
            value = 150 - dist * 0.8
          } else {
            value = 20 + Math.random() * 10
          }

          if (dist < 60 && dist > 40) {
            value += 40
          }

          if (Math.abs(dx) < 5 && Math.abs(dy) < 30) {
            value += 60
          }

          pixels.push(value)
        }
      }

      originalPixelsRef.current = pixels
      imageDataRef.current = imageData

      setImageLoaded(true)
      applyWindowLevel(viewport.voi.windowWidth, viewport.voi.windowCenter)
      setIsLoading(false)
    }, 500)
  }, [applyWindowLevel, viewport.voi])

  useEffect(() => {
    loadMockDicom()
  }, [loadMockDicom])

  const handleWindowWidthChange = (value: number) => {
    setViewport((prev) => ({
      ...prev,
      voi: { ...prev.voi, windowWidth: value },
    }))
    applyWindowLevel(value, viewport.voi.windowCenter)
  }

  const handleWindowCenterChange = (value: number) => {
    setViewport((prev) => ({
      ...prev,
      voi: { ...prev.voi, windowCenter: value },
    }))
    applyWindowLevel(viewport.voi.windowWidth, value)
  }

  const handlePresetClick = (preset: typeof presets[0]) => {
    setViewport((prev) => ({
      ...prev,
      voi: { windowWidth: preset.width, windowCenter: preset.center },
    }))
    applyWindowLevel(preset.width, preset.center)
    message.info(`已应用 ${preset.name} 预设`)
  }

  const handleZoomIn = () => {
    setViewport((prev) => ({
      ...prev,
      scale: Math.min(prev.scale * 1.2, 5),
    }))
    applyTransform()
  }

  const handleZoomOut = () => {
    setViewport((prev) => ({
      ...prev,
      scale: Math.max(prev.scale / 1.2, 0.2),
    }))
    applyTransform()
  }

  const handleRotate = (direction: number) => {
    setViewport((prev) => ({
      ...prev,
      rotation: (prev.rotation + direction * 90 + 360) % 360,
    }))
    applyTransform()
  }

  const handleReset = () => {
    setViewport(defaultViewport)
    applyWindowLevel(defaultViewport.voi.windowWidth, defaultViewport.voi.windowCenter)
  }

  const applyTransform = () => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    canvas.style.transform = `scale(${viewport.scale}) rotate(${viewport.rotation}deg)`
    canvas.style.transformOrigin = 'center center'
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true
    lastPosRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return

    const deltaX = e.clientX - lastPosRef.current.x
    const deltaY = e.clientY - lastPosRef.current.y

    if (activeTool === 'ww/wl') {
      const newWidth = Math.max(1, viewport.voi.windowWidth + deltaX)
      const newCenter = viewport.voi.windowCenter - deltaY
      setViewport((prev) => ({
        ...prev,
        voi: { windowWidth: newWidth, windowCenter: newCenter },
      }))
      applyWindowLevel(newWidth, newCenter)
    } else if (activeTool === 'zoom') {
      const scale = viewport.scale * (1 + deltaY * 0.01)
      setViewport((prev) => ({
        ...prev,
        scale: Math.max(0.2, Math.min(5, scale)),
      }))
      applyTransform()
    } else if (activeTool === 'pan') {
      setViewport((prev) => ({
        ...prev,
        translation: {
          x: prev.translation.x + deltaX,
          y: prev.translation.y + deltaY,
        },
      }))
    }

    lastPosRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleCanvasMouseUp = () => {
    isDraggingRef.current = false
  }

  const planeTabItems: TabsProps['items'] = [
    {
      key: 'axial',
      label: '轴位 (Axial)',
    },
    {
      key: 'sagittal',
      label: '矢状位 (Sagittal)',
    },
    {
      key: 'coronal',
      label: '冠状位 (Coronal)',
    },
  ]

  const toolButtons = [
    { key: 'ww/wl', icon: <MedicineBoxOutlined />, label: '窗宽窗位' },
    { key: 'zoom', icon: <ZoomInOutlined />, label: '缩放' },
    { key: 'pan', icon: <ArrowsAltOutlined />, label: '平移' },
  ]

  return (
    <div className="dicom-viewer">
      <Card className="viewer-container" size="small">
        <div className="viewer-header">
          <Tabs
            size="small"
            activeKey={activePlane}
            onChange={setActivePlane}
            items={planeTabItems}
          />
          <div className="tool-buttons">
            {toolButtons.map((tool) => (
              <Button
                key={tool.key}
                size="small"
                type={activeTool === tool.key ? 'primary' : 'default'}
                icon={tool.icon}
                onClick={() => setActiveTool(tool.key)}
              >
                {tool.label}
              </Button>
            ))}
          </div>
        </div>

        <div
          className="canvas-container"
          style={{ width: '100%', height: 350 }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          <Spin spinning={isLoading}>
            <canvas
              ref={canvasRef}
              className="dicom-canvas"
              style={{ cursor: activeTool === 'pan' ? 'grab' : 'crosshair' }}
            />
          </Spin>

          {imageLoaded && (
            <div className="viewport-info">
              <div>WW: {Math.round(viewport.voi.windowWidth)}</div>
              <div>WL: {Math.round(viewport.voi.windowCenter)}</div>
              <div>缩放: {Math.round(viewport.scale * 100)}%</div>
            </div>
          )}
        </div>

        <div className="control-panel">
          <div className="preset-section">
            <span className="section-label">窗宽预设：</span>
            <div className="preset-buttons">
              {presets.map((preset) => (
                <Button
                  key={preset.name}
                  size="small"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="slider-section">
            <div className="slider-item">
              <span className="slider-label">窗宽 (WW):</span>
              <Slider
                min={1}
                max={4000}
                value={viewport.voi.windowWidth}
                onChange={handleWindowWidthChange}
                style={{ flex: 1 }}
              />
              <span className="slider-value">{Math.round(viewport.voi.windowWidth)}</span>
            </div>
            <div className="slider-item">
              <span className="slider-label">窗位 (WL):</span>
              <Slider
                min={-1000}
                max={1000}
                value={viewport.voi.windowCenter}
                onChange={handleWindowCenterChange}
                style={{ flex: 1 }}
              />
              <span className="slider-value">{Math.round(viewport.voi.windowCenter)}</span>
            </div>
          </div>

          <div className="zoom-section">
            <Space>
              <Button size="small" icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
              <Button size="small" icon={<ZoomInOutlined />} onClick={handleZoomIn} />
              <Button size="small" icon={<RotateLeftOutlined />} onClick={() => handleRotate(-1)} />
              <Button size="small" icon={<RotateRightOutlined />} onClick={() => handleRotate(1)} />
              <Button size="small" onClick={handleReset}>
                重置
              </Button>
            </Space>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default DicomViewer
