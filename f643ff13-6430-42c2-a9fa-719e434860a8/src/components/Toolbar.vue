<template>
  <header class="toolbar">
    <div class="toolbar-left">
      <div class="case-info">
        <select
          v-model="selectedCaseId"
          class="case-select"
          @change="handleCaseChange"
        >
          <option
            v-for="caseItem in transcriptStore.cases"
            :key="caseItem.id"
            :value="caseItem.id"
          >
            {{ caseItem.caseNumber }} - {{ caseItem.caseName }}
          </option>
        </select>
        <button class="btn-new-case" @click="showNewCaseModal = true">
          <span class="icon">+</span> 新建案件
        </button>
      </div>
    </div>

    <div class="toolbar-center">
      <div class="role-selector">
        <span class="label">当前角色：</span>
        <div class="role-buttons">
          <button
            v-for="role in roles"
            :key="role.value"
            class="role-btn"
            :class="{ active: transcriptStore.settings.currentRole === role.value }"
            :style="{ borderColor: transcriptStore.settings.currentRole === role.value ? role.color : 'transparent' }"
            @click="transcriptStore.updateSettings({ currentRole: role.value })"
          >
            <span class="role-dot" :style="{ backgroundColor: role.color }"></span>
            {{ role.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="toolbar-right">
      <div class="recording-controls">
        <button
          v-if="!transcriptStore.isRecording"
          class="btn-record"
          @click="startRecording"
        >
          <span class="record-dot"></span>
          开始记录
        </button>
        <button
          v-else
          class="btn-stop"
          @click="stopRecording"
        >
          <span class="stop-square"></span>
          停止记录
        </button>
        <span class="timer" v-if="transcriptStore.isRecording">
          {{ formatDuration(transcriptStore.currentTime) }}
        </span>
      </div>

      <div class="status-indicators">
        <span class="save-status" :class="{ saving: transcriptStore.isSaving }">
          <span class="status-icon">💾</span>
          {{ transcriptStore.isSaving ? '保存中...' : '已保存' }}
        </span>
        
        <div class="collaboration-status" @click="toggleCollaborationPanel" title="协同状态">
          <span class="collab-icon" :class="{ connected: transcriptStore.isCollaborating, connecting: transcriptStore.isConnecting }">
            {{ transcriptStore.isCollaborating ? '🔗' : transcriptStore.isConnecting ? '⏳' : '🔌' }}
          </span>
          <span class="collab-text" v-if="transcriptStore.isCollaborating">
            协同中 ({{ transcriptStore.connectedUsers?.length || 0 }}人)
          </span>
          <span class="collab-text" v-else-if="transcriptStore.isConnecting">
            连接中...
          </span>
          <span class="collab-text" v-else>
            未连接
          </span>
        </div>
      </div>

      <div class="view-tabs">
        <router-link
          v-for="tab in tabs"
          :key="tab.path"
          :to="tab.path"
          class="tab-btn"
          active-class="active"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          {{ tab.label }}
        </router-link>
      </div>

      <button
        class="btn-theme"
        @click="toggleTheme"
        :title="transcriptStore.settings.theme === 'dark' ? '切换亮色' : '切换暗色'"
      >
        {{ transcriptStore.settings.theme === 'dark' ? '☀️' : '🌙' }}
      </button>

      <button
        class="btn-projection"
        :class="{ active: transcriptStore.settings.projectionMode }"
        @click="toggleProjection"
        title="投影模式"
      >
        📽️
      </button>
    </div>

    <div v-if="showNewCaseModal" class="modal-overlay" @click.self="showNewCaseModal = false">
      <div class="modal">
        <h3>新建案件</h3>
        <div class="form-group">
          <label>案号</label>
          <input v-model="newCaseNumber" type="text" placeholder="例如：(2024)京0101刑初123号" />
        </div>
        <div class="form-group">
          <label>案由</label>
          <input v-model="newCaseName" type="text" placeholder="例如：被告人张三盗窃一案" />
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showNewCaseModal = false">取消</button>
          <button class="btn-confirm" @click="createNewCase" :disabled="!newCaseNumber || !newCaseName">创建</button>
        </div>
      </div>
    </div>

    <div v-if="showCollaborationPanel" class="modal-overlay" @click.self="showCollaborationPanel = false">
      <div class="modal collaboration-modal">
        <h3>多方协同</h3>
        
        <div class="collaboration-info">
          <div class="info-row">
            <span class="label">连接状态</span>
            <span class="value" :class="transcriptStore.isCollaborating ? 'status-connected' : 'status-disconnected'">
              {{ transcriptStore.isCollaborating ? '已连接' : '未连接' }}
            </span>
          </div>
          <div class="info-row">
            <span class="label">当前案件</span>
            <span class="value">{{ transcriptStore.currentCase?.caseName || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="label">当前角色</span>
            <span class="value">
              <span class="role-dot" :style="{ backgroundColor: getRoleColor(transcriptStore.settings.currentRole) }"></span>
              {{ getRoleLabel(transcriptStore.settings.currentRole) }}
            </span>
          </div>
        </div>

        <div v-if="transcriptStore.connectionError" class="error-message">
          ⚠️ {{ transcriptStore.connectionError }}
        </div>

        <div class="collaboration-actions">
          <button 
            v-if="!transcriptStore.isCollaborating && !transcriptStore.isConnecting"
            class="btn-confirm"
            @click="startCollaboration"
          >
            🔗 开始协同
          </button>
          <button 
            v-else-if="transcriptStore.isConnecting"
            class="btn-confirm"
            disabled
          >
            ⏳ 连接中...
          </button>
          <button 
            v-else
            class="btn-cancel danger"
            @click="stopCollaboration"
          >
            🔌 断开连接
          </button>
        </div>

        <div v-if="transcriptStore.isCollaborating" class="online-users">
          <h4>在线用户 ({{ transcriptStore.connectedUsers?.length || 0 }})</h4>
          <div class="user-list">
            <div 
              v-for="user in transcriptStore.connectedUsers" 
              :key="user.id"
              class="user-item"
            >
              <span class="user-avatar" :style="{ backgroundColor: getRoleColor(user.role) }">
                {{ user.name?.charAt(0) || user.role.charAt(0).toUpperCase() }}
              </span>
              <div class="user-info">
                <span class="user-name">{{ user.name }}</span>
                <span class="user-role">{{ getRoleLabel(user.role) }}</span>
              </div>
              <span class="user-status online"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTranscriptStore } from '@/stores/transcriptStore'
import { useEvidenceStore } from '@/stores/evidenceStore'
import { formatDuration } from '@/utils/storage'
import type { Role } from '@/types'

const transcriptStore = useTranscriptStore()
const evidenceStore = useEvidenceStore()

const showNewCaseModal = ref(false)
const newCaseNumber = ref('')
const newCaseName = ref('')
const showCollaborationPanel = ref(false)
const collabUserName = ref('')

const selectedCaseId = computed({
  get: () => transcriptStore.settings.currentCaseId,
  set: (val: string) => transcriptStore.updateSettings({ currentCaseId: val })
})

const roles: { value: Role; label: string; color: string }[] = [
  { value: 'judge', label: '审判长', color: '#e74c3c' },
  { value: 'clerk', label: '书记员', color: '#3498db' },
  { value: 'prosecutor', label: '公诉人', color: '#f39c12' },
  { value: 'defender', label: '辩护人', color: '#2ecc71' }
]

const tabs = [
  { path: '/', label: '实时笔录', icon: '📝' },
  { path: '/evidence', label: '证据管理', icon: '📁' },
  { path: '/annotations', label: '标注管理', icon: '🏷️' },
  { path: '/timeline', label: '时间轴', icon: '⏱️' },
  { path: '/export', label: '导出归档', icon: '📦' }
]

const handleCaseChange = () => {
  transcriptStore.switchCase(selectedCaseId.value)
  evidenceStore.loadFromStorage(selectedCaseId.value)
}

const createNewCase = () => {
  if (newCaseNumber.value && newCaseName.value) {
    const newCase = transcriptStore.addCase(newCaseNumber.value, newCaseName.value)
    evidenceStore.loadFromStorage(newCase.id)
    showNewCaseModal.value = false
    newCaseNumber.value = ''
    newCaseName.value = ''
  }
}

const startRecording = () => {
  transcriptStore.startRecording()
}

const stopRecording = () => {
  transcriptStore.stopRecording()
}

const toggleTheme = () => {
  const newTheme = transcriptStore.settings.theme === 'dark' ? 'light' : 'dark'
  transcriptStore.updateSettings({ theme: newTheme })
  document.documentElement.setAttribute('data-theme', newTheme)
}

const toggleProjection = () => {
  transcriptStore.updateSettings({ projectionMode: !transcriptStore.settings.projectionMode })
  document.documentElement.setAttribute('data-projection', transcriptStore.settings.projectionMode ? 'true' : 'false')
}

const toggleCollaborationPanel = () => {
  showCollaborationPanel.value = !showCollaborationPanel.value
  if (showCollaborationPanel.value && !collabUserName.value) {
    collabUserName.value = `用户${transcriptStore.settings.currentRole}`
  }
}

const getRoleLabel = (role: string): string => {
  const roleMap: Record<string, string> = {
    judge: '审判长',
    clerk: '书记员',
    prosecutor: '公诉人',
    defender: '辩护人'
  }
  return roleMap[role] || role
}

const getRoleColor = (role: string): string => {
  const colorMap: Record<string, string> = {
    judge: '#e74c3c',
    clerk: '#3498db',
    prosecutor: '#f39c12',
    defender: '#2ecc71'
  }
  return colorMap[role] || '#95a5a6'
}

const startCollaboration = async () => {
  const name = collabUserName.value || `用户${transcriptStore.settings.currentRole}`
  const success = await transcriptStore.initCollaboration(name)
  if (success) {
    evidenceStore.initCollaboration(
      transcriptStore.settings.currentCaseId,
      transcriptStore.settings.currentRole,
      name
    )
  }
}

const stopCollaboration = () => {
  transcriptStore.disconnectCollaboration()
  evidenceStore.disconnectCollaboration()
}
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--toolbar-bg);
  border-bottom: 1px solid var(--border-color);
  gap: 20px;
  flex-wrap: wrap;
}

.toolbar-left, .toolbar-center, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.case-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.case-select {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  min-width: 300px;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
}

.btn-new-case {
  padding: 8px 16px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.2s;

  &:hover {
    background: var(--primary-hover);
  }

  .icon {
    font-weight: bold;
  }
}

.role-selector {
  display: flex;
  align-items: center;
  gap: 12px;

  .label {
    color: var(--text-secondary);
    font-size: 14px;
  }
}

.role-buttons {
  display: flex;
  gap: 8px;
}

.role-btn {
  padding: 6px 14px;
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

  .role-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
}

.recording-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-record, .btn-stop {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.btn-record {
  background: var(--danger-color);
  color: white;

  &:hover {
    background: var(--danger-hover);
  }

  .record-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: white;
    animation: pulse 1.5s infinite;
  }
}

.btn-stop {
  background: var(--danger-color);
  color: white;

  &:hover {
    background: var(--danger-hover);
  }

  .stop-square {
    width: 10px;
    height: 10px;
    background: white;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.timer {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 16px;
  color: var(--danger-color);
  font-weight: 600;
  min-width: 80px;
}

.status-indicators {
  display: flex;
  align-items: center;
}

.save-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);

  &.saving {
    color: var(--primary-color);
  }

  .status-icon {
    font-size: 14px;
  }
}

.view-tabs {
  display: flex;
  gap: 4px;
  background: var(--input-bg);
  padding: 4px;
  border-radius: 8px;
}

.tab-btn {
  padding: 8px 14px;
  border-radius: 6px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;

  &:hover {
    color: var(--text-primary);
    background: var(--hover-bg);
  }

  &.active {
    background: var(--primary-color);
    color: white;
  }

  .tab-icon {
    font-size: 14px;
  }
}

.btn-theme, .btn-projection {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--input-bg);
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: var(--hover-bg);
  }

  &.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
  }
}

.collaboration-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--input-bg);
  border: 1px solid var(--border-color);

  &:hover {
    background: var(--hover-bg);
  }

  .collab-icon {
    font-size: 14px;
    opacity: 0.5;
    transition: all 0.2s;

    &.connected {
      opacity: 1;
      animation: pulse-green 2s infinite;
    }

    &.connecting {
      opacity: 1;
      animation: spin 1s linear infinite;
    }
  }

  .collab-text {
    font-size: 13px;
    color: var(--text-secondary);
  }

  &:has(.connected) .collab-text {
    color: var(--success-color, #2ecc71);
  }
}

@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.collaboration-modal {
  min-width: 380px;
  max-width: 420px;
}

.collaboration-info {
  background: var(--input-bg);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;

    &:not(:last-child) {
      border-bottom: 1px solid var(--border-color);
    }

    .label {
      color: var(--text-secondary);
      font-size: 13px;
    }

    .value {
      color: var(--text-primary);
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;

      &.status-connected {
        color: var(--success-color, #2ecc71);
      }

      &.status-disconnected {
        color: var(--text-secondary);
      }
    }
  }
}

.error-message {
  background: rgba(231, 76, 60, 0.1);
  color: var(--danger-color, #e74c3c);
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 16px;
}

.collaboration-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;

  button {
    flex: 1;
    padding: 10px 16px;
    font-size: 14px;
  }

  .btn-cancel.danger {
    background: var(--danger-color, #e74c3c);
    color: white;

    &:hover {
      background: var(--danger-hover, #c0392b);
    }
  }
}

.online-users {
  h4 {
    margin: 0 0 12px 0;
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 600;
  }

  .user-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 240px;
    overflow-y: auto;
  }

  .user-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--input-bg);
    border-radius: 8px;
    transition: all 0.2s;

    &:hover {
      background: var(--hover-bg);
    }
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .user-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    .user-name {
      font-size: 13px;
      color: var(--text-primary);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .user-role {
      font-size: 12px;
      color: var(--text-secondary);
    }
  }

  .user-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;

    &.online {
      background: var(--success-color, #2ecc71);
      box-shadow: 0 0 0 2px rgba(46, 204, 113, 0.2);
    }
  }
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
  min-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);

  h3 {
    margin: 0 0 20px 0;
    color: var(--text-primary);
  }
}

.form-group {
  margin-bottom: 16px;

  label {
    display: block;
    margin-bottom: 6px;
    color: var(--text-secondary);
    font-size: 14px;
  }

  input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 14px;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--primary-color);
    }
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
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

  &:hover {
    background: var(--primary-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

@media (max-width: 1200px) {
  .toolbar {
    gap: 12px;
  }

  .case-select {
    min-width: 200px;
  }

  .role-selector .label {
    display: none;
  }

  .tab-btn {
    padding: 6px 10px;
    font-size: 12px;
  }
}
</style>
