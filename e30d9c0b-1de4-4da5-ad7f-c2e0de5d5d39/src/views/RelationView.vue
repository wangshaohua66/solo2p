<template>
  <div class="relation-view">
    <div class="view-header">
      <h1>项目关联图谱</h1>
      <div class="stats-info">
        <span>共 {{ filteredProjects.length }} 个项目</span>
        <span>{{ filteredRelations.length }} 条关联</span>
      </div>
    </div>
    <div class="graph-wrapper">
      <div class="floating-filter" :class="{ collapsed: filterCollapsed }">
        <button class="filter-toggle" @click="filterCollapsed = !filterCollapsed">
          <el-icon><component :is="filterCollapsed ? 'ArrowLeft' : 'Setting'" /></el-icon>
        </button>
        <div class="filter-content" v-show="!filterCollapsed">
          <div class="filter-title">筛选</div>
          <el-select
            v-model="filterCategory"
            placeholder="筛选类别"
            clearable
            size="small"
            style="width: 100%; margin-bottom: 8px"
          >
            <el-option
              v-for="(label, key) in HERITAGE_CATEGORY_LABELS"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
          <el-select
            v-model="filterRegion"
            placeholder="筛选地区"
            clearable
            filterable
            size="small"
            style="width: 100%; margin-bottom: 8px"
          >
            <el-option
              v-for="region in REGIONS"
              :key="region"
              :label="region"
              :value="region"
            />
          </el-select>
          <el-button size="small" @click="resetFilters" style="width: 100%">
            重置筛选
          </el-button>
        </div>
      </div>
      <RelationGraph
        :projects="filteredProjects"
        :relations="filteredRelations"
        :filter-category="filterCategory"
        :filter-region="filterRegion"
        @node-click="handleNodeClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import { HERITAGE_CATEGORY_LABELS, REGIONS } from '@/types'
import type { HeritageCategory } from '@/types'
import RelationGraph from '@/components/RelationGraph.vue'

const router = useRouter()
const projectStore = useProjectStore()

const filterCategory = ref<HeritageCategory | ''>('')
const filterRegion = ref('')
const filterCollapsed = ref(false)

const filteredProjects = computed(() => {
  return projectStore.projects.filter(p => {
    if (filterCategory.value && p.category !== filterCategory.value) {
      return false
    }
    if (filterRegion.value && p.region !== filterRegion.value) {
      return false
    }
    return true
  })
})

const filteredRelations = computed(() => {
  const filteredIds = new Set(filteredProjects.value.map(p => p.id))
  return projectStore.allRelations.filter(
    r => filteredIds.has(r.sourceId) && filteredIds.has(r.targetId)
  )
})

const resetFilters = () => {
  filterCategory.value = ''
  filterRegion.value = ''
}

const handleNodeClick = (projectId: string) => {
  router.push(`/editor/${projectId}`)
}
</script>

<style lang="scss" scoped>
.relation-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;

  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #303133;
  }

  .filter-controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .stats-info {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: #909399;
  }
}

.graph-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.floating-filter {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  padding: 12px;
  width: 180px;
  transition: all 0.3s ease;

  &.collapsed {
    width: auto;
    padding: 8px;

    .filter-toggle {
      right: 0;
      top: 0;
    }
  }
}

.filter-toggle {
  position: absolute;
  left: -32px;
  top: 12px;
  width: 32px;
  height: 32px;
  border: none;
  background: #fff;
  border-radius: 6px 0 0 6px;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #606266;
  font-size: 16px;

  &:hover {
    color: #409EFF;
  }
}

.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

@media (max-width: 768px) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;

    .filter-controls {
      width: 100%;
      flex-wrap: wrap;
    }

    .stats-info {
      width: 100%;
    }
  }
}
</style>
