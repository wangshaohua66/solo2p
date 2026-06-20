import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Palette,
  SlidersHorizontal,
  Settings2
} from 'lucide-react'
import { useObservationStore } from '@/stores/observationStore'
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction'
import { useHistogram } from '@/hooks/useHistogram'
import {
  pixelToImageData,
  autoStretchParams,
  type ColorMapName,
  type StretchFunction
} from '@/utils/colorMaps'
import { formatADU } from '@/utils/fitsUtils'
import type { PixelInfo, StarDetection } from '@/core/types'

interface ImageCanvasProps {
  compareMode?: boolean
  comparePosition?: number
}

export const ImageCanvas = ({ compareMode = false, comparePosition = 50 }: ImageCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const [pixelInfo, setPixelInfo] = useState<PixelInfo | null>(null)
  const [showToolbar, setShowToolbar] = useState(true)

  const {
    frames,
    selectedFrameId,
    selectedStackResultId,
    stackTasks,
    visualizationSettings,
    setVisualizationSettings,
    getFrameById
  } = useObservationStore()

  const selectedFrame = useMemo(() => {
    if (selectedStackResultId) {
      const task = stackTasks.find(t => t.id === selectedStackResultId)
      if (task?.result) {
        return {
          id: task.id,
          pixelData: task.result.pixelData,
          width: task.result.width,
          height: task.result.height,
          starDetection: [] as StarDetection[],
          isStackResult: true
        }
      }
    }
    if (selectedFrameId) {
      const frame = getFrameById(selectedFrameId)
      if (frame) {
        return {
          ...frame,
          pixelData: frame.calibratedData || frame.pixelData,
          isStackResult: false
        }
      }
    }
    return null
  }, [selectedFrameId, selectedStackResultId, stackTasks, getFrameById])

  const displayData = useMemo(() => {
    if (!selectedFrame) return null
    return selectedFrame.pixelData
  }, [selectedFrame])

  const histogramData = useHistogram({ pixelData: displayData, bins: 256 })

  const stretchParams = useMemo(() => {
    if (!displayData) return { blackPoint: 0, whitePoint: 1 }
    if (visualizationSettings.stretchFunction === 'auto') {
      return autoStretchParams(displayData)
    }
    return {
      blackPoint: visualizationSettings.blackPoint,
      whitePoint: visualizationSettings.whitePoint
    }
  }, [displayData, visualizationSettings])

  const {
    viewport,
    isDragging,
    mousePos,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    resetView,
    zoomIn,
    zoomOut,
    zoomToFit
  } = useCanvasInteraction({
    canvasRef,
    imageWidth: selectedFrame?.width || 100,
    imageHeight: selectedFrame?.height || 100,
    onPixelHover: setPixelInfo,
    minScale: 0.1,
    maxScale: 8
  })

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setCanvasSize({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height)
        })
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    resetView()
  }, [selectedFrame?.width, selectedFrame?.height, resetView])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !selectedFrame || !displayData) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    ctx.imageSmoothingEnabled = viewport.scale < 1
    ctx.imageSmoothingQuality = 'high'

    ctx.fillStyle = '#0a0e17'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const imageData = pixelToImageData(
      displayData,
      selectedFrame.width,
      selectedFrame.height,
      stretchParams.blackPoint,
      stretchParams.whitePoint,
      visualizationSettings.stretchFunction,
      visualizationSettings.colorMap,
      visualizationSettings.gamma
    )

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = selectedFrame.width
    tempCanvas.height = selectedFrame.height
    const tempCtx = tempCanvas.getContext('2d')
    if (tempCtx) {
      tempCtx.putImageData(imageData, 0, 0)
    }

    ctx.save()
    ctx.translate(viewport.offsetX, viewport.offsetY)
    ctx.scale(viewport.scale, viewport.scale)
    ctx.drawImage(tempCanvas, 0, 0)

    if (visualizationSettings.showStars && selectedFrame.starDetection && !selectedFrame.isStackResult) {
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 1 / viewport.scale
      ctx.fillStyle = 'rgba(16, 185, 129, 0.3)'

      selectedFrame.starDetection.forEach(star => {
        const radius = star.fwhm * 1.5
        ctx.beginPath()
        ctx.arc(star.x, star.y, radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(star.x - radius * 0.5, star.y)
        ctx.lineTo(star.x + radius * 0.5, star.y)
        ctx.moveTo(star.x, star.y - radius * 0.5)
        ctx.lineTo(star.x, star.y + radius * 0.5)
        ctx.stroke()
      })
    }

    ctx.restore()

    if (compareMode) {
      const splitX = (canvas.width * comparePosition) / 100

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, splitX, canvas.height)
      ctx.clip()

      const originalData = selectedFrame.isStackResult
        ? displayData
        : (getFrameById(selectedFrameId!)?.pixelData || displayData)

      const originalImageData = pixelToImageData(
        originalData,
        selectedFrame.width,
        selectedFrame.height,
        stretchParams.blackPoint,
        stretchParams.whitePoint,
        'linear' as StretchFunction,
        'gray' as ColorMapName,
        1
      )

      const tempCanvas2 = document.createElement('canvas')
      tempCanvas2.width = selectedFrame.width
      tempCanvas2.height = selectedFrame.height
      const tempCtx2 = tempCanvas2.getContext('2d')
      if (tempCtx2) {
        tempCtx2.putImageData(originalImageData, 0, 0)
      }

      ctx.save()
      ctx.translate(viewport.offsetX, viewport.offsetY)
      ctx.scale(viewport.scale, viewport.scale)
      ctx.drawImage(tempCanvas2, 0, 0)
      ctx.restore()
      ctx.restore()

      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(splitX, 0)
      ctx.lineTo(splitX, canvas.height)
      ctx.stroke()

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(splitX - 40, 10, 80, 24)
      ctx.fillStyle = '#fff'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${comparePosition}%`, splitX, 26)
    }

    if (visualizationSettings.showCrosshair && mousePos) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])

      ctx.beginPath()
      ctx.moveTo(mousePos.x, 0)
      ctx.lineTo(mousePos.x, canvas.height)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, mousePos.y)
      ctx.lineTo(canvas.width, mousePos.y)
      ctx.stroke()

      ctx.setLineDash([])
    }
  }, [
    selectedFrame,
    displayData,
    viewport,
    mousePos,
    stretchParams,
    visualizationSettings,
    compareMode,
    comparePosition,
    canvasSize,
    selectedFrameId,
    getFrameById
  ])

  const handlePixelHover = useCallback((info: PixelInfo | null) => {
    if (!info || !displayData) {
      setPixelInfo(null)
      return
    }

    const idx = info.y * (selectedFrame?.width || 0) + info.x
    const value = displayData[idx] || 0

    setPixelInfo({
      ...info,
      value,
      adu: value
    })
  }, [displayData, selectedFrame?.width])

  const colorMapOptions: { value: ColorMapName; label: string }[] = [
    { value: 'gray', label: '灰度' },
    { value: 'heat', label: '热力图' },
    { value: 'cool', label: '冷色' },
    { value: 'viridis', label: 'Viridis' }
  ]

  const stretchOptions: { value: StretchFunction; label: string }[] = [
    { value: 'linear', label: '线性' },
    { value: 'log', label: '对数' },
    { value: 'asinh', label: '反正切' },
    { value: 'auto', label: '自动' }
  ]

  if (!selectedFrame) {
    return (
      <div
        ref={containerRef}
        className="h-full flex flex-col items-center justify-center bg-space-deep text-gray-500"
      >
        <Crosshair size={64} className="mb-4 opacity-30" />
        <p className="text-lg">选择一帧查看图像</p>
        <p className="text-sm mt-2 opacity-70">从左侧帧浏览器中选择或开始叠加任务</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full relative bg-space-deep overflow-hidden">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'canvas-cursor'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => {
          handleMouseMove(e)
          const coords = (handleMouseMove as any).coords
          if (coords) {
            const idx = coords.imageY * selectedFrame.width + coords.imageX
            const value = displayData?.[idx] || 0
            handlePixelHover({
              x: coords.imageX,
              y: coords.imageY,
              value,
              adu: value
            })
          }
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseLeave()
          handlePixelHover(null)
        }}
      />

      {showToolbar && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-space-deep/90 backdrop-blur rounded-lg p-2 border border-space-panel">
          <button
            onClick={zoomOut}
            className="p-2 hover:bg-space-panel rounded transition-colors text-gray-300 hover:text-white"
            title="缩小"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-xs text-gray-400 w-16 text-center font-mono">
            {(viewport.scale * 100).toFixed(0)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-2 hover:bg-space-panel rounded transition-colors text-gray-300 hover:text-white"
            title="放大"
          >
            <ZoomIn size={18} />
          </button>
          <div className="w-px h-6 bg-space-panel" />
          <button
            onClick={zoomToFit}
            className="p-2 hover:bg-space-panel rounded transition-colors text-gray-300 hover:text-white"
            title="适应窗口"
          >
            <Maximize2 size={18} />
          </button>
          <div className="w-px h-6 bg-space-panel" />
          <button
            onClick={() => setVisualizationSettings({ showCrosshair: !visualizationSettings.showCrosshair })}
            className={`p-2 rounded transition-colors ${
              visualizationSettings.showCrosshair
                ? 'bg-signal-green/20 text-signal-green'
                : 'hover:bg-space-panel text-gray-300 hover:text-white'
            }`}
            title="十字准线"
          >
            <Crosshair size={18} />
          </button>
          <button
            onClick={() => setVisualizationSettings({ showStars: !visualizationSettings.showStars })}
            className={`p-2 rounded transition-colors ${
              visualizationSettings.showStars
                ? 'bg-signal-green/20 text-signal-green'
                : 'hover:bg-space-panel text-gray-300 hover:text-white'
            }`}
            title="显示星点"
          >
            <Settings2 size={18} />
          </button>
        </div>
      )}

      <div className="absolute top-4 right-4 bg-space-deep/90 backdrop-blur rounded-lg p-3 border border-space-panel min-w-48">
        <div className="flex items-center gap-2 mb-2">
          <Palette size={14} className="text-signal-green" />
          <span className="text-sm font-medium text-white">显示设置</span>
          <button
            onClick={() => setShowToolbar(!showToolbar)}
            className="ml-auto text-gray-400 hover:text-white"
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <label className="text-gray-400 block mb-1">调色板</label>
            <select
              value={visualizationSettings.colorMap}
              onChange={(e) => setVisualizationSettings({ colorMap: e.target.value as ColorMapName })}
              className="w-full bg-space-panel border border-space-panel/50 rounded px-2 py-1 text-white focus:outline-none focus:border-signal-green"
            >
              {colorMapOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-gray-400 block mb-1">拉伸函数</label>
            <select
              value={visualizationSettings.stretchFunction}
              onChange={(e) => setVisualizationSettings({ stretchFunction: e.target.value as StretchFunction })}
              className="w-full bg-space-panel border border-space-panel/50 rounded px-2 py-1 text-white focus:outline-none focus:border-signal-green"
            >
              {stretchOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-gray-400 block mb-1">
              Gamma: {visualizationSettings.gamma.toFixed(1)}
            </label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={visualizationSettings.gamma}
              onChange={(e) => setVisualizationSettings({ gamma: Number(e.target.value) })}
              className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {histogramData.stats && (
            <div className="pt-2 border-t border-space-panel/50">
              <div className="text-gray-400 mb-1">直方图统计</div>
              <div className="grid grid-cols-2 gap-1 font-mono">
                <span className="text-gray-400">均值:</span>
                <span className="text-white">{histogramData.stats.mean.toFixed(1)}</span>
                <span className="text-gray-400">中值:</span>
                <span className="text-white">{histogramData.stats.median.toFixed(1)}</span>
                <span className="text-gray-400">标准差:</span>
                <span className="text-white">{histogramData.stats.stdDev.toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {pixelInfo && (
        <div className="absolute bottom-4 left-4 bg-space-deep/90 backdrop-blur rounded-lg px-3 py-2 border border-space-panel font-mono text-xs">
          <div className="flex items-center gap-4">
            <span className="text-gray-400">
              X: <span className="text-white">{pixelInfo.x}</span>
            </span>
            <span className="text-gray-400">
              Y: <span className="text-white">{pixelInfo.y}</span>
            </span>
            <span className="text-gray-400">
              ADU: <span className="text-signal-green">{formatADU(pixelInfo.adu)}</span>
            </span>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 bg-space-deep/90 backdrop-blur rounded-lg px-3 py-2 border border-space-panel text-xs">
        <div className="text-gray-400">
          {selectedFrame.isStackResult ? '叠加结果' : '原始帧'}:
          <span className="text-white ml-1">
            {selectedFrame.width} × {selectedFrame.height}
          </span>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-500">
        滚轮缩放 · Alt+拖拽平移
      </div>
    </div>
  )
}
