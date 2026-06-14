<script setup lang="ts">
import { onMounted } from 'vue'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { useReviewStore } from '@/stores/reviewStore'

const themeStore = useThemeStore()
const authStore = useAuthStore()
const reviewStore = useReviewStore()

onMounted(() => {
  themeStore.applyTheme()
  if (authStore.token) {
    reviewStore.setupWebSocketListeners()
  }
})
</script>

<template>
  <router-view />
</template>

<style lang="scss">
#app {
  width: 100%;
  height: 100%;
}
</style>
