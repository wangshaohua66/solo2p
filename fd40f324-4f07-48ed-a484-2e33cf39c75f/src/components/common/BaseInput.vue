<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  type?: string
  disabled?: boolean
  error?: string
  size?: 'sm' | 'md'
}>(), {
  modelValue: '',
  placeholder: '',
  type: 'text',
  disabled: false,
  error: '',
  size: 'md'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: [e: FocusEvent]
  blur: [e: FocusEvent]
  keydown: [e: KeyboardEvent]
  enter: [value: string]
}>()

const inner = ref(props.modelValue)

watch(() => props.modelValue, (v) => { inner.value = v })

const wrapperClass = computed(() => [
  'relative',
  props.error ? 'ring-1 ring-red-400 rounded-md' : ''
].join(' '))

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  inner.value = v
  emit('update:modelValue', v)
}

function onKeyDown(e: KeyboardEvent) {
  emit('keydown', e)
  if (e.key === 'Enter') emit('enter', inner.value)
}
</script>

<template>
  <div :class="wrapperClass">
    <input
      :type="type"
      :value="inner"
      :placeholder="placeholder"
      :disabled="disabled"
      class="input-field"
      :class="size === 'sm' ? 'py-1 px-2 text-xs' : ''"
      @input="onInput"
      @focus="(e) => emit('focus', e)"
      @blur="(e) => emit('blur', e)"
      @keydown="onKeyDown"
    />
    <div
      v-if="error"
      class="text-xs text-red-400 mt-1 pl-1"
    >{{ error }}</div>
  </div>
</template>
