<script setup lang="ts">
defineProps<{ text: string; type?: string }>()
</script>

<template>
  <span class="chip" :class="type">{{ text }}</span>
</template>

<style scoped>
.chip { background: #f3e6ee; color: #5b2a4e; }
</style>
