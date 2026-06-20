import { useState, useMemo } from 'react'
import {
  ListTodo,
  Play,
  Pause,
  X,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Layers,
  ChevronUp,
  ChevronDown,
  Settings
} from 'lucide-react'
import { useObservationStore } from '@/stores/observationStore'
import { useStackingWorkflow } from '@/hooks/useStackingWorkflow'
import type { StackTask } from '@/core/types'

interface TaskCardProps {
  task: StackTask
  onCancel: (taskId: string) => void
  onRetry: (taskId: string) => void
  onRemove: (taskId: string) => void
  onView: (taskId: string) => void
  isSelected: boolean
}

const TaskCard = ({ task, onCancel, onRetry, onRemove, onView, isSelected }: TaskCardProps) => {
  const [expanded, setExpanded] = useState(false)

  const statusConfig = {
    queued: {
      icon: Clock,
      color: 'text-gray-400',
      bgColor: 'bg-gray-700/50',
      label: '等待中'
    },
    processing: {
      icon: Loader2,
      color: 'text-signal-green animate-spin',
      bgColor: 'bg-signal-green/10',
      label: '处理中'
    },
    completed: {
      icon: CheckCircle2,
      color: 'text-signal-green',
      bgColor: 'bg-signal-green/10',
      label: '已完成'
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      label: '错误'
    }
  }[task.status]

  const StatusIcon = statusConfig.icon

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '--'
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const estimatedRemaining = useMemo(() => {
    if (task.status !== 'processing' || !task.startedAt || task.progress === 0) return null
    const elapsed = (Date.now() - task.startedAt) / 1000
    const totalEstimated = elapsed / task.progress
    const remaining = totalEstimated - elapsed
    if (remaining < 60) return `${Math.ceil(remaining)}秒`
    if (remaining < 3600) return `${Math.ceil(remaining / 60)}分钟`
    return `${(remaining / 3600).toFixed(1)}小时`
  }, [task.status, task.startedAt, task.progress])

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        isSelected
          ? 'border-signal-green bg-signal-green/5'
          : 'border-space-panel bg-space-panel/30 hover:border-space-panel/80'
      }`}
    >
      <div
        className="p-3 cursor-pointer"
        onClick={() => onView(task.id)}
      >
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${statusConfig.bgColor}`}>
            <StatusIcon size={16} className={statusConfig.color} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-white truncate">{task.name}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
              <span className="flex items-center gap-1">
                <Layers size={12} />
                {task.currentFrame} / {task.totalFrames} 帧
              </span>
              <span>开始: {formatTime(task.startedAt)}</span>
              {estimatedRemaining && (
                <span className="text-signal-green">剩余: {estimatedRemaining}</span>
              )}
            </div>

            <div className="relative h-2 bg-space-deep rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                  task.status === 'error' ? 'bg-red-500' :
                  task.status === 'completed' ? 'bg-signal-green' :
                  'progress-gradient'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, task.progress * 100))}%` }}
              />
            </div>

            {task.status === 'processing' && (
              <div className="mt-1.5 text-xs text-signal-green flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                {task.currentStep}
              </div>
            )}

            {task.status === 'error' && task.error && (
              <div className="mt-1.5 text-xs text-red-400 truncate">
                {task.error}
              </div>
            )}

            {task.status === 'completed' && task.result && (
              <div className="mt-1.5 text-xs text-signal-green">
                最终SNR: {task.result.snr.toFixed(1)}σ · 已叠加 {task.result.stackedCount} 帧
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {task.status === 'processing' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCancel(task.id)
                }}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                title="取消任务"
              >
                <Pause size={14} />
              </button>
            )}
            {task.status === 'error' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRetry(task.id)
                }}
                className="p-1.5 text-gray-400 hover:text-signal-green hover:bg-signal-green/10 rounded transition-colors"
                title="重试任务"
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove(task.id)
              }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
              title="删除任务"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
              className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-space-panel/50">
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="text-gray-400">叠加模式</div>
            <div className="text-white">{task.stackingSettings.mode}</div>
            <div className="text-gray-400">Sigma阈值</div>
            <div className="text-white">{task.stackingSettings.sigmaThreshold}σ</div>
            <div className="text-gray-400">暗电流减除</div>
            <div className={task.calibrationSettings.darkSubtraction ? 'text-signal-green' : 'text-gray-500'}>
              {task.calibrationSettings.darkSubtraction ? '已启用' : '已禁用'}
            </div>
            <div className="text-gray-400">平场校正</div>
            <div className={task.calibrationSettings.flatCorrection ? 'text-signal-green' : 'text-gray-500'}>
              {task.calibrationSettings.flatCorrection ? '已启用' : '已禁用'}
            </div>
            <div className="text-gray-400">检测阈值</div>
            <div className="text-white">{task.alignmentSettings.detectionThreshold}σ</div>
            <div className="text-gray-400">亚像素精度</div>
            <div className={task.alignmentSettings.subpixelAccuracy ? 'text-signal-green' : 'text-gray-500'}>
              {task.alignmentSettings.subpixelAccuracy ? '已启用' : '已禁用'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const TaskQueue = () => {
  const {
    stackTasks,
    selectedStackResultId,
    getFilteredFrames,
    removeStackTask,
    clearCompletedTasks,
    setSelectedStackResult
  } = useObservationStore()

  const { startStacking, cancelStacking, retryTask, activeWorkers } = useStackingWorkflow()

  const [showStartDialog, setShowStartDialog] = useState(false)
  const [taskName, setTaskName] = useState('')

  const filteredFrames = getFilteredFrames()
  const goodFrames = filteredFrames.filter(f => f.quality !== 'rejected')

  const sortedTasks = useMemo(() => {
    return [...stackTasks].sort((a, b) => b.createdAt - a.createdAt)
  }, [stackTasks])

  const handleStartStacking = () => {
    if (goodFrames.length < 3) return

    const name = taskName.trim() || `叠加任务 - ${new Date().toLocaleString('zh-CN')}`
    const result = startStacking(
      goodFrames.map(f => f.id),
      name
    )

    if ((result as any).error) {
      alert((result as any).error)
    } else {
      setShowStartDialog(false)
      setTaskName('')
    }
  }

  return (
    <div className="h-full flex flex-col bg-space-deep border-t border-space-panel">
      <div className="px-4 py-3 border-b border-space-panel flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo size={18} className="text-signal-green" />
          <h2 className="text-base font-semibold text-white">任务队列</h2>
          <span className="text-xs text-gray-400">
            {sortedTasks.length} 个任务
            {activeWorkers > 0 && (
              <span className="ml-2 text-signal-green">· {activeWorkers} 运行中</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {sortedTasks.some(t => t.status === 'completed' || t.status === 'error') && (
            <button
              onClick={clearCompletedTasks}
              className="text-xs px-2 py-1 text-gray-400 hover:text-white hover:bg-space-panel rounded transition-colors"
            >
              清除已完成
            </button>
          )}
          <button
            onClick={() => setShowStartDialog(true)}
            disabled={goodFrames.length < 3}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              goodFrames.length >= 3
                ? 'bg-signal-green text-white hover:bg-signal-green/80'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Play size={14} />
            开始叠加
            <span className="text-xs opacity-70">({goodFrames.length}帧)</span>
          </button>
        </div>
      </div>

      {showStartDialog && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-space-deep border border-space-panel rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Settings size={18} className="text-signal-green" />
              开始叠加任务
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">任务名称</label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder={`叠加任务 - ${new Date().toLocaleString('zh-CN')}`}
                  className="w-full bg-space-panel border border-space-panel/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-signal-green"
                />
              </div>

              <div className="bg-space-panel/30 rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-2">任务摘要</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-gray-400">待叠加帧数</div>
                  <div className="text-white">{goodFrames.length} 帧</div>
                  <div className="text-gray-400">已剔除帧数</div>
                  <div className="text-alert-orange">{filteredFrames.length - goodFrames.length} 帧</div>
                  <div className="text-gray-400">叠加模式</div>
                  <div className="text-white">Sigma-clip</div>
                  <div className="text-gray-400">参考帧</div>
                  <div className="text-white">自动选择</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowStartDialog(false)}
                  className="flex-1 px-4 py-2 bg-space-panel text-gray-300 rounded-lg hover:bg-space-panel/80 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleStartStacking}
                  className="flex-1 px-4 py-2 bg-signal-green text-white rounded-lg hover:bg-signal-green/80 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Play size={14} />
                  开始处理
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sortedTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <ListTodo size={40} className="mb-2 opacity-50" />
            <p className="text-sm">暂无任务</p>
            <p className="text-xs mt-1">选择帧并点击"开始叠加"创建任务</p>
          </div>
        ) : (
          sortedTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onCancel={cancelStacking}
              onRetry={retryTask}
              onRemove={removeStackTask}
              onView={setSelectedStackResult}
              isSelected={selectedStackResultId === task.id}
            />
          ))
        )}
      </div>
    </div>
  )
}
