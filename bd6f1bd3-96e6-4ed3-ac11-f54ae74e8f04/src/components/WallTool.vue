<script setup lang="ts">
import { useProjectStore } from '@/stores/ProjectStore'
import { computed } from 'vue'

const store = useProjectStore()

const tools = [
  { id: 'select', name: '选择', icon: '👆' },
  { id: 'wall-straight', name: '直线墙', icon: '📏' },
  { id: 'wall-arc', name: '弧形墙', icon: '〰️' },
  { id: 'door', name: '门', icon: '🚪' },
  { id: 'window', name: '窗', icon: '🪟' }
]

const activeTool = computed(() => store.state.selectedTool)

function selectTool(toolId: string) {
  store.setTool(toolId)
}
</script>

<template>
  <div class="wall-tool">
    <div class="tool-group">
      <div class="tool-group-title">绘制工具</div>
      <div class="tool-buttons">
        <button
          v-for="tool in tools"
          :key="tool.id"
          :class="['tool-btn', { active: activeTool === tool.id }]"
          @click="selectTool(tool.id)"
          :title="tool.name"
        >
          <span class="tool-icon">{{ tool.icon }}</span>
          <span class="tool-name">{{ tool.name }}</span>
        </button>
      </div>
    </div>
    
    <div class="tool-tip" v-if="activeTool.startsWith('wall')">
      <p>💡 提示：</p>
      <ul>
        <li>点击画布确定起点</li>
        <li>移动鼠标预览墙体</li>
        <li>再次点击完成绘制</li>
        <li>按 ESC 取消绘制</li>
      </ul>
    </div>
    
    <div class="tool-tip" v-else-if="activeTool === 'select'">
      <p>💡 提示：</p>
      <ul>
        <li>点击选择墙体或家具</li>
        <li>按住 Shift 多选</li>
        <li>拖拽家具移动位置</li>
        <li>按 Delete 删除选中项</li>
        <li>按 Ctrl+D 复制选中项</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.wall-tool {
  padding: 12px;
}

.tool-group {
  margin-bottom: 16px;
}

.tool-group-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tool-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-btn:hover {
  border-color: #4A90D9;
  background: #f0f7ff;
}

.tool-btn.active {
  border-color: #4A90D9;
  background: #4A90D9;
  color: #fff;
}

.tool-btn.active .tool-name {
  color: #fff;
}

.tool-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.tool-name {
  font-size: 12px;
  color: #333;
}

.tool-tip {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
}

.tool-tip p {
  margin: 0 0 8px 0;
  font-weight: 600;
  color: #666;
}

.tool-tip ul {
  margin: 0;
  padding-left: 16px;
  color: #666;
}

.tool-tip li {
  margin-bottom: 4px;
}
</style>
