import { defineStore } from 'pinia'
import { THEMES, type ThemeName } from '@/types'
import { STORAGE_KEYS, getLocalStorage, setLocalStorage } from '@/utils/storage'

interface ThemeState {
  currentTheme: ThemeName
  fontSize: number
  sidebarWidth: number
  consoleOpen: boolean
  sidebarOpen: boolean
  presentationMode: boolean
  fullscreen: boolean
}

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    currentTheme: getLocalStorage<ThemeName>(STORAGE_KEYS.THEME, 'dark'),
    fontSize: getLocalStorage<number>(STORAGE_KEYS.FONT_SIZE, 14),
    sidebarWidth: getLocalStorage<number>(STORAGE_KEYS.SIDEBAR_WIDTH, 240),
    consoleOpen: getLocalStorage<boolean>(STORAGE_KEYS.CONSOLE_OPEN, true),
    sidebarOpen: getLocalStorage<boolean>(STORAGE_KEYS.SIDEBAR_OPEN, true),
    presentationMode: false,
    fullscreen: false
  }),

  getters: {
    themeConfig: (state) => THEMES[state.currentTheme],
    monacoTheme: (state) => THEMES[state.currentTheme].monacoTheme,
    cssVars: (state) => {
      const t = THEMES[state.currentTheme].colors
      return {
        '--bg-primary': t.bgPrimary,
        '--bg-secondary': t.bgSecondary,
        '--bg-tertiary': t.bgTertiary,
        '--text-primary': t.textPrimary,
        '--text-secondary': t.textSecondary,
        '--border-color': t.border,
        '--accent-color': t.accent,
        '--line-highlight': t.lineHighlight,
        '--breakpoint-color': t.breakpoint,
        '--sidebar-width': `${state.sidebarWidth}px`
      }
    }
  },

  actions: {
    setTheme(theme: ThemeName) {
      this.currentTheme = theme
      setLocalStorage(STORAGE_KEYS.THEME, theme)
      this.applyThemeClass()
    },
    cycleTheme() {
      const order: ThemeName[] = ['dark', 'light', 'high-contrast']
      const idx = order.indexOf(this.currentTheme)
      this.setTheme(order[(idx + 1) % order.length])
    },
    setFontSize(size: number) {
      this.fontSize = Math.min(Math.max(size, 10), 28)
      setLocalStorage(STORAGE_KEYS.FONT_SIZE, this.fontSize)
    },
    increaseFontSize() {
      this.setFontSize(this.fontSize + 1)
    },
    decreaseFontSize() {
      this.setFontSize(this.fontSize - 1)
    },
    setSidebarWidth(width: number) {
      this.sidebarWidth = Math.min(Math.max(width, 180), 400)
      setLocalStorage(STORAGE_KEYS.SIDEBAR_WIDTH, this.sidebarWidth)
    },
    toggleConsole() {
      this.consoleOpen = !this.consoleOpen
      setLocalStorage(STORAGE_KEYS.CONSOLE_OPEN, this.consoleOpen)
    },
    setConsoleOpen(open: boolean) {
      this.consoleOpen = open
      setLocalStorage(STORAGE_KEYS.CONSOLE_OPEN, this.consoleOpen)
    },
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
      setLocalStorage(STORAGE_KEYS.SIDEBAR_OPEN, this.sidebarOpen)
    },
    setSidebarOpen(open: boolean) {
      this.sidebarOpen = open
      setLocalStorage(STORAGE_KEYS.SIDEBAR_OPEN, this.sidebarOpen)
    },
    async enterPresentationMode() {
      this.presentationMode = true
      try {
        await document.documentElement.requestFullscreen()
        this.fullscreen = true
      } catch {
        this.fullscreen = false
      }
    },
    async exitPresentationMode() {
      this.presentationMode = false
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen()
        } catch { /* ignore */ }
      }
      this.fullscreen = false
    },
    togglePresentationMode() {
      if (this.presentationMode) {
        this.exitPresentationMode()
      } else {
        this.enterPresentationMode()
      }
    },
    applyThemeClass() {
      const root = document.documentElement
      root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast')
      if (this.currentTheme !== 'dark') {
        root.classList.add(`theme-${this.currentTheme}`)
      }
      const vars = this.cssVars
      Object.keys(vars).forEach(key => {
        root.style.setProperty(key, (vars as Record<string, string>)[key])
      })
    }
  }
})
