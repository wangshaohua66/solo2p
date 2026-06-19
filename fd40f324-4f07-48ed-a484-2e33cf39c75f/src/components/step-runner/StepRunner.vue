<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useStepRunner } from '@/composables/useStepRunner'
import { useExecution } from '@/composables/useExecution'
import { useStepStore } from '@/stores/step'
import { InjectKeys, type EditorContext } from '@/types'
import {
  Play, Pause, SkipForward, RotateCcw,
  Gauge, Zap, Flag, ChevronRight
} from 'lucide-vue-next'

const editorCtx = inject(InjectKeys.EditorContext, null) as EditorContext | null
const stepStore = useStepStore()

const runner = useStepRunner()
const execution = useExecution()
const {
  currentLine,
  progress,
  stepOver,
  stepContinue,
  reset: runnerReset,
  setSpeed
} = runner

const speedOptions = [
  { label: '0.5x', value: 1000 },
  { label: '1x', value: 500 },
  { label: '2x', value: 250 },
  { label: '3x', value: 150 },
  { label: '极速', value: 50 }
]
const selectedSpeedIdx = ref(1)
const selectedSpeed = computed(() => speedOptions[selectedSpeedIdx.value])

runner.onHighlight((line: number) => {
  editorCtx?.revealLine(line)
  editorCtx?.setPosition(line, 1)
  // highlight via exposed method if possible, use decoration
})

runner.onClear(() => {
  // clear decorations handled internally
})

async function runFull() {
  const code = editorCtx?.getContent() || ''
  if (!code) return
  editorCtx?.focus()
  runnerReset()
  execution.clearLogs()
  await execution.run(code)
  runner.runAll()
}



function doReset() {
  runnerReset()
  execution.clearLogs()
}

watch(selectedSpeed, (s) => setSpeed(s.value), { immediate: true })

watch(() => runner.state.value, async (s) => {
  if (s === 'finished') {
    // on finished
  }
})

function onSelectSpeed(idx: number) {
  selectedSpeedIdx.value = idx
}
</script>

<template>
  <div
    class="flex items-center gap-3 px-3 h-full text-sm"
    style="background: var(--bg-secondary); color: var(--text-secondary); border-color: var(--border-color);"
  >
    <div
      class="step-progress-bar flex-1 max-w-[160px] rounded-full overflow-hidden"
      title="执行进度"
    >
      <div
        class="step-progress-fill"
        :style="{ width: `${progress}%` }"
      />
    </div>

    <div class="flex items-center gap-1">
      <button
        class="btn-icon"
        :disabled="stepStore.state === 'running'"
        :class="stepStore.state === 'running' ? 'opacity-40 cursor-not-allowed' : ''"
        title="重置 (Shift+F5)"
        @click="doReset"
      >
        <RotateCcw class="w-4 h-4" />
      </button>
      <button
        v-if="stepStore.state !== 'running' && stepStore.state !== 'paused'"
        class="btn-icon text-success"
        title="执行全部 (F5)"
        @click="runFull"
      >
        <Play class="w-4 h-4" />
      </button>
      <button
        v-else
        class="btn-icon text-warning"
        title="暂停"
        @click="runner.pause"
      >
        <Pause class="w-4 h-4" />
      </button>
      <button
        class="btn-icon text-brand-400"
        :class="stepStore.state === 'finished' ? 'opacity-60' : ''"
        title="逐行执行 (F10)"
        @click="stepOver"
      >
        <SkipForward class="w-4 h-4" />
      </button>
      <button
        class="btn-icon text-brand-500"
        :class="stepStore.state === 'finished' ? 'opacity-60' : ''"
        title="跳到下一断点 (F8)"
        @click="stepContinue"
      >
        <ChevronRight class="w-4 h-4" />
      </button>
    </div>

    <div class="w-px h-5 mx-1" style="background: var(--border-color);" />

    <div class="flex items-center gap-1.5 relative group">
      <Gauge class="w-3.5 h-3.5" />
      <span class="text-xs font-medium w-10">{{ selectedSpeed.label }}</span>
      <div class="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col p-1 rounded-md card z-20 min-w-[90px]">
        <button
          v-for="(s, idx) in speedOptions"
          :key="s.value"
          class="px-2 py-1 text-xs rounded hover:bg-slate-700/40 text-left transition-colors"
          :class="idx === selectedSpeedIdx ? 'text-brand-400 font-medium' : ''"
          :style="{ color: idx === selectedSpeedIdx ? undefined : 'var(--text-secondary)' }"
          @click="onSelectSpeed(idx)"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <div class="w-px h-5" style="background: var(--border-color);" />

    <div
      class="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md"
      :style="{
        background: stepStore.state === 'error' ? 'rgba(239,68,68,0.15)' : stepStore.state === 'finished' ? 'rgba(16,185,129,0.15)' : 'var(--bg-tertiary)'
      }"
    >
      <Flag
        v-if="stepStore.state === 'paused'"
        class="w-3 h-3 text-warning"
      />
      <Zap
        v-else-if="stepStore.state === 'running'"
        class="w-3 h-3 text-brand-400 animate-pulse"
      />
      <span
        :class="stepStore.state === 'error' ? 'text-red-400' : stepStore.state === 'finished' ? 'text-success' : ''"
      >
        {{ stepStore.state === 'idle' ? '就绪' : stepStore.state === 'running' ? '执行中' : stepStore.state === 'paused' ? '已暂停' : stepStore.state === 'error' ? '出错' : '完成' }}
      </span>
    </div>

    <div
      v-if="currentLine > 0"
      class="text-xs px-2 py-0.5 rounded-md"
      style="background: var(--bg-tertiary);"
    >
      行: <span class="font-medium" style="color: var(--text-primary);">{{ currentLine }}</span>
    </div>
  </div>
</template>
