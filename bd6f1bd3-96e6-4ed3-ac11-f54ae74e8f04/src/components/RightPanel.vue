<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '@/stores/ProjectStore'
import WallTool from './WallTool.vue'
import TransformManager from './TransformManager.vue'

const store = useProjectStore()
const activeTab = ref<'tools' | 'floors' | 'settings'>('tools')

const tabs = [
  { id: 'tools', name: '工具', icon: '🛠️' },
  { id: 'floors', name: '楼层', icon: '🏢' },
  { id: 'settings', name: '设置', icon: '⚙️' }
]

function handleFloorNameChange(floorId: string, newName: string) {
  const floor = store.state.floors.find(f => f.id === floorId)
  if (floor) {
    floor.name = newName
  }
}
</script>

<template>
  <div class="right-panel">
    <div class="panel-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id as any"
      >
        <span class="icon">{{ tab.icon }}</span>
        <span class="name">{{ tab.name }}</span>
      </button>
    </div>
    
    <div class="panel-content">
      <div v-show="activeTab === 'tools'" class="tab-content">
        <WallTool />
        <TransformManager />
      </div>
      
      <div v-show="activeTab === 'floors'" class="tab-content">
        <div class="floors-header">
          <h4>🏢 楼层管理</h4>
          <button class="add-floor-btn" @click="store.addFloor">
            ➕ 添加楼层
          </button>
        </div>
        
        <div class="floors-list">
          <div
            v-for="floor in store.state.floors"
            :key="floor.id"
            :class="['floor-item', { active: store.state.currentFloorId === floor.id }]"
            @click="store.setCurrentFloor(floor.id)"
          >
            <div class="floor-info">
              <span class="floor-icon">📄</span>
              <input
                type="text"
                :value="floor.name"
                @input="handleFloorNameChange(floor.id, ($event.target as HTMLInputElement).value)"
                @click.stop
                class="floor-name-input"
              />
            </div>
            <div class="floor-actions">
              <button
                class="action-icon"
                :title="floor.visible ? '隐藏楼层' : '显示楼层'"
                @click.stop="store.toggleFloorVisibility(floor.id)"
              >
                {{ floor.visible ? '👁️' : '👁️‍🗨️' }}
              </button>
              <button
                class="action-icon"
                title="复制楼层"
                @click.stop="store.duplicateFloor(floor.id)"
              >
                📋
              </button>
              <button
                class="action-icon"
                title="删除楼层"
                :disabled="store.state.floors.length <= 1"
                @click.stop="store.deleteFloor(floor.id)"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
        
        <div class="floors-stats">
          <p>当前：{{ store.currentFloor?.name }}</p>
          <p>墙体：{{ store.allWalls.length }} 个</p>
          <p>家具：{{ store.allFurniture.length }} 件</p>
          <p>房间：{{ store.allRooms.length }} 个</p>
        </div>
      </div>
      
      <div v-show="activeTab === 'settings'" class="tab-content">
        <div class="settings-section">
          <h4>⚙️ 项目设置</h4>
          
          <div class="setting-item">
            <label>项目名称</label>
            <input
              type="text"
              v-model="store.state.name"
              class="setting-input"
            />
          </div>
        </div>
        
        <div class="settings-section">
          <h4>📐 网格设置</h4>
          
          <div class="setting-item">
            <label>网格大小</label>
            <div class="setting-row">
              <input
                type="range"
                v-model.number="store.state.gridSize"
                min="10"
                max="500"
                step="10"
                class="setting-range"
              />
              <span class="setting-value">{{ store.state.gridSize }}mm</span>
            </div>
          </div>
          
          <div class="setting-item">
            <label>吸附精度</label>
            <div class="setting-row">
              <input
                type="range"
                v-model.number="store.state.snapPrecision"
                min="1"
                max="50"
                step="1"
                class="setting-range"
              />
              <span class="setting-value">{{ store.state.snapPrecision }}mm</span>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <h4>🔧 显示设置</h4>
          
          <div class="setting-item toggle">
            <label>显示网格</label>
            <div class="toggle-switch" @click="store.toggleGrid">
              <div :class="['toggle-slider', { active: store.state.showGrid }]"></div>
            </div>
          </div>
          
          <div class="setting-item toggle">
            <label>智能吸附</label>
            <div class="toggle-switch" @click="store.toggleSnap">
              <div :class="['toggle-slider', { active: store.state.snapEnabled }]"></div>
            </div>
          </div>
          
          <div class="setting-item toggle">
            <label>显示尺寸</label>
            <div class="toggle-switch" @click="store.toggleDimensions">
              <div :class="['toggle-slider', { active: store.state.showDimensions }]"></div>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <h4>📊 统计信息</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value">{{ store.allWalls.length }}</span>
              <span class="stat-label">墙体</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ store.allFurniture.length }}</span>
              <span class="stat-label">家具</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ store.allRooms.length }}</span>
              <span class="stat-label">房间</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ store.state.floors.length }}</span>
              <span class="stat-label">楼层</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.right-panel {
  width: 280px;
  background: #ffffff;
  border-left: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
}

.tab-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  gap: 4px;
}

.tab-btn:hover {
  background: #f5f5f5;
}

.tab-btn.active {
  background: #e3f2fd;
  border-bottom: 2px solid #4A90D9;
}

.tab-btn.active .name {
  color: #4A90D9;
  font-weight: 600;
}

.tab-btn .icon {
  font-size: 16px;
}

.tab-btn .name {
  font-size: 11px;
  color: #666;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.tab-content {
  height: 100%;
}

.floors-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.floors-header h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.add-floor-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: #4A90D9;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.add-floor-btn:hover {
  background: #1976D2;
}

.floors-list {
  padding: 8px;
}

.floor-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 4px;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.floor-item:hover {
  background: #f5f5f5;
}

.floor-item.active {
  border-color: #4A90D9;
  background: #e3f2fd;
}

.floor-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.floor-icon {
  font-size: 16px;
}

.floor-name-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 13px;
  background: transparent;
  outline: none;
  transition: all 0.2s;
}

.floor-name-input:hover,
.floor-name-input:focus {
  border-color: #e0e0e0;
  background: #fff;
}

.floor-actions {
  display: flex;
  gap: 4px;
}

.action-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.action-icon:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
}

.action-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.floors-stats {
  padding: 12px;
  margin: 8px;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 12px;
  color: #666;
}

.floors-stats p {
  margin: 4px 0;
}

.settings-section {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.settings-section h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.setting-item {
  margin-bottom: 12px;
}

.setting-item label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
}

.setting-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.setting-input:focus {
  border-color: #4A90D9;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.setting-range {
  flex: 1;
}

.setting-value {
  font-size: 12px;
  font-weight: 600;
  color: #4A90D9;
  min-width: 50px;
  text-align: right;
}

.setting-item.toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-switch {
  width: 44px;
  height: 24px;
  background: #e0e0e0;
  border-radius: 12px;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
}

.toggle-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-slider.active {
  left: 22px;
  background: #4A90D9;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #4A90D9;
}

.stat-label {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}
</style>
