<template>
  <div class="annotation-panel" :class="{ compact }">
    <div class="panel-header">
      <h3>
        <span class="icon">📝</span>
        多方标注
      </h3>
      <div class="header-actions">
        <select v-model="filterRole" class="role-filter">
          <option value="all">全部角色</option>
          <option value="judge">审判长</option>
          <option value="prosecutor">公诉人</option>
          <option value="defender">辩护人</option>
          <option value="clerk">书记员</option>
        </select>
        <select v-model="filterType" class="type-filter">
          <option value="all">全部类型</option>
          <option value="dispute">争议焦点</option>
          <option value="proof">举证要点</option>
          <option value="defense">质证意见</option>
          <option value="note">备注</option>
        </select>
      </div>
    </div>

    <div class="annotation-form" v-if="selectedTranscript">
      <div class="form-row">
        <label>标注类型</label>
        <select v-model="newAnnotation.type" class="type-select">
          <option value="dispute">争议焦点 🔴</option>
          <option value="proof">举证要点 🟠</option>
          <option value="defense">质证意见 🟢</option>
          <option value="note">备注 🔵</option>
        </select>
      </div>
      <div class="form-row">
        <label>关联证据</label>
        <select v-model="newAnnotation.evidenceId" class="evidence-select">
          <option value="">无</option>
          <option v-for="ev in evidenceList" :key="ev.id" :value="ev.id">
            {{ ev.name }}
          </option>
        </select>
      </div>
      <div class="form-row">
        <label>标注内容</label>
        <textarea
          v-model="newAnnotation.content"
          class="content-textarea"
          placeholder="请输入标注内容..."
          rows="3"
          maxlength="500"
        ></textarea>
        <span class="char-count">{{ newAnnotation.content.length }}/500</span>
      </div>
      <div class="form-actions">
        <span class="current-role" :style="{ color: getRoleColor(currentRole) }">
          当前角色：{{ getRoleName(currentRole) }}
        </span>
        <button @click="addAnnotation" class="add-btn" :disabled="!newAnnotation.content.trim()">
          <span>➕</span> 添加标注
        </button>
      </div>
    </div>

    <div class="no-selection" v-else-if="!compact">
      <div class="empty-icon">👆</div>
      <p>请先选择一条笔录进行标注</p>
    </div>

    <div class="annotations-list">
      <div class="list-header">
        <span>标注列表</span>
        <span class="count">{{ filteredAnnotations.length }} 条</span>
      </div>

      <div class="annotation-item"
           v-for="annotation in filteredAnnotations"
           :key="annotation.id"
           :class="{ active: selectedAnnotationId === annotation.id }"
           @click="selectAnnotation(annotation)"
           :style="{ borderLeftColor: annotation.color }">
        <div class="annotation-header">
          <span class="annotation-type" :style="{ backgroundColor: annotation.color }">
            {{ getTypeName(annotation.type) }}
          </span>
          <span class="annotation-role" :style="{ color: getRoleColor(annotation.role) }">
            {{ getRoleName(annotation.role) }}
          </span>
          <span class="annotation-time">{{ formatTime(annotation.timestamp) }}</span>
        </div>
        <div class="annotation-content">{{ annotation.content }}</div>
        <div class="annotation-footer">
          <span v-if="annotation.evidenceId" class="evidence-link" @click.stop="jumpToEvidence(annotation.evidenceId)">
            📎 {{ getEvidenceName(annotation.evidenceId) }}
          </span>
          <span class="transcript-link" @click.stop="jumpToTranscript(annotation.transcriptId)">
            🔗 查看笔录
          </span>
          <button v-if="annotation.role === currentRole"
                  class="delete-btn"
                  @click.stop="deleteAnnotation(annotation.id)">
            🗑️
          </button>
        </div>
      </div>

      <div class="empty-state" v-if="filteredAnnotations.length === 0">
        <div class="empty-icon">📭</div>
        <p>暂无标注记录</p>
      </div>
    </div>

    <div class="role-legend">
      <div class="legend-title">角色说明</div>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-dot" style="background: #ef4444"></span>
          <span>审判长 - 争议焦点</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #f97316"></span>
          <span>公诉人 - 举证要点</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #22c55e"></span>
          <span>辩护人 - 质证意见</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #3b82f6"></span>
          <span>书记员 - 备注</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { useTranscriptStore } from '@/stores/transcriptStore'
import { useEvidenceStore } from '@/stores/evidenceStore'
import { getRoleColor, getRoleName, formatTime } from '@/utils/storage'
import type { Annotation, Role } from '@/types'

const props = defineProps<{
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'jumpToTranscript', id: string): void
  (e: 'jumpToEvidence', id: string): void
}>()

const transcriptStore = useTranscriptStore()
const evidenceStore = useEvidenceStore()

const filterRole = ref<Role | 'all'>('all')
const filterType = ref<Annotation['type'] | 'all'>('all')
const selectedAnnotationId = ref<string | null>(null)

const newAnnotation = reactive({
  type: 'dispute' as Annotation['type'],
  content: '',
  evidenceId: ''
})

const currentRole = computed(() => transcriptStore.settings.currentRole)

const selectedTranscript = computed(() => {
  return transcriptStore.selectedTranscriptId
    ? transcriptStore.getTranscriptById(transcriptStore.selectedTranscriptId)
    : null
})

const evidenceList = computed(() => evidenceStore.evidenceItems)

const filteredAnnotations = computed(() => {
  let results = [...transcriptStore.annotations]

  if (filterRole.value !== 'all') {
    results = results.filter(a => a.role === filterRole.value)
  }

  if (filterType.value !== 'all') {
    results = results.filter(a => a.type === filterType.value)
  }

  return results.sort((a, b) => b.timestamp - a.timestamp)
})

const getTypeName = (type: Annotation['type']) => {
  const names: Record<Annotation['type'], string> = {
    dispute: '争议焦点',
    proof: '举证要点',
    defense: '质证意见',
    note: '备注'
  }
  return names[type]
}

const getEvidenceName = (evidenceId: string) => {
  const ev = evidenceStore.evidenceItems.find(e => e.id === evidenceId)
  return ev ? ev.name : '未知证据'
}

const getTypeColor = (type: Annotation['type'], role: Role) => {
  const typeColors: Record<Annotation['type'], string> = {
    dispute: '#ef4444',
    proof: '#f97316',
    defense: '#22c55e',
    note: '#3b82f6'
  }
  return typeColors[type]
}

const addAnnotation = () => {
  if (!selectedTranscript.value || !newAnnotation.content.trim()) return

  transcriptStore.addAnnotation({
    transcriptId: selectedTranscript.value.id,
    evidenceId: newAnnotation.evidenceId || undefined,
    type: newAnnotation.type,
    content: newAnnotation.content.trim(),
    role: currentRole.value,
    color: getTypeColor(newAnnotation.type, currentRole.value),
    timestamp: selectedTranscript.value.timestamp
  })

  newAnnotation.content = ''
  newAnnotation.evidenceId = ''
}

const deleteAnnotation = (id: string) => {
  if (confirm('确定要删除这条标注吗？')) {
    transcriptStore.deleteAnnotation(id)
  }
}

const selectAnnotation = (annotation: Annotation) => {
  selectedAnnotationId.value = annotation.id
}

const jumpToTranscript = (id: string) => {
  transcriptStore.jumpToTranscript(id)
  emit('jumpToTranscript', id)
}

const jumpToEvidence = (id: string) => {
  evidenceStore.selectEvidence(id)
  emit('jumpToEvidence', id)
}

watch(selectedTranscript, (transcript) => {
  if (transcript && transcript.evidenceIds.length > 0) {
    newAnnotation.evidenceId = transcript.evidenceIds[0]
  }
})

if (transcriptStore.annotations.length === 0) {
  const demoAnnotations: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      transcriptId: transcriptStore.transcripts[0]?.id || '',
      type: 'dispute',
      content: '被告人是否具有自首情节存在争议，需要核实公安机关的到案经过说明',
      role: 'judge',
      color: '#ef4444',
      timestamp: 120000
    },
    {
      transcriptId: transcriptStore.transcripts[2]?.id || '',
      type: 'proof',
      content: '出示证据一：被告人指纹鉴定报告，证明被告人曾接触过作案工具',
      role: 'prosecutor',
      color: '#f97316',
      timestamp: 300000
    },
    {
      transcriptId: transcriptStore.transcripts[4]?.id || '',
      type: 'defense',
      content: '对指纹鉴定的关联性提出异议，该指纹只能证明接触过物品，不能直接证明实施了盗窃行为',
      role: 'defender',
      color: '#22c55e',
      timestamp: 450000
    }
  ]

  demoAnnotations.forEach((a, index) => {
    if (transcriptStore.transcripts[index]) {
      a.transcriptId = transcriptStore.transcripts[index].id
      a.timestamp = transcriptStore.transcripts[index].timestamp
      transcriptStore.addAnnotation(a)
    }
  })
}
</script>

<style scoped lang="scss">
.annotation-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;

  &.compact {
    .panel-header h3 {
      font-size: 14px;
    }

    .annotation-form {
      padding: 8px 12px;
    }

    .content-textarea {
      padding: 6px 10px;
      font-size: 13px;
    }
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);

  h3 {
    margin: 0;
    font-size: 15px;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 6px;

    .icon {
      font-size: 16px;
    }
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  select {
    padding: 4px 8px;
    font-size: 12px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    cursor: pointer;
  }
}

.annotation-form {
  padding: 12px 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);

  .form-row {
    margin-bottom: 10px;

    label {
      display: block;
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }

    select, textarea {
      width: 100%;
      padding: 8px 12px;
      font-size: 13px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.2s;

      &:focus {
        outline: none;
        border-color: var(--accent-primary);
      }
    }

    .char-count {
      display: block;
      text-align: right;
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 2px;
    }
  }

  .form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;

    .current-role {
      font-size: 12px;
      font-weight: 500;
    }

    .add-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 14px;
      font-size: 13px;
      border-radius: 6px;
      border: none;
      background: var(--accent-primary);
      color: white;
      cursor: pointer;
      transition: all 0.2s;

      &:hover:not(:disabled) {
        background: var(--accent-hover);
        transform: translateY(-1px);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
}

.no-selection {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-secondary);

  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  p {
    margin: 0;
    font-size: 13px;
  }
}

.annotations-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);

    .count {
      font-size: 12px;
      background: var(--bg-primary);
      padding: 2px 8px;
      border-radius: 10px;
    }
  }

  .annotation-item {
    background: var(--bg-primary);
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 8px;
    border-left: 3px solid;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      transform: translateX(2px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    &.active {
      background: var(--accent-bg);
    }

    .annotation-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;

      .annotation-type {
        padding: 2px 8px;
        font-size: 11px;
        border-radius: 10px;
        color: white;
        font-weight: 500;
      }

      .annotation-role {
        font-size: 12px;
        font-weight: 500;
      }

      .annotation-time {
        margin-left: auto;
        font-size: 11px;
        color: var(--text-secondary);
        font-family: 'SF Mono', Monaco, monospace;
      }
    }

    .annotation-content {
      font-size: 13px;
      color: var(--text-primary);
      line-height: 1.5;
      margin-bottom: 8px;
    }

    .annotation-footer {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;

      .evidence-link,
      .transcript-link {
        color: var(--accent-primary);
        cursor: pointer;
        transition: color 0.2s;

        &:hover {
          color: var(--accent-hover);
          text-decoration: underline;
        }
      }

      .delete-btn {
        margin-left: auto;
        padding: 2px 6px;
        font-size: 14px;
        border: none;
        background: transparent;
        cursor: pointer;
        opacity: 0.6;
        transition: opacity 0.2s;

        &:hover {
          opacity: 1;
        }
      }
    }
  }

  .empty-state {
    padding: 40px 16px;
    text-align: center;
    color: var(--text-secondary);

    .empty-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }

    p {
      margin: 0;
      font-size: 13px;
    }
  }
}

.role-legend {
  padding: 12px 16px;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);

  .legend-title {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .legend-items {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-secondary);

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
  }
}
</style>
