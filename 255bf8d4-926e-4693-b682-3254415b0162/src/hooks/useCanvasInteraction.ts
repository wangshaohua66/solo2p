import { useState, useCallback, useRef, useEffect } from 'react'
import type { CanvasViewport, PixelInfo } from '@/core/types'

interface UseCanvasInteractionOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>
  imageWidth: number
  imageHeight: number
  onPixelHover?: (pixelInfo: PixelInfo | null) => void
  minScale?: number
  maxScale?: number
}

export const useCanvasInteraction = ({
  canvasRef,
  imageWidth,
  imageHeight,
  onPixelHover,
  minScale = 0.1,
  maxScale = 10
}: UseCanvasInteractionOptions) => {
  const [viewport, setViewport] = useState<CanvasViewport>({
    scale: 1,
    offsetX: 0,
    offsetY: 0
  })

  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  const getImageCoordinates = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const canvasX = clientX - rect.left
    const canvasY = clientY - rect.top

    const imageX = (canvasX - viewport.offsetX) / viewport.scale
    const imageY = (canvasY - viewport.offsetY) / viewport.scale

    if (imageX < 0 || imageX >= imageWidth || imageY < 0 || imageY >= imageHeight) {
      return null
    }

    return {
      canvasX,
      canvasY,
      imageX: Math.floor(imageX),
      imageY: Math.floor(imageY)
    }
  }, [canvasRef, viewport, imageWidth, imageHeight])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const imageX = (mouseX - viewport.offsetX) / viewport.scale
    const imageY = (mouseY - viewport.offsetY) / viewport.scale

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    const newScale = Math.max(minScale, Math.min(maxScale, viewport.scale * zoomFactor))

    const newOffsetX = mouseX - imageX * newScale
    const newOffsetY = mouseY - imageY * newScale

    setViewport({
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY
    })
  }, [canvasRef, viewport, minScale, maxScale])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      setIsDragging(true)
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        offsetX: viewport.offsetX,
        offsetY: viewport.offsetY
      }
    }
  }, [viewport])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getImageCoordinates(e.clientX, e.clientY)
    setMousePos(coords ? { x: coords.canvasX, y: coords.canvasY } : null)

    if (isDragging && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y

      setViewport(prev => ({
        ...prev,
        offsetX: dragStartRef.current!.offsetX + dx,
        offsetY: dragStartRef.current!.offsetY + dy
      }))
    }

    if (onPixelHover && coords) {
      onPixelHover({
        x: coords.imageX,
        y: coords.imageY,
        value: 0,
        adu: 0
      })
    } else if (onPixelHover) {
      onPixelHover(null)
    }
  }, [isDragging, getImageCoordinates, onPixelHover])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    dragStartRef.current = null
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
    setMousePos(null)
    dragStartRef.current = null
    if (onPixelHover) {
      onPixelHover(null)
    }
  }, [onPixelHover])

  const resetView = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scaleX = canvas.width / imageWidth
    const scaleY = canvas.height / imageHeight
    const scale = Math.min(scaleX, scaleY)

    const offsetX = (canvas.width - imageWidth * scale) / 2
    const offsetY = (canvas.height - imageHeight * scale) / 2

    setViewport({ scale, offsetX, offsetY })
  }, [canvasRef, imageWidth, imageHeight])

  const zoomToFit = useCallback(() => {
    resetView()
  }, [resetView])

  const zoomIn = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      scale: Math.min(maxScale, prev.scale * 1.2)
    }))
  }, [maxScale])

  const zoomOut = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      scale: Math.max(minScale, prev.scale * 0.8)
    }))
  }, [minScale])

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  return {
    viewport,
    setViewport,
    isDragging,
    mousePos,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    resetView,
    zoomToFit,
    zoomIn,
    zoomOut,
    getImageCoordinates
  }
}
