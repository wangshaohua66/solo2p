<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { GlazeRecipe, FiringType } from '@/types'
import { ElMessage } from 'element-plus'

const router = useRouter()

const searchKeyword = ref('')
const filterType = ref<'' | FiringType>('')
const showArchived = ref(false)
const viewMode = ref<'list' | 'tree'>('list')

const recipes = ref<GlazeRecipe[]>([
  {
    id: '1',
    name: '基础透明釉',
    code: 'G-T-001',
    version: 3,
    isArchived: false,
    firingType: 'glaze',
    temperatureMin: 1220,
    temperatureMax: 1260,
    atmosphere: '氧化焰',
    description: '经典透明釉配方，适用于各类坯体，光泽度高，透明度好。',
    ingredients: [
      { name: '长石', percentage: 45, note: '' },
      { name: '石英', percentage: 25, note: '' },
      { name: '高岭土', percentage: 15, note: '' },
      { name: '石灰石', percentage: 10, note: '' },
      { name: '锌白', percentage: 5, note: '' }
    ],
    createdBy: 'admin',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z'
  },
  {
    id: '2',
    name: '青瓷釉',
    code: 'G-C-001',
    version: 2,
    isArchived: false,
    firingType: 'reduction',
    temperatureMin: 1280,
    temperatureMax: 1320,
    atmosphere: '还原焰',
    description: '传统青瓷釉，还原焰烧成呈现温润的青色。',
    ingredients: [
      { name: '长石', percentage: 40, note: '' },
      { name: '石英', percentage: 20, note: '' },
      { name: '高岭土', percentage: 25, note: '' },
      { name: '石灰石', percentage: 8, note: '' },
      { name: '氧化铁', percentage: 2, note: '' },
      { name: '滑石', percentage: 5, note: '' }
    ],
    createdBy: 'teacher',
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z'
  },
  {
    id: '3',
    name: '钧红釉',
    code: 'G-R-001',
    version: 5,
    isArchived: false,
    firingType: 'glaze',
    temperatureMin: 1260,
    temperatureMax: 1300,
    atmosphere: '还原焰',
    description: '仿钧窑红釉，颜色鲜艳，流动性强。',
    ingredients: [
      { name: '长石', percentage: 35, note: '' },
      { name: '石英', percentage: 20, note: '' },
      { name: '方解石', percentage: 15, note: '' },
      { name: '氧化锌', percentage: 8, note: '' },
      { name: '氧化铜', percentage: 3, note: '' },
      { name: '氧化铁', percentage: 2, note: '' },
      { name: '高岭土', percentage: 17, note: '' }
    ],
    createdBy: 'admin',
    createdAt: '2023-12-01T00:00:00Z',
    updatedAt: '2024-01-08T00:00:00Z'
  },
  {
    id: '4',
    name: '哑光白釉',
    code: 'G-W-002',
    version: 1,
    isArchived: true,
    firingType: 'bisque',
    temperatureMin: 1180,
    temperatureMax: 1220,
    atmosphere: '氧化焰',
    description: '实验配方：哑光效果白釉，触感细腻。',
    ingredients: [
      { name: '长石', percentage: 30, note: '' },
      { name: '石英', percentage: 30, note: '' },
      { name: '高岭土', percentage: 20, note: '' },
      { name: '石灰石', percentage: 15, note: '' },
      { name: '钡长石', percentage: 5, note: '' }
    ],
    createdBy: 'teacher',
    createdAt: '2023-11-15T00:00:00Z',
    updatedAt: '2023-11-20T00:00:00Z'
  },
  {
    id: '5',
    name: '天目釉',
    code: 'G-TM-001',
    version: 4,
    isArchived: false,
    firingType: 'glaze',
    temperatureMin: 1280,
    temperatureMax: 1320,
    atmosphere: '还原焰',
    description: '建盏风格天目釉，烧成油滴效果。',
    ingredients: [
      { name: '长石', percentage: 35, note: '' },
      { name: '石英', percentage: 15, note: '' },
      { name: '赤铁矿', percentage: 10, note: '' },
      { name: '石灰石', percentage: 12, note: '' },
      { name: '高岭土', percentage: 18, note: '' },
      { name: '草木灰', percentage: 10, note: '' }
    ],
    createdBy: 'admin',
    createdAt: '2023-10-10T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z'
  }
])

const filteredRecipes = computed(() => {
  return recipes.value.filter(r => {
    if (!showArchived.value && r.isArchived) return false
    if (filterType.value && r.firingType !== filterType.value) return false
    if (searchKeyword.value) {
      const keyword = searchKeyword.value.toLowerCase()
      return r.name.toLowerCase().includes(keyword) || 
             r.code.toLowerCase().includes(keyword) ||
             r.description?.toLowerCase().includes(keyword)
    }
    return true
  })
})

const getFiringTypeLabel = (type: FiringType) => {
  const map: Record<FiringType, string> = {
    bisque: '素烧',
    glaze: '釉烧',
    reduction: '还原焰'
  }
  return map[type] || type
}

const getFiringTypeColor = (type: FiringType) => {
  const map: Record<FiringType, string> = {
    bisque: '#8c8c8c',
    glaze: '#c85a32',
    reduction: '#722ed1'
  }
  return map[type] || '#999'
}

const handleRecipeClick = (recipe: GlazeRecipe) => {
  router.push(`/glaze-recipes/${recipe.id}`)
}

const handleCreateRecipe = () => {
  ElMessage.info('创建新配方功能开发中...')
}

const handleImportRecipe = () => {
  ElMessage.info('导入配方功能开发中...')
}
</script>

<template>
  <div class="glaze-recipe-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">釉料配方</h2>
        <span class="recipe-count">共 {{ filteredRecipes.length }} 个配方</span>
      </div>
      <div class="header-right">
        <el-button-group>
          <el-button :type="viewMode === 'list' ? 'primary' : ''" @click="viewMode = 'list'">
            <el-icon><List /></el-icon>
            列表
          </el-button>
          <el-button :type="viewMode === 'tree' ? 'primary' : ''" @click="viewMode = 'tree'">
            <el-icon><Share /></el-icon>
            版本树
          </el-button>
        </el-button-group>
        <el-button :icon="Upload" @click="handleImportRecipe">导入</el-button>
        <el-button type="primary" :icon="Plus" @click="handleCreateRecipe">
          新建配方
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-left">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索配方名称、编号..."
          :prefix-icon="Search"
          clearable
          class="search-input"
        />
        <el-select 
          v-model="filterType" 
          placeholder="烧制类型"
          clearable
          class="type-select"
        >
          <el-option label="素烧" value="bisque" />
          <el-option label="釉烧" value="glaze" />
          <el-option label="还原焰" value="reduction" />
        </el-select>
      </div>
      <div class="filter-right">
        <el-switch 
          v-model="showArchived" 
          active-text="显示归档"
          inactive-text="隐藏归档"
        />
      </div>
    </div>

    <div class="recipe-grid" v-if="viewMode === 'list'">
      <div 
        v-for="recipe in filteredRecipes" 
        :key="recipe.id"
        class="recipe-card"
        :class="{ archived: recipe.isArchived }"
        @click="handleRecipeClick(recipe)"
      >
        <div class="recipe-preview">
          <svg viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient :id="'grad-' + recipe.id" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" :style="{ stopColor: getFiringTypeColor(recipe.firingType) + 'cc' }" />
                <stop offset="100%" :style="{ stopColor: getFiringTypeColor(recipe.firingType) }" />
              </linearGradient>
            </defs>
            <ellipse cx="60" cy="148" rx="40" ry="6" fill="#d4a574" opacity="0.3"/>
            <path d="M25 148C25 100 35 60 60 60C85 60 95 100 95 148" 
              :stroke="getFiringTypeColor(recipe.firingType)" stroke-width="2.5" :fill="`url(#grad-${recipe.id})`"/>
            <ellipse cx="60" cy="60" rx="22" ry="8" fill="#d4a574" opacity="0.5"/>
          </svg>
          <div v-if="recipe.isArchived" class="archived-badge">已归档</div>
        </div>
        
        <div class="recipe-info">
          <div class="recipe-header">
            <h3 class="recipe-name">{{ recipe.name }}</h3>
            <span class="recipe-version">v{{ recipe.version }}</span>
          </div>
          <div class="recipe-code">{{ recipe.code }}</div>
          
          <div class="recipe-meta">
            <el-tag 
              size="small" 
              :style="{ 
                backgroundColor: getFiringTypeColor(recipe.firingType) + '20', 
                color: getFiringTypeColor(recipe.firingType),
                border: 'none' 
              }"
            >
              {{ getFiringTypeLabel(recipe.firingType) }}
            </el-tag>
            <span class="temp-range">
              {{ recipe.temperatureMin }}-{{ recipe.temperatureMax }}℃
            </span>
          </div>
          
          <p class="recipe-desc">{{ recipe.description }}</p>
          
          <div class="recipe-footer">
            <span class="ingredient-count">
              <el-icon><DataLine /></el-icon>
              {{ recipe.ingredients.length }} 种原料
            </span>
            <span class="update-time">
              {{ new Date(recipe.updatedAt).toLocaleDateString() }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="tree-view" v-else>
      <el-empty description="版本树视图开发中..." />
    </div>
  </div>
</template>

<style scoped lang="scss">
.glaze-recipe-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: $color-text-primary;
}

.recipe-count {
  font-size: 14px;
  color: $color-text-secondary;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-radius: $border-radius-md;
  box-shadow: $shadow-sm;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-left {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.search-input {
  width: 280px;
}

.type-select {
  width: 140px;
}

.filter-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.recipe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.recipe-card {
  background: white;
  border-radius: $border-radius-md;
  overflow: hidden;
  cursor: pointer;
  transition: all $transition-normal;
  box-shadow: $shadow-sm;

  &:hover {
    transform: translateY(-4px);
    box-shadow: $shadow-lg;
  }

  &.archived {
    opacity: 0.6;

    .recipe-preview {
      filter: grayscale(50%);
    }
  }
}

.recipe-preview {
  height: 160px;
  background: linear-gradient(135deg, #f5f0eb 0%, #e8ddd0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  svg {
    width: 100px;
    height: 130px;
  }
}

.archived-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 12px;
  border-radius: 12px;
}

.recipe-info {
  padding: 16px;
}

.recipe-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.recipe-name {
  font-size: 16px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0;
}

.recipe-version {
  font-size: 12px;
  color: $color-text-placeholder;
  font-family: monospace;
}

.recipe-code {
  font-size: 12px;
  color: $color-text-placeholder;
  font-family: monospace;
  margin-bottom: 10px;
}

.recipe-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.temp-range {
  font-size: 12px;
  color: $color-text-secondary;
}

.recipe-desc {
  font-size: 13px;
  color: $color-text-secondary;
  line-height: 1.5;
  margin: 0 0 12px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recipe-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid $color-border;
  font-size: 12px;
  color: $color-text-placeholder;
}

.ingredient-count {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tree-view {
  background: white;
  border-radius: $border-radius-md;
  padding: 40px;
  min-height: 400px;
  box-shadow: $shadow-sm;
}
</style>
