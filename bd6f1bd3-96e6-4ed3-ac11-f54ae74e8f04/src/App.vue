<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '@/stores/ProjectStore'
import TopToolbar from './components/TopToolbar.vue'
import FurnitureLibrary from './components/FurnitureLibrary.vue'
import FloorplanCanvas from './components/FloorplanCanvas.vue'
import RightPanel from './components/RightPanel.vue'
import BottomStatusBar from './components/BottomStatusBar.vue'

const store = useProjectStore()
const canvasRef = ref<InstanceType<typeof FloorplanCanvas> | null>(null)

function handleExportPNG() {
  const dataUrl = canvasRef.value?.exportPNG(2)
  if (dataUrl) {
    const link = document.createElement('a')
    link.download = `${store.state.name || 'floorplan'}.png`
    link.href = dataUrl
    link.click()
  }
}

function handleExportJSON() {
  const json = store.exportJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = `${store.state.name || 'floorplan'}.json`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="app-container">
    <TopToolbar
      @export-png="handleExportPNG"
      @export-json="handleExportJSON"
    />
    
    <div class="main-content">
      <aside class="left-panel">
        <FurnitureLibrary />
      </aside>
      
      <main class="canvas-area">
        <div class="canvas-container">
          <FloorplanCanvas ref="canvasRef" />
        </div>
      </main>
      
      <aside class="right-panel">
        <RightPanel />
      </aside>
    </div>
    
    <BottomStatusBar />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f5f5;
  color: #333;
}
</style>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel {
  width: 260px;
  background: #ffffff;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f0f0f0;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.right-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
