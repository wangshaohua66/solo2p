<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReviewStore } from '@/stores/reviewStore'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import CanvasReview from '@/components/CanvasReview.vue'
import AnnotationPanel from '@/components/AnnotationPanel.vue'
import ReviewToolbar from '@/components/ReviewToolbar.vue'
import ProjectTree from '@/components/ProjectTree.vue'

const route = useRoute()
const router = useRouter()
const reviewStore = useReviewStore()
const themeStore = useThemeStore()
const authStore = useAuthStore()

const loading = ref(false)
const showMobilePanel = ref<'tree' | 'annotations' | null>(null)

const documentId = computed(() => route.params.documentId as string)
const showAnnotationPanel = computed(() => !themeStore.annotationPanelCollapsed)
const showSidebar = computed(() => !themeStore.sidebarCollapsed)

async function loadDocument() {
  if (!documentId.value) return
  loading.value = true
  try {
    await reviewStore.loadDocument(documentId.value)
  } finally {
    loading.value = false
  }
}

watch(documentId, (newId) => {
  if (newId) {
    reviewStore.clearAll()
    loadDocument()
  }
})

onMounted(() => {
  if (authStore.token) {
    reviewStore.setupWebSocketListeners()
  }
  loadDocument()
})

onUnmounted(() => {
  reviewStore.clearAll()
})
</script>

<template>
  <div class="review-view" :class="{ 'panel-collapsed': !showAnnotationPanel, dark: themeStore.mode === 'dark' }">
    <div v-if="showSidebar" class="sidebar-wrapper">
      <ProjectTree />
    </div>

    <div class="review-main">
      <ReviewToolbar />

      <div class="review-body" v-loading="loading">
        <div class="canvas-area">
          <CanvasReview v-if="reviewStore.currentVersion" />
          <el-empty
            v-else
            description="暂无图纸数据"
            :image-size="120"
          >
            <el-button type="primary" @click="router.back()">返回</el-button>
          </el-empty>
        </div>

        <div v-if="showAnnotationPanel" class="panel-area">
          <AnnotationPanel />
        </div>
      </div>

      <div class="mobile-bottom-nav">
        <div
          class="nav-item"
          :class="{ active: showMobilePanel === 'tree' }"
          @click="showMobilePanel = showMobilePanel === 'tree' ? null : 'tree'"
        >
          <el-icon><FolderOpened /></el-icon>
          <span>项目</span>
        </div>
        <div
          class="nav-item"
          :class="{ active: showMobilePanel === 'annotations' }"
          @click="showMobilePanel = showMobilePanel === 'annotations' ? null : 'annotations'"
        >
          <el-icon><ChatDotRound /></el-icon>
          <span>批注</span>
          <el-badge v-if="reviewStore.annotations.length > 0" :value="reviewStore.annotations.length" class="badge" />
        </div>
      </div>

      <el-drawer
        v-model="showMobilePanel"
        :title="showMobilePanel === 'tree' ? '项目列表' : '批注列表'"
        direction="btt"
        size="70%"
        class="mobile-drawer"
      >
        <ProjectTree v-if="showMobilePanel === 'tree'" />
        <AnnotationPanel v-else-if="showMobilePanel === 'annotations'" />
      </el-drawer>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.review-view {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: $bg-light;

  .dark & {
    background: $dark-bg-base;
  }
}

.sidebar-wrapper {
  width: $sider-width;
  flex-shrink: 0;
  height: 100%;
  overflow: hidden;
}

.review-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  position: relative;
}

.review-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.canvas-area {
  flex: 1;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.panel-area {
  width: $panel-width;
  flex-shrink: 0;
  height: 100%;
  overflow: hidden;
}

.panel-collapsed .panel-area {
  display: none;
}

.mobile-bottom-nav {
  display: none;
}

.badge {
  margin-left: 4px;

  :deep(.el-badge__content) {
    top: -4px;
  }
}

@media (max-width: 1024px) {
  .sidebar-wrapper {
    width: 200px;
  }

  .panel-area {
    width: 320px;
  }
}

@media (max-width: 768px) {
  .sidebar-wrapper,
  .panel-area {
    display: none;
  }

  .review-body {
    padding-bottom: 56px;
  }

  .mobile-bottom-nav {
    display: flex;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: $bg-base;
    border-top: 1px solid $border-color;
    z-index: 100;

    .dark & {
      background: $dark-bg-light;
      border-top-color: $dark-border-color;
    }

    .nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      cursor: pointer;
      color: $text-secondary;
      transition: color $transition-fast;

      &:hover,
      &.active {
        color: $primary-color;
      }

      span {
        font-size: 11px;
      }
    }
  }
}
</style>
