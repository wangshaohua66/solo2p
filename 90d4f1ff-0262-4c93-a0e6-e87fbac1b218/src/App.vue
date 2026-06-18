<template>
  <router-view />
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSignalRService } from '@/services/signalr'

const authStore = useAuthStore()
const { startConnection, stopConnection } = useSignalRService()

watch(
  () => authStore.isAuthenticated,
  (val) => {
    if (val) {
      startConnection()
    } else {
      stopConnection()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  stopConnection()
})
</script>
