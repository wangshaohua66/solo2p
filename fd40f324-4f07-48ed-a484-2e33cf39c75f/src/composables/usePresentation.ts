import { watchEffect, onBeforeUnmount, type Ref } from 'vue'
import { useThemeStore } from '@/stores/theme'

export function usePresentation(containerRef: Ref<HTMLElement | null>) {
  const themeStore = useThemeStore()

  const onEnterHandlers: Array<() => void> = []
  const onExitHandlers: Array<() => void> = []

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
  }

  async function exit() {
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
      themeStore.presentationMode = false
      document.documentElement.classList.remove('presentation-mode')
      onExitHandlers.forEach(cb => cb())
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
    onEnterHandlers.length = 0
    onExitHandlers.length = 0
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
    isActive: () => themeStore.presentationMode
  }
}

export type PresentationAPI = ReturnType<typeof usePresentation>
