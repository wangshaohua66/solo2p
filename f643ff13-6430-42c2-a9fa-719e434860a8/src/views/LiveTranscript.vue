<template>
  <div class="live-transcript">
    <div class="main-content">
      <aside class="left-sidebar">
        <QuickPhrases @select="handleQuickPhrase" />
      </aside>

      <section class="transcript-area">
        <div class="transcript-header">
          <div class="header-left">
            <h2 class="section-title">庭审笔录</h2>
            <span class="entry-count">
              共 {{ transcriptStore.activeTranscripts.length }} 条记录
            </span>
          </div>
          <div class="header-right">
            <SearchBar @result="handleSearchResult" />
            <div class="voice-controls">
              <button
                class="btn-voice"
                :class="{ active: voice.isListening }"
                @click="toggleVoice"
                :title="voice.isListening ? '停止语音' : '开始语音识别'"
              >
                <span class="voice-icon">{{ voice.isListening ? '🎙️' : '🎤' }}</span>
                {{ voice.isListening ? '识别中...' : '语音输入' }}
              </button>
              <button
                class="btn-timestamp"
                @click="insertTimestamp"
                title="插入时间戳"
              >
                ⏰ 时间戳
              </button>
            </div>
          </div>
        </div>

        <div class="transcript-list" ref="listRef" @scroll="handleScroll">
          <div
            v-for="(entry, index) in displayTranscripts"
            :key="entry.id"
            class="transcript-entry"
            :class="{
              selected: transcriptStore.selectedTranscriptId === entry.id,
              highlight: isHighlighted(entry.id)
            }"
            :data-id="entry.id"
            @click="selectEntry(entry.id)"
          >
            <div v-if="transcriptStore.settings.showLineNumbers" class="line-number">
              {{ index + 1 }}
            </div>

            <div class="entry-main">
              <div class="entry-header">
                <span class="entry-time">{{ formatTime(entry.timestamp) }}</span>
                <span
                  class="entry-role"
                  :style="{ color: getRoleColor(entry.role) }"
                >
                  {{ getRoleName(entry.role) }}
                </span>
                <span v-if="entry.speaker !== entry.role" class="entry-speaker">
                  ({{ entry.speaker }})
                </span>
              </div>

              <div
                class="entry-content"
                :style="{ fontSize: transcriptStore.settings.fontSize + 'px' }"
                v-if="editingId !== entry.id"
                @dblclick="startEditing(entry)"
              >
                <span v-html="highlightContent(entry.content, entry.id)"></span>
              </div>

              <textarea
                v-else
                ref="editRef"
                v-model="editContent"
                class="entry-edit"
                @blur="saveEditing"
                @keydown.enter.stop.prevent="saveEditing"
                @keydown.esc="cancelEditing"
              ></textarea>

              <div v-if="entry.evidenceIds.length > 0" class="entry-evidence">
                <span class="evidence-label">📎 关联证据：</span>
                <span
                  v-for="evId in entry.evidenceIds"
                  :key="evId"
                  class="evidence-tag"
                  @click.stop="jumpToEvidence(evId)"
                >
                  {{ getEvidenceName(evId) }}
                </span>
              </div>

              <div v-if="entry.annotationIds.length > 0" class="entry-annotations">
                <span
                  v-for="annId in entry.annotationIds"
                  :key="annId"
                  class="annotation-badge"
                  :style="{ backgroundColor: getAnnotationBgColor(annId) }"
                  @click.stop="jumpToAnnotation(annId)"
                >
                  {{ getAnnotationTypeLabel(annId) }}
                </span>
              </div>

              <div class="entry-actions">
                <button
                  class="action-btn"
                  @click.stop="startEditing(entry)"
                  title="编辑"
                >
                  ✏️
                </button>
                <button
                  class="action-btn"
                  @click.stop="addAnnotationFor(entry.id)"
                  title="添加标注"
                >
                  🏷️
                </button>
                <button
                  class="action-btn"
                  @click.stop="linkEvidence(entry.id)"
                  title="关联证据"
                >
                  🔗
                </button>
                <button
                  class="action-btn delete"
                  @click.stop="deleteEntry(entry.id)"
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>

          <div v-if="displayTranscripts.length === 0" class="empty-state">
            <div class="empty-icon">📝</div>
            <p>暂无笔录记录</p>
            <p class="hint">在下方输入框开始记录，或点击"开始记录"启动计时</p>
          </div>
        </div>

        <div class="transcript-input">
          <div class="input-toolbar">
            <select v-model="inputRole" class="role-select">
              <option value="judge">审判长</option>
              <option value="clerk">书记员</option>
              <option value="prosecutor">公诉人</option>
              <option value="defender">辩护人</option>
            </select>
            <input
              v-model="inputSpeaker"
              type="text"
              class="speaker-input"
              placeholder="发言人姓名（可选）"
            />
          </div>

          <div class="input-wrapper">
            <textarea
              v-model="inputContent"
              class="transcript-textarea"
              placeholder="输入笔录内容... (按 Enter 提交，Shift+Enter 换行)"
              :style="{ fontSize: transcriptStore.settings.fontSize + 'px' }"
              @keydown.enter.prevent="handleSubmit"
              @keydown.ctrl.enter.prevent="insertTimestampAtCursor"
              @input="handleInput"
              ref="textareaRef"
            ></textarea>

            <div class="input-actions">
              <button
                class="btn-submit"
                @click="handleSubmit"
                :disabled="!inputContent.trim()"
              >
                ⏎ 提交记录
              </button>
              <span class="char-count">{{ inputContent.length }} 字</span>
            </div>
          </div>

          <div v-if="voice.isListening" class="voice-preview">
            <span class="voice-label">语音识别：</span>
            <span class="voice-text">{{ voice.getFullTranscript() }}</span>
            <span class="voice-interim" v-if="voice.interimTranscript">
              {{ voice.interimTranscript }}
            </span>
          </div>
        </div>
      </section>

      <aside class="right-sidebar">
        <EvidenceManager
          v-if="evidenceStore.selectedEvidenceId"
          :compact="true"
        />
        <div v-else class="sidebar-placeholder">
          <p>选择证据以预览</p>
        </div>
      </aside>
    </div>

    <TimelineView :compact="true" />

    <div v-if="showAnnotationModal" class="modal-overlay" @click.self="showAnnotationModal = false">
      <div class="modal">
        <h3>添加标注</h3>
        <div class="form-group">
          <label>标注类型</label>
          <div class="annotation-types">
            <button
              v-for="type in annotationTypes"
              :key="type.value"
              class="type-btn"
              :class="{ active: newAnnotationType === type.value }"
              :style="{ borderColor: newAnnotationType === type.value ? type.color : 'transparent' }"
              @click="newAnnotationType = type.value as any"
            >
              <span class="type-dot" :style="{ backgroundColor: type.color }"></span>
              {{ type.label }}
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>标注内容</label>
          <textarea
            v-model="newAnnotationContent"
            rows="4"
            placeholder="输入标注内容..."
          ></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showAnnotationModal = false">取消</button>
          <button
            class="btn-confirm"
            @click="saveAnnotation"
            :disabled="!newAnnotationContent.trim()"
          >
            添加
          </button>
        </div>
      </div>
    </div>

    <div v-if="showEvidenceLinkModal" class="modal-overlay" @click.self="showEvidenceLinkModal = false">
      <div class="modal">
        <h3>关联证据</h3>
        <div class="evidence-list">
          <label
            v-for="evidence in evidenceStore.evidenceList"
            :key="evidence.id"
            class="evidence-item"
          >
            <input
              type="checkbox"
              :checked="linkedEvidenceIds.includes(evidence.id)"
              @change="toggleEvidenceLink(evidence.id)"
            />
            <span class="evidence-icon">{{ getEvidenceIcon(evidence.type) }}</span>
            <span class="evidence-name">{{ evidence.name }}</span>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showEvidenceLinkModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useTranscriptStore } from '@/stores/transcriptStore'
import { useEvidenceStore } from '@/stores/evidenceStore'
import { useTimeSync } from '@/composables/useTimeSync'
import { useVoiceRecognition } from '@/composables/useVoiceRecognition'
import { formatTime, getRoleColor, getRoleName, getAnnotationColor } from '@/utils/storage'
import type { Role, SearchResult } from '@/types'
import QuickPhrases from '@/components/QuickPhrases.vue'
import SearchBar from '@/components/SearchBar.vue'
import EvidenceManager from './EvidenceManager.vue'
import TimelineView from './TimelineView.vue'

const transcriptStore = useTranscriptStore()
const evidenceStore = useEvidenceStore()
const timeSync = useTimeSync()
const voice = useVoiceRecognition()

const listRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const editRef = ref<HTMLTextAreaElement | null>(null)

const inputContent = ref('')
const inputRole = ref<Role>('clerk')
const inputSpeaker = ref('')
const editingId = ref<string | null>(null)
const editContent = ref('')
const showAnnotationModal = ref(false)
const showEvidenceLinkModal = ref(false)
const targetTranscriptId = ref<string | null>(null)
const newAnnotationType = ref<'dispute' | 'proof' | 'defense' | 'note'>('note')
const newAnnotationContent = ref('')
const linkedEvidenceIds = ref<string[]>([])
const lastScrollTime = ref(0)

const displayTranscripts = computed(() => {
  return transcriptStore.filteredTranscripts
})

const annotationTypes = [
  { value: 'dispute', label: '争议焦点', color: '#e74c3c' },
  { value: 'proof', label: '举证要点', color: '#f39c12' },
  { value: 'defense', label: '质证意见', color: '#2ecc71' },
  { value: 'note', label: '备注', color: '#9b59b6' }
]

watch(
  () => transcriptStore.settings.currentRole,
  (newRole) => {
    inputRole.value = newRole
  }
)

watch(
  () => transcriptStore.selectedTranscriptId,
  (newId) => {
    if (newId) {
      nextTick(() => {
        const element = document.querySelector(`[data-id="${newId}"]`) as HTMLElement
        if (element && listRef.value) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
    }
  }
)

onMounted(() => {
  inputRole.value = transcriptStore.settings.currentRole
  timeSync.startSync()

  if (transcriptStore.activeTranscripts.length === 0) {
    addDemoData()
  }
})

const addDemoData = () => {
  const demoEntries = [
    { role: 'clerk' as Role, content: '现在开庭。请法警带被告人到庭。' },
    { role: 'judge' as Role, content: '被告人姓名？' },
    { role: 'clerk' as Role, content: '张三。' },
    { role: 'judge' as Role, content: '被告人张三，你对起诉书指控的犯罪事实有无异议？' },
    { role: 'defender' as Role, content: '辩护人对起诉书指控的罪名无异议，但认为被告人具有自首情节，请求从轻处罚。' },
    { role: 'prosecutor' as Role, content: '公诉人认为，被告人虽有自首情节，但其犯罪性质恶劣，建议法庭依法判处。' },
    { role: 'judge' as Role, content: '现在进行法庭调查，请公诉人举证。' },
    { role: 'prosecutor' as Role, content: '公诉人出示第一组证据：被告人供述与辩解。' },
    { role: 'judge' as Role, content: '请被告人做最后陈述。' },
    { role: 'clerk' as Role, content: '我认罪认罚，希望法庭从轻处理。' },
    { role: 'judge' as Role, content: '现在休庭，合议庭评议后择日宣判。' }
  ]

  demoEntries.forEach((entry, index) => {
    const transcript = transcriptStore.addTranscript(entry.content, entry.role)
    transcript.timestamp = index * 60000
  })

  transcriptStore.addAnnotation({
    transcriptId: transcriptStore.activeTranscripts[2].id,
    type: 'dispute',
    content: '被告人是否具有自首情节存在争议',
    role: 'judge',
    color: '#e74c3c',
    timestamp: 120000
  })

  transcriptStore.addAnnotation({
    transcriptId: transcriptStore.activeTranscripts[4].id,
    type: 'defense',
    content: '辩护人主张自首情节',
    role: 'defender',
    color: '#2ecc71',
    timestamp: 240000
  })

  transcriptStore.addAnnotation({
    transcriptId: transcriptStore.activeTranscripts[5].id,
    type: 'proof',
    content: '公诉人认为犯罪性质恶劣',
    role: 'prosecutor',
    color: '#f39c12',
    timestamp: 300000
  })
}

const handleSubmit = () => {
  if (inputContent.value.trim()) {
    const speaker = inputSpeaker.value.trim() || inputRole.value
    transcriptStore.addTranscript(inputContent.value.trim(), inputRole.value, speaker)
    inputContent.value = ''
    inputSpeaker.value = ''
    nextTick(() => {
      if (listRef.value) {
        listRef.value.scrollTop = listRef.value.scrollHeight
      }
    })
  }
}

const handleInput = () => {
}

const handleQuickPhrase = (content: string) => {
  if (textareaRef.value) {
    const start = textareaRef.value.selectionStart
    const end = textareaRef.value.selectionEnd
    inputContent.value =
      inputContent.value.substring(0, start) +
      content +
      inputContent.value.substring(end)
    nextTick(() => {
      if (textareaRef.value) {
        textareaRef.value.focus()
        textareaRef.value.setSelectionRange(start + content.length, start + content.length)
      }
    })
  } else {
    inputContent.value += content
  }
}

const handleScroll = () => {
  const now = Date.now()
  if (now - lastScrollTime.value > 100) {
    lastScrollTime.value = now
    if (listRef.value) {
      const entries = listRef.value.querySelectorAll('.transcript-entry')
      const viewportMiddle = listRef.value.scrollTop + listRef.value.clientHeight / 2

      for (const entry of entries) {
        const rect = entry.getBoundingClientRect()
        const listRect = listRef.value.getBoundingClientRect()
        const entryMiddle = rect.top - listRect.top + listRef.value.scrollTop + rect.height / 2

        if (Math.abs(entryMiddle - viewportMiddle) < 100) {
          const id = entry.getAttribute('data-id')
          if (id && id !== transcriptStore.selectedTranscriptId) {
            const transcript = transcriptStore.getTranscriptById(id)
            if (transcript) {
              transcriptStore.setCurrentTime(transcript.timestamp)
            }
          }
          break
        }
      }
    }
  }
}

const handleSearchResult = (result: SearchResult) => {
  if (result.transcriptId) {
    transcriptStore.jumpToTranscript(result.transcriptId)
  }
}

const selectEntry = (id: string) => {
  transcriptStore.jumpToTranscript(id)
}

const startEditing = (entry: { id: string; content: string }) => {
  editingId.value = entry.id
  editContent.value = entry.content
  nextTick(() => {
    if (editRef.value) {
      editRef.value.focus()
      editRef.value.select()
    }
  })
}

const saveEditing = () => {
  if (editingId.value && editContent.value.trim()) {
    transcriptStore.updateTranscript(editingId.value, { content: editContent.value.trim() })
  }
  cancelEditing()
}

const cancelEditing = () => {
  editingId.value = null
  editContent.value = ''
}

const deleteEntry = (id: string) => {
  if (confirm('确定要删除这条笔录吗？')) {
    transcriptStore.deleteTranscript(id)
  }
}

const insertTimestamp = () => {
  const time = formatTime(Date.now())
  handleQuickPhrase(`[${time}] `)
}

const insertTimestampAtCursor = () => {
  insertTimestamp()
}

const toggleVoice = () => {
  if (voice.isListening) {
    voice.stopListening()
    if (voice.getFullTranscript().trim()) {
      inputContent.value += voice.getFullTranscript()
    }
    voice.resetTranscript()
  } else {
    voice.startListening()
  }
}

const addAnnotationFor = (transcriptId: string) => {
  targetTranscriptId.value = transcriptId
  newAnnotationType.value = 'note'
  newAnnotationContent.value = ''
  showAnnotationModal.value = true
}

const saveAnnotation = () => {
  if (targetTranscriptId.value && newAnnotationContent.value.trim()) {
    const type = newAnnotationType.value
    transcriptStore.addAnnotation({
      transcriptId: targetTranscriptId.value,
      type,
      content: newAnnotationContent.value.trim(),
      role: transcriptStore.settings.currentRole,
      color: getAnnotationColor(type),
      timestamp: transcriptStore.currentTime
    })
    showAnnotationModal.value = false
    targetTranscriptId.value = null
    newAnnotationContent.value = ''
  }
}

const linkEvidence = (transcriptId: string) => {
  targetTranscriptId.value = transcriptId
  const transcript = transcriptStore.getTranscriptById(transcriptId)
  linkedEvidenceIds.value = transcript ? [...transcript.evidenceIds] : []
  showEvidenceLinkModal.value = true
}

const toggleEvidenceLink = (evidenceId: string) => {
  if (!targetTranscriptId.value) return

  const index = linkedEvidenceIds.value.indexOf(evidenceId)
  if (index === -1) {
    linkedEvidenceIds.value.push(evidenceId)
    transcriptStore.addEvidenceToTranscript(targetTranscriptId.value, evidenceId)
  } else {
    linkedEvidenceIds.value.splice(index, 1)
    const transcript = transcriptStore.getTranscriptById(targetTranscriptId.value)
    if (transcript) {
      transcriptStore.updateTranscript(targetTranscriptId.value, {
        evidenceIds: transcript.evidenceIds.filter(id => id !== evidenceId)
      })
    }
  }
}

const getEvidenceName = (evidenceId: string) => {
  return evidenceStore.getEvidenceById(evidenceId)?.name || '未知证据'
}

const getEvidenceIcon = (type: string) => {
  const icons: Record<string, string> = {
    pdf: '📄',
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    document: '📑'
  }
  return icons[type] || '📁'
}

const getAnnotationTypeLabel = (annotationId: string) => {
  const annotation = transcriptStore.annotations.find(a => a.id === annotationId)
  if (!annotation) return '标注'
  const labels: Record<string, string> = {
    dispute: '争议焦点',
    proof: '举证要点',
    defense: '质证意见',
    note: '备注'
  }
  return labels[annotation.type] || '标注'
}

const getAnnotationBgColor = (annotationId: string) => {
  const annotation = transcriptStore.annotations.find(a => a.id === annotationId)
  return annotation ? annotation.color + '30' : '#95a5a630'
}

const jumpToEvidence = (evidenceId: string) => {
  evidenceStore.selectEvidence(evidenceId)
}

const jumpToAnnotation = (annotationId: string) => {
  const annotation = transcriptStore.annotations.find(a => a.id === annotationId)
  if (annotation) {
    transcriptStore.jumpToTranscript(annotation.transcriptId)
  }
}

const isHighlighted = (transcriptId: string) => {
  if (!transcriptStore.searchQuery.trim()) return false
  return transcriptStore.searchResults.some(r => r.transcriptId === transcriptId)
}

const highlightContent = (content: string, transcriptId: string) => {
  if (!transcriptStore.searchQuery.trim()) return content

  const result = transcriptStore.searchResults.find(r => r.transcriptId === transcriptId)
  if (!result || !result.highlight.length) return content

  let highlighted = ''
  let lastIndex = 0

  for (const [start, end] of result.highlight.sort((a, b) => a[0] - b[0])) {
    if (start >= lastIndex) {
      highlighted += content.slice(lastIndex, start)
      highlighted += `<mark>${content.slice(start, end)}</mark>`
      lastIndex = end
    }
  }

  if (lastIndex < content.length) {
    highlighted += content.slice(lastIndex)
  }

  return highlighted
}
</script>

<style lang="scss" scoped>
.live-transcript {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.left-sidebar {
  width: 280px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.transcript-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.right-sidebar {
  width: 35%;
  min-width: 300px;
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--card-bg);
}

.sidebar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  font-size: 14px;
}

.transcript-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.entry-count {
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--input-bg);
  padding: 4px 10px;
  border-radius: 12px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  max-width: 600px;
  min-width: 300px;
}

.voice-controls {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn-voice, .btn-timestamp {
  padding: 8px 14px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    background: var(--hover-bg);
  }

  &.active {
    background: var(--danger-color);
    border-color: var(--danger-color);
    color: white;

    .voice-icon {
      animation: pulse 1s infinite;
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.transcript-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  line-height: 1.8;
  scroll-behavior: smooth;
}

.transcript-entry {
  display: flex;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    background: var(--hover-bg);

    .entry-actions {
      opacity: 1;
    }
  }

  &.selected {
    background: var(--primary-color) + '15';
    border-left: 3px solid var(--primary-color);
  }

  &.highlight {
    background: rgba(241, 196, 15, 0.1);
  }
}

.line-number {
  width: 40px;
  text-align: right;
  color: var(--text-secondary);
  font-size: 12px;
  flex-shrink: 0;
  padding-top: 4px;
  opacity: 0.7;
}

.entry-main {
  flex: 1;
  min-width: 0;
}

.entry-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
}

.entry-time {
  color: var(--text-secondary);
  font-family: 'SF Mono', monospace;
}

.entry-role {
  font-weight: 600;
}

.entry-speaker {
  color: var(--text-secondary);
}

.entry-content {
  color: var(--text-primary);
  word-break: break-word;
  white-space: pre-wrap;

  :deep(mark) {
    background: rgba(241, 196, 15, 0.3);
    padding: 0 2px;
    border-radius: 2px;
  }
}

.entry-edit {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--primary-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: inherit;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  min-height: 60px;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px var(--primary-color) + '30';
  }
}

.entry-evidence {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
}

.evidence-label {
  color: var(--text-secondary);
}

.evidence-tag {
  padding: 2px 8px;
  background: rgba(52, 152, 219, 0.2);
  color: #3498db;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(52, 152, 219, 0.3);
  }
}

.entry-annotations {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.annotation-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
}

.entry-actions {
  position: absolute;
  right: 8px;
  top: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover {
    background: var(--hover-bg);
  }

  &.delete:hover {
    background: rgba(231, 76, 60, 0.2);
  }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  p {
    margin: 8px 0;

    &.hint {
      font-size: 13px;
      opacity: 0.7;
    }
  }
}

.transcript-input {
  border-top: 1px solid var(--border-color);
  padding: 16px 20px;
  background: var(--card-bg);
}

.input-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.role-select, .speaker-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
}

.speaker-input {
  flex: 1;
}

.input-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.transcript-textarea {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  line-height: 1.6;
  resize: none;
  min-height: 80px;
  max-height: 200px;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
  }
}

.input-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.btn-submit {
  padding: 10px 20px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: var(--primary-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.char-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.voice-preview {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(52, 152, 219, 0.1);
  border-radius: 6px;
  font-size: 13px;
}

.voice-label {
  color: var(--primary-color);
  font-weight: 500;
  flex-shrink: 0;
}

.voice-text {
  color: var(--text-primary);
}

.voice-interim {
  color: var(--text-secondary);
  font-style: italic;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 24px;
  min-width: 450px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);

  h3 {
    margin: 0 0 20px 0;
    color: var(--text-primary);
    font-size: 18px;
  }
}

.form-group {
  margin-bottom: 16px;

  label {
    display: block;
    margin-bottom: 8px;
    color: var(--text-secondary);
    font-size: 14px;
  }

  textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 14px;
    font-family: inherit;
    box-sizing: border-box;
    resize: vertical;

    &:focus {
      outline: none;
      border-color: var(--primary-color);
    }
  }
}

.annotation-types {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.type-btn {
  padding: 8px 14px;
  background: var(--input-bg);
  border: 2px solid transparent;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;

  &:hover {
    background: var(--hover-bg);
  }

  &.active {
    background: var(--input-bg);
  }

  .type-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
}

.evidence-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.evidence-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--hover-bg);
  }

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .evidence-icon {
    font-size: 16px;
  }

  .evidence-name {
    flex: 1;
    font-size: 14px;
    color: var(--text-primary);
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.btn-cancel, .btn-confirm {
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  border: none;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--input-bg);
  color: var(--text-primary);

  &:hover {
    background: var(--hover-bg);
  }
}

.btn-confirm {
  background: var(--primary-color);
  color: white;

  &:hover:not(:disabled) {
    background: var(--primary-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

@media (max-width: 1200px) {
  .left-sidebar {
    width: 240px;
  }

  .right-sidebar {
    width: 40%;
  }
}

@media (max-width: 900px) {
  .main-content {
    flex-direction: column;
  }

  .left-sidebar {
    width: 100%;
    height: 200px;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }

  .right-sidebar {
    width: 100%;
    height: 300px;
    border-left: none;
    border-top: 1px solid var(--border-color);
  }
}
</style>
