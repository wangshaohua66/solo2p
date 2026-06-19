import { ref, watchEffect, onBeforeUnmount, type Ref } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useOutputStore } from '@/stores/output'

const GPU_WARNING_THRESHOLD = 15
const FPS_SAMPLE_COUNT = 30

export function usePresentation(containerRef: Ref<HTMLElement | null>) {
  const themeStore = useThemeStore()
  const outputStore = useOutputStore()

  const onEnterHandlers: Array<() => void> = []
  const onExitHandlers: Array<() => void> = []
  const onGpuWarningHandlers: Array<(level: number) => void> = []

  const gpuLevel = ref(0)
  const isDegraded = ref(false)
  const fpsHistory: number[] = []
  let lastFrameTime = 0
  let rafId: number | null = null
  let fpsCheckTimer: ReturnType<typeof setInterval> | null = null

  function onEnter(cb: () => void): () => void {
    onEnterHandlers.push(cb)
    return () => {
      const idx = onEnterHandlers.indexOf(cb)
      if (idx >= 0) onEnterHandlers.splice(idx, 1)
    }
  }

  function onExit(cb: () => void): () => void {
    onExitHandlers.push(cb)
    return () => {
      const idx = onExitHandlers.indexOf(cb)
      if (idx >= 0) onExitHandlers.splice(idx, 1)
    }
  }

  function onGpuWarning(cb: (level: number) => void): () => void {
    onGpuWarningHandlers.push(cb)
    return () => {
      const idx = onGpuWarningHandlers.indexOf(cb)
      if (idx >= 0) onGpuWarningHandlers.splice(idx, 1)
    }
  }

  function trackFps() {
    const now = performance.now()
    if (lastFrameTime > 0) {
      const delta = now - lastFrameTime
      const fps = 1000 / delta
      fpsHistory.push(fps)
      if (fpsHistory.length > FPS_SAMPLE_COUNT) {
        fpsHistory.shift()
      }
    }
    lastFrameTime = now
    rafId = requestAnimationFrame(trackFps)
  }

  function estimateGpuUsage(): number {
    if (fpsHistory.length < 10) return 0
    const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length
    const minFps = Math.min(...fpsHistory)

    let usage = 0
    if (avgFps < 30) usage = 85
    else if (avgFps < 45) usage = 65
    else if (avgFps < 55) usage = 40
    else if (avgFps < 58) usage = 25
    else usage = 12

    if (minFps < 25) usage = Math.max(usage, 75)
    else if (minFps < 35) usage = Math.max(usage, 55)

    return Math.round(Math.min(95, Math.max(5, usage)))
  }

  function checkGpuLoad() {
    if (!themeStore.presentationMode) return

    const estimatedUsage = estimateGpuUsage()
    gpuLevel.value = estimatedUsage

    if (estimatedUsage > GPU_WARNING_THRESHOLD && !isDegraded.value) {
      triggerDegradation(estimatedUsage)
    } else if (estimatedUsage <= GPU_WARNING_THRESHOLD && isDegraded.value) {
      restoreFromDegradation()
    }

    if (estimatedUsage > GPU_WARNING_THRESHOLD) {
      onGpuWarningHandlers.forEach(cb => cb(estimatedUsage))
    }
  }

  function triggerDegradation(level: number) {
    isDegraded.value = true
    document.documentElement.classList.add('gpu-degraded')
    console.warn(
      `[CodeStage] GPU 占用警告: 估算约 ${level}%，超过 ${GPU_WARNING_THRESHOLD}% 阈值，已启用降级模式。`,
      '已关闭：模糊效果、阴影动画、GSAP 高级缓动'
    )
    outputStore.addLog('warn', [
      `GPU 性能警告: 占用率约 ${level}%，已自动启用降级模式以保证流畅度`
    ], 'presentation')
  }

  function restoreFromDegradation() {
    isDegraded.value = false
    document.documentElement.classList.remove('gpu-degraded')
    console.info('[CodeStage] GPU 负载已恢复正常，退出降级模式。')
  }

  function startGpuMonitoring() {
    fpsHistory.length = 0
    lastFrameTime = 0
    rafId = requestAnimationFrame(trackFps)
    fpsCheckTimer = setInterval(checkGpuLoad, 2000)
  }

  function stopGpuMonitoring() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (fpsCheckTimer !== null) {
      clearInterval(fpsCheckTimer)
      fpsCheckTimer = null
    }
    fpsHistory.length = 0
    if (isDegraded.value) {
      restoreFromDegradation()
    }
  }

  async function enter() {
    const el = containerRef.value
    if (el && !document.fullscreenElement) {
      try {
        await el.requestFullscreen()
      } catch { /* fallback to body */
        try { await document.documentElement.requestFullscreen() } catch { /* ignore */ }
      }
    }
    themeStore.presentationMode = true
    document.documentElement.classList.add('presentation-mode')
    onEnterHandlers.forEach(cb => cb())
    startGpuMonitoring()
  }

  async function exit() {
    stopGpuMonitoring()
    if (document.fullscreenElement) {
      try { await document.exitFullscreen() } catch { /* ignore */ }
    }
    themeStore.presentationMode = false
    document.documentElement.classList.remove('presentation-mode')
    onExitHandlers.forEach(cb => cb())
  }

  function toggle() {
    if (themeStore.presentationMode) exit()
    else enter()
  }

  function onFsChange() {
    if (!document.fullscreenElement && themeStore.presentationMode) {
      exit()
    }
  }

  const stopWatch = watchEffect(() => {
    if (themeStore.presentationMode) {
      document.documentElement.classList.add('presentation-mode')
    } else {
      document.documentElement.classList.remove('presentation-mode')
    }
  })

  document.addEventListener('fullscreenchange', onFsChange)

  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', onFsChange)
    stopWatch()
    stopGpuMonitoring()
    onEnterHandlers.length = 0
    onExitHandlers.length = 0
    onGpuWarningHandlers.length = 0
    if (themeStore.presentationMode) {
      themeStore.presentationMode = false
      document.documentElement.classList.remove('presentation-mode')
    }
  })

  return {
    enter,
    exit,
    toggle,
    onEnter,
    onExit,
    onGpuWarning,
    isActive: () => themeStore.presentationMode,
    gpuLevel,
    isDegraded
  }
}

export type PresentationAPI = ReturnType<typeof usePresentation>
