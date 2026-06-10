<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { GlazeRecipe, GlazeIngredient, FiringType } from '@/types'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  recipe: GlazeRecipe | null
  readOnly?: boolean
}>()

const emit = defineEmits<{
  save: [recipe: Partial<GlazeRecipe>]
  clone: []
  createVersion: []
  archive: []
}>()

const localRecipe = ref<Partial<GlazeRecipe>>({
  name: '',
  code: '',
  firingType: 'glaze' as FiringType,
  temperatureMin: 1200,
  temperatureMax: 1250,
  atmosphere: '氧化焰',
  description: '',
  ingredients: []
})

const ingredients = ref<GlazeIngredient[]>([
  { name: '长石', percentage: 40, note: '' },
  { name: '石英', percentage: 25, note: '' },
  { name: '高岭土', percentage: 20, note: '' },
  { name: '石灰石', percentage: 10, note: '' },
  { name: '色料', percentage: 5, note: '' }
])

const totalPercentage = computed(() => {
  return ingredients.value.reduce((sum, ing) => sum + (ing.percentage || 0), 0)
})

const isTotalValid = computed(() => {
  return Math.abs(totalPercentage.value - 100) < 0.1
})

watch(() => props.recipe, (newRecipe) => {
  if (newRecipe) {
    localRecipe.value = { ...newRecipe }
    ingredients.value = newRecipe.ingredients ? [...newRecipe.ingredients] : []
  } else {
    localRecipe.value = {
      name: '',
      code: '',
      firingType: 'glaze',
      temperatureMin: 1200,
      temperatureMax: 1250,
      atmosphere: '氧化焰',
      description: '',
      ingredients: []
    }
    ingredients.value = []
  }
}, { immediate: true, deep: true })

const addIngredient = () => {
  ingredients.value.push({ name: '', percentage: 0, note: '' })
}

const removeIngredient = (index: number) => {
  ingredients.value.splice(index, 1)
}

const handleSave = () => {
  if (!localRecipe.value.name) {
    ElMessage.warning('请输入配方名称')
    return
  }
  if (!isTotalValid.value) {
    ElMessage.warning('原料总百分比必须等于100%')
    return
  }
  
  emit('save', {
    ...localRecipe.value,
    ingredients: ingredients.value
  })
}

const firingTypes = [
  { value: 'bisque', label: '素烧' },
  { value: 'glaze', label: '釉烧' },
  { value: 'reduction', label: '还原焰' }
]

const atmosphereOptions = ['氧化焰', '还原焰', '中性焰', '苏打烧', '乐烧']

const adjustPercentage = (index: number, delta: number) => {
  const newValue = Math.max(0, Math.min(100, ingredients.value[index].percentage + delta))
  ingredients.value[index].percentage = Number(newValue.toFixed(1))
}
</script>

<template>
  <div class="recipe-editor" v-if="recipe">
    <div class="editor-header">
      <div class="recipe-title-section">
        <el-input 
          v-if="!readOnly"
          v-model="localRecipe.name" 
          placeholder="配方名称"
          size="large"
          class="name-input"
        />
        <h2 v-else class="recipe-name">{{ recipe.name }}</h2>
        <el-input 
          v-if="!readOnly"
          v-model="localRecipe.code" 
          placeholder="配方编号"
          size="small"
          class="code-input"
        />
        <span v-else class="recipe-code">{{ recipe.code }}</span>
      </div>
      <div class="recipe-actions" v-if="!readOnly">
        <el-button @click="emit('clone')">
          <el-icon><CopyDocument /></el-icon>
          克隆
        </el-button>
        <el-button type="primary" @click="emit('createVersion')">
          <el-icon><Plus /></el-icon>
          新版本
        </el-button>
        <el-button type="danger" @click="emit('archive')">
          <el-icon><FolderOpened /></el-icon>
          归档
        </el-button>
      </div>
    </div>

    <div class="editor-body">
      <div class="left-panel">
        <div class="info-section">
          <h3 class="section-title">基本信息</h3>
          
          <div class="info-grid">
            <div class="info-item">
              <label>烧制类型</label>
              <el-select 
                v-if="!readOnly"
                v-model="localRecipe.firingType"
                class="full-width"
              >
                <el-option 
                  v-for="ft in firingTypes" 
                  :key="ft.value" 
                  :label="ft.label" 
                  :value="ft.value" 
                />
              </el-select>
              <span v-else class="info-value">
                {{ firingTypes.find(f => f.value === recipe.firingType)?.label || recipe.firingType }}
              </span>
            </div>
            <div class="info-item">
              <label>温度区间</label>
              <div class="temp-range" v-if="!readOnly">
                <el-input-number 
                  v-model="localRecipe.temperatureMin" 
                  :min="800" 
                  :max="1400"
                  size="small"
                />
                <span class="temp-sep">~</span>
                <el-input-number 
                  v-model="localRecipe.temperatureMax" 
                  :min="800" 
                  :max="1400"
                  size="small"
                />
                <span class="temp-unit">℃</span>
              </div>
              <span v-else class="info-value">
                {{ recipe.temperatureMin }} ~ {{ recipe.temperatureMax }}℃
              </span>
            </div>
            <div class="info-item">
              <label>烧成气氛</label>
              <el-select 
                v-if="!readOnly"
                v-model="localRecipe.atmosphere"
                class="full-width"
              >
                <el-option 
                  v-for="atm in atmosphereOptions" 
                  :key="atm" 
                  :label="atm" 
                  :value="atm" 
                />
              </el-select>
              <span v-else class="info-value">{{ recipe.atmosphere }}</span>
            </div>
            <div class="info-item">
              <label>版本号</label>
              <span class="info-value">v{{ recipe.version || 1 }}</span>
            </div>
          </div>
        </div>

        <div class="ingredients-section">
          <div class="section-header">
            <h3 class="section-title">配方成分</h3>
            <div class="total-percentage" :class="{ invalid: !isTotalValid }">
              总计: {{ totalPercentage.toFixed(1) }}%
            </div>
          </div>
          
          <div class="ingredients-list">
            <div 
              v-for="(ing, index) in ingredients" 
              :key="index" 
              class="ingredient-row"
            >
              <div class="ing-index">{{ index + 1 }}</div>
              <el-input 
                v-if="!readOnly"
                v-model="ing.name" 
                placeholder="原料名称"
                class="ing-name"
              />
              <span v-else class="ing-name-text">{{ ing.name }}</span>
              
              <div v-if="!readOnly" class="ing-percent-control">
                <el-button 
                  size="small" 
                  :icon="Minus" 
                  circle
                  @click="adjustPercentage(index, -1)"
                />
                <el-input-number 
                  v-model="ing.percentage" 
                  :min="0" 
                  :max="100"
                  :step="0.5"
                  size="small"
                  controls-position="right"
                  class="percent-input"
                />
                <el-button 
                  size="small" 
                  :icon="Plus" 
                  circle
                  @click="adjustPercentage(index, 1)"
                />
              </div>
              <span v-else class="ing-percent-text">{{ ing.percentage }}%</span>
              
              <el-button 
                v-if="!readOnly"
                type="danger" 
                text 
                size="small"
                @click="removeIngredient(index)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            
            <el-button 
              v-if="!readOnly"
              type="primary" 
              plain 
              class="add-ingredient-btn"
              @click="addIngredient"
            >
              <el-icon><Plus /></el-icon>
              添加原料
            </el-button>
          </div>
        </div>

        <div class="description-section">
          <h3 class="section-title">配方说明</h3>
          <el-input 
            v-if="!readOnly"
            v-model="localRecipe.description" 
            type="textarea" 
            :rows="4"
            placeholder="输入配方描述、注意事项、实验心得等..."
          />
          <p v-else class="description-text">{{ recipe.description || '暂无描述' }}</p>
        </div>
      </div>

      <div class="right-panel">
        <div class="preview-section">
          <h3 class="section-title">烧成效果预览</h3>
          <div class="preview-image">
            <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient :id="'glazeGradient'" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" :style="{ stopColor: getGlazeColor('light') }" />
                  <stop offset="50%" :style="{ stopColor: getGlazeColor('main') }" />
                  <stop offset="100%" :style="{ stopColor: getGlazeColor('dark') }" />
                </linearGradient>
              </defs>
              <ellipse cx="100" cy="240" rx="60" ry="10" fill="#d4a574" opacity="0.3"/>
              <path d="M50 240C50 180 60 120 100 120C140 120 150 180 150 240" 
                :stroke="getGlazeColor('dark')" stroke-width="3" fill="url(#glazeGradient)"/>
              <ellipse cx="100" cy="120" rx="35" ry="12" fill="#d4a574" opacity="0.5"/>
              <path d="M70 120 Q80 100 100 100 Q120 100 130 120" 
                :stroke="getGlazeColor('light')" stroke-width="2" fill="none" opacity="0.6"/>
            </svg>
          </div>
          <div class="preview-info">
            <div class="temp-badge">
              <el-icon><Flame /></el-icon>
              {{ localRecipe.temperatureMin }}-{{ localRecipe.temperatureMax }}℃
            </div>
            <div class="atmosphere-badge">
              {{ localRecipe.atmosphere }}
            </div>
          </div>
        </div>

        <div class="version-history-section">
          <h3 class="section-title">版本历史</h3>
          <div class="version-timeline">
            <div class="version-item current">
              <div class="version-dot"></div>
              <div class="version-info">
                <span class="version-label">v{{ recipe.version || 1 }} (当前)</span>
                <span class="version-date">{{ recipe.updatedAt ? new Date(recipe.updatedAt).toLocaleDateString() : '今天' }}</span>
              </div>
            </div>
            <div v-if="recipe.parentId" class="version-item">
              <div class="version-dot"></div>
              <div class="version-info">
                <span class="version-label">父版本</span>
                <span class="version-date">-</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!readOnly" class="save-section">
          <el-button type="primary" size="large" class="save-btn" @click="handleSave">
            保存配方
          </el-button>
        </div>
      </div>
    </div>
  </div>
  
  <div v-else class="empty-state">
    <el-empty description="请选择一个配方或创建新配方" />
  </div>
</template>

<script lang="ts">
const getGlazeColor = (tone: 'light' | 'main' | 'dark') => {
  const colors: Record<string, string> = {
    light: '#e8a87c',
    main: '#c85a32',
    dark: '#8b3a1a'
  }
  return colors[tone]
}

export default {
  methods: {
    getGlazeColor
  }
}
</script>

<style scoped lang="scss">
.recipe-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 16px;
  border-bottom: 1px solid $color-border;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.recipe-title-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.name-input {
  :deep(.el-input__wrapper) {
    font-size: 20px;
    font-weight: 600;
    box-shadow: none;
    padding: 0;
  }
  width: 300px;
}

.recipe-name {
  font-size: 20px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0;
}

.code-input {
  width: 150px;
  :deep(.el-input__wrapper) {
    font-size: 13px;
  }
}

.recipe-code {
  font-size: 13px;
  color: $color-text-placeholder;
  font-family: monospace;
}

.recipe-actions {
  display: flex;
  gap: 8px;
}

.editor-body {
  display: flex;
  gap: 24px;
  flex: 1;
  overflow: hidden;

  @media (max-width: 1024px) {
    flex-direction: column;
  }
}

.left-panel {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}

.right-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (max-width: 1024px) {
    width: 100%;
  }
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 12px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.info-section,
.ingredients-section,
.description-section,
.preview-section,
.version-history-section {
  background: white;
  border-radius: $border-radius-md;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: $shadow-sm;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  @media (max-width: $breakpoint-mobile) {
    grid-template-columns: 1fr;
  }
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 12px;
    color: $color-text-secondary;
  }
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: $color-text-primary;
}

.temp-range {
  display: flex;
  align-items: center;
  gap: 6px;
}

.temp-sep {
  color: $color-text-placeholder;
}

.temp-unit {
  font-size: 12px;
  color: $color-text-secondary;
}

.total-percentage {
  font-size: 14px;
  font-weight: 600;
  color: $color-success;

  &.invalid {
    color: $color-error;
  }
}

.ingredients-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ingredient-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: $color-bg;
  border-radius: $border-radius-sm;
}

.ing-index {
  width: 20px;
  font-size: 12px;
  color: $color-text-placeholder;
  text-align: center;
  flex-shrink: 0;
}

.ing-name {
  flex: 1;
  min-width: 0;
}

.ing-name-text {
  flex: 1;
  font-size: 14px;
  color: $color-text-primary;
}

.ing-percent-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.percent-input {
  width: 80px;
}

.ing-percent-text {
  width: 60px;
  text-align: right;
  font-weight: 600;
  color: $color-primary;
}

.add-ingredient-btn {
  width: 100%;
  margin-top: 8px;
}

.description-text {
  font-size: 14px;
  color: $color-text-secondary;
  line-height: 1.6;
  margin: 0;
}

.preview-image {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #f5f0eb 0%, #e8ddd0 100%);
  border-radius: $border-radius-md;
  margin-bottom: 12px;

  svg {
    width: 150px;
    height: 200px;
  }
}

.preview-info {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.temp-badge,
.atmosphere-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: $color-bg;
  border-radius: 12px;
  font-size: 12px;
  color: $color-text-secondary;
}

.temp-badge {
  color: $color-primary;
}

.version-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-left: 10px;
}

.version-item {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 7px;
    top: 24px;
    bottom: -12px;
    width: 2px;
    background: $color-border;
  }

  &:last-child::before {
    display: none;
  }

  &.current .version-dot {
    background: $color-primary;
    box-shadow: 0 0 0 4px rgba($color-primary, 0.2);
  }
}

.version-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: $color-border;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.version-label {
  font-size: 13px;
  font-weight: 500;
  color: $color-text-primary;
}

.version-date {
  font-size: 12px;
  color: $color-text-placeholder;
}

.save-section {
  margin-top: auto;
}

.save-btn {
  width: 100%;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
}

.full-width {
  width: 100%;
}
</style>
