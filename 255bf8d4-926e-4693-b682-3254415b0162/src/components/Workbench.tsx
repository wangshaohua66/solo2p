import { useState, useRef, useCallback } from 'react'
import {
  Upload,
  FileImage,
  Settings,
  Layers,
  Palette,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  Database,
  Play,
  Info
} from 'lucide-react'
import { FrameBrowser } from './FrameBrowser'
import { CalibrationPanel } from './CalibrationPanel'
import { StackPreview } from './StackPreview'
import { ImageCanvas } from './ImageCanvas'
import { TaskQueue } from './TaskQueue'
import { useObservationStore } from '@/stores/observationStore'
import { parseFitsFile, createMockFitsFrame } from '@/core/FitsParser'
import { detectStars } from '@/core/StarMatcher'
import type { FitsFrame, DarkFrameInfo, FlatFrameInfo } from '@/core/types'
import { generateId } from '@/utils/fitsUtils'

type RightPanelTab = 'calibration' | 'alignment' | 'stacking' | 'visualization'

export const Workbench = () => {
  const {
    addFrame,
    addFrames,
    addDarkFrame,
    addFlatFrame,
    alignmentSettings,
    stackingSettings,
    setAlignmentSettings,
    setStackingSettings,
    updateFrame,
    isLoading,
    setLoading,
    error,
    setError
  } = useObservationStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('calibration')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [comparePosition, setComparePosition] = useState(50)

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setLoading(true)
    setError(null)

    try {
      const fitsFiles = files.filter(f => f.name.toLowerCase().endsWith('.fits') || f.name.toLowerCase().endsWith('.fit'))
      const frames: FitsFrame[] = []

      for (const file of fitsFiles) {
        try {
          const frame = await parseFitsFile(file)
          frames.push(frame)
        } catch (err) {
          console.error(`解析文件 ${file.name} 失败:`, err)
        }
      }

      if (frames.length > 0) {
        addFrames(frames)
      }

      if (frames.length !== fitsFiles.length) {
        setError(`成功解析 ${frames.length} / ${fitsFiles.length} 个文件`)
      }
    } catch (err) {
      setError('文件解析失败，请检查FITS格式')
      console.error(err)
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [addFrames, setLoading, setError])

  const loadSampleData = useCallback(() => {
    setLoading(true)
    setError(null)

    try {
      const filters = ['B', 'V', 'R', 'H-alpha']
      const objects = ['M42', 'M31', 'M51', 'NGC7000']
      const frames: FitsFrame[] = []

      for (let i = 0; i < 12; i++) {
        const filter = filters[i % filters.length]
        const obj = objects[Math.floor(i / 4) % objects.length]
        const frame = createMockFitsFrame(512, 512, {
          exposureTime: [30, 60, 120, 300][i % 4],
          gain: 1.0 + (i % 3) * 0.5,
          ccdTemp: -15 - (i % 3) * 5,
          filter,
          object: obj,
          stars: 50 + Math.floor(Math.random() * 100),
          noise: 10 + Math.random() * 20
        })
        frames.push(frame)
      }

      addFrames(frames)

      const darkFrames: DarkFrameInfo[] = [
        {
          id: generateId(),
          fileName: 'master_dark_-15C_30s.fits',
          exposureTime: 30,
          gain: 1.0,
          ccdTemp: -15,
          frameCount: 20,
          pixelData: new Float32Array(512 * 512).fill(100),
          width: 512,
          height: 512
        },
        {
          id: generateId(),
          fileName: 'master_dark_-20C_60s.fits',
          exposureTime: 60,
          gain: 1.0,
          ccdTemp: -20,
          frameCount: 15,
          pixelData: new Float32Array(512 * 512).fill(95),
          width: 512,
          height: 512
        },
        {
          id: generateId(),
          fileName: 'master_dark_-15C_120s.fits',
          exposureTime: 120,
          gain: 1.5,
          ccdTemp: -15,
          frameCount: 8,
          pixelData: new Float32Array(512 * 512).fill(110),
          width: 512,
          height: 512
        }
      ]

      const flatFrames: FlatFrameInfo[] = [
        {
          id: generateId(),
          fileName: 'master_flat_V.fits',
          filter: 'V',
          exposureTime: 5,
          gain: 1.0,
          frameCount: 25,
          pixelData: new Float32Array(512 * 512).fill(30000),
          width: 512,
          height: 512
        },
        {
          id: generateId(),
          fileName: 'master_flat_B.fits',
          filter: 'B',
          exposureTime: 8,
          gain: 1.0,
          frameCount: 20,
          pixelData: new Float32Array(512 * 512).fill(28000),
          width: 512,
          height: 512
        },
        {
          id: generateId(),
          fileName: 'master_flat_R.fits',
          filter: 'R',
          exposureTime: 4,
          gain: 1.0,
          frameCount: 5,
          pixelData: new Float32Array(512 * 512).fill(32000),
          width: 512,
          height: 512
        }
      ]

      darkFrames.forEach(df => addDarkFrame(df))
      flatFrames.forEach(ff => addFlatFrame(ff))

      setTimeout(() => {
        frames.forEach(async (frame, idx) => {
          if (idx < 5) {
            const stars = await detectStars(frame.pixelData, frame.width, frame.height, {
              detectionThreshold: 5,
              minStars: 10,
              maxStars: 200,
              subpixelAccuracy: true,
              maxIterations: 100,
              matchTolerance: 0.05
            })
            updateFrame(frame.id, { starDetection: stars })
          }
        })
      }, 500)

    } catch (err) {
      setError('加载示例数据失败')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [addFrames, addDarkFrame, addFlatFrame, updateFrame, setLoading, setError])

  const rightPanelTabs: { id: RightPanelTab; label: string; icon: any }[] = [
    { id: 'calibration', label: '校准', icon: Settings },
    { id: 'alignment', label: '对齐', icon: Layers },
    { id: 'stacking', label: '叠加', icon: Database },
    { id: 'visualization', label: '可视化', icon: Palette }
  ]

  return (
    <div className="h-screen flex flex-col bg-space-deep text-white overflow-hidden">
      <header className="h-14 border-b border-space-panel flex items-center justify-between px-4 bg-space-deep/95 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="lg:hidden p-2 hover:bg-space-panel rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-signal-green to-blue-500 rounded-lg flex items-center justify-center">
              <FileImage size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">深空图像处理工作站</h1>
              <p className="text-xs text-gray-400 leading-tight hidden sm:block">Astro Image Processing Workstation</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSampleData}
            disabled={isLoading}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-space-panel hover:bg-space-panel/80 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <Play size={14} />
            加载示例
          </button>

          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".fits,.fit"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-signal-green hover:bg-signal-green/80 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">上传FITS</span>
              <span className="sm:hidden">上传</span>
            </button>
          </div>

          {error && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
              <Info size={12} />
              {error}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <aside
          className={`hidden lg:flex ${
            leftPanelOpen ? 'w-64 xl:w-72' : 'w-0'
          } transition-all duration-300 overflow-hidden flex-shrink-0 border-r border-space-panel relative`}
        >
          <div className="w-64 xl:w-72 h-full">
            <FrameBrowser />
          </div>
          <button
            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
            className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-4 h-16 bg-space-panel hover:bg-signal-green rounded-r-lg flex items-center justify-center transition-colors"
          >
            {leftPanelOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 relative overflow-hidden">
            <ImageCanvas
              compareMode={compareMode}
              comparePosition={comparePosition}
            />

            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="hidden md:flex xl:hidden absolute right-2 top-2 z-20 p-2 bg-space-panel/90 backdrop-blur hover:bg-signal-green rounded-lg transition-colors"
            >
              <Settings size={18} />
            </button>
          </div>

          <div className="h-40 md:h-48 lg:h-56 flex-shrink-0">
            <TaskQueue />
          </div>
        </main>

        <aside
          className={`hidden xl:flex ${
            rightPanelOpen ? 'w-72 xl:w-80' : 'w-0'
          } transition-all duration-300 overflow-hidden flex-shrink-0 border-l border-space-panel relative`}
        >
          <div className="w-72 xl:w-80 h-full flex flex-col">
            <div className="flex border-b border-space-panel">
              {rightPanelTabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setRightPanelTab(tab.id)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors flex flex-col items-center gap-0.5 ${
                      rightPanelTab === tab.id
                        ? 'text-signal-green border-b-2 border-signal-green bg-signal-green/5'
                        : 'text-gray-400 hover:text-white hover:bg-space-panel/50'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 overflow-hidden">
              {rightPanelTab === 'calibration' && <CalibrationPanel />}
              {rightPanelTab === 'alignment' && (
                <div className="h-full flex flex-col bg-space-deep overflow-y-auto">
                  <div className="p-4 border-b border-space-panel">
                    <div className="flex items-center gap-2 mb-1">
                      <Layers size={18} className="text-signal-green" />
                      <h2 className="text-lg font-semibold text-white">对齐配置</h2>
                    </div>
                    <p className="text-xs text-gray-400">配置星点检测与图像对齐参数</p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="bg-space-panel/30 rounded-lg p-3 space-y-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          检测阈值: {alignmentSettings.detectionThreshold}σ
                        </label>
                        <input
                          type="range"
                          min="2"
                          max="15"
                          step="0.5"
                          value={alignmentSettings.detectionThreshold}
                          onChange={(e) => setAlignmentSettings({ detectionThreshold: Number(e.target.value) })}
                          className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          最小星点数: {alignmentSettings.minStars}
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          value={alignmentSettings.minStars}
                          onChange={(e) => setAlignmentSettings({ minStars: Number(e.target.value) })}
                          className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          最大星点数: {alignmentSettings.maxStars}
                        </label>
                        <input
                          type="range"
                          min="50"
                          max="500"
                          step="10"
                          value={alignmentSettings.maxStars}
                          onChange={(e) => setAlignmentSettings({ maxStars: Number(e.target.value) })}
                          className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-300">亚像素精度</span>
                        <button
                          onClick={() => setAlignmentSettings({ subpixelAccuracy: !alignmentSettings.subpixelAccuracy })}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            alignmentSettings.subpixelAccuracy ? 'bg-signal-green' : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                              alignmentSettings.subpixelAccuracy ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          匹配容差: {alignmentSettings.matchTolerance.toFixed(2)}
                        </label>
                        <input
                          type="range"
                          min="0.01"
                          max="0.2"
                          step="0.01"
                          value={alignmentSettings.matchTolerance}
                          onChange={(e) => setAlignmentSettings({ matchTolerance: Number(e.target.value) })}
                          className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {rightPanelTab === 'stacking' && (
                <div className="h-full flex flex-col">
                  <StackPreview />
                </div>
              )}
              {rightPanelTab === 'visualization' && (
                <div className="h-full flex flex-col bg-space-deep overflow-y-auto">
                  <div className="p-4 border-b border-space-panel">
                    <div className="flex items-center gap-2 mb-1">
                      <Palette size={18} className="text-signal-green" />
                      <h2 className="text-lg font-semibold text-white">可视化设置</h2>
                    </div>
                    <p className="text-xs text-gray-400">配置直方图拉伸与伪彩色映射</p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="bg-space-panel/30 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-300">校准对比模式</span>
                        </div>
                        <button
                          onClick={() => setCompareMode(!compareMode)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            compareMode ? 'bg-signal-green' : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                              compareMode ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      {compareMode && (
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">
                            对比位置: {comparePosition}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={comparePosition}
                            onChange={(e) => setComparePosition(Number(e.target.value))}
                            className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      显示设置可在主画布右上角面板调整
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-4 h-16 bg-space-panel hover:bg-signal-green rounded-l-lg flex items-center justify-center transition-colors"
          >
            {rightPanelOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </aside>

        <div
          className={`hidden md:block xl:hidden fixed inset-0 z-40 transition-opacity duration-300 ${
            rightPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setRightPanelOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
        </div>

        <aside
          className={`hidden md:flex xl:hidden fixed top-14 right-0 bottom-0 w-72 z-50 bg-space-deep border-l border-space-panel transform transition-transform duration-300 flex-col ${
            rightPanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex border-b border-space-panel">
            {rightPanelTabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setRightPanelTab(tab.id)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors flex flex-col items-center gap-0.5 ${
                    rightPanelTab === tab.id
                      ? 'text-signal-green border-b-2 border-signal-green bg-signal-green/5'
                      : 'text-gray-400 hover:text-white hover:bg-space-panel/50'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto">
            {rightPanelTab === 'calibration' && <CalibrationPanel />}
            {rightPanelTab === 'alignment' && (
              <div className="h-full flex flex-col bg-space-deep">
                <div className="p-4 border-b border-space-panel">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers size={18} className="text-signal-green" />
                    <h2 className="text-lg font-semibold text-white">对齐配置</h2>
                  </div>
                  <p className="text-xs text-gray-400">配置星点检测与图像对齐参数</p>
                </div>
                <div className="p-4 space-y-4">
                  <div className="bg-space-panel/30 rounded-lg p-3 space-y-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        检测阈值: {alignmentSettings.detectionThreshold}σ
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="15"
                        step="0.5"
                        value={alignmentSettings.detectionThreshold}
                        onChange={(e) => setAlignmentSettings({ detectionThreshold: Number(e.target.value) })}
                        className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        最小星点数: {alignmentSettings.minStars}
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        value={alignmentSettings.minStars}
                        onChange={(e) => setAlignmentSettings({ minStars: Number(e.target.value) })}
                        className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        最大星点数: {alignmentSettings.maxStars}
                      </label>
                      <input
                        type="range"
                        min="50"
                        max="500"
                        step="10"
                        value={alignmentSettings.maxStars}
                        onChange={(e) => setAlignmentSettings({ maxStars: Number(e.target.value) })}
                        className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-300">亚像素精度</span>
                      <button
                        onClick={() => setAlignmentSettings({ subpixelAccuracy: !alignmentSettings.subpixelAccuracy })}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          alignmentSettings.subpixelAccuracy ? 'bg-signal-green' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            alignmentSettings.subpixelAccuracy ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        匹配容差: {alignmentSettings.matchTolerance.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0.01"
                        max="0.2"
                        step="0.01"
                        value={alignmentSettings.matchTolerance}
                        onChange={(e) => setAlignmentSettings({ matchTolerance: Number(e.target.value) })}
                        className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {rightPanelTab === 'stacking' && (
              <div className="h-full flex flex-col">
                <StackPreview />
              </div>
            )}
            {rightPanelTab === 'visualization' && (
              <div className="h-full flex flex-col bg-space-deep">
                <div className="p-4 border-b border-space-panel">
                  <div className="flex items-center gap-2 mb-1">
                    <Palette size={18} className="text-signal-green" />
                    <h2 className="text-lg font-semibold text-white">可视化设置</h2>
                  </div>
                  <p className="text-xs text-gray-400">配置直方图拉伸与伪彩色映射</p>
                </div>
                <div className="p-4 space-y-4">
                  <div className="bg-space-panel/30 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-300">校准对比模式</span>
                      </div>
                      <button
                        onClick={() => setCompareMode(!compareMode)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          compareMode ? 'bg-signal-green' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            compareMode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {compareMode && (
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          对比位置: {comparePosition}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={comparePosition}
                          onChange={(e) => setComparePosition(Number(e.target.value))}
                          className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    显示设置可在主画布右上角面板调整
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {showMobileMenu && (
        <div className="fixed inset-0 bg-black/80 z-50 lg:hidden">
          <div className="w-64 h-full bg-space-deep">
            <div className="p-4 border-b border-space-panel flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">菜单</h2>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 hover:bg-space-panel rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <button
                onClick={() => {
                  loadSampleData()
                  setShowMobileMenu(false)
                }}
                className="w-full text-left px-3 py-2 hover:bg-space-panel rounded-lg text-sm flex items-center gap-2"
              >
                <Play size={16} />
                加载示例数据
              </button>
              <button
                onClick={() => {
                  fileInputRef.current?.click()
                  setShowMobileMenu(false)
                }}
                className="w-full text-left px-3 py-2 hover:bg-space-panel rounded-lg text-sm flex items-center gap-2"
              >
                <Upload size={16} />
                上传FITS文件
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-space-deep border border-space-panel rounded-xl p-6 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-signal-green border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white font-medium">处理中...</p>
            <p className="text-sm text-gray-400 mt-1">请稍候</p>
          </div>
        </div>
      )}
    </div>
  )
}
