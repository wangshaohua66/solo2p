import { onMounted, onBeforeUnmount } from 'vue'

export type ShortcutHandler = (e: KeyboardEvent) => void

interface Shortcut {
  combo: string
  handler: ShortcutHandler
  preventDefault?: boolean
  stopPropagation?: boolean
  priority?: number
}

function parseCombo(combo: string): { keys: Set<string>; description: string } {
  const parts = combo.toLowerCase().split('+').map(s => s.trim())
  const keys = new Set(parts)
  return { keys, description: combo }
}

function eventMatches(e: KeyboardEvent, combo: string): boolean {
  const { keys } = parseCombo(combo)
  if (keys.has('ctrl') !== e.ctrlKey && !e.metaKey) return false
  if (keys.has('ctrl') && !(e.ctrlKey || e.metaKey)) return false
  if (keys.has('cmd') !== e.metaKey) return false
  if (keys.has('alt') !== e.altKey) return false
  if (keys.has('shift') !== e.shiftKey) return false

  const mainKeys = Array.from(keys).filter(k => !['ctrl', 'cmd', 'alt', 'shift', 'meta'].includes(k))
  if (mainKeys.length === 0) return false

  const eventKey = e.key.toLowerCase()
  return mainKeys.some(k => {
    if (k === 'f1') return e.key === 'F1'
    if (k === 'f2') return e.key === 'F2'
    if (k === 'f5') return e.key === 'F5'
    if (k === 'f8') return e.key === 'F8'
    if (k === 'f10') return e.key === 'F10'
    if (k === 'f11') return e.key === 'F11'
    if (k === 'escape' || k === 'esc') return e.key === 'Escape'
    if (k === 'enter') return e.key === 'Enter'
    if (k === 'space') return e.key === ' '
    if (k === 'arrowup') return e.key === 'ArrowUp'
    if (k === 'arrowdown') return e.key === 'ArrowDown'
    if (k === 'arrowleft') return e.key === 'ArrowLeft'
    if (k === 'arrowright') return e.key === 'ArrowRight'
    return eventKey === k
  })
}

export function useShortcuts() {
  const shortcuts: Shortcut[] = []

  function register(
    combo: string,
    handler: ShortcutHandler,
    options: Omit<Shortcut, 'combo' | 'handler'> = {}
  ): () => void {
    const shortcut: Shortcut = {
      combo,
      handler,
      priority: 0,
      ...options
    }
    shortcuts.push(shortcut)
    shortcuts.sort((a, b) => (b.priority || 0) - (a.priority || 0))
    return () => {
      const idx = shortcuts.indexOf(shortcut)
      if (idx >= 0) shortcuts.splice(idx, 1)
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    for (const sc of shortcuts) {
      if (eventMatches(e, sc.combo)) {
        if (sc.preventDefault) e.preventDefault()
        if (sc.stopPropagation) e.stopPropagation()
        try { sc.handler(e) } catch (err) { console.warn(err) }
        return
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown, true)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown, true)
    shortcuts.length = 0
  })

  return { register }
}
