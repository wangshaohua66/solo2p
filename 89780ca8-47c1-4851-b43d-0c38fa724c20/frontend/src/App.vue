<template>
  <div class="flex min-h-screen">
    <Sidebar :collapsed="sidebarCollapsed" @toggle="sidebarCollapsed = !sidebarCollapsed" />
    <main
      class="flex-1 transition-all duration-300"
      :class="sidebarCollapsed ? 'ml-[72px]' : 'ml-[240px]'"
      style="min-height: 100vh;"
    >
      <div class="p-6">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from '@/components/Sidebar.vue'

const sidebarCollapsed = ref(false)
</script>
