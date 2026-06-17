<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'
defineProps<{ text?: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-wine-300">
    <Inbox :size="40" :stroke-width="1.2" />
    <p class="mt-3 text-sm">{{ text || '暂无数据' }}</p>
  </div>
</template>
