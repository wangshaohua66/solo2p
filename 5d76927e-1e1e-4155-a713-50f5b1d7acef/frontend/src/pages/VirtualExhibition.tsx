import React, { useState, useRef, useEffect } from 'react'
import { Card, Row, Col, Typography, Tag, Button, Empty, Spin, Select, message, Tooltip } from 'antd'
import {
  ExpandOutlined,
  CompressOutlined,
  LeftOutlined,
  RightOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { Heritage, HeritageCategoryMap } from '@/types'

const { Title, Paragraph } = Typography

interface PanoScene {
  id: string
  heritageId: string
  heritageName: string
  category: string
  panoramaUrl: string
  title: string
  description: string
  hotSpots: PanoHotSpot[]
}

interface PanoHotSpot {
  id: string
  pitch: number
  yaw: number
  type: 'scene' | 'info'
  text: string
  targetSceneId?: string
}

const DEMO_SCENES: PanoScene[] = [
  {
    id: 'scene-1',
    heritageId: 'demo-1',
    heritageName: '蜀绣工坊',
    category: 'TRADITIONAL_CRAFT',
    panoramaUrl: 'https://pannellum.org/images/alma.jpg',
    title: '蜀绣传承人工坊全景',
    description: '走进蜀绣传承人的工作坊，感受传统刺绣技艺的精妙之处。360度全景展示工坊内绣架、丝线、成品等。',
    hotSpots: [
      { id: 'hs1', pitch: -10, yaw: 120, type: 'info', text: '绣架区域：传承人在此进行日常刺绣创作' },
      { id: 'hs2', pitch: -5, yaw: 240, type: 'info', text: '丝线展示区：展示各种传统染色丝线' },
      { id: 'hs3', pitch: 5, yaw: 30, type: 'scene', text: '前往展厅 →', targetSceneId: 'scene-2' },
    ],
  },
  {
    id: 'scene-2',
    heritageId: 'demo-1',
    heritageName: '蜀绣展厅',
    category: 'TRADITIONAL_CRAFT',
    panoramaUrl: 'https://pannellum.org/images/cerro-toco-0.jpg',
    title: '蜀绣代表作品展厅',
    description: '展出历代蜀绣精品，包括双面绣、三异绣等代表性作品。沉浸式欣赏非遗之美。',
    hotSpots: [
      { id: 'hs4', pitch: 0, yaw: 90, type: 'info', text: '双面绣《熊猫戏竹》：国家级馆藏作品' },
      { id: 'hs5', pitch: -10, yaw: 180, type: 'info', text: '三异绣《芙蓉鲤鱼》：省级非遗代表作' },
      { id: 'hs6', pitch: 5, yaw: 270, type: 'scene', text: '返回工坊 →', targetSceneId: 'scene-1' },
    ],
  },
  {
    id: 'scene-3',
    heritageId: 'demo-2',
    heritageName: '川剧舞台',
    category: 'TRADITIONAL_OPERA',
    panoramaUrl: 'https://pannellum.org/images/bma-0.jpg',
    title: '川剧变脸表演舞台',
    description: '沉浸式体验川剧变脸表演现场，近距离观赏变脸绝技和传统戏台。',
    hotSpots: [
      { id: 'hs7', pitch: -5, yaw: 0, type: 'info', text: '表演舞台：变脸绝技演出区域' },
      { id: 'hs8', pitch: 10, yaw: 120, type: 'info', text: '观众席：传统戏园布局' },
    ],
  },
]

const VirtualExhibition: React.FC = () => {
  const [scenes] = useState<PanoScene[]>(DEMO_SCENES)
  const [currentScene, setCurrentScene] = useState<PanoScene>(DEMO_SCENES[0])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [viewerYaw, setViewerYaw] = useState(0)
  const [viewerPitch, setViewerPitch] = useState(0)
  const [viewerFov, setViewerFov] = useState(100)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(timer)
  }, [currentScene.id])

  useEffect(() => {
    if (isFullscreen && containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    }
  }, [isFullscreen])

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      setViewerYaw(prev => prev + dx * 0.3)
      setViewerPitch(prev => Math.max(-85, Math.min(85, prev - dy * 0.3)))
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }
    const handleMouseUp = () => {
      isDragging.current = false
    }
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      setViewerFov(prev => Math.max(30, Math.min(120, prev + e.deltaY * 0.05)))
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [])

  const navigateScene = (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId)
    if (scene) {
      setViewerYaw(0)
      setViewerPitch(0)
      setViewerFov(100)
      setCurrentScene(scene)
    }
  }

  const currentSceneIndex = scenes.findIndex(s => s.id === currentScene.id)

  return (
    <div>
      <div
        style={{
          textAlign: 'center',
          padding: '48px 24px',
          marginBottom: 32,
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(15, 52, 96, 0.8), rgba(26, 26, 46, 0.9))',
        }}
      >
        <Title level={1} className="gradient-text" style={{ fontSize: 42, marginBottom: 16 }}>
          虚拟展厅漫游
        </Title>
        <Paragraph style={{ fontSize: 16, color: '#c8c8c8', maxWidth: 600, margin: '0 auto' }}>
          拖拽鼠标环顾四周，滚轮缩放视角，点击热点切换场景，沉浸式体验非遗文化空间
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={18}>
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              width: '100%',
              height: isFullscreen ? '100vh' : 500,
              borderRadius: isFullscreen ? 0 : 12,
              overflow: 'hidden',
              background: '#0a0a1a',
              cursor: isDragging.current ? 'grabbing' : 'grab',
            }}
          >
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Spin size="large" tip="加载全景场景..." />
              </div>
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                  }}
                  width={1200}
                  height={600}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)`,
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: `url(${currentScene.panoramaUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    transform: `perspective(800px) rotateY(${viewerYaw * 0.5}deg) rotateX(${-viewerPitch * 0.3}deg) scale(${100 / viewerFov})`,
                    transition: isDragging.current ? 'none' : 'transform 0.1s ease-out',
                    filter: 'saturate(1.1) contrast(1.05)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.3) 100%)',
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}

            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                background: 'rgba(15, 52, 96, 0.85)',
                padding: '8px 16px',
                borderRadius: 8,
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ color: '#c8a96e', fontWeight: 600, fontSize: 16 }}>{currentScene.title}</div>
              <Tag color="gold" style={{ marginTop: 4 }}>{HeritageCategoryMap[currentScene.category as keyof typeof HeritageCategoryMap] || currentScene.category}</Tag>
            </div>

            <div
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                display: 'flex',
                gap: 8,
              }}
            >
              <Tooltip title={isFullscreen ? '退出全屏' : '全屏漫游'}>
                <Button
                  type="text"
                  icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  style={{ color: '#c8a96e', background: 'rgba(15, 52, 96, 0.85)', borderRadius: 6 }}
                />
              </Tooltip>
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                right: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Button
                icon={<LeftOutlined />}
                disabled={currentSceneIndex === 0}
                onClick={() => navigateScene(scenes[currentSceneIndex - 1].id)}
                style={{ background: 'rgba(15, 52, 96, 0.85)', color: '#c8a96e', border: 'none' }}
              >
                上一场景
              </Button>
              <div style={{ display: 'flex', gap: 6 }}>
                {scenes.map((s, i) => (
                  <div
                    key={s.id}
                    onClick={() => navigateScene(s.id)}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: s.id === currentScene.id ? '#c8a96e' : 'rgba(200, 169, 110, 0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                  />
                ))}
              </div>
              <Button
                disabled={currentSceneIndex === scenes.length - 1}
                onClick={() => navigateScene(scenes[currentSceneIndex + 1].id)}
                style={{ background: 'rgba(15, 52, 96, 0.85)', color: '#c8a96e', border: 'none' }}
              >
                下一场景 <RightOutlined />
              </Button>
            </div>
          </div>

          <Card style={{ marginTop: 16, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <Title level={4} style={{ color: '#c8a96e', marginBottom: 8 }}>{currentScene.title}</Title>
                <Paragraph style={{ color: '#c8c8c8', lineHeight: 1.8 }}>{currentScene.description}</Paragraph>
              </div>
              <div style={{ minWidth: 180 }}>
                <div style={{ color: '#a0a0a0', fontSize: 12, marginBottom: 8 }}>场景热点</div>
                {currentScene.hotSpots.map(hs => (
                  <Tooltip key={hs.id} title={hs.text}>
                    <Tag
                      color={hs.type === 'scene' ? 'gold' : 'blue'}
                      style={{ marginBottom: 4, cursor: hs.type === 'scene' ? 'pointer' : 'default' }}
                      onClick={() => hs.type === 'scene' && hs.targetSceneId && navigateScene(hs.targetSceneId)}
                    >
                      <InfoCircleOutlined /> {hs.type === 'scene' ? '切换场景' : '信息点'}
                    </Tag>
                  </Tooltip>
                ))}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title={<span style={{ color: '#c8a96e' }}>场景列表</span>} style={{ borderRadius: 12 }}>
            {scenes.map(scene => (
              <Card.Grid
                key={scene.id}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: scene.id === currentScene.id ? 'rgba(200, 169, 110, 0.1)' : 'transparent',
                  borderLeft: scene.id === currentScene.id ? '3px solid #c8a96e' : '3px solid transparent',
                }}
                onClick={() => navigateScene(scene.id)}
              >
                <div style={{ color: scene.id === currentScene.id ? '#c8a96e' : '#e8e8e8', fontWeight: scene.id === currentScene.id ? 600 : 400 }}>
                  {scene.heritageName}
                </div>
                <div style={{ color: '#a0a0a0', fontSize: 12, marginTop: 4 }}>{scene.title}</div>
                <Tag color="gold" style={{ marginTop: 4, fontSize: 10 }}>
                  {HeritageCategoryMap[scene.category as keyof typeof HeritageCategoryMap]}
                </Tag>
              </Card.Grid>
            ))}
          </Card>

          <Card
            title={<span style={{ color: '#c8a96e' }}>操作指南</span>}
            style={{ borderRadius: 12, marginTop: 16 }}
            styles={{ body: { padding: 16 } }}
          >
            <div style={{ color: '#c8c8c8', fontSize: 13, lineHeight: 2.2 }}>
              <div>🖱️ 拖拽鼠标 → 环顾四周</div>
              <div>🔍 滚轮缩放 → 调整视角</div>
              <div>📌 金色标签 → 切换场景</div>
              <div>🔵 蓝色标签 → 查看信息</div>
              <div>⬅️➡️ 底部按钮 → 切换场景</div>
              <div>⛶ 右上角按钮 → 全屏漫游</div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default VirtualExhibition
