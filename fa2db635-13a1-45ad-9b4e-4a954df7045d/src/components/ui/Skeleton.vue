<script setup lang="ts">
defineProps<{ rows?: number; height?: string }>()
</script>

<template>
  <div class="space-y-3">
    <div v-for="i in rows || 3" :key="i" class="skeleton" :style="{ height: height || '14px' }"></div>
  </div>
</template>
