<template>
  <div id="app">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <div id="nprogress-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ElNotification } from 'element-plus'
import NProgress from 'nprogress'
import { watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

NProgress.configure({
  showSpinner: false,
  trickleSpeed: 200,
  minimum: 0.3
})

watch(
  () => route.fullPath,
  () => {
    NProgress.start()
    setTimeout(() => {
      NProgress.done()
    }, 300)
  }
)

const notification = (message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
  ElNotification({
    message,
    type,
    duration: 3000,
    showClose: true
  })
}

defineExpose({
  notification
})
</script>

<style scoped>
#app {
  min-height: 100vh;
  background-color: var(--color-bg-page);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
