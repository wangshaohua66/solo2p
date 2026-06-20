import { useMemo } from 'react'
import {
  LineChart,
  Activity,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Eye
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useObservationStore } from '@/stores/observationStore'
import { formatSNR } from '@/utils/fitsUtils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
)

interface SNRChartProps {
  snrHistory: number[]
  isProcessing: boolean
}

const SNRChart = ({ snrHistory, isProcessing }: SNRChartProps) => {
  const chartData = useMemo(() => {
    const labels = snrHistory.map((_, i) => `${i + 1}帧`)
    return {
      labels,
      datasets: [
        {
          label: '信噪比 (σ)',
          data: snrHistory,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: snrHistory.length <= 20 ? 4 : 2,
          pointHoverRadius: 6,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#0a0e17',
          pointBorderWidth: 2
        }
      ]
    }
  }, [snrHistory])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: isProcessing ? 300 : 0
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#1e3a5f',
        titleColor: '#fff',
        bodyColor: '#d1d5db',
        borderColor: '#3b82f6',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          title: (items: any[]) => items[0].label,
          label: (item: any) => `SNR: ${formatSNR(item.raw)}`
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)'
        },
        ticks: {
          color: '#9ca3af',
          font: { size: 10 },
          maxTicksLimit: 8
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)'
        },
        ticks: {
          color: '#9ca3af',
          font: { size: 10 }
        },
        title: {
          display: true,
          text: '信噪比 (σ)',
          color: '#9ca3af',
          font: { size: 10 }
        }
      }
    }
  }

  return <Line data={chartData} options={options as any} />
}

interface ProgressStatsProps {
  taskId: string
}

const ProgressStats = ({ taskId }: ProgressStatsProps) => {
  const task = useObservationStore(state =>
    state.stackTasks.find(t => t.id === taskId)
  )

  if (!task) return null

  const currentSNR = task.snrHistory.length > 0
    ? task.snrHistory[task.snrHistory.length - 1]
    : 0

  const snrImprovement = task.snrHistory.length >= 2
    ? ((currentSNR - task.snrHistory[0]) / task.snrHistory[0] * 100)
    : 0

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-space-panel/30 rounded-lg p-3">
        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
          <Layers size={12} />
          已叠加帧数
        </div>
        <div className="text-2xl font-bold text-white">
          {task.currentFrame}
          <span className="text-sm text-gray-400 font-normal"> / {task.totalFrames}</span>
        </div>
      </div>

      <div className="bg-space-panel/30 rounded-lg p-3">
        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
          <Activity size={12} />
          当前信噪比
        </div>
        <div className="text-2xl font-bold text-signal-green">
          {formatSNR(currentSNR)}
        </div>
      </div>

      <div className="bg-space-panel/30 rounded-lg p-3">
        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
          <TrendingUp size={12} />
          SNR提升
        </div>
        <div className={`text-xl font-bold ${snrImprovement >= 0 ? 'text-signal-green' : 'text-red-500'}`}>
          {snrImprovement >= 0 ? '+' : ''}{snrImprovement.toFixed(1)}%
        </div>
      </div>

      <div className="bg-space-panel/30 rounded-lg p-3">
        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
          <XCircle size={12} />
          已剔除帧数
        </div>
        <div className="text-2xl font-bold text-alert-orange">
          {task.result?.rejectedCount || 0}
        </div>
      </div>
    </div>
  )
}

interface ProcessingStepsProps {
  taskId: string
}

const ProcessingSteps = ({ taskId }: ProcessingStepsProps) => {
  const task = useObservationStore(state =>
    state.stackTasks.find(t => t.id === taskId)
  )

  if (!task) return null

  const steps = [
    { key: 'calibration', label: '校准处理', icon: CheckCircle2 },
    { key: 'star_detection', label: '星点检测', icon: Activity },
    { key: 'alignment', label: '图像对齐', icon: Layers },
    { key: 'stacking', label: '图像叠加', icon: TrendingUp }
  ]

  const getStepStatus = (stepKey: string) => {
    const currentStep = task.currentStep
    const stepOrder = ['calibration', 'star_detection', 'alignment', 'stacking']
    const currentIndex = stepOrder.findIndex(s => currentStep.includes(s))
    const stepIndex = stepOrder.indexOf(stepKey)

    if (task.status === 'completed') return 'completed'
    if (task.status === 'error') return stepIndex <= currentIndex ? 'error' : 'pending'
    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'processing'
    return 'pending'
  }

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => {
        const status = getStepStatus(step.key)
        const statusColor = {
          pending: 'text-gray-500',
          processing: 'text-signal-green animate-pulse',
          completed: 'text-signal-green',
          error: 'text-red-500'
        }[status]

        const Icon = step.icon

        return (
          <div key={step.key} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              status === 'processing' ? 'bg-signal-green/20' :
              status === 'completed' ? 'bg-signal-green/20' :
              status === 'error' ? 'bg-red-500/20' : 'bg-gray-700/50'
            }`}>
              <Icon size={14} className={statusColor} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={`text-sm ${status === 'pending' ? 'text-gray-500' : 'text-white'}`}>
                  {step.label}
                </span>
                {status === 'processing' && (
                  <span className="text-xs text-signal-green">{task.currentStep}</span>
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className={`h-4 w-0.5 ml-4 mt-1 ${
                  status === 'completed' ? 'bg-signal-green' : 'bg-gray-700'
                }`} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const StackPreview = () => {
  const { stackTasks, selectedStackResultId, setSelectedStackResult } = useObservationStore()

  const activeTask = stackTasks.find(t =>
    t.status === 'processing' || t.status === 'queued' ||
    (selectedStackResultId && t.id === selectedStackResultId)
  ) || stackTasks[stackTasks.length - 1]

  const hasActiveProcessing = stackTasks.some(t => t.status === 'processing')

  if (!activeTask) {
    return (
      <div className="h-full flex flex-col bg-space-deep">
        <div className="p-4 border-b border-space-panel">
          <div className="flex items-center gap-2 mb-1">
            <LineChart size={18} className="text-signal-green" />
            <h2 className="text-lg font-semibold text-white">叠加预览</h2>
          </div>
          <p className="text-xs text-gray-400">实时监控叠加进度与信噪比变化</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <Eye size={48} className="mb-3 opacity-50" />
          <p className="text-sm">暂无叠加任务</p>
          <p className="text-xs mt-1">选择帧并开始叠加任务</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-space-deep">
      <div className="p-4 border-b border-space-panel">
        <div className="flex items-center gap-2 mb-1">
          <LineChart size={18} className="text-signal-green" />
          <h2 className="text-lg font-semibold text-white">叠加预览</h2>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
            activeTask.status === 'processing' ? 'bg-signal-green/20 text-signal-green animate-pulse' :
            activeTask.status === 'completed' ? 'bg-signal-green/20 text-signal-green' :
            activeTask.status === 'error' ? 'bg-red-500/20 text-red-500' :
            'bg-gray-700 text-gray-400'
          }`}>
            {activeTask.status === 'processing' ? '处理中' :
             activeTask.status === 'completed' ? '已完成' :
             activeTask.status === 'error' ? '错误' : '排队中'}
          </span>
        </div>
        <p className="text-xs text-gray-400">{activeTask.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {stackTasks.length > 1 && (
          <div>
            <h3 className="text-xs text-gray-400 mb-2">选择任务</h3>
            <select
              value={activeTask.id}
              onChange={(e) => setSelectedStackResult(e.target.value)}
              className="w-full bg-space-panel border border-space-panel/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-signal-green"
            >
              {stackTasks.map(task => (
                <option key={task.id} value={task.id}>
                  {task.name} ({task.status === 'completed' ? '已完成' : task.status})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
            <TrendingUp size={14} className="text-signal-green" />
            信噪比曲线
          </h3>
          <div className="bg-space-panel/30 rounded-lg p-3 h-48">
            {activeTask.snrHistory.length > 0 ? (
              <SNRChart
                snrHistory={activeTask.snrHistory}
                isProcessing={hasActiveProcessing}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                <Activity size={20} className="mr-2 animate-pulse" />
                等待数据...
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
            <Layers size={14} className="text-signal-green" />
            进度统计
          </h3>
          <ProgressStats taskId={activeTask.id} />
        </div>

        <div>
          <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
            <Clock size={14} className="text-signal-green" />
            处理步骤
          </h3>
          <div className="bg-space-panel/30 rounded-lg p-3">
            <ProcessingSteps taskId={activeTask.id} />
          </div>
        </div>

        {activeTask.result && activeTask.status === 'completed' && (
          <div className="bg-signal-green/10 border border-signal-green/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={18} className="text-signal-green" />
              <span className="font-medium text-white">叠加完成</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-gray-400">最终信噪比</div>
              <div className="text-signal-green font-medium">{formatSNR(activeTask.result.snr)}</div>
              <div className="text-gray-400">成功叠加</div>
              <div className="text-white">{activeTask.result.stackedCount} 帧</div>
              <div className="text-gray-400">剔除帧数</div>
              <div className="text-alert-orange">{activeTask.result.rejectedCount} 帧</div>
              <div className="text-gray-400">平均FWHM</div>
              <div className="text-white">{activeTask.result.meanFwhm.toFixed(2)} px</div>
            </div>
          </div>
        )}

        {activeTask.error && activeTask.status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={18} className="text-red-500" />
              <span className="font-medium text-white">处理错误</span>
            </div>
            <p className="text-sm text-red-400">{activeTask.error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
