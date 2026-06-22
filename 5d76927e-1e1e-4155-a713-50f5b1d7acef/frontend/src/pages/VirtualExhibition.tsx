import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Pannellum,
  PannellumViewer,
  PannellumHotSpot,
} from 'pannellum-react'
import { Card, Row, Col, Typography, Tag, Button, Spin, Tooltip, message } from 'antd'
import {
  ExpandOutlined,
  CompressOutlined,
  LeftOutlined,
  RightOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { HeritageCategoryMap } from '@/types'

const { Title, Paragraph } = Typography

interface PanoScene {
  id: string
  heritageId: string
  heritageName: string
  category: string
  panoramaUrl: string
  title: string
  description: string
  autoRotate?: boolean
  autoRotateSpeed?: number
  hotSpots: PanoHotSpot[]
}

interface PanoHotSpot {
  id: string
  pitch: number
  yaw: number
  type: 'scene' | 'info'
  text: string
  targetSceneId?: string
  cssClass?: string
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
    autoRotate: true,
    autoRotateSpeed: -2,
    hotSpots: [
      {
        id: 'hs1',
        pitch: -10,
        yaw: 120,
        type: 'info',
        text: '绣架区域：传承人在此进行日常刺绣创作，可容纳3位传承人同时作业。',
      },
      {
        id: 'hs2',
        pitch: -5,
        yaw: 240,
        type: 'info',
        text: '丝线展示区：展示蜀绣传统染色丝线，共128种色阶。',
      },
      {
        id: 'hs3',
        pitch: 5,
        yaw: 30,
        type: 'scene',
        text: '前往蜀绣展厅 →',
        targetSceneId: 'scene-2',
        cssClass: 'custom-hotspot-scene',
      },
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
      {
        id: 'hs4',
        pitch: 0,
        yaw: 90,
        type: 'info',
        text: '双面绣《熊猫戏竹》：国家级馆藏作品，正反两面图案完全不同。',
      },
      {
        id: 'hs5',
        pitch: -10,
        yaw: 180,
        type: 'info',
        text: '三异绣《芙蓉鲤鱼》：省级非遗代表作，异形、异色、异针法。',
      },
      {
        id: 'hs6',
        pitch: 5,
        yaw: 270,
        type: 'scene',
        text: '返回蜀绣工坊 →',
        targetSceneId: 'scene-1',
        cssClass: 'custom-hotspot-scene',
      },
      {
        id: 'hs6-next',
        pitch: 8,
        yaw: 0,
        type: 'scene',
        text: '前往川剧舞台 →',
        targetSceneId: 'scene-3',
        cssClass: 'custom-hotspot-scene',
      },
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
      {
        id: 'hs7',
        pitch: -5,
        yaw: 0,
        type: 'info',
        text: '表演舞台：变脸绝技演出区域，传统七尺戏台。',
      },
      {
        id: 'hs8',
        pitch: 10,
        yaw: 120,
        type: 'info',
        text: '观众席：传统戏园布局，可容纳120位观众。',
      },
      {
        id: 'hs9',
        pitch: 8,
        yaw: 180,
        type: 'scene',
        text: '返回蜀绣展厅 →',
        targetSceneId: 'scene-2',
        cssClass: 'custom-hotspot-scene',
      },
    ],
  },
]

const VirtualExhibition: React.FC = () => {
  const [currentSceneId, setCurrentSceneId] = useState<string>(DEMO_SCENES[0].id)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewerReady, setViewerReady] = useState(false)
  const viewerRef = useRef<PannellumViewer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentScene = useMemo(
    () => DEMO_SCENES.find(s => s.id === currentSceneId) || DEMO_SCENES[0],
    [currentSceneId],
  )

  const currentSceneIndex = DEMO_SCENES.findIndex(s => s.id === currentSceneId)

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const navigateScene = (sceneId: string) => {
    if (viewerRef.current && viewerRef.current.isLoaded()) {
      viewerRef.current.loadScene(sceneId)
    } else {
      setCurrentSceneId(sceneId)
    }
  }

  const handleViewerReady = (viewer: PannellumViewer) => {
    viewerRef.current = viewer
    setViewerReady(true)

    viewer.on('scenechange', (sceneId: string) => {
      setCurrentSceneId(sceneId)
    })

    viewer.on('error', (err: unknown) => {
      console.error('Pannellum viewer error:', err)
      message.error('全景场景加载失败')
    })

    DEMO_SCENES.forEach(scene => {
      if (!viewer.getSceneIds().includes(scene.id)) {
        viewer.addScene(scene.id, {
          type: 'equirectangular',
          panorama: scene.panoramaUrl,
          autoRotate: scene.autoRotate,
          autoRotateSpeed: scene.autoRotateSpeed,
          hotSpots: scene.hotSpots.map(hs => ({
            id: hs.id,
            pitch: hs.pitch,
            yaw: hs.yaw,
            type: hs.type === 'scene' ? 'scene' : 'info',
            text: hs.text,
            sceneId: hs.targetSceneId,
            cssClass: hs.cssClass || (hs.type === 'scene' ? 'custom-hotspot-scene' : 'custom-hotspot-info'),
          })),
        })
      }
    })
  }

  const handleHotspotClick = (hotspot: PanoHotSpot) => {
    if (hotspot.type === 'scene' && hotspot.targetSceneId) {
      navigateScene(hotspot.targetSceneId)
    } else if (hotspot.type === 'info') {
      message.info({
        content: hotspot.text,
        duration: 5,
      })
    }
  }

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
          基于Pannellum 360°全景引擎，拖拽环顾四周，滚轮缩放视角，点击金色热点切换场景，沉浸式体验非遗文化空间
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
            }}
          >
            {!viewerReady && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#0a0a1a',
                }}
              >
                <Spin size="large" tip="初始化Pannellum全景引擎..." />
              </div>
            )}

            <Pannellum
              width="100%"
              height="100%"
              image={currentScene.panoramaUrl}
              pitch={0}
              yaw={0}
              hfov={100}
              minHfov={30}
              maxHfov={120}
              minPitch={-85}
              maxPitch={85}
              autoLoad
              autoRotate={currentScene.autoRotate}
              autoRotateSpeed={currentScene.autoRotateSpeed || -2}
              showControls
              showFullscreenCtrl={false}
              showZoomCtrl
              compass
              hotspotDebug={false}
              mouseZoom
              draggable
              keyboardZoom
              sceneId={currentScene.id}
              onLoad={handleViewerReady}
            >
              {currentScene.hotSpots.map(hs => (
                <PannellumHotSpot
                  key={hs.id}
                  id={hs.id}
                  pitch={hs.pitch}
                  yaw={hs.yaw}
                  type={hs.type === 'scene' ? 'scene' : 'info'}
                  text={hs.text}
                  sceneId={hs.targetSceneId}
                  cssClass={hs.cssClass || (hs.type === 'scene' ? 'custom-hotspot-scene' : 'custom-hotspot-info')}
                  handleClick={() => handleHotspotClick(hs)}
                  tooltip={hs.text}
                  createTooltipFunc={(hotSpotDiv: HTMLDivElement, args: { text: string }) => {
                    hotSpotDiv.classList.add('pannellum-tooltip-custom')
                    const span = document.createElement('span')
                    span.innerHTML = args.text
                    span.style.color = hs.type === 'scene' ? '#c8a96e' : '#40a9ff'
                    hotSpotDiv.appendChild(span)
                    hotSpotDiv.style.width = 'auto'
                    hotSpotDiv.style.maxWidth = '220px'
                  }}
                  createTooltipArgs={{ text: hs.text }}
                />
              ))}
            </Pannellum>

            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                background: 'rgba(15, 52, 96, 0.85)',
                padding: '8px 16px',
                borderRadius: 8,
                backdropFilter: 'blur(8px)',
                zIndex: 50,
                pointerEvents: 'none',
              }}
            >
              <div style={{ color: '#c8a96e', fontWeight: 600, fontSize: 16 }}>
                {currentScene.title}
              </div>
              <Tag color="gold" style={{ marginTop: 4 }}>
                {HeritageCategoryMap[
                  currentScene.category as keyof typeof HeritageCategoryMap
                ] || currentScene.category}
              </Tag>
            </div>

            <div
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                display: 'flex',
                gap: 8,
                zIndex: 50,
              }}
            >
              <Tooltip title={isFullscreen ? '退出全屏' : '全屏漫游'}>
                <Button
                  type="text"
                  icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
                  onClick={toggleFullscreen}
                  style={{
                    color: '#c8a96e',
                    background: 'rgba(15, 52, 96, 0.85)',
                    borderRadius: 6,
                  }}
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
                zIndex: 50,
              }}
            >
              <Button
                icon={<LeftOutlined />}
                disabled={currentSceneIndex === 0}
                onClick={() => navigateScene(DEMO_SCENES[currentSceneIndex - 1].id)}
                style={{
                  background: 'rgba(15, 52, 96, 0.85)',
                  color: '#c8a96e',
                  border: 'none',
                }}
              >
                上一场景
              </Button>
              <div style={{ display: 'flex', gap: 6 }}>
                {DEMO_SCENES.map((s, i) => (
                  <div
                    key={s.id}
                    onClick={() => navigateScene(s.id)}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background:
                        s.id === currentSceneId ? '#c8a96e' : 'rgba(200, 169, 110, 0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      border:
                        s.id === currentSceneId
                          ? '2px solid #fff'
                          : '2px solid transparent',
                    }}
                  />
                ))}
              </div>
              <Button
                disabled={currentSceneIndex === DEMO_SCENES.length - 1}
                onClick={() => navigateScene(DEMO_SCENES[currentSceneIndex + 1].id)}
                style={{
                  background: 'rgba(15, 52, 96, 0.85)',
                  color: '#c8a96e',
                  border: 'none',
                }}
              >
                下一场景 <RightOutlined />
              </Button>
            </div>
          </div>

          <Card style={{ marginTop: 16, borderRadius: 12 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <Title level={4} style={{ color: '#c8a96e', marginBottom: 8 }}>
                  {currentScene.title}
                </Title>
                <Paragraph style={{ color: '#c8c8c8', lineHeight: 1.8 }}>
                  {currentScene.description}
                </Paragraph>
              </div>
              <div style={{ minWidth: 200 }}>
                <div style={{ color: '#a0a0a0', fontSize: 12, marginBottom: 8 }}>
                  场景热点 ({currentScene.hotSpots.length})
                </div>
                {currentScene.hotSpots.map(hs => (
                  <Tooltip key={hs.id} title={hs.text}>
                    <Tag
                      color={hs.type === 'scene' ? 'gold' : 'blue'}
                      style={{
                        marginBottom: 4,
                        cursor: hs.type === 'scene' ? 'pointer' : 'default',
                      }}
                      onClick={() =>
                        hs.type === 'scene' && hs.targetSceneId
                          ? navigateScene(hs.targetSceneId)
                          : handleHotspotClick(hs)
                      }
                    >
                      <InfoCircleOutlined /> {hs.type === 'scene' ? '场景切换' : '信息点'}
                    </Tag>
                  </Tooltip>
                ))}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card
            title={<span style={{ color: '#c8a96e' }}>场景列表</span>}
            style={{ borderRadius: 12 }}
          >
            {DEMO_SCENES.map(scene => (
              <Card.Grid
                key={scene.id}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background:
                    scene.id === currentSceneId
                      ? 'rgba(200, 169, 110, 0.1)'
                      : 'transparent',
                  borderLeft:
                    scene.id === currentSceneId
                      ? '3px solid #c8a96e'
                      : '3px solid transparent',
                  transition: 'all 0.3s',
                }}
                hoverable
                onClick={() => navigateScene(scene.id)}
              >
                <div
                  style={{
                    color: scene.id === currentSceneId ? '#c8a96e' : '#e8e8e8',
                    fontWeight: scene.id === currentSceneId ? 600 : 400,
                  }}
                >
                  {scene.heritageName}
                </div>
                <div style={{ color: '#a0a0a0', fontSize: 12, marginTop: 4 }}>
                  {scene.title}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  <Tag color="gold" style={{ fontSize: 10 }}>
                    {HeritageCategoryMap[
                      scene.category as keyof typeof HeritageCategoryMap
                    ]}
                  </Tag>
                  <Tag color="blue" style={{ fontSize: 10 }}>
                    {scene.hotSpots.length}个热点
                  </Tag>
                </div>
              </Card.Grid>
            ))}
          </Card>

          <Card
            title={<span style={{ color: '#c8a96e' }}>操作指南</span>}
            style={{ borderRadius: 12, marginTop: 16 }}
            styles={{ body: { padding: 16 } }}
          >
            <div style={{ color: '#c8c8c8', fontSize: 13, lineHeight: 2.4 }}>
              <div>🖱️ 拖拽鼠标 → 360°环顾四周</div>
              <div>🔍 滚轮缩放 → 调整视角(30°-120°)</div>
              <div>👆 金色圆点 → 切换相邻场景</div>
              <div>💡 蓝色圆点 → 查看场景信息</div>
              <div>⬅️➡️ 底部按钮 → 上/下一场景</div>
              <div>⛶ 右上角按钮 → 全屏沉浸漫游</div>
              <div>⚙️ 场景自动旋转 → 观看中自动环视</div>
            </div>
          </Card>
        </Col>
      </Row>

      <style>{`
        .pannellum-container {
          background: #0a0a1a !important;
        }
        .pannellum-view {
          border-radius: 12px;
        }
        .custom-hotspot-scene {
          background: #c8a96e !important;
          border: 3px solid #fff !important;
          border-radius: 50% !important;
          width: 32px !important;
          height: 32px !important;
          transform: translate(-50%, -50%);
          cursor: pointer !important;
          box-shadow: 0 0 20px rgba(200, 169, 110, 0.8);
          animation: hotspot-pulse-scene 2s infinite;
        }
        .custom-hotspot-scene::after {
          content: '→';
          color: #fff;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 16px;
          font-weight: bold;
        }
        .custom-hotspot-info {
          background: #40a9ff !important;
          border: 3px solid #fff !important;
          border-radius: 50% !important;
          width: 24px !important;
          height: 24px !important;
          transform: translate(-50%, -50%);
          cursor: pointer !important;
          box-shadow: 0 0 16px rgba(64, 169, 255, 0.7);
          animation: hotspot-pulse-info 2.5s infinite;
        }
        .custom-hotspot-info::after {
          content: 'i';
          color: #fff;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 14px;
          font-weight: bold;
          font-style: italic;
        }
        @keyframes hotspot-pulse-scene {
          0%, 100% { box-shadow: 0 0 20px rgba(200, 169, 110, 0.8); }
          50% { box-shadow: 0 0 36px rgba(200, 169, 110, 1); }
        }
        @keyframes hotspot-pulse-info {
          0%, 100% { box-shadow: 0 0 16px rgba(64, 169, 255, 0.7); }
          50% { box-shadow: 0 0 28px rgba(64, 169, 255, 1); }
        }
        .pannellum-tooltip-custom {
          background: rgba(15, 52, 96, 0.95) !important;
          border: 1px solid rgba(200, 169, 110, 0.4) !important;
          color: #e8e8e8 !important;
          padding: 8px 12px !important;
          border-radius: 6px !important;
          font-size: 13px !important;
          line-height: 1.6 !important;
          backdrop-filter: blur(4px);
        }
        .pannellum-compass {
          background: rgba(15, 52, 96, 0.85) !important;
          border: 1px solid rgba(200, 169, 110, 0.3) !important;
        }
        .pannellum-zoom-in, .pannellum-zoom-out {
          background: rgba(15, 52, 96, 0.85) !important;
          border: 1px solid rgba(200, 169, 110, 0.3) !important;
          color: #c8a96e !important;
        }
        .pannellum-grab, .pannellum-grabbing {
          cursor: grab;
        }
      `}</style>
    </div>
  )
}

export default VirtualExhibition
