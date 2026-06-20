<template>
  <div class="export-center">
    <div class="export-header">
      <h2>
        <span class="icon">📦</span>
        庭审归档导出
      </h2>
      <p class="subtitle">生成完整案卷包，支持多种格式导出</p>
    </div>

    <div class="case-summary">
      <div class="summary-card">
        <div class="card-icon">📋</div>
        <div class="card-content">
          <div class="card-label">案件信息</div>
          <div class="card-value">{{ currentCase?.caseNumber || '未选择' }}</div>
          <div class="card-subtitle">{{ currentCase?.caseName || '' }}</div>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-icon">📝</div>
        <div class="card-content">
          <div class="card-label">笔录条目</div>
          <div class="card-value">{{ transcriptCount }} 条</div>
          <div class="card-subtitle">总字数：{{ totalWordCount }} 字</div>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-icon">🔖</div>
        <div class="card-content">
          <div class="card-label">标注数量</div>
          <div class="card-value">{{ annotationCount }} 条</div>
          <div class="card-subtitle">
            <span class="stat-item">争议: {{ disputeCount }}</span>
            <span class="stat-item">举证: {{ proofCount }}</span>
            <span class="stat-item">质证: {{ defenseCount }}</span>
          </div>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-icon">📎</div>
        <div class="card-content">
          <div class="card-label">证据数量</div>
          <div class="card-value">{{ evidenceCount }} 份</div>
          <div class="card-subtitle">总大小：{{ totalEvidenceSize }}</div>
        </div>
      </div>
    </div>

    <div class="export-options">
      <h3>导出选项</h3>

      <div class="option-section">
        <div class="section-title">导出内容</div>
        <div class="checkbox-group">
          <label class="checkbox-item">
            <input type="checkbox" v-model="exportOptions.includeTranscripts" checked>
            <span class="checkbox-custom"></span>
            <span class="label-text">庭审笔录</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" v-model="exportOptions.includeAnnotations" checked>
            <span class="checkbox-custom"></span>
            <span class="label-text">标注汇总</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" v-model="exportOptions.includeEvidence" checked>
            <span class="checkbox-custom"></span>
            <span class="label-text">证据材料</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" v-model="exportOptions.includeTimeline">
            <span class="checkbox-custom"></span>
            <span class="label-text">时间轴数据</span>
          </label>
        </div>
      </div>

      <div class="option-section">
        <div class="section-title">角色过滤</div>
        <div class="checkbox-group">
          <label class="checkbox-item">
            <input type="checkbox" v-model="exportOptions.roles.judge" checked>
            <span class="checkbox-custom" style="background: #ef4444"></span>
            <span class="label-text">审判长</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" v-model="exportOptions.roles.prosecutor" checked>
            <span class="checkbox-custom" style="background: #f97316"></span>
            <span class="label-text">公诉人</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" v-model="exportOptions.roles.defender" checked>
            <span class="checkbox-custom" style="background: #22c55e"></span>
            <span class="label-text">辩护人</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" v-model="exportOptions.roles.clerk" checked>
            <span class="checkbox-custom" style="background: #3b82f6"></span>
            <span class="label-text">书记员</span>
          </label>
        </div>
      </div>

      <div class="option-section">
        <div class="section-title">时间范围</div>
        <div class="time-range">
          <div class="range-input">
            <label>开始时间</label>
            <input type="time" v-model="exportOptions.startTime" step="1">
          </div>
          <span class="range-separator">至</span>
          <div class="range-input">
            <label>结束时间</label>
            <input type="time" v-model="exportOptions.endTime" step="1">
          </div>
        </div>
      </div>
    </div>

    <div class="export-formats">
      <h3>导出格式</h3>
      <div class="format-grid">
        <div class="format-card" @click="wrappedExportToTxt">
          <div class="format-icon">📄</div>
          <div class="format-info">
            <div class="format-name">文本文件</div>
            <div class="format-desc">TXT格式，纯文本笔录</div>
          </div>
          <button class="export-btn" :disabled="isExporting">
            导出
          </button>
        </div>

        <div class="format-card" @click="wrappedExportToPdf">
          <div class="format-icon">📕</div>
          <div class="format-info">
            <div class="format-name">PDF文档</div>
            <div class="format-desc">含格式排版，支持打印</div>
          </div>
          <button class="export-btn" :disabled="isExporting">
            导出
          </button>
        </div>

        <div class="format-card featured" @click="wrappedExportToZip">
          <div class="featured-badge">推荐</div>
          <div class="format-icon">📦</div>
          <div class="format-info">
            <div class="format-name">完整案卷包</div>
            <div class="format-desc">ZIP格式，含所有材料</div>
          </div>
          <button class="export-btn primary" :disabled="isExporting">
            导出
          </button>
        </div>
      </div>
    </div>

    <div class="export-progress" v-if="isExporting">
      <div class="progress-header">
        <span>正在导出...</span>
        <span>{{ exportProgress }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: exportProgress + '%' }"></div>
      </div>
      <div class="progress-text">{{ getProgressText() }}</div>
    </div>

    <div class="export-error" v-if="exportError">
      <span class="error-icon">⚠️</span>
      <span>{{ exportError }}</span>
      <button class="retry-btn" @click="clearError">重试</button>
    </div>

    <div class="export-history">
      <h3>最近导出</h3>
      <div class="history-list">
        <div class="history-item" v-for="(item, index) in exportHistory" :key="index">
          <span class="history-icon">{{ getFormatIcon(item.format) }}</span>
          <span class="history-name">{{ item.name }}</span>
          <span class="history-time">{{ item.time }}</span>
          <span class="history-size">{{ item.size }}</span>
        </div>
        <div class="empty-history" v-if="exportHistory.length === 0">
          <span>暂无导出记录</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useTranscriptStore } from '@/stores/transcriptStore'
import { useEvidenceStore } from '@/stores/evidenceStore'
import { useExport } from '@/composables/useExport'
import { formatFullTime } from '@/utils/storage'

const transcriptStore = useTranscriptStore()
const evidenceStore = useEvidenceStore()
const { isExporting, exportProgress, exportError, exportToTxt, exportToPdf, exportToZip } = useExport()

const exportOptions = reactive({
  includeTranscripts: true,
  includeAnnotations: true,
  includeEvidence: true,
  includeTimeline: false,
  roles: {
    judge: true,
    prosecutor: true,
    defender: true,
    clerk: true
  },
  startTime: '00:00:00',
  endTime: '23:59:59'
})

const exportHistory = ref<Array<{
  name: string
  format: 'txt' | 'pdf' | 'zip'
  time: string
  size: string
}>>([])

const currentCase = computed(() => transcriptStore.currentCase)
const transcriptCount = computed(() => transcriptStore.activeTranscripts.length)
const totalWordCount = computed(() => {
  return transcriptStore.activeTranscripts.reduce((sum, t) => sum + t.content.length, 0)
})
const annotationCount = computed(() => transcriptStore.annotations.length)
const disputeCount = computed(() => transcriptStore.annotations.filter(a => a.type === 'dispute').length)
const proofCount = computed(() => transcriptStore.annotations.filter(a => a.type === 'proof').length)
const defenseCount = computed(() => transcriptStore.annotations.filter(a => a.type === 'defense').length)
const evidenceCount = computed(() => evidenceStore.evidenceItems.length)
const totalEvidenceSize = computed(() => {
  const bytes = evidenceStore.evidenceItems.reduce((sum, e) => sum + e.fileSize, 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

const getFormatIcon = (format: string) => {
  const icons: Record<string, string> = {
    txt: '📄',
    pdf: '📕',
    zip: '📦'
  }
  return icons[format] || '📁'
}

const getProgressText = () => {
  if (exportProgress.value < 30) return '正在生成笔录...'
  if (exportProgress.value < 60) return '正在处理标注...'
  if (exportProgress.value < 90) return '正在打包证据...'
  return '正在生成文件...'
}

const clearError = () => {
  exportError.value = null
}

const addToHistory = (format: 'txt' | 'pdf' | 'zip') => {
  const caseNumber = currentCase.value?.caseNumber || '庭审案件'
  const formatNames: Record<string, string> = {
    txt: '庭审笔录',
    pdf: '庭审笔录',
    zip: '完整案卷'
  }
  const sizes: Record<string, string> = {
    txt: `${(totalWordCount.value * 2 / 1024).toFixed(1)} KB`,
    pdf: `${(totalWordCount.value * 5 / 1024).toFixed(1)} KB`,
    zip: totalEvidenceSize.value
  }

  exportHistory.value.unshift({
    name: `${caseNumber}_${formatNames[format]}`,
    format,
    time: formatFullTime(Date.now()),
    size: sizes[format]
  })

  if (exportHistory.value.length > 10) {
    exportHistory.value = exportHistory.value.slice(0, 10)
  }
}

const originalExportToTxt = exportToTxt
const originalExportToPdf = exportToPdf
const originalExportToZip = exportToZip

const wrappedExportToTxt = async () => {
  await originalExportToTxt()
  if (!exportError.value) addToHistory('txt')
}

const wrappedExportToPdf = async () => {
  await originalExportToPdf()
  if (!exportError.value) addToHistory('pdf')
}

const wrappedExportToZip = async () => {
  await originalExportToZip()
  if (!exportError.value) addToHistory('zip')
}

defineExpose({
  exportToTxt: wrappedExportToTxt,
  exportToPdf: wrappedExportToPdf,
  exportToZip: wrappedExportToZip
})
</script>

<style scoped lang="scss">
.export-center {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
  background: var(--bg-secondary);

  .export-header {
    margin-bottom: 24px;

    h2 {
      margin: 0 0 8px 0;
      font-size: 24px;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 10px;

      .icon {
        font-size: 28px;
      }
    }

    .subtitle {
      margin: 0;
      font-size: 14px;
      color: var(--text-secondary);
    }
  }

  .case-summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;

    .summary-card {
      background: var(--bg-primary);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      border: 1px solid var(--border-color);
      transition: all 0.3s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      }

      .card-icon {
        font-size: 36px;
        opacity: 0.8;
      }

      .card-content {
        flex: 1;

        .card-label {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }

        .card-value {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .card-subtitle {
          font-size: 11px;
          color: var(--text-secondary);

          .stat-item {
            margin-right: 8px;

            &:last-child {
              margin-right: 0;
            }
          }
        }
      }
    }
  }

  .export-options,
  .export-formats,
  .export-history {
    background: var(--bg-primary);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
    border: 1px solid var(--border-color);

    h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: var(--text-primary);
    }
  }

  .option-section {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 12px;
    }

    .checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;

      .checkbox-item {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 14px;
        color: var(--text-primary);

        input {
          display: none;

          &:checked + .checkbox-custom {
            background: var(--accent-primary);
            border-color: var(--accent-primary);

            &::after {
              content: '✓';
              color: white;
              font-size: 10px;
            }
          }
        }

        .checkbox-custom {
          width: 18px;
          height: 18px;
          border: 2px solid var(--border-color);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          background: var(--bg-secondary);
        }

        .label-text {
          user-select: none;
        }
      }
    }

    .time-range {
      display: flex;
      align-items: center;
      gap: 16px;

      .range-input {
        display: flex;
        flex-direction: column;
        gap: 6px;

        label {
          font-size: 12px;
          color: var(--text-secondary);
        }

        input {
          padding: 8px 12px;
          font-size: 14px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-family: 'SF Mono', Monaco, monospace;
        }
      }

      .range-separator {
        color: var(--text-secondary);
        margin-top: 20px;
      }
    }
  }

  .format-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;

    .format-card {
      position: relative;
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 20px;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.3s;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 12px;

      &:hover {
        border-color: var(--accent-primary);
        transform: translateY(-4px);
        box-shadow: 0 12px 32px rgba(59, 130, 246, 0.2);
      }

      &.featured {
        border-color: var(--accent-primary);
        background: linear-gradient(135deg, var(--accent-bg) 0%, var(--bg-secondary) 100%);

        .featured-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          background: var(--accent-primary);
          color: white;
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: 600;
        }
      }

      .format-icon {
        font-size: 48px;
      }

      .format-info {
        .format-name {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .format-desc {
          font-size: 12px;
          color: var(--text-secondary);
        }
      }

      .export-btn {
        margin-top: 8px;
        padding: 8px 24px;
        font-size: 14px;
        border-radius: 6px;
        border: 1px solid var(--border-color);
        background: var(--bg-primary);
        color: var(--text-primary);
        cursor: pointer;
        transition: all 0.2s;

        &:hover:not(:disabled) {
          background: var(--accent-primary);
          color: white;
          border-color: var(--accent-primary);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        &.primary {
          background: var(--accent-primary);
          color: white;
          border-color: var(--accent-primary);

          &:hover:not(:disabled) {
            background: var(--accent-hover);
            border-color: var(--accent-hover);
          }
        }
      }
    }
  }

  .export-progress {
    background: var(--accent-bg);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
    border: 1px solid var(--accent-primary);

    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 14px;
      color: var(--text-primary);
      font-weight: 500;
    }

    .progress-bar {
      height: 8px;
      background: var(--bg-secondary);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--accent-primary), var(--accent-hover));
        border-radius: 4px;
        transition: width 0.3s;
      }
    }

    .progress-text {
      font-size: 12px;
      color: var(--text-secondary);
      text-align: center;
    }
  }

  .export-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #dc2626;

    .error-icon {
      font-size: 20px;
    }

    .retry-btn {
      margin-left: auto;
      padding: 6px 16px;
      font-size: 13px;
      border-radius: 6px;
      border: 1px solid #fca5a5;
      background: white;
      color: #dc2626;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #fef2f2;
      }
    }
  }

  .history-list {
    .history-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border-radius: 8px;
      margin-bottom: 8px;
      gap: 12px;
      font-size: 13px;
      transition: background 0.2s;

      &:hover {
        background: var(--bg-hover);
      }

      .history-icon {
        font-size: 20px;
      }

      .history-name {
        flex: 1;
        color: var(--text-primary);
        font-weight: 500;
      }

      .history-time {
        color: var(--text-secondary);
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 12px;
      }

      .history-size {
        color: var(--text-secondary);
        font-size: 12px;
        min-width: 60px;
        text-align: right;
      }
    }

    .empty-history {
      text-align: center;
      padding: 32px;
      color: var(--text-secondary);
      font-size: 14px;
    }
  }
}
</style>
