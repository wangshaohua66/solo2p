<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSyncStore } from '@/stores/sync'
import { useSync } from '@/composables/useSync'
import { useEditorStore } from '@/stores/editor'
import { useThemeStore } from '@/stores/theme'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import type { SyncType, Breakpoint } from '@/types'
import {
  Users, Link, Unlink, Users2, Copy, Check,
  Radio, Share2, Eye, Edit3, AlertCircle
} from 'lucide-vue-next'

const syncStore = useSyncStore()
const editorStore = useEditorStore()
const themeStore = useThemeStore()
const sync = useSync()

const showDialog = ref(false)
const mode = ref<'create' | 'join'>('create')
const channelInput = ref('')
const channelDisplay = ref('')
const copied = ref(false)

const {
  broadcast,
  on
} = sync

const isConnected = computed(() => syncStore.isConnected)
const channelId = computed(() => syncStore.channelId)
const role = computed(() => syncStore.role)
const clients = computed(() => syncStore.channel?.clients || [])
const lastSyncStr = computed(() => {
  if (!syncStore.lastSyncAt) return ''
  return new Date(syncStore.lastSyncAt).toLocaleTimeString('zh-CN')
})

function openCreate() {
  mode.value = 'create'
  channelInput.value = ''
  showDialog.value = true
}
function openJoin() {
  mode.value = 'join'
  channelInput.value = ''
  showDialog.value = true
}

function confirmChannel() {
  if (mode.value === 'create') {
    const id = syncStore.createChannel(channelInput.value.trim() || undefined)
    sync.createOrJoinChannel(id, 'editor')
    setupListeners()
    channelDisplay.value = id
  } else {
    const success = syncStore.joinChannel(channelInput.value.trim(), 'viewer')
    if (success) {
      sync.createOrJoinChannel(channelInput.value.trim(), 'viewer')
      setupListeners()
      channelDisplay.value = channelInput.value.trim().toUpperCase()
    }
  }
  showDialog.value = false
}

function disconnect() {
  sync.disconnect()
  channelDisplay.value = ''
}

function copyChannel() {
  navigator.clipboard?.writeText(channelId.value)
  copied.value = true
  setTimeout(() => copied.value = false, 1500)
}

function toggleRole() {
  const newRole = role.value === 'editor' ? 'viewer' : 'editor'
  syncStore.setRole(newRole)
  broadcast('sync:hello', { role: newRole })
}

const listeners: Array<() => void> = []
function setupListeners() {
  listeners.forEach(l => l())
  listeners.length = 0

  listeners.push(on('code:change' as SyncType, (payload: { content: string }) => {
    if (role.value === 'viewer' && editorStore.activeFile) {
      editorStore.updateContent(payload.content)
    }
  }))

  listeners.push(on('cursor:change' as SyncType, (_payload: { line: number; col: number }) => {
    // cursor sync
  }))

  listeners.push(on('breakpoint:toggle' as SyncType, (payload: { line: number }) => {
    if (role.value === 'viewer') {
      editorStore.toggleBreakpoint(payload.line)
    }
  }))

  listeners.push(on('theme:change' as SyncType, (_payload: { theme: string }) => {
    // theme sync
  }))

  listeners.push(on('line:highlight' as SyncType, (_payload: { line: number }) => {
    // highlight
  }))
}

watch(() => editorStore.activeContent, (content) => {
  if (isConnected.value && role.value === 'editor') {
    broadcast('code:change', { content, fileId: editorStore.activeFileId })
  }
}, { flush: 'post' })

watch(() => editorStore.activeBreakpoints, (bps: Breakpoint[]) => {
  if (isConnected.value && role.value === 'editor') {
    broadcast('breakpoint:toggle', { breakpoints: bps })
  }
}, { deep: true, flush: 'post' })

watch(() => themeStore.currentTheme, (t) => {
  if (isConnected.value && role.value === 'editor') {
    broadcast('theme:change', { theme: t })
  }
}, { flush: 'post' })
</script>

<template>
  <div
    class="card p-2.5 text-sm h-full flex flex-col"
    style="background: var(--bg-secondary);"
  >
    <div class="flex items-center justify-between mb-2.5">
      <div class="flex items-center gap-1.5">
        <Users2 class="w-4 h-4 text-brand-400" />
        <span class="font-medium" style="color: var(--text-primary);">多标签同步</span>
      </div>
      <button
        v-if="!isConnected"
        class="btn-ghost text-xs flex items-center gap-1"
        @click="openCreate"
      >
        <Link class="w-3.5 h-3.5" /> 创建
      </button>
    </div>

    <div v-if="!isConnected" class="flex-1 flex flex-col items-center justify-center text-center py-6">
      <Share2 class="w-9 h-9 opacity-30 mb-2" />
      <div class="text-xs mb-1" style="color: var(--text-secondary);">创建或加入同步频道</div>
      <div class="text-[11px] mb-3 opacity-60">支持多浏览器标签页实时同步</div>
      <div class="flex items-center gap-1.5">
        <BaseButton variant="primary" size="sm" @click="openCreate">
          <Link class="w-3 h-3" /> 创建频道
        </BaseButton>
        <BaseButton variant="secondary" size="sm" @click="openJoin">
          <Users class="w-3 h-3" /> 加入
        </BaseButton>
      </div>
    </div>

    <div v-else class="flex-1 flex flex-col space-y-2.5 overflow-y-auto scrollbar-thin">
      <div class="p-2 rounded-md" style="background: var(--bg-tertiary);">
        <div class="flex items-center justify-between mb-1">
          <div class="text-[10px]" style="color: var(--text-secondary);">频道 ID</div>
          <span
            class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold"
            :class="role === 'editor' ? 'bg-brand-500/20 text-brand-400' : 'bg-success/20 text-success'"
          >
            {{ role === 'editor' ? '编辑者' : '观察者' }}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <span
            class="flex-1 font-mono font-bold tracking-wider text-base"
            style="color: var(--text-primary);"
          >{{ channelId }}</span>
          <button
            class="btn-icon"
            style="width: 28px; height: 28px;"
            @click="copyChannel"
          >
            <Check v-if="copied" class="w-3.5 h-3.5 text-success" />
            <Copy v-else class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs">
        <span style="color: var(--text-secondary);">在线用户</span>
        <span class="font-medium" style="color: var(--text-primary);">{{ clients.length }}</span>
      </div>

      <div class="space-y-1">
        <div
          v-for="c in clients"
          :key="c.id"
          class="flex items-center gap-2 p-1.5 rounded text-xs"
          style="background: var(--bg-tertiary);"
        >
          <div
            class="w-1.5 h-1.5 rounded-full"
            :class="c.role === 'editor' ? 'bg-brand-400 animate-pulse' : 'bg-success'"
          />
          <span class="flex-1 truncate font-mono text-[11px]" style="color: var(--text-primary);">
            {{ c.id.slice(-8) }}
            <span v-if="c.id === syncStore.clientId" class="opacity-60">(我)</span>
          </span>
          <span class="text-[10px] opacity-60 uppercase">{{ c.role }}</span>
        </div>
      </div>

      <div v-if="lastSyncStr" class="text-[10px] opacity-60 flex items-center gap-1 px-1">
        <Radio class="w-2.5 h-2.5 text-success" />
        最后同步: {{ lastSyncStr }}
      </div>

      <div class="flex-1" />

      <div class="space-y-1.5 pt-2 border-t" style="border-color: var(--border-color);">
        <button
          class="w-full btn-secondary text-xs flex items-center justify-center gap-1"
          @click="toggleRole"
        >
          <component :is="role === 'editor' ? Eye : Edit3" class="w-3 h-3" />
          切换为{{ role === 'editor' ? '观察者' : '编辑者' }}
        </button>
        <button
          class="w-full text-xs flex items-center justify-center gap-1 py-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
          @click="disconnect"
        >
          <Unlink class="w-3 h-3" /> 断开连接
        </button>
      </div>
    </div>

    <BaseDialog
      v-model="showDialog"
      :title="mode === 'create' ? '创建同步频道' : '加入同步频道'"
      width="420px"
    >
      <div class="space-y-3">
        <div
          v-if="mode === 'create'"
          class="p-2.5 rounded-md text-xs flex items-start gap-2"
          style="background: rgba(99, 102, 241, 0.1); color: var(--text-secondary);"
        >
          <AlertCircle class="w-4 h-4 flex-shrink-0 text-brand-400 mt-0.5" />
          <span>创建频道后，将频道ID分享给其他人，他们可以在新标签页输入此ID加入观看。<br />创建者默认拥有编辑权限。</span>
        </div>
        <div
          v-else
          class="p-2.5 rounded-md text-xs flex items-start gap-2"
          style="background: rgba(16, 185, 129, 0.1); color: var(--text-secondary);"
        >
          <AlertCircle class="w-4 h-4 flex-shrink-0 text-success mt-0.5" />
          <span>输入分享给你的频道ID加入。加入后默认为观察者模式（只读），可随时切换角色。</span>
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">
            {{ mode === 'create' ? '频道名称（可选，留空自动生成）' : '频道 ID' }}
          </label>
          <BaseInput
            v-model="channelInput"
            :placeholder="mode === 'create' ? '例如 my-demo-2024' : '输入6位频道ID'"
          />
        </div>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="showDialog = false">取消</BaseButton>
        <BaseButton variant="primary" @click="confirmChannel">
          {{ mode === 'create' ? '创建并开始' : '加入频道' }}
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
