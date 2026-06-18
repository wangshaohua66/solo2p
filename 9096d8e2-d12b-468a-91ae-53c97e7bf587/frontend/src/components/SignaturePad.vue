<template>
  <div class="signature-pad-wrapper" :style="{ width: width + 'px' }">
    <div class="pad-header" v-if="showHeader">
      <div class="pad-title">
        <el-icon color="#3b82f6"><EditPen /></el-icon>
        <span>{{ title }}</span>
      </div>
      <div class="pad-actions">
        <el-button size="small" @click="clearSignature" :disabled="disabled">
          <el-icon><RefreshLeft /></el-icon>
          清除
        </el-button>
        <el-button size="small" @click="undo" :disabled="disabled || historyStack.length === 0">
          <el-icon><RefreshLeft /></el-icon>
          撤销
        </el-button>
      </div>
    </div>

    <div
      class="canvas-container"
      :class="{ 'has-sign': hasSignature, readonly: disabled }"
      ref="containerRef"
      @touchstart.prevent="handleTouchStart"
      @touchmove.prevent="handleTouchMove"
      @touchend.prevent="handleTouchEnd"
    >
      <canvas
        ref="canvasRef"
        class="signature-canvas"
        :style="{ width: width + 'px', height: height + 'px' }"
      />
      <div v-if="!hasSignature && placeholder" class="placeholder-text">
        <el-icon :size="28" color="#d1d5db"><EditPen /></el-icon>
        <p>{{ placeholder }}</p>
      </div>
    </div>

    <div v-if="showSignerInfo" class="signer-info">
      <el-form :model="signerForm" size="small" inline>
        <el-form-item label="签名人">
          <el-input
            v-model="signerForm.name"
            placeholder="请输入签名人姓名"
            :disabled="disabled"
            style="width: 150px;"
          />
        </el-form-item>
        <el-form-item label="时间">
          <span class="signed-time">{{ signedTime || '--' }}</span>
        </el-form-item>
      </el-form>
    </div>

    <div class="pad-footer" v-if="showFooter && !disabled">
      <div class="pad-tip">
        <el-icon color="#f59e0b"><InfoFilled /></el-icon>
        请使用鼠标或触摸屏在上方区域手写签名
      </div>
      <el-button type="primary" size="small" @click="confirmSignature" :disabled="!hasSignature">
        <el-icon><Check /></el-icon>
        确认签名
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
  shallowRef
} from 'vue'
import SignaturePad from 'signature_pad'
import { EditPen, RefreshLeft, InfoFilled, Check } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    title?: string
    placeholder?: string
    width?: number
    height?: number
    penColor?: string
    backgroundColor?: string
    disabled?: boolean
    showHeader?: boolean
    showFooter?: boolean
    showSignerInfo?: boolean
    requireSigner?: boolean
  }>(),
  {
    title: '电子签名',
    placeholder: '请在此处签名',
    width: 560,
    height: 200,
    penColor: '#1f2937',
    backgroundColor: '#ffffff',
    disabled: false,
    showHeader: true,
    showFooter: false,
    showSignerInfo: true,
    requireSigner: true
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'change', v: { dataUrl: string; signerName?: string; signedAt?: string }): void
  (e: 'confirm', v: { dataUrl: string; signerName?: string; signedAt?: string }): void
  (e: 'clear'): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const signaturePad = shallowRef<SignaturePad | null>(null)
const hasSignature = ref(false)
const historyStack = ref<string[]>([])
const signedTime = ref('')
const signerForm = reactive({
  name: ''
})

function resizeCanvas() {
  if (!canvasRef.value || !signaturePad.value) return
  const canvas = canvasRef.value
  const ratio = Math.max(window.devicePixelRatio || 1, 1)

  canvas.width = canvas.offsetWidth * ratio
  canvas.height = canvas.offsetHeight * ratio
  canvas.getContext('2d')?.scale(ratio, ratio)

  if (props.modelValue) {
    signaturePad.value.fromDataURL(props.modelValue)
    hasSignature.value = true
  } else {
    signaturePad.value.clear()
    hasSignature.value = false
  }
}

function initSignaturePad() {
  if (!canvasRef.value) return

  signaturePad.value = new SignaturePad(canvasRef.value, {
    penColor: props.penColor,
    backgroundColor: props.backgroundColor,
    minWidth: 1.5,
    maxWidth: 3.5,
    velocityFilterWeight: 0.7,
    onBegin: () => {
      if (historyStack.value.length > 20) {
        historyStack.value.shift()
      }
    },
    onEnd: () => {
      if (!signaturePad.value) return
      const data = signaturePad.value.toDataURL()
      historyStack.value.push(data)
      updateState()
    }
  })

  resizeCanvas()

  if (props.modelValue) {
    signaturePad.value.fromDataURL(props.modelValue)
    hasSignature.value = true
  }
}

function updateState() {
  if (!signaturePad.value) return
  hasSignature.value = !signaturePad.value.isEmpty()

  if (hasSignature.value) {
    const dataUrl = signaturePad.value.toDataURL('image/png')
    emit('update:modelValue', dataUrl)
    emit('change', {
      dataUrl,
      signerName: signerForm.name || undefined,
      signedAt: signedTime.value || undefined
    })
  } else {
    emit('update:modelValue', '')
  }
}

function clearSignature() {
  if (!signaturePad.value || props.disabled) return
  historyStack.value = []
  signaturePad.value.clear()
  hasSignature.value = false
  signedTime.value = ''
  emit('clear')
  emit('update:modelValue', '')
}

function undo() {
  if (!signaturePad.value || props.disabled || historyStack.value.length === 0) return
  historyStack.value.pop()

  if (historyStack.value.length > 0) {
    const prevData = historyStack.value[historyStack.value.length - 1]
    signaturePad.value.fromDataURL(prevData)
    hasSignature.value = true
  } else {
    signaturePad.value.clear()
    hasSignature.value = false
  }
}

function confirmSignature() {
  if (!signaturePad.value || !hasSignature.value) return

  if (props.requireSigner && !signerForm.name.trim()) {
    import('element-plus').then(({ ElMessage }) => {
      ElMessage.warning('请输入签名人姓名')
    })
    return
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  signedTime.value = now

  const dataUrl = signaturePad.value.toDataURL('image/png')

  emit('confirm', {
    dataUrl,
    signerName: signerForm.name || undefined,
    signedAt: now
  })
}

function handleTouchStart(e: TouchEvent) {
  if (props.disabled) return
  const touch = e.touches[0]
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  canvasRef.value?.dispatchEvent(mouseEvent)
}

function handleTouchMove(e: TouchEvent) {
  if (props.disabled) return
  const touch = e.touches[0]
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  canvasRef.value?.dispatchEvent(mouseEvent)
}

function handleTouchEnd(e: TouchEvent) {
  if (props.disabled) return
  const mouseEvent = new MouseEvent('mouseup', {})
  canvasRef.value?.dispatchEvent(mouseEvent)
}

watch(
  () => props.modelValue,
  (val) => {
    if (val && signaturePad.value && signaturePad.value.isEmpty()) {
      signaturePad.value.fromDataURL(val)
      hasSignature.value = true
    }
  }
)

watch(
  () => props.disabled,
  (val) => {
    if (signaturePad.value) {
      signaturePad.value.off()
    }
  }
)

onMounted(async () => {
  await nextTick()
  initSignaturePad()

  window.addEventListener('resize', resizeCanvas)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
  if (signaturePad.value) {
    signaturePad.value.off()
  }
})

defineExpose({
  clear: clearSignature,
  undo,
  isEmpty: () => !hasSignature.value,
  getDataUrl: () => (signaturePad.value ? signaturePad.value.toDataURL('image/png') : ''),
  confirm: confirmSignature
})
</script>

<style scoped lang="scss">
.signature-pad-wrapper {
  background: white;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  transition: all 0.2s;

  &:hover {
    border-color: #93c5fd;
  }
}

.pad-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-bottom: 1px solid #e0e7ff;

  .pad-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: #1e40af;
  }

  .pad-actions {
    display: flex;
    gap: 8px;
  }
}

.canvas-container {
  position: relative;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: crosshair;

  &.has-sign {
    .placeholder-text {
      display: none;
    }
  }

  &.readonly {
    cursor: not-allowed;
    background: #f9fafb;
  }
}

.signature-canvas {
  display: block;
  touch-action: none;
}

.placeholder-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  pointer-events: none;
  background-image: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 28px,
    #f3f4f6 28px,
    #f3f4f6 29px
  );

  p {
    margin: 8px 0 0;
    font-size: 14px;
  }
}

.signer-info {
  padding: 10px 16px;
  background: #f9fafb;
  border-top: 1px solid #f3f4f6;

  :deep(.el-form-item) {
    margin-bottom: 0;
  }

  .signed-time {
    color: #374151;
    font-family: 'SF Mono', Monaco, monospace;
  }
}

.pad-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: #fafafa;
  border-top: 1px solid #f3f4f6;

  .pad-tip {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #6b7280;
  }
}
</style>
