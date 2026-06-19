<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
}>(), {
  variant: 'secondary',
  size: 'md',
  disabled: false,
  loading: false,
  fullWidth: false
})

const emit = defineEmits<{
  click: [e: MouseEvent]
}>()

const classes = computed(() => {
  const sizeMap = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  }
  const variantMap: Record<string, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    icon: 'btn-icon',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 rounded-md text-sm px-3 py-1.5 font-medium transition-all'
  }
  return [
    variantMap[props.variant],
    props.variant !== 'icon' ? sizeMap[props.size] : '',
    props.disabled ? 'opacity-50 cursor-not-allowed' : '',
    props.fullWidth ? 'w-full' : '',
    'inline-flex items-center justify-center gap-1.5 select-none'
  ].join(' ')
})

function onClick(e: MouseEvent) {
  if (props.disabled || props.loading) return
  emit('click', e)
}
</script>

<template>
  <button
    :class="classes"
    :disabled="disabled || loading"
    @click="onClick"
  >
    <svg v-if="loading" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
    </svg>
    <slot />
  </button>
</template>
