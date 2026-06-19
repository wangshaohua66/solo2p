<script setup lang="ts">
import { computed } from 'vue'

const SIDEBAR_WIDTH = 240

const width = computed(() => SIDEBAR_WIDTH)
</script>

<template>
  <div
    class="flex h-full"
    :style="{ width: `${width}px`, flexShrink: 0 }"
  >
    <div class="h-full flex-1 overflow-hidden">
      <slot :width="width" />
    </div>
  </div>
</template>
