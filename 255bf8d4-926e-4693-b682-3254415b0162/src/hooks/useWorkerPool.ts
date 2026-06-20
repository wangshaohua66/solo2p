import { useState, useEffect, useRef, useCallback } from 'react'
import type { WorkerProgress, StackResult } from '@/core/types'

type WorkerType = 'stacking' | 'calibration' | 'starDetection'

interface WorkerPoolItem {
  worker: Worker
  type: WorkerType
  isBusy: boolean
  currentTaskId: string | null
}

interface TaskQueueItem {
  id: string
  type: WorkerType
  payload: any
  onProgress?: (progress: WorkerProgress) => void
  onComplete?: (result: any) => void
  onError?: (error: string) => void
}

export const useWorkerPool = (maxWorkers: number = 3) => {
  const [activeTasks, setActiveTasks] = useState<number>(0)
  const [isInitialized, setIsInitialized] = useState(false)
  const poolRef = useRef<Map<WorkerType, WorkerPoolItem[]>>(new Map())
  const queueRef = useRef<TaskQueueItem[]>([])
  const callbacksRef = useRef<Map<string, TaskQueueItem>>(new Map())

  const createWorker = useCallback((type: WorkerType): Worker => {
    let worker: Worker

    switch (type) {
      case 'stacking':
        worker = new Worker(new URL('@/workers/stacking.worker.ts', import.meta.url), {
          type: 'module'
        })
        break
      case 'calibration':
        worker = new Worker(new URL('@/workers/calibration.worker.ts', import.meta.url), {
          type: 'module'
        })
        break
      case 'starDetection':
        worker = new Worker(new URL('@/workers/starDetection.worker.ts', import.meta.url), {
          type: 'module'
        })
        break
      default:
        throw new Error(`Unknown worker type: ${type}`)
    }

    return worker
  }, [])

  const initializePool = useCallback(() => {
    if (isInitialized) return

    const types: WorkerType[] = ['stacking', 'calibration', 'starDetection']
    for (const type of types) {
      const workers: WorkerPoolItem[] = []
      for (let i = 0; i < (type === 'stacking' ? 1 : maxWorkers); i++) {
        const worker = createWorker(type)
        worker.onmessage = (e) => handleWorkerMessage(type, worker, e)
        worker.onerror = (e) => handleWorkerError(type, worker, e)
        workers.push({ worker, type, isBusy: false, currentTaskId: null })
      }
      poolRef.current.set(type, workers)
    }

    setIsInitialized(true)
  }, [isInitialized, maxWorkers, createWorker])

  const handleWorkerMessage = useCallback((type: WorkerType, worker: Worker, e: MessageEvent) => {
    const { type: msgType, payload } = e.data

    const poolItem = poolRef.current.get(type)?.find(p => p.worker === worker)
    if (!poolItem) return

    const taskId = poolItem.currentTaskId
    if (!taskId) return

    const callbacks = callbacksRef.current.get(taskId)
    if (!callbacks) return

    switch (msgType) {
      case 'progress':
        callbacks.onProgress?.(payload)
        break
      case 'result':
        poolItem.isBusy = false
        poolItem.currentTaskId = null
        callbacks.onComplete?.(payload.result)
        callbacksRef.current.delete(taskId)
        setActiveTasks(prev => prev - 1)
        processQueue()
        break
      case 'error':
        poolItem.isBusy = false
        poolItem.currentTaskId = null
        callbacks.onError?.(payload.error)
        callbacksRef.current.delete(taskId)
        setActiveTasks(prev => prev - 1)
        processQueue()
        break
      case 'cancelled':
        poolItem.isBusy = false
        poolItem.currentTaskId = null
        callbacksRef.current.delete(taskId)
        setActiveTasks(prev => prev - 1)
        processQueue()
        break
    }
  }, [])

  const handleWorkerError = useCallback((type: WorkerType, worker: Worker, e: ErrorEvent) => {
    console.error(`Worker error (${type}):`, e.error)

    const poolItem = poolRef.current.get(type)?.find(p => p.worker === worker)
    if (poolItem?.currentTaskId) {
      const callbacks = callbacksRef.current.get(poolItem.currentTaskId)
      callbacks?.onError?.(e.message)
      callbacksRef.current.delete(poolItem.currentTaskId)
      setActiveTasks(prev => prev - 1)
    }

    poolItem!.isBusy = false
    poolItem!.currentTaskId = null
    processQueue()
  }, [])

  const processQueue = useCallback(() => {
    const queue = queueRef.current
    if (queue.length === 0) return

    const pool = poolRef.current
    for (let i = queue.length - 1; i >= 0; i--) {
      const task = queue[i]
      const workers = pool.get(task.type)
      const availableWorker = workers?.find(w => !w.isBusy)

      if (availableWorker) {
        queue.splice(i, 1)
        availableWorker.isBusy = true
        availableWorker.currentTaskId = task.id
        callbacksRef.current.set(task.id, task)

        const msgType = task.type === 'stacking' ? 'start' :
                        task.type === 'calibration' ? 'calibrate' : 'detect'

        availableWorker.worker.postMessage({
          type: msgType,
          payload: task.payload,
          taskId: task.id
        })

        setActiveTasks(prev => prev + 1)
      }
    }
  }, [])

  const submitTask = useCallback((
    type: WorkerType,
    payload: any,
    callbacks?: {
      onProgress?: (progress: WorkerProgress) => void
      onComplete?: (result: any) => void
      onError?: (error: string) => void
    }
  ): string => {
    if (!isInitialized) {
      initializePool()
    }

    const taskId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const task: TaskQueueItem = {
      id: taskId,
      type,
      payload,
      onProgress: callbacks?.onProgress,
      onComplete: callbacks?.onComplete,
      onError: callbacks?.onError
    }

    queueRef.current.push(task)
    processQueue()

    return taskId
  }, [isInitialized, initializePool, processQueue])

  const cancelTask = useCallback((taskId: string) => {
    const task = callbacksRef.current.get(taskId)
    if (!task) return

    for (const [, workers] of poolRef.current) {
      const worker = workers.find(w => w.currentTaskId === taskId)
      if (worker) {
        worker.worker.postMessage({ type: 'cancel', taskId })
        break
      }
    }

    const queueIndex = queueRef.current.findIndex(t => t.id === taskId)
    if (queueIndex >= 0) {
      queueRef.current.splice(queueIndex, 1)
    }

    callbacksRef.current.delete(taskId)
  }, [])

  const terminatePool = useCallback(() => {
    for (const [, workers] of poolRef.current) {
      for (const item of workers) {
        item.worker.terminate()
      }
    }
    poolRef.current.clear()
    queueRef.current = []
    callbacksRef.current.clear()
    setActiveTasks(0)
    setIsInitialized(false)
  }, [])

  useEffect(() => {
    return () => {
      terminatePool()
    }
  }, [terminatePool])

  return {
    isInitialized,
    activeTasks,
    submitTask,
    cancelTask,
    terminatePool,
    initializePool
  }
}
