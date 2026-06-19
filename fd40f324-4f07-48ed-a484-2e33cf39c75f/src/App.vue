<script setup lang="ts">
import { onMounted } from 'vue'
import { useThemeStore } from '@/stores/theme'
import MainLayout from '@/components/layout/MainLayout.vue'

const themeStore = useThemeStore()

onMounted(() => {
  themeStore.applyThemeClass()
})
</script>

<template>
  <MainLayout />
</template>
