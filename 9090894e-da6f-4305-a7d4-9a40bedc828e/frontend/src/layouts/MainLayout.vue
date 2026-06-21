<script setup lang="ts">
import { ref, computed } from 'vue'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'
import { RouterView } from 'vue-router'

const isCollapsed = ref(false)

const sidebarWidth = computed(() => isCollapsed.value ? '64px' : '240px')
</script>

<template>
  <div class="main-layout">
    <Sidebar
      :collapsed="isCollapsed"
      :width="sidebarWidth"
    />
    <div class="main-container" :style="{ marginLeft: sidebarWidth }">
      <Header
        :collapsed="isCollapsed"
        @toggle="isCollapsed = !isCollapsed"
      />
      <main class="main-content">
        <RouterView v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.main-layout {
  width: 100%;
  height: 100vh;
  display: flex;
  background-color: $bg-color;
}

.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  transition: margin-left 0.25s ease;
}

.main-content {
  flex: 1;
  overflow: auto;
  padding: 0;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
