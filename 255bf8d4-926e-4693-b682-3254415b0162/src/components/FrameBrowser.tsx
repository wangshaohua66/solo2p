import { useState, useCallback } from 'react'
import {
  Image as ImageIcon,
  Filter,
  Search,
  Star,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Thermometer,
  Eye,
  Target
} from 'lucide-react'
import { useObservationStore } from '@/stores/observationStore'
import type { FitsFrame } from '@/core/types'
import {
  formatExposure,
  formatDate,
  getFilter,
  getGain,
  getCCDTemp,
  getObservationDate,
  getRA,
  getDEC,
  formatRA,
  formatDEC,
  getObjectName,
  getTelescope
} from '@/utils/fitsUtils'

interface FrameTooltipProps {
  frame: FitsFrame
  position: { x: number; y: number }
}

const FrameTooltip = ({ frame, position }: FrameTooltipProps) => {
  const ra = getRA(frame.header)
  const dec = getDEC(frame.header)

  return (
    <div
      className="fixed z-50 bg-space-deep border border-space-panel rounded-lg p-4 shadow-2xl w-80 pointer-events-none"
      style={{
        left: position.x + 10,
        top: position.y + 10,
        maxHeight: '80vh',
        overflowY: 'auto'
      }}
    >
      <div className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <ImageIcon size={14} className="text-signal-green" />
        {frame.fileName}
      </div>

      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="text-gray-400">目标天体</div>
          <div className="text-white">{getObjectName(frame.header)}</div>

          <div className="text-gray-400">望远镜</div>
          <div className="text-white">{getTelescope(frame.header)}</div>

          <div className="text-gray-400">滤波器</div>
          <div className="text-white">{getFilter(frame.header)}</div>

          <div className="text-gray-400">曝光时间</div>
          <div className="text-white">{formatExposure(frame.header.EXPTIME || 0)}</div>

          <div className="text-gray-400">增益</div>
          <div className="text-white">{getGain(frame.header).toFixed(1)} e-/ADU</div>

          <div className="text-gray-400">CCD温度</div>
          <div className="text-white">{getCCDTemp(frame.header).toFixed(1)}°C</div>

          <div className="text-gray-400">观测时间</div>
          <div className="text-white">{formatDate(getObservationDate(frame.header))}</div>

          {ra !== undefined && (
            <>
              <div className="text-gray-400">赤经 (RA)</div>
              <div className="text-white">{formatRA(ra)}</div>
            </>
          )}

          {dec !== undefined && (
            <>
              <div className="text-gray-400">赤纬 (DEC)</div>
              <div className="text-white">{formatDEC(dec)}</div>
            </>
          )}

          <div className="text-gray-400">图像尺寸</div>
          <div className="text-white">{frame.width} × {frame.height}</div>

          <div className="text-gray-400">位深度</div>
          <div className="text-white">
            {frame.header.BITPIX > 0 ? `${frame.header.BITPIX}-bit` : `${Math.abs(frame.header.BITPIX)}-bit浮点`}
          </div>
        </div>

        {frame.calibrationMatch && (
          <div className="mt-3 pt-3 border-t border-space-panel">
            <div className="text-signal-green font-medium mb-1">校准匹配</div>
            <div className="grid grid-cols-2 gap-1">
              <div className="text-gray-400">匹配度</div>
              <div className="text-white">{(frame.calibrationMatch.matchScore * 100).toFixed(0)}%</div>
              {frame.calibrationMatch.darkFrameId && (
                <>
                  <div className="text-gray-400">暗帧</div>
                  <div className="text-signal-green">已匹配</div>
                </>
              )}
              {frame.calibrationMatch.flatFrameId && (
                <>
                  <div className="text-gray-400">平场帧</div>
                  <div className="text-signal-green">已匹配</div>
                </>
              )}
            </div>
          </div>
        )}

        {frame.starDetection && frame.starDetection.length > 0 && (
          <div className="mt-3 pt-3 border-t border-space-panel">
            <div className="text-signal-green font-medium mb-1">星点检测</div>
            <div className="grid grid-cols-2 gap-1">
              <div className="text-gray-400">检测星数</div>
              <div className="text-white">{frame.starDetection.length}</div>
              <div className="text-gray-400">平均FWHM</div>
              <div className="text-white">
                {(frame.starDetection.reduce((s, d) => s + d.fwhm, 0) / frame.starDetection.length).toFixed(2)} px
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface FrameCardProps {
  frame: FitsFrame
  isSelected: boolean
  isRefFrame: boolean
  onSelect: () => void
  onSetRef: () => void
}

const FrameCard = ({ frame, isSelected, isRefFrame, onSelect, onSetRef }: FrameCardProps) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY })
  }, [])

  const qualityIcon = {
    pending: <Clock size={12} className="text-gray-400" />,
    good: <CheckCircle size={12} className="text-signal-green" />,
    rejected: <AlertCircle size={12} className="text-red-500" />
  }[frame.quality]

  return (
    <div
      className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 ${
        isSelected
          ? 'border-signal-green shadow-lg shadow-signal-green/20'
          : 'border-transparent hover:border-space-panel'
      }`}
      onClick={onSelect}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onMouseMove={handleMouseMove}
    >
      <div className="relative aspect-square bg-space-deep">
        <img
          src={frame.thumbnail}
          alt={frame.fileName}
          className="w-full h-full object-contain"
          loading="lazy"
        />

        {isRefFrame && (
          <div className="absolute top-1 left-1 bg-alert-orange text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            <Target size={10} />
            参考
          </div>
        )}

        <div className="absolute top-1 right-1 flex items-center gap-1">
          {qualityIcon}
          {frame.quality === 'rejected' && (
            <div className="bg-red-500/80 text-white text-xs px-1.5 py-0.5 rounded">
              已剔除
            </div>
          )}
        </div>

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <button
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              isRefFrame
                ? 'bg-alert-orange text-white'
                : 'bg-space-panel text-white hover:bg-signal-green'
            }`}
            onClick={(e) => {
              e.stopPropagation()
              onSetRef()
            }}
          >
            <Star size={12} className="inline mr-1" />
            {isRefFrame ? '取消参考' : '设为参考'}
          </button>
        </div>
      </div>

      <div className="p-2 bg-space-panel/50">
        <div className="text-xs text-white truncate font-medium">{frame.fileName}</div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
          <span className="flex items-center gap-0.5">
            <Filter size={10} />
            {getFilter(frame.header)}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock size={10} />
            {formatExposure(frame.header.EXPTIME || 0)}
          </span>
          <span className="flex items-center gap-0.5">
            <Thermometer size={10} />
            {getCCDTemp(frame.header).toFixed(0)}°
          </span>
        </div>
      </div>

      {showTooltip && <FrameTooltip frame={frame} position={tooltipPos} />}
    </div>
  )
}

export const FrameBrowser = () => {
  const {
    frames,
    filterOptions,
    filter,
    selectedFrameId,
    refFrameId,
    setFilter,
    setSelectedFrame,
    setRefFrame,
    getFilteredFrames
  } = useObservationStore()

  const [searchQuery, setSearchQuery] = useState('')

  const filteredFrames = getFilteredFrames().filter(frame =>
    frame.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getObjectName(frame.header).toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSetRef = (frameId: string) => {
    setRefFrame(refFrameId === frameId ? null : frameId)
  }

  return (
    <div className="h-full flex flex-col bg-space-deep border-r border-space-panel">
      <div className="p-4 border-b border-space-panel">
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon size={18} className="text-signal-green" />
          <h2 className="text-lg font-semibold text-white">帧浏览器</h2>
          <span className="ml-auto text-sm text-gray-400">
            {filteredFrames.length} / {frames.length} 帧
          </span>
        </div>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索文件名或目标..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-space-panel border border-space-panel/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-signal-green"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400 flex-shrink-0" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 bg-space-panel border border-space-panel/50 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-signal-green"
          >
            <option value="all">全部滤波器</option>
            {filterOptions.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filteredFrames.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <Eye size={48} className="mb-3 opacity-50" />
            <p className="text-sm">暂无帧数据</p>
            <p className="text-xs mt-1">上传FITS文件开始处理</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredFrames.map(frame => (
              <FrameCard
                key={frame.id}
                frame={frame}
                isSelected={selectedFrameId === frame.id}
                isRefFrame={refFrameId === frame.id}
                onSelect={() => setSelectedFrame(frame.id)}
                onSetRef={() => handleSetRef(frame.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
