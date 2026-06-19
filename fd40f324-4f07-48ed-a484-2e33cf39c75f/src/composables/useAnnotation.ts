import { ref, onBeforeUnmount, type Ref } from 'vue'
import { useAnnotationStore } from '@/stores/annotation'
import type { AnnotationPoint, ToolType } from '@/types'

export function useAnnotation(
  canvasRef: Ref<HTMLCanvasElement | null>,
  getOffset: () => { offsetX: number; offsetY: number }
) {
  const store = useAnnotationStore()

  const isDrawing = ref(false)
  const tempPoints = ref<AnnotationPoint[]>([])
  const currentNumber = ref(1)

  let ctx: CanvasRenderingContext2D | null = null

  function resize() {
    const canvas = canvasRef.value
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const context = canvas.getContext('2d')
    if (context) {
      ctx = context
      ctx.scale(dpr, dpr)
      renderAll()
    }
  }

  function getCanvasPos(clientX: number, clientY: number): AnnotationPoint {
    const canvas = canvasRef.value
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const { offsetX, offsetY } = getOffset()
    return {
      x: clientX - rect.left - offsetX,
      y: clientY - rect.top - offsetY
    }
  }

  function startDraw(clientX: number, clientY: number) {
    if (!store.active || store.currentTool === 'none' || store.currentTool === 'eraser') return
    isDrawing.value = true
    const pos = getCanvasPos(clientX, clientY)

    if (store.currentTool === 'pen') {
      tempPoints.value = [pos]
    } else if (store.currentTool === 'rect' || store.currentTool === 'arrow') {
      tempPoints.value = [pos, { ...pos }]
    } else if (store.currentTool === 'text') {
      const text = prompt('请输入标注文字:')
      if (text && text.trim()) {
        store.addAnnotation('text', [pos], text.trim())
        renderAll()
      }
      isDrawing.value = false
    } else if (store.currentTool === 'number') {
      store.addAnnotation('number', [pos], undefined, currentNumber.value)
      store.incrementNumber()
      renderAll()
      isDrawing.value = false
    }
  }

  function draw(clientX: number, clientY: number) {
    if (!isDrawing.value || !ctx) return
    const pos = getCanvasPos(clientX, clientY)

    if (store.currentTool === 'pen') {
      tempPoints.value.push(pos)
      renderAll()
      renderTemp()
    } else if (store.currentTool === 'rect' || store.currentTool === 'arrow') {
      if (tempPoints.value.length >= 2) {
        tempPoints.value[1] = pos
        renderAll()
        renderTemp()
      }
    }
  }

  function endDraw() {
    if (!isDrawing.value) return
    isDrawing.value = false

    if (tempPoints.value.length === 0) return

    if (store.currentTool === 'pen' && tempPoints.value.length > 1) {
      store.addAnnotation('pen', [...tempPoints.value])
    } else if ((store.currentTool === 'rect' || store.currentTool === 'arrow') && tempPoints.value.length >= 2) {
      const [start, end] = tempPoints.value
      if (Math.abs(end.x - start.x) > 3 || Math.abs(end.y - start.y) > 3) {
        store.addAnnotation(store.currentTool, [start, end])
      }
    }
    tempPoints.value = []
    renderAll()
  }

  function renderAll() {
    if (!ctx || !canvasRef.value) return
    const rect = canvasRef.value.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)

    if (!store.visible) return
    store.annotations.forEach(a => renderAnnotation(a))
  }

  function renderTemp() {
    if (!ctx || tempPoints.value.length === 0) return
    ctx.save()
    ctx.strokeStyle = store.currentColor
    ctx.fillStyle = store.currentColor
    ctx.lineWidth = store.strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = 0.7

    if (store.currentTool === 'pen') {
      drawPen(tempPoints.value)
    } else if (store.currentTool === 'rect') {
      drawRect(tempPoints.value[0], tempPoints.value[tempPoints.value.length - 1])
    } else if (store.currentTool === 'arrow') {
      drawArrow(tempPoints.value[0], tempPoints.value[tempPoints.value.length - 1])
    }
    ctx.restore()
  }

  function renderAnnotation(a: {
    type: ToolType
    color: string
    strokeWidth: number
    points: AnnotationPoint[]
    text?: string
    numberValue?: number
    fontSize?: number
  }) {
    if (!ctx) return
    ctx.save()
    ctx.strokeStyle = a.color
    ctx.fillStyle = a.color
    ctx.lineWidth = a.strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    switch (a.type) {
      case 'pen':
        drawPen(a.points)
        break
      case 'rect':
        if (a.points.length >= 2) drawRect(a.points[0], a.points[1])
        break
      case 'arrow':
        if (a.points.length >= 2) drawArrow(a.points[0], a.points[1])
        break
      case 'text':
        if (a.points.length >= 1 && a.text) drawText(a.points[0], a.text, a.color, a.fontSize || store.fontSize)
        break
      case 'number':
        if (a.points.length >= 1 && a.numberValue !== undefined) drawNumber(a.points[0], a.numberValue, a.color, a.fontSize || store.fontSize)
        break
    }
    ctx.restore()
  }

  function drawPen(points: AnnotationPoint[]) {
    if (!ctx || points.length < 2) return
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.stroke()
  }

  function drawRect(start: AnnotationPoint, end: AnnotationPoint) {
    if (!ctx) return
    ctx.beginPath()
    ctx.rect(
      Math.min(start.x, end.x),
      Math.min(start.y, end.y),
      Math.abs(end.x - start.x),
      Math.abs(end.y - start.y)
    )
    ctx.stroke()
  }

  function drawArrow(start: AnnotationPoint, end: AnnotationPoint) {
    if (!ctx) return
    const headLength = 12
    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    )
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    )
    ctx.stroke()
  }

  function drawText(pos: AnnotationPoint, text: string, color: string, fontSize: number) {
    if (!ctx) return
    ctx.font = `600 ${fontSize}px "Space Grotesk", system-ui, sans-serif`
    const metrics = ctx.measureText(text)
    const padding = 6
    const bgW = metrics.width + padding * 2
    const bgH = fontSize + padding * 2
    ctx.save()
    ctx.globalAlpha = 0.9
    ctx.fillStyle = '#0F172A'
    ctx.fillRect(pos.x - 2, pos.y - fontSize + 2, bgW, bgH)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.strokeRect(pos.x - 2, pos.y - fontSize + 2, bgW, bgH)
    ctx.restore()
    ctx.fillStyle = color
    ctx.textBaseline = 'bottom'
    ctx.fillText(text, pos.x + padding - 2, pos.y + padding)
  }

  function drawNumber(pos: AnnotationPoint, num: number, color: string, fontSize: number) {
    if (!ctx) return
    const r = fontSize * 0.8
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = 8
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `700 ${fontSize}px "Space Grotesk", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), pos.x, pos.y + 1)
  }

  function undo() { store.undo(); renderAll() }
  function redo() { store.redo(); renderAll() }
  function clear() { store.clear(); currentNumber.value = 1; renderAll() }
  function setTool(tool: ToolType) { store.setTool(tool) }
  function setColor(color: string) { store.setColor(color) }

  onBeforeUnmount(() => {
    ctx = null
  })

  return {
    isDrawing,
    resize,
    startDraw,
    draw,
    endDraw,
    renderAll,
    undo,
    redo,
    clear,
    setTool,
    setColor
  }
}

export type AnnotationAPI = ReturnType<typeof useAnnotation>
