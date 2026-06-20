import { useCallback, useRef } from 'react'
import { useObservationStore } from '@/stores/observationStore'
import { useWorkerPool } from './useWorkerPool'
import type { FitsFrame, WorkerProgress, StackTask } from '@/core/types'
import { generateId } from '@/utils/fitsUtils'

export const useStackingWorkflow = () => {
  const {
    frames,
    darkFrames,
    flatFrames,
    refFrameId,
    calibrationSettings,
    alignmentSettings,
    stackingSettings,
    addStackTask,
    updateStackTask,
    setSelectedStackResult
  } = useObservationStore()

  const { submitTask, cancelTask } = useWorkerPool(2)
  const activeWorkersRef = useRef<Map<string, string>>(new Map())

  const startStacking = useCallback((frameIds: string[], name?: string) => {
    const selectedFrames = frameIds
      .map(id => frames.find(f => f.id === id))
      .filter(Boolean) as FitsFrame[]

    if (selectedFrames.length < 3) {
      return { error: '至少需要3帧才能进行叠加' }
    }

    const refFrame = refFrameId
      ? frames.find(f => f.id === refFrameId)
      : selectedFrames[0]

    if (!refFrame) {
      return { error: '未找到参考帧' }
    }

    const taskName = name || `叠加任务 - ${new Date().toLocaleString()}`

    const taskId = addStackTask({
      name: taskName,
      frameIds,
      totalFrames: selectedFrames.length,
      calibrationSettings,
      alignmentSettings,
      stackingSettings
    }) as unknown as string

    updateStackTask(taskId, {
      status: 'processing',
      startedAt: Date.now(),
      currentStep: '初始化处理队列'
    })

    const workerTaskId = submitTask('stacking', {
      taskId,
      frameIds,
      frames: selectedFrames.map(f => ({ ...f })),
      refFrame: { ...refFrame },
      darkFrames,
      flatFrames,
      calibrationSettings,
      alignmentSettings,
      stackingSettings
    }, {
      onProgress: (progress: WorkerProgress) => {
        const snrHistory = progress.snr !== undefined
          ? [...(useObservationStore.getState().stackTasks.find(t => t.id === taskId)?.snrHistory || []), progress.snr]
          : undefined

        updateStackTask(taskId, {
          progress: progress.progress,
          currentStep: progress.step,
          currentFrame: progress.frameIndex || 0,
          snrHistory
        })
      },
      onComplete: (result) => {
        updateStackTask(taskId, {
          status: 'completed',
          progress: 1.0,
          currentStep: '处理完成',
          completedAt: Date.now(),
          result: {
            ...result,
            snrHistory: useObservationStore.getState().stackTasks.find(t => t.id === taskId)?.snrHistory || []
          }
        })
        setSelectedStackResult(taskId)
        activeWorkersRef.current.delete(taskId)
      },
      onError: (error) => {
        updateStackTask(taskId, {
          status: 'error',
          currentStep: '处理失败',
          error,
          completedAt: Date.now()
        })
        activeWorkersRef.current.delete(taskId)
      }
    })

    activeWorkersRef.current.set(taskId, workerTaskId)

    return { taskId }
  }, [frames, darkFrames, flatFrames, refFrameId, calibrationSettings, alignmentSettings, stackingSettings, addStackTask, updateStackTask, setSelectedStackResult, submitTask])

  const cancelStacking = useCallback((taskId: string) => {
    const workerTaskId = activeWorkersRef.current.get(taskId)
    if (workerTaskId) {
      cancelTask(workerTaskId)
      activeWorkersRef.current.delete(taskId)
    }

    updateStackTask(taskId, {
      status: 'error',
      currentStep: '已取消',
      error: '用户取消操作',
      completedAt: Date.now()
    })
  }, [cancelTask, updateStackTask])

  const startBatchProcessing = useCallback((groups: Array<{ name: string; frameIds: string[] }>) => {
    const results: Array<{ taskId: string; error?: string }> = []

    for (const group of groups) {
      const result = startStacking(group.frameIds, group.name)
      results.push(result as any)
    }

    return results
  }, [startStacking])

  const retryTask = useCallback((taskId: string) => {
    const task = useObservationStore.getState().stackTasks.find(t => t.id === taskId)
    if (!task) return { error: '未找到任务' }

    return startStacking(task.frameIds, `重试 - ${task.name}`)
  }, [startStacking])

  return {
    startStacking,
    cancelStacking,
    startBatchProcessing,
    retryTask,
    activeWorkers: activeWorkersRef.current.size
  }
}
