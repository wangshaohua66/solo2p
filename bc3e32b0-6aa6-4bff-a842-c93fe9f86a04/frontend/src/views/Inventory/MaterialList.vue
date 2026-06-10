<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Material, MaterialCategory, MaterialAlert } from '@/types'
import { ElMessage } from 'element-plus'

const activeTab = ref<'all' | 'low'>('all')
const searchKeyword = ref('')
const filterCategory = ref<MaterialCategory | ''>('')

const materials = ref<Material[]>([
  { id: 'm1', name: '陶土 - 紫砂泥', category: 'clay', unit: 'kg', totalQuantity: 200, reservedQuantity: 30, availableQuantity: 170, minThreshold: 50, unitPrice: 25, lastRestocked: '2024-01-10' },
  { id: 'm2', name: '陶土 - 高岭土', category: 'clay', unit: 'kg', totalQuantity: 150, reservedQuantity: 20, availableQuantity: 130, minThreshold: 40, unitPrice: 35, lastRestocked: '2024-01-08' },
  { id: 'm3', name: '长石粉', category: 'glaze', unit: 'kg', totalQuantity: 80, reservedQuantity: 10, availableQuantity: 70, minThreshold: 20, unitPrice: 18, lastRestocked: '2024-01-05' },
  { id: 'm4', name: '石英砂', category: 'glaze', unit: 'kg', totalQuantity: 100, reservedQuantity: 15, availableQuantity: 85, minThreshold: 30, unitPrice: 12, lastRestocked: '2024-01-03' },
  { id: 'm5', name: '氧化铜', category: 'colorant', unit: 'kg', totalQuantity: 5, reservedQuantity: 1, availableQuantity: 4, minThreshold: 2, unitPrice: 120, lastRestocked: '2023-12-20' },
  { id: 'm6', name: '氧化铁', category: 'colorant', unit: 'kg', totalQuantity: 8, reservedQuantity: 2, availableQuantity: 6, minThreshold: 3, unitPrice: 45, lastRestocked: '2023-12-25' },
  { id: 'm7', name: '拉坯工具套装', category: 'tool', unit: '套', totalQuantity: 12, reservedQuantity: 0, availableQuantity: 12, minThreshold: 5, unitPrice: 180, lastRestocked: '2023-11-15' },
  { id: 'm8', name: '海绵', category: 'tool', unit: '个', totalQuantity: 30, reservedQuantity: 5, availableQuantity: 25, minThreshold: 10, unitPrice: 8, lastRestocked: '2024-01-01' }
])

const alerts = ref<MaterialAlert[]>([
  { id: 'a1', materialId: 'm5', materialName: '氧化铜', currentQuantity: 4, threshold: 5, createdAt: '2024-01-20T10:00:00Z', isRead: false, suggestedPurchaseAmount: 10 },
  { id: 'a2', materialId: 'm6', materialName: '氧化铁', currentQuantity: 6, threshold: 3, createdAt: '2024-01-15T08:00:00Z', isRead: true, suggestedPurchaseAmount: 5 }
])

const categoryOptions = [
  { value: '', label: '全部分类' },
  { value: 'clay', label: '陶土' },
  { value: 'glaze', label: '釉料' },
  { value: 'colorant', label: '色料' },
  { value: 'tool', label: '工具' }
]

const filteredMaterials = computed(() => {
  return materials.value.filter(m => {
    if (activeTab.value === 'low' && m.availableQuantity > m.minThreshold) return false
    if (filterCategory.value && m.category !== filterCategory.value) return false
    if (searchKeyword.value && !m.name.toLowerCase().includes(searchKeyword.value.toLowerCase())) return false
    return true
  })
})

const getCategoryLabel = (category: MaterialCategory) => {
  const map: Record<string, string> = {
    clay: '陶土',
    glaze: '釉料',
    colorant: '色料',
    tool: '工具',
    other: '其他'
  }
  return map[category] || category
}

const getCategoryColor = (category: MaterialCategory) => {
  const map: Record<string, string> = {
    clay: '#d4a574',
    glaze: '#c85a32',
    colorant: '#722ed1',
    tool: '#409eff',
    other: '#909399'
  }
  return map[category] || '#999'
}

const isLowStock = (material: Material) => {
  return material.availableQuantity <= material.minThreshold
}

const getStockPercent = (material: Material) => {
  const max = Math.max(material.totalQuantity, material.minThreshold * 3)
  return Math.min(100, Math.round((material.availableQuantity / max) * 100))
}

const handleAddStock = (material: Material) => {
  ElMessage.info('入库功能开发中...')
}

const handleUseStock = (material: Material) => {
  ElMessage.info('出库功能开发中...')
}

const handlePurchaseSuggestion = () => {
  ElMessage.success('已生成采购建议单')
}

const handleViewAlerts = () => {
  ElMessage.info('预警详情功能开发中...')
}

onMounted(() => {
})
</script>

<template>
  <div class="material-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">原料库存</h2>
        <el-tabs v-model="activeTab" class="header-tabs">
          <el-tab-pane label="全部物料" name="all" />
          <el-tab-pane label="库存预警" name="low">
            <el-badge :value="alerts.filter(a => !a.isRead).length" :max="99" class="alert-badge">
              库存预警
            </el-badge>
          </el-tab-pane>
        </el-tabs>
      </div>
      <div class="header-right">
        <el-button @click="handlePurchaseSuggestion">
          <el-icon><Document /></el-icon>
          采购建议
        </el-button>
        <el-button type="primary">
          <el-icon><Plus /></el-icon>
          新增物料
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-left">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索物料名称..."
          :prefix-icon="Search"
          clearable
          class="search-input"
        />
        <el-select 
          v-model="filterCategory" 
          placeholder="分类"
          class="category-select"
        >
          <el-option 
            v-for="cat in categoryOptions" 
            :key="cat.value" 
            :label="cat.label" 
            :value="cat.value" 
          />
        </el-select>
      </div>
    </div>

    <div class="material-grid">
      <div 
        v-for="material in filteredMaterials" 
        :key="material.id"
        class="material-card"
        :class="{ 'low-stock': isLowStock(material) }"
      >
        <div class="card-header">
          <div class="material-info">
            <h3 class="material-name">{{ material.name }}</h3>
            <el-tag 
              size="small"
              :style="{ 
                backgroundColor: getCategoryColor(material.category) + '20', 
                color: getCategoryColor(material.category),
                border: 'none' 
              }"
            >
              {{ getCategoryLabel(material.category) }}
            </el-tag>
          </div>
          <div 
            v-if="isLowStock(material)" 
            class="low-stock-badge"
            @click="handleViewAlerts"
          >
            <el-icon><WarningFilled /></el-icon>
            库存预警
          </div>
        </div>
        
        <div class="stock-info">
          <div class="stock-main">
            <span class="stock-value">{{ material.availableQuantity }}</span>
            <span class="stock-unit">{{ material.unit }}</span>
          </div>
          <div class="stock-detail">
            <span>总库存: {{ material.totalQuantity }}{{ material.unit }}</span>
            <span>已预留: {{ material.reservedQuantity }}{{ material.unit }}</span>
          </div>
        </div>
        
        <el-progress 
          :percentage="getStockPercent(material)"
          :stroke-width="6"
          :color="isLowStock(material) ? '#f56c6c' : '#67c23a'"
          :show-text="false"
        />
        
        <div class="stock-meta">
          <span class="threshold">预警值: {{ material.minThreshold }}{{ material.unit }}</span>
          <span class="price">¥{{ material.unitPrice }}/{{ material.unit }}</span>
        </div>
        
        <div class="card-actions">
          <el-button size="small" type="primary" @click="handleAddStock(material)">
            入库
          </el-button>
          <el-button size="small" @click="handleUseStock(material)">
            出库
          </el-button>
          <el-button size="small" text>
            明细
          </el-button>
        </div>
      </div>
    </div>

    <el-empty v-if="filteredMaterials.length === 0" description="暂无物料" />
  </div>
</template>

<style scoped lang="scss">
.material-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: $color-text-primary;
}

.header-tabs {
  :deep(.el-tabs__item) {
    font-size: 14px;
  }
  :deep(.el-tabs__header) {
    margin: 0;
  }
}

.alert-badge {
  :deep(.el-badge__content) {
    background-color: $color-error;
  }
}

.header-right {
  display: flex;
  gap: 10px;
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
}

.search-input {
  width: 280px;
}

.category-select {
  width: 140px;
}

.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.material-card {
  background: white;
  border-radius: $border-radius-md;
  padding: 16px;
  box-shadow: $shadow-sm;
  transition: all $transition-normal;

  &:hover {
    box-shadow: $shadow-md;
  }

  &.low-stock {
    border: 1px solid $color-error;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 8px;
}

.material-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.material-name {
  font-size: 15px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0;
}

.low-stock-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba($color-error, 0.1);
  color: $color-error;
  font-size: 12px;
  font-weight: 500;
  border-radius: $border-radius-sm;
  cursor: pointer;
  white-space: nowrap;
}

.stock-info {
  margin-bottom: 12px;
}

.stock-main {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 6px;
}

.stock-value {
  font-size: 28px;
  font-weight: 700;
  color: $color-text-primary;
  line-height: 1;
}

.stock-unit {
  font-size: 14px;
  color: $color-text-secondary;
}

.stock-detail {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: $color-text-placeholder;
}

.stock-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: $color-text-placeholder;
}

.threshold {
  color: $color-warning;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid $color-border;
}
</style>
