<template>
  <el-button
    :type="isRecording ? 'danger' : 'primary'"
    :icon="isRecording ? 'MicrophoneFilled' : 'Microphone'"
    :size="size"
    :circle="circle"
    :loading="isProcessing"
    @click="toggleRecording"
    :class="[
      'speech-input-btn',
      { 'is-recording': isRecording, 'is-processing': isProcessing }
    ]"
  >
    <span v-if="!circle && !isRecording">语音输入</span>
    <span v-if="!circle && isRecording">停止录音</span>
  </el-button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Microphone, MicrophoneFilled } from '@element-plus/icons-vue'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'

interface Props {
  modelValue?: string
  fieldContext?: string
  size?: 'small' | 'default' | 'large'
  circle?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  fieldContext: '',
  size: 'small',
  circle: false,
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'start'): void
  (e: 'end', value: string): void
  (e: 'error', error: string): void
}>()

const {
  isRecording,
  isProcessing,
  interimTranscript,
  finalTranscript,
  startRecording,
  stopRecording,
  cancelRecording
} = useSpeechRecognition()

async function toggleRecording() {
  if (props.disabled) return

  if (isRecording.value) {
    emit('end', '')
    const text = await stopRecording(props.fieldContext)
    if (text) {
      const newText = props.modelValue ? props.modelValue + text : text
      emit('update:modelValue', newText)
      emit('end', text)
    }
  } else {
    emit('start')
    await startRecording('field', props.fieldContext)
  }
}

defineExpose({
  startRecording,
  stopRecording,
  cancelRecording,
  isRecording,
  isProcessing
})
</script>

<style scoped lang="scss">
.speech-input-btn {
  transition: all 0.3s ease;

  &.is-recording {
    animation: pulse 1.5s ease-in-out infinite;
  }

  &.is-processing {
    opacity: 0.7;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.7);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 8px rgba(245, 108, 108, 0);
  }
}
</style>
