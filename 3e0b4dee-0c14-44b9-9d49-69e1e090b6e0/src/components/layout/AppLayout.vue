<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute, RouterView } from 'vue-router';
import { useProjectStore } from '@/stores/project';
import ResourceTree from '@/components/common/ResourceTree.vue';
import PropertyPanel from '@/components/common/PropertyPanel.vue';
import TopToolbar from '@/components/layout/TopToolbar.vue';

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();

const leftWidth = ref(240);
const rightWidth = ref(280);
const drawerRightOpen = ref(false);
const leftCollapsed = ref(false);
const winWidth = ref(window.innerWidth);

const isSmall = computed(() => winWidth.value <= 1280);
const layoutClass = computed(() => ({
  'app-layout': true,
  'left-panel-collapsed': leftCollapsed.value,
  'drawer-open': drawerRightOpen.value && isSmall.value
}));

function onResize() { winWidth.value = window.innerWidth; }
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

function onLeftResize(e: MouseEvent) {
  if (leftCollapsed.value) return;
  const startX = e.clientX;
  const startW = leftWidth.value;
  const move = (ev: MouseEvent) => {
    leftWidth.value = Math.max(180, Math.min(480, startW + ev.clientX - startX));
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

function onRightResize(e: MouseEvent) {
  if (isSmall.value) return;
  const startX = e.clientX;
  const startW = rightWidth.value;
  const move = (ev: MouseEvent) => {
    rightWidth.value = Math.max(220, Math.min(480, startW - ev.clientX + startX));
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

const currentPage = computed(() => {
  const n = route.name as string;
  const map: Record<string, string> = {
    'sprite-editor': '精灵编辑',
    'animation-editor': '动画编排',
    'tilemap-editor': '地图编辑',
    'audio-manager': '音效管理'
  };
  return map[n] || '';
});

onMounted(() => {
  const pid = route.params.projectId as string;
  if (pid && !projectStore.currentProjectId) projectStore.openProject(pid);
});
</script>

<template>
  <div :class="layoutClass">
    <TopToolbar @toggle-left="leftCollapsed = !leftCollapsed"
      @toggle-right="drawerRightOpen = !drawerRightOpen"
      :page="currentPage" />
    <div class="app-main">
      <aside class="left-panel" :style="{ flexBasis: leftCollapsed ? '0px' : leftWidth + 'px' }">
        <ResourceTree />
      </aside>
      <div v-if="!leftCollapsed" class="resizer resizer-left"
        @mousedown="onLeftResize" title="拖动调整左侧宽度"></div>
      <main class="canvas-area">
        <RouterView v-slot="{ Component }">
          <component :is="Component" />
        </RouterView>
      </main>
      <div v-if="!isSmall" class="resizer resizer-right"
        @mousedown="onRightResize" title="拖动调整右侧宽度"></div>
      <aside class="right-panel" :style="isSmall ? {} : { flexBasis: rightWidth + 'px' }">
        <PropertyPanel />
      </aside>
      <div v-if="isSmall && drawerRightOpen" class="drawer-mask" @click="drawerRightOpen = false"></div>
    </div>
  </div>
</template>

<style scoped>
/* layout classes defined in layout.css */
</style>
