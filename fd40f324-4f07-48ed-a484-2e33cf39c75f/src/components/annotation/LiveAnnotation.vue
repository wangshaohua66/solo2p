<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount, type Ref } from 'vue'
import { useAnnotation } from '@/composables/useAnnotation'
import { useAnnotationStore } from '@/stores/annotation'
import type { ToolType } from '@/types'
import { ANNOTATION_COLORS } from '@/types'
import BaseDialog from '@/components/common/BaseDialog.vue'
import {
  Pencil, Square, ArrowRight, Type, Hash,
  Undo2, Redo2, Trash2, Eye, EyeOff, Save,
  X, Circle, Hand
} from 'lucide-vue-next'

defineProps<{
  containerRef: Ref<HTMLElement | null>
}>()

const emit = defineEmits<{
  annotationsChanged: []
}>()

const store = useAnnotationStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const toolbarRef = ref<HTMLElement | null>(null)
const toolbarPos = ref({ x: 16, y: 16 })
const showToolbar = ref(true)
const showPresetDialog = ref(false)
const presetName = ref('')
const draggingToolbar = ref(false)
const dragStart = ref({ x: 0, y: 0, tx: 0, ty: 0 })

function getOffset(): { offsetX: number; offsetY: number } {
  return { offsetX: 0, offsetY: 0 }
}

const {
  isDrawing,
  resize,
  startDraw,
  draw,
  endDraw,
  renderAll,
  undo,
  redo,
  clear
} = useAnnotation(canvasRef, getOffset)

const tools: Array<{ id: ToolType; icon: any; label: string }> = [
  { id: 'none', icon: Hand, label: '选择' },
  { id: 'pen', icon: Pencil, label: '画笔' },
  { id: 'rect', icon: Square, label: '矩形框' },
  { id: 'arrow', icon: ArrowRight, label: '箭头' },
  { id: 'text', icon: Type, label: '文字' },
  { id: 'number', icon: Hash, label: '序号' }
]

const activeTool = computed(() => store.currentTool)
const activeColor = computed(() => store.currentColor)
const strokeW = computed(() => store.strokeWidth)
const canUndo = computed(() => store.canUndo)
const canRedo = computed(() => store.canRedo)
const isActive = computed(() => store.active)
const isVisible = computed(() => store.visible)
const presets = computed(() => store.presets)

function setTool(t: ToolType) {
  if (!store.active && t !== 'none') {
    store.setActive(true)
  }
  store.setTool(t)
}

function setColor(c: string) {
  store.setColor(c)
}

function toggleActive() {
  store.setActive(!store.active)
  if (!store.active) store.setTool('none')
}

function savePreset() {
  if (store.annotations.length === 0) return
  showPresetDialog.value = true
  presetName.value = `预设 ${presets.value.length + 1}`
}

function confirmSavePreset() {
  if (!presetName.value.trim()) return
  store.savePreset(presetName.value.trim())
  showPresetDialog.value = false
}

function applyPreset(id: string) {
  store.applyPreset(id)
  nextTick(renderAll)
  emit('annotationsChanged')
}

function deletePreset(id: string, e: MouseEvent) {
  e.stopPropagation()
  if (confirm('删除此预设？')) store.deletePreset(id)
}

function onMouseDown(e: MouseEvent) {
  if (!store.active || store.currentTool === 'none') return
  const target = e.target as HTMLElement
  if (target.closest('.annotation-toolbar')) return
  startDraw(e.clientX, e.clientY)
}

function onMouseMove(e: MouseEvent) {
  if (isDrawing.value) draw(e.clientX, e.clientY)
}

function onMouseUp() {
  if (isDrawing.value) {
    endDraw()
    nextTick(renderAll)
    emit('annotationsChanged')
  }
}

function startToolbarDrag(e: MouseEvent) {
  draggingToolbar.value = true
  dragStart.value = { x: e.clientX, y: e.clientY, tx: toolbarPos.value.x, ty: toolbarPos.value.y }
  document.addEventListener('mousemove', onToolbarDrag)
  document.addEventListener('mouseup', stopToolbarDrag)
}
function onToolbarDrag(e: MouseEvent) {
  if (!draggingToolbar.value) return
  toolbarPos.value = {
    x: dragStart.value.tx + (e.clientX - dragStart.value.x),
    y: dragStart.value.ty + (e.clientY - dragStart.value.y)
  }
}
function stopToolbarDrag() {
  draggingToolbar.value = false
  document.removeEventListener('mousemove', onToolbarDrag)
  document.removeEventListener('mouseup', stopToolbarDrag)
}

onMounted(() => {
  nextTick(() => {
    resize()
    renderAll()
  })
  window.addEventListener('resize', () => { nextTick(() => { resize(); renderAll() }) })
})

watch(() => store.annotations, () => { nextTick(renderAll); emit('annotationsChanged') }, { deep: true })
watch(() => store.visible, () => { nextTick(renderAll) })

defineExpose({
  clear: () => { clear(); nextTick(renderAll) },
  undo: () => { undo(); nextTick(renderAll) },
  redo: () => { redo(); nextTick(renderAll) },
  resize
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onToolbarDrag)
  document.removeEventListener('mouseup', stopToolbarDrag)
})
</script>

<template>
  <div class="absolute inset-0 pointer-events-none z-20">
    <canvas
      ref="canvasRef"
      class="annotation-canvas w-full h-full"
      :class="{ active: isActive && activeTool !== 'none' && activeTool !== 'eraser' }"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    />

    <div
      v-if="showToolbar"
      ref="toolbarRef"
      class="annotation-toolbar pointer-events-auto absolute"
      :style="{ left: `${toolbarPos.x}px`, top: `${toolbarPos.y}px` }"
    >
      <div class="card p-1.5 flex items-center gap-0.5 shadow-lg">
        <div
          class="w-1 h-6 rounded-full mr-1 cursor-move hover:bg-slate-600/40"
          style="background: var(--bg-tertiary);"
          @mousedown="startToolbarDrag"
        />
        <button
          v-for="t in tools"
          :key="t.id"
          class="btn-icon"
          :style="activeTool === t.id ? { background: 'var(--bg-tertiary)', color: 'var(--accent-color)' } : {}"
          :title="t.label"
          @click="setTool(t.id)"
        >
          <component :is="t.icon" class="w-4 h-4" />
        </button>
        <div class="w-px h-5 mx-0.5" style="background: var(--border-color);" />
        <div class="flex items-center gap-0.5 px-1">
          <button
            v-for="c in ANNOTATION_COLORS"
            :key="c"
            class="w-4 h-4 rounded-full border-2 transition-transform hover:scale-110"
            :style="{ background: c, borderColor: activeColor === c ? '#fff' : 'transparent' }"
            @click="setColor(c)"
          />
        </div>
        <div class="w-px h-5 mx-0.5" style="background: var(--border-color);" />
        <input
          type="range"
          min="1"
          max="10"
          v-model.number="strokeW"
          @input="store.setStrokeWidth(+($event.target as any).value)"
          class="w-12 accent-brand-500 cursor-pointer"
          title="线宽"
        />
        <div class="w-px h-5 mx-0.5" style="background: var(--border-color);" />
        <button class="btn-icon" :class="{ 'opacity-40 cursor-not-allowed': !canUndo }" :disabled="!canUndo" title="撤销 (Ctrl+Z)" @click="undo">
          <Undo2 class="w-4 h-4" />
        </button>
        <button class="btn-icon" :class="{ 'opacity-40 cursor-not-allowed': !canRedo }" :disabled="!canRedo" title="重做 (Ctrl+Y)" @click="redo">
          <Redo2 class="w-4 h-4" />
        </button>
        <button
          class="btn-icon"
          :style="{ color: !isVisible ? 'var(--accent-color)' : undefined }"
          :title="isVisible ? '隐藏标注' : '显示标注'"
          @click="store.toggleVisible"
        >
          <Eye v-if="isVisible" class="w-4 h-4" />
          <EyeOff v-else class="w-4 h-4" />
        </button>
        <button class="btn-icon" title="保存为预设" @click="savePreset">
          <Save class="w-4 h-4" />
        </button>
        <button class="btn-icon text-red-400 hover:!text-red-400" title="清空标注" @click="clear">
          <Trash2 class="w-4 h-4" />
        </button>
        <div class="w-px h-5 mx-0.5" style="background: var(--border-color);" />
        <button
          class="btn-icon"
          :style="{ color: isActive ? 'var(--accent-color)' : undefined }"
          title="开关标注模式"
          @click="toggleActive"
        >
          <Circle class="w-3.5 h-3.5" :class="isActive ? 'fill-brand-500 animate-pulse-highlight' : ''" />
        </button>
      </div>

      <div
        v-if="presets.length > 0"
        class="card mt-1.5 p-1.5 max-w-[280px] max-h-[160px] overflow-y-auto scrollbar-thin"
      >
        <div class="text-[10px] font-medium mb-1 px-1" style="color: var(--text-secondary);">标注预设</div>
        <div class="grid grid-cols-2 gap-1">
          <div
            v-for="p in presets"
            :key="p.id"
            class="group relative p-1.5 rounded hover:bg-slate-700/40 cursor-pointer text-[11px] truncate flex items-center justify-between gap-1"
            @click="applyPreset(p.id)"
          >
            <span class="truncate" style="color: var(--text-primary);">{{ p.name }}</span>
            <button
              class="opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop="deletePreset(p.id, $event)"
            >
              <X class="w-3 h-3 text-red-400" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <BaseDialog v-model="showPresetDialog" title="保存为标注预设" width="400px">
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">预设名称</label>
          <input
            v-model="presetName"
            class="input-field text-sm"
            placeholder="给这个标注组合起个名字..."
          />
        </div>
        <div class="text-xs px-2.5 py-2 rounded-md" style="background: var(--bg-tertiary); color: var(--text-secondary);">
          将保存当前 {{ store.annotations.length }} 个标注元素
        </div>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="showPresetDialog = false">取消</BaseButton>
        <BaseButton variant="primary" @click="confirmSavePreset">保存</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
