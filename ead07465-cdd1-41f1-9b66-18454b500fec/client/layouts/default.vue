<template>
  <div class="app-layout h-screen w-screen flex flex-col overflow-hidden bg-primary">
    <AppHeader />
    <div class="flex-1 flex overflow-hidden">
      <main class="flex-1 overflow-hidden">
        <slot />
      </main>
    </div>
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import AppHeader from '~/components/AppHeader.vue'
import ToastContainer from '~/components/ToastContainer.vue'
import { useDispatchStore } from '~/stores/dispatch'

const dispatch = useDispatchStore()

onMounted(() => {
  dispatch.connectSignalR()
})
</script>
