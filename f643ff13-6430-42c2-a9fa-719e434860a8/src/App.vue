<template>
  <div class="app-container" :class="{ 'projection-mode': isProjectionMode, [themeClass]: true }">
    <Toolbar />

    <div class="main-content">
      <aside class="left-panel" v-if="currentView === 'transcript'">
        <QuickPhrases @insert="insertPhrase" />
      </aside>

      <main class="content-area">
        <div class="search-bar-wrapper" v-if="currentView === 'transcript'">
          <SearchBar @search="handleSearch" @clear="handleSearchClear" />
        </div>

        <div class="view-container" :class="{ 'has-timeline': true }">
          <router-view v-slot="{ Component }">
            <component :is="Component"
                       v-if="!isMainView"
                       @jumpToTranscript="handleJumpToTranscript"
                       @jumpToEvidence="handleJumpToEvidence" />
            <LiveTranscript v-else
                            ref="liveTranscriptRef"
                            @jumpToEvidence="handleJumpToEvidence" />
          </router-view>
        </div>
      </main>

      <aside class="right-panel" v-if="currentView === 'transcript'">
        <div class="panel-tabs">
          <div class="tab-item" :class="{ active: rightPanelTab === 'evidence' }" @click="rightPanelTab = 'evidence'">
            📎 证据
          </div>
          <div class="tab-item" :class="{ active: rightPanelTab === 'annotation' }" @click="rightPanelTab = 'annotation'">
            📝 标注
          </div>
        </div>
        <div class="panel-content">
          <EvidenceManager v-if="rightPanelTab === 'evidence'" :compact="true" />
          <AnnotationPanel v-else :compact="true" @jumpToTranscript="handleJumpToTranscript" @jumpToEvidence="handleJumpToEvidence" />
        </div>
      </aside>
    </div>

    <TimelineView @timeChange="handleTimeChange" @eventClick="handleEventClick" @selectionChange="handleSelectionChange" />

    <div class="loading-overlay" v-if="isLoading">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">正在加载数据...</div>
      </div>
    </div>

    <div class="toast-container" v-if="toast.show">
      <div class="toast" :class="toast.type">
        <span class="toast-icon">{{ getToastIcon() }}</span>
        <span class="toast-message">{{ toast.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, provide } from 'vue'
import { useRoute } from 'vue-router'
import Toolbar from '@/components/Toolbar.vue'
import QuickPhrases from '@/components/QuickPhrases.vue'
import SearchBar from '@/components/SearchBar.vue'
import TimelineView from '@/views/TimelineView.vue'
import EvidenceManager from '@/views/EvidenceManager.vue'
import AnnotationPanel from '@/views/AnnotationPanel.vue'
import LiveTranscript from '@/views/LiveTranscript.vue'
import { useTranscriptStore } from '@/stores/transcriptStore'
import { useEvidenceStore } from '@/stores/evidenceStore'
import { useTimeSync } from '@/composables/useTimeSync'
import type { TimelineEvent } from '@/types'

const route = useRoute()
const transcriptStore = useTranscriptStore()
const evidenceStore = useEvidenceStore()
const { jumpToTime } = useTimeSync()

const liveTranscriptRef = ref<InstanceType<typeof LiveTranscript> | null>(null)
const isLoading = ref(true)
const rightPanelTab = ref<'evidence' | 'annotation'>('evidence')

const toast = ref({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error' | 'info'
})

const currentView = computed(() => route.name?.toString().toLowerCase() || 'transcript')
const isMainView = computed(() => currentView.value === 'transcript')
const isProjectionMode = computed(() => transcriptStore.settings.projectionMode)
const themeClass = computed(() => `theme-${transcriptStore.settings.theme}`)

const getToastIcon = () => {
  const icons: Record<string, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  }
  return icons[toast.value.type] || 'ℹ'
}

const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

provide('showToast', showToast)

const handleSearch = (query: string) => {
  transcriptStore.searchTranscripts(query)
}

const handleSearchClear = () => {
  transcriptStore.searchTranscripts('')
}

const insertPhrase = (phrase: string) => {
  if (liveTranscriptRef.value) {
    liveTranscriptRef.value.insertPhrase(phrase)
  }
}

const handleJumpToTranscript = (id: string) => {
  transcriptStore.jumpToTranscript(id)
  if (liveTranscriptRef.value) {
    liveTranscriptRef.value.scrollToTranscript(id)
  }
}

const handleJumpToEvidence = (id: string) => {
  evidenceStore.selectEvidence(id)
  rightPanelTab.value = 'evidence'
}

const handleTimeChange = (time: number) => {
  jumpToTime(time)
}

const handleEventClick = (event: TimelineEvent) => {
  if (event.type === 'transcript') {
    handleJumpToTranscript(event.refId)
  } else if (event.type === 'evidence') {
    handleJumpToEvidence(event.refId)
  }
}

const handleSelectionChange = (start: number, end: number) => {
  showToast(`已选择时间段：${Math.round((end - start) / 1000)}秒`, 'info')
}

const initApp = async () => {
  try {
    await transcriptStore.loadFromStorage()
    await evidenceStore.loadFromStorage()
  } catch (error) {
    console.error('Failed to load data:', error)
    showToast('数据加载失败，部分功能可能不可用', 'error')
  } finally {
    setTimeout(() => {
      isLoading.value = false
    }, 500)
  }
}

onMounted(() => {
  initApp()
})

watch(
  () => transcriptStore.settings.theme,
  (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
  },
  { immediate: true }
)

watch(
  () => transcriptStore.settings.projectionMode,
  (isProjection) => {
    if (isProjection) {
      showToast('已进入投影模式，敏感信息已隐藏', 'info')
    }
  }
)
</script>

<style scoped lang="scss">
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  overflow: hidden;

  &.projection-mode {
    --text-secondary: rgba(255, 255, 255, 0.7);
    --border-color: rgba(255, 255, 255, 0.1);

    .sensitive-info {
      filter: blur(4px);
      pointer-events: none;
    }
  }
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel {
  width: 220px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  overflow: hidden;
  flex-shrink: 0;
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-bar-wrapper {
  padding: 12px 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.view-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.right-panel {
  width: 380px;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;

  .panel-tabs {
    display: flex;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);

    .tab-item {
      flex: 1;
      padding: 12px;
      text-align: center;
      font-size: 13px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
      border-bottom: 2px solid transparent;

      &:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
      }

      &.active {
        color: var(--accent-primary);
        border-bottom-color: var(--accent-primary);
        font-weight: 500;
      }
    }
  }

  .panel-content {
    flex: 1;
    overflow: hidden;
  }
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;

  .loading-content {
    text-align: center;
    color: white;

    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: var(--accent-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    .loading-text {
      font-size: 14px;
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.toast-container {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  animation: slideDown 0.3s ease;

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

    &.success {
      background: #065f46;
      color: #d1fae5;
    }

    &.error {
      background: #991b1b;
      color: #fee2e2;
    }

    &.info {
      background: #1e40af;
      color: #dbeafe;
    }

    .toast-icon {
      font-weight: bold;
    }
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@media (max-width: 1200px) {
  .left-panel {
    width: 180px;
  }

  .right-panel {
    width: 320px;
  }
}

@media (max-width: 900px) {
  .left-panel {
    display: none;
  }

  .right-panel {
    display: none;
  }
}
</style>
