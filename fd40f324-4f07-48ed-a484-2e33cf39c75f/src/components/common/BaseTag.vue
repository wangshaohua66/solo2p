<script setup lang="ts">
import { computed } from 'vue'

const emit = defineEmits<{
  close: []
  click: []
}>()

const props = withDefaults(defineProps<{
  text?: string
  closable?: boolean
  color?: string
  size?: 'sm' | 'md'
}>(), {
  closable: false,
  size: 'md'
})

const classes = computed(() => {
  const base = props.size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-0.5 text-xs'
  return `tag inline-flex items-center gap-1 ${base}`
})

function tagStyle() {
  if (props.color) {
    return {
      background: `${props.color}20`,
      color: props.color,
      borderColor: `${props.color}50`
    }
  }
  return {}
}
</script>

<template>
  <span
    :class="classes"
    :style="tagStyle()"
    @click="emit('click')"
  >
    <slot>{{ text }}</slot>
    <button
      v-if="closable"
      class="ml-0.5 hover:opacity-80 rounded-full w-3 h-3 flex items-center justify-center"
      @click.stop="emit('close')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="w-2 h-2">
        <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
      </svg>
    </button>
  </span>
</template>
