import { useState, useMemo } from 'react'
import {
  Settings,
  Moon,
  Sun,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Database,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Thermometer,
  Clock,
  Filter as FilterIcon
} from 'lucide-react'
import { useObservationStore } from '@/stores/observationStore'
import { matchCalibrationFrames } from '@/core/AstroCalibration'
import { formatExposure } from '@/utils/fitsUtils'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

const ToggleSwitch = ({ checked, onChange, label }: ToggleSwitchProps) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm text-gray-300">{label}</span>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
        checked ? 'bg-signal-green' : 'bg-gray-600'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
)

interface MatchScoreProps {
  score: number
  label: string
  matched: boolean
}

const MatchScore = ({ score, label, matched }: MatchScoreProps) => {
  const percentage = Math.round(score * 100)
  const color = percentage >= 80 ? 'text-signal-green' : percentage >= 50 ? 'text-alert-orange' : 'text-red-500'

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        {matched ? (
          <CheckCircle2 size={14} className="text-signal-green" />
        ) : (
          <XCircle size={14} className="text-gray-500" />
        )}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <span className={`text-xs font-medium ${color}`}>
        {matched ? `${percentage}%` : '未匹配'}
      </span>
    </div>
  )
}

interface LibraryGroupProps {
  title: string
  items: Array<{ key: string; count: number; exposures: number[] }>
  insufficient: Array<{ count: number; recommended: number }>
  type: 'dark' | 'flat'
}

const LibraryGroup = ({ title, items, insufficient, type }: LibraryGroupProps) => {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="border border-space-panel rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 bg-space-panel/50 flex items-center justify-between hover:bg-space-panel transition-colors"
      >
        <div className="flex items-center gap-2">
          {type === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
          <span className="text-sm font-medium text-white">{title}</span>
          <span className="text-xs text-gray-400">({items.length} 组)</span>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="p-2 space-y-1.5 max-h-48 overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-2">暂无数据</div>
          ) : (
            items.map((item, idx) => {
              const isInsufficient = insufficient[idx]?.count < insufficient[idx]?.recommended
              return (
                <div
                  key={item.key}
                  className={`p-2 rounded text-xs ${
                    isInsufficient ? 'bg-alert-orange/10 border border-alert-orange/30' : 'bg-space-deep/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">{item.key}</span>
                    <span className={`${isInsufficient ? 'text-alert-orange' : 'text-signal-green'}`}>
                      {item.count} 帧
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Clock size={10} />
                    <span>{item.exposures.map(e => formatExposure(e)).join(', ')}</span>
                  </div>
                  {isInsufficient && (
                    <div className="flex items-center gap-1 mt-1 text-alert-orange">
                      <AlertTriangle size={10} />
                      <span>建议至少 {insufficient[idx].recommended} 帧</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export const CalibrationPanel = () => {
  const {
    selectedFrameId,
    frames,
    darkFrames,
    flatFrames,
    calibrationSettings,
    setCalibrationSettings,
    updateFrame,
    getCalibrationLibraryStats,
    getFrameById
  } = useObservationStore()

  const [compareMode, setCompareMode] = useState(false)
  const [comparePosition, setComparePosition] = useState(50)

  const selectedFrame = useMemo(() => {
    return selectedFrameId ? getFrameById(selectedFrameId) : undefined
  }, [selectedFrameId, getFrameById])

  const libraryStats = useMemo(() => getCalibrationLibraryStats(), [getCalibrationLibraryStats])

  const darkGroups = useMemo(() => {
    return Object.entries(libraryStats.darkFrames.byTemp).map(([temp, info]) => ({
      key: `${temp}°C`,
      count: info.count,
      exposures: info.exposureTimes
    }))
  }, [libraryStats])

  const flatGroups = useMemo(() => {
    return Object.entries(libraryStats.flatFrames.byFilter).map(([filter, info]) => ({
      key: filter,
      count: info.count,
      exposures: info.exposureTimes
    }))
  }, [libraryStats])

  const handleAutoMatch = () => {
    if (!selectedFrame) return

    const match = matchCalibrationFrames(
      selectedFrame,
      darkFrames,
      flatFrames
    )

    updateFrame(selectedFrame.id, { calibrationMatch: match })
  }

  const handleManualSelect = (type: 'dark' | 'flat', frameId: string) => {
    if (!selectedFrame) return

    const currentMatch = selectedFrame.calibrationMatch || {
      id: selectedFrame.id,
      targetFrameId: selectedFrame.id,
      matchScore: 0,
      manualOverride: true
    }

    const updatedMatch = {
      ...currentMatch,
      manualOverride: true,
      [type === 'dark' ? 'darkFrameId' : 'flatFrameId']: frameId
    }

    updateFrame(selectedFrame.id, { calibrationMatch: updatedMatch })
  }

  return (
    <div className="h-full flex flex-col bg-space-deep">
      <div className="p-4 border-b border-space-panel">
        <div className="flex items-center gap-2 mb-1">
          <Settings size={18} className="text-signal-green" />
          <h2 className="text-lg font-semibold text-white">校准配置</h2>
        </div>
        <p className="text-xs text-gray-400">配置暗电流减除、平场校正和坏像素插值参数</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
            <Sliders size={14} className="text-signal-green" />
            校准流水线
          </h3>
          <div className="bg-space-panel/30 rounded-lg p-3 space-y-1">
            <ToggleSwitch
              checked={calibrationSettings.darkSubtraction}
              onChange={(v) => setCalibrationSettings({ darkSubtraction: v })}
              label="暗电流减除"
            />
            <ToggleSwitch
              checked={calibrationSettings.flatCorrection}
              onChange={(v) => setCalibrationSettings({ flatCorrection: v })}
              label="平场校正"
            />
            <ToggleSwitch
              checked={calibrationSettings.badPixelInterpolation}
              onChange={(v) => setCalibrationSettings({ badPixelInterpolation: v })}
              label="坏像素插值"
            />

            {calibrationSettings.badPixelInterpolation && (
              <div className="pt-2 border-t border-space-panel/50">
                <label className="text-xs text-gray-400 block mb-1">
                  坏像素阈值: {calibrationSettings.badPixelThreshold}σ
                </label>
                <input
                  type="range"
                  min="3"
                  max="10"
                  step="0.5"
                  value={calibrationSettings.badPixelThreshold}
                  onChange={(e) => setCalibrationSettings({ badPixelThreshold: Number(e.target.value) })}
                  className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            )}
          </div>
        </div>

        {selectedFrame && (
          <div>
            <h3 className="text-sm font-medium text-white mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <RefreshCw size={14} className="text-signal-green" />
                校准帧匹配
              </span>
              <button
                onClick={handleAutoMatch}
                className="text-xs px-2 py-1 bg-signal-green/20 text-signal-green rounded hover:bg-signal-green/30 transition-colors"
              >
                自动匹配
              </button>
            </h3>
            <div className="bg-space-panel/30 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-2">
                当前帧: <span className="text-white">{selectedFrame.fileName}</span>
              </div>

              <div className="space-y-1 mb-3">
                <MatchScore
                  score={selectedFrame.calibrationMatch?.matchScore || 0}
                  label="暗帧匹配"
                  matched={!!selectedFrame.calibrationMatch?.darkFrameId}
                />
                <MatchScore
                  score={selectedFrame.calibrationMatch?.matchScore || 0}
                  label="平场帧匹配"
                  matched={!!selectedFrame.calibrationMatch?.flatFrameId}
                />
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">手动选择暗帧</label>
                  <select
                    value={selectedFrame.calibrationMatch?.darkFrameId || ''}
                    onChange={(e) => handleManualSelect('dark', e.target.value)}
                    className="w-full bg-space-panel border border-space-panel/50 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-signal-green"
                  >
                    <option value="">自动匹配</option>
                    {darkFrames.map(df => (
                      <option key={df.id} value={df.id}>
                        {df.ccdTemp.toFixed(0)}°C - {formatExposure(df.exposureTime)} ({df.frameCount}帧)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">手动选择平场帧</label>
                  <select
                    value={selectedFrame.calibrationMatch?.flatFrameId || ''}
                    onChange={(e) => handleManualSelect('flat', e.target.value)}
                    className="w-full bg-space-panel border border-space-panel/50 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-signal-green"
                  >
                    <option value="">自动匹配</option>
                    {flatFrames.map(ff => (
                      <option key={ff.id} value={ff.id}>
                        {ff.filter} - {formatExposure(ff.exposureTime)} ({ff.frameCount}帧)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
            <Database size={14} className="text-signal-green" />
            校准帧库
          </h3>
          <div className="space-y-3">
            <LibraryGroup
              title="暗帧库"
              items={darkGroups}
              insufficient={libraryStats.darkFrames.insufficient}
              type="dark"
            />
            <LibraryGroup
              title="平场帧库"
              items={flatGroups}
              insufficient={libraryStats.flatFrames.insufficient}
              type="flat"
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-white mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sliders size={14} className="text-signal-green" />
              校准前后对比
            </span>
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                compareMode
                  ? 'bg-signal-green text-white'
                  : 'bg-space-panel text-gray-300 hover:bg-space-panel/80'
              }`}
            >
              {compareMode ? '关闭对比' : '开启对比'}
            </button>
          </h3>

          {compareMode && (
            <div className="bg-space-panel/30 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                <span>校准前</span>
                <span>{comparePosition}%</span>
                <span>校准后</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={comparePosition}
                onChange={(e) => setComparePosition(Number(e.target.value))}
                className="w-full h-2 bg-space-panel rounded-lg appearance-none cursor-pointer slider"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                在主画布上拖动滑块查看校准前后差异
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
