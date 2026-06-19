<script setup lang="ts">
import { ref, computed } from 'vue'
import { categories, furnitureCatalog, getItemsByCategory } from '@/data/furnitureCatalog'
import type { FurnitureCatalogItem } from '@/types'

const expandedCategories = ref<Set<string>>(new Set(['客厅', '卧室']))
const selectedSubcategory = ref<string | null>(null)
const searchQuery = ref('')

function toggleCategory(categoryName: string) {
  if (expandedCategories.value.has(categoryName)) {
    expandedCategories.value.delete(categoryName)
  } else {
    expandedCategories.value.add(categoryName)
  }
}

function selectSubcategory(category: string, subcategory: string) {
  if (selectedSubcategory.value === `${category}-${subcategory}`) {
    selectedSubcategory.value = null
  } else {
    selectedSubcategory.value = `${category}-${subcategory}`
  }
}

const displayItems = computed((): FurnitureCatalogItem[] => {
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    return furnitureCatalog.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.subcategory.toLowerCase().includes(query)
    )
  }
  
  if (selectedSubcategory.value) {
    const [category, subcategory] = selectedSubcategory.value.split('-')
    return getItemsByCategory(category, subcategory)
  }
  
  return furnitureCatalog.slice(0, 50)
})

function onDragStart(e: DragEvent, item: FurnitureCatalogItem) {
  if (e.dataTransfer) {
    e.dataTransfer.setData('furniture', JSON.stringify(item))
    e.dataTransfer.effectAllowed = 'copy'
  }
}

const itemCount = computed(() => furnitureCatalog.length)
</script>

<template>
  <div class="furniture-library">
    <div class="library-header">
      <h3>🏠 家具素材库</h3>
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索家具..."
          class="search-input"
        />
      </div>
      <div class="item-count">共 {{ itemCount }} 件素材</div>
    </div>
    
    <div class="category-tree" v-if="!searchQuery">
      <div
        v-for="category in categories"
        :key="category.id"
        class="category-item"
      >
        <div
          class="category-header"
          @click="toggleCategory(category.name)"
        >
          <span class="toggle-icon">
            {{ expandedCategories.has(category.name) ? '▼' : '▶' }}
          </span>
          <span class="category-icon">{{ category.icon }}</span>
          <span class="category-name">{{ category.name }}</span>
          <span class="category-count">
            {{ getItemsByCategory(category.name).length }}
          </span>
        </div>
        
        <div
          v-if="expandedCategories.has(category.name)"
          class="subcategories"
        >
          <div
            v-for="sub in category.subcategories"
            :key="sub"
            :class="[
              'subcategory-item',
              { active: selectedSubcategory === `${category.name}-${sub}` }
            ]"
            @click="selectSubcategory(category.name, sub)"
          >
            <span class="subcategory-name">{{ sub }}</span>
            <span class="subcategory-count">
              {{ getItemsByCategory(category.name, sub).length }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="items-grid">
      <div
        v-for="item in displayItems"
        :key="item.id"
        class="furniture-item"
        draggable="true"
        @dragstart="onDragStart($event, item)"
        :title="`${item.name} - 拖拽到画布放置`"
      >
        <div class="item-icon" :style="{ backgroundColor: item.color + '30' }">
          <span class="icon">{{ item.icon }}</span>
        </div>
        <div class="item-info">
          <div class="item-name">{{ item.name }}</div>
          <div class="item-size">{{ Math.round(item.width) }}×{{ Math.round(item.height) }}mm</div>
        </div>
      </div>
    </div>
    
    <div class="library-footer" v-if="displayItems.length === 0">
      <p>🔍 没有找到相关家具</p>
      <p class="hint">试试其他关键词</p>
    </div>
  </div>
</template>

<style scoped>
.furniture-library {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.library-header {
  padding: 12px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}

.library-header h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.search-box {
  margin-bottom: 8px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #4A90D9;
}

.item-count {
  font-size: 11px;
  color: #999;
}

.category-tree {
  overflow-y: auto;
  flex-shrink: 0;
  max-height: 250px;
  border-bottom: 1px solid #e0e0e0;
}

.category-item {
  border-bottom: 1px solid #f0f0f0;
}

.category-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.category-header:hover {
  background: #f5f5f5;
}

.toggle-icon {
  font-size: 10px;
  color: #999;
  width: 16px;
}

.category-icon {
  font-size: 16px;
  margin: 0 8px;
}

.category-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.category-count {
  font-size: 11px;
  color: #999;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 10px;
}

.subcategories {
  background: #fafafa;
}

.subcategory-item {
  display: flex;
  align-items: center;
  padding: 8px 12px 8px 48px;
  cursor: pointer;
  transition: background 0.2s;
}

.subcategory-item:hover {
  background: #f0f0f0;
}

.subcategory-item.active {
  background: #e3f2fd;
}

.subcategory-item.active .subcategory-name {
  color: #4A90D9;
  font-weight: 500;
}

.subcategory-name {
  flex: 1;
  font-size: 12px;
  color: #666;
}

.subcategory-count {
  font-size: 10px;
  color: #999;
}

.items-grid {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  align-content: start;
}

.furniture-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  cursor: grab;
  transition: all 0.2s;
}

.furniture-item:hover {
  border-color: #4A90D9;
  background: #f0f7ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(74, 144, 217, 0.15);
}

.furniture-item:active {
  cursor: grabbing;
}

.item-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}

.item-icon .icon {
  font-size: 24px;
}

.item-info {
  text-align: center;
  width: 100%;
}

.item-name {
  font-size: 11px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-size {
  font-size: 10px;
  color: #999;
  margin-top: 2px;
}

.library-footer {
  padding: 24px;
  text-align: center;
  color: #999;
}

.library-footer p {
  margin: 4px 0;
}

.library-footer .hint {
  font-size: 12px;
}
</style>
