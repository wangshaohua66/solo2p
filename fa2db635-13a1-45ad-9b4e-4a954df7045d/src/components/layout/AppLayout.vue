<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import Topbar from './Topbar.vue'
import MobileTabBar from './MobileTabBar.vue'
</script>

<template>
  <div class="min-h-screen flex">
    <Sidebar />
    <div class="flex-1 min-w-0 flex flex-col">
      <Topbar />
      <main class="flex-1 px-4 lg:px-8 py-6 pb-24 lg:pb-8 max-w-[1600px] w-full mx-auto">
        <RouterView />
      </main>
    </div>
    <MobileTabBar />
  </div>
</template>
