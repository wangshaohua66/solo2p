<template>
  <div class="step-flow-editor">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <el-button-group>
          <el-button @click="addNode('normal')" :icon="Plus">
            添加步骤
          </el-button>
          <el-button @click="addNode('start')" :icon="VideoPlay">
            开始节点
          </el-button>
          <el-button @click="addNode('end')" :icon="VideoPause">
            结束节点
          </el-button>
          <el-button @click="addNode('branch')" :icon="Share">
            分支节点
          </el-button>
          <el-button @click="addNode('loop')" :icon="Refresh">
            循环节点
          </el-button>
        </el-button-group>
        <el-button @click="autoLayout" :icon="Grid">
          自动布局
        </el-button>
        <el-button @click="deleteSelected" :icon="Delete" type="danger" :disabled="!selectedNodeId">
          删除选中
        </el-button>
      </div>
      <div class="toolbar-right">
        <span class="node-count">节点: {{ nodes.length }} | 连线: {{ edges.length }}</span>
      </div>
    </div>

    <VueFlow
      ref="vueFlowRef"
      v-model:nodes="vueFlowNodes"
      v-model:edges="vueFlowEdges"
      :min-zoom="0.2"
      :max-zoom="2"
      :default-viewport="viewport"
      :connect-on-click="true"
      :connection-line-style="connectionLineStyle"
      :proportional-zoom="true"
      class="flow-canvas"
      @node-click="handleNodeClick"
      @edge-click="handleEdgeClick"
      @node-drag-stop="handleNodeDragStop"
      @connect="handleConnect"
      @pane-click="handlePaneClick"
      @move-end="handleMoveEnd"
      @drop="handleDrop"
      @dragover.prevent
      @dragenter.prevent
    >
      <Background :gap="16" pattern-color="#a8dadc" />
      <Controls :show-fit-view="true" :show-interactive="true" position="bottom-right" />
      <MiniMap
        node-stroke-color="#000"
        node-fill-color="#fff"
        node-class-name="custom-node"
        :position="'bottom-left'"
      />

      <template #node-custom="{ data }">
        <div
          class="custom-flow-node"
          :class="[`node-type-${data.type}`, { 'is-selected': data.selected }]"
        >
          <div class="node-header">
            <el-icon v-if="data.type === 'start'"><VideoPlay /></el-icon>
            <el-icon v-else-if="data.type === 'end'"><VideoPause /></el-icon>
            <el-icon v-else-if="data.type === 'branch'"><Share /></el-icon>
            <el-icon v-else-if="data.type === 'loop'"><Refresh /></el-icon>
            <el-icon v-else><Operation /></el-icon>
            <span class="node-title">{{ data.label }}</span>
          </div>
          <div class="node-body">
            <p class="node-desc">{{ data.description }}</p>
            <div v-if="data.duration" class="node-duration">
              <el-icon><Timer /></el-icon>
              <span>{{ formatDuration(data.duration) }}</span>
            </div>
            <div v-if="data.mediaCount > 0" class="node-media">
              <el-icon><Picture /></el-icon>
              <span>{{ data.mediaCount }} 素材</span>
            </div>
          </div>
          <Handle
            v-if="data.type !== 'start'"
            type="target"
            position="left"
            :style="{ background: '#409EFF' }"
          />
          <Handle
            v-if="data.type !== 'end'"
            type="source"
            position="right"
            :style="{ background: '#67C23A' }"
          />
        </div>
      </template>
    </VueFlow>

    <el-dialog
      v-model="edgeDialogVisible"
      title="编辑连线属性"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="连线类型">
          <el-select v-model="editingEdgeType">
            <el-option label="顺序" value="sequential" />
            <el-option label="并行" value="parallel" />
            <el-option label="分支" value="branch" />
            <el-option label="循环" value="loop" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="editingEdgeLabel" placeholder="可选" />
        </el-form-item>
        <el-form-item label="条件">
          <el-input v-model="editingEdgeCondition" placeholder="分支条件" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="edgeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdge">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import VueFlow, { Handle, addEdge, type Node, type Edge, type Connection, type VueFlowStore } from '@vue-flow/core'
import Background from '@vue-flow/background'
import Controls from '@vue-flow/controls'
import MiniMap from '@vue-flow/minimap'
import { ElMessage } from 'element-plus'
import { Plus, Delete, Grid, Share, Refresh, VideoPlay, VideoPause, Operation, Timer, Picture } from '@element-plus/icons-vue'
import { useStepEditorStore } from '@/stores/step-editor'
import type { StepNode, EdgeType } from '@/types'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'nodeSelect', nodeId: string | null): void
}>()

const stepEditor = useStepEditorStore()

const vueFlowRef = ref<typeof VueFlow | null>(null)
const vueFlowInstance = ref<VueFlowStore | null>(null)

const edgeDialogVisible = ref(false)
const selectedEdgeId = ref<string | null>(null)
const editingEdgeType = ref<EdgeType>('sequential')
const editingEdgeLabel = ref('')
const editingEdgeCondition = ref('')

const nodes = computed(() => stepEditor.nodes)
const edges = computed(() => stepEditor.edges)
const selectedNodeId = computed(() => stepEditor.selectedNodeId)
const viewport = computed(() => stepEditor.viewport)

const connectionLineStyle = {
  stroke: '#409EFF',
  strokeWidth: 2
}

const nodeTypeColors: Record<string, string> = {
  start: '#67C23A',
  end: '#F56C6C',
  branch: '#E6A23C',
  loop: '#909399',
  normal: '#409EFF'
}

const vueFlowNodes = computed<Node[]>(() => {
  return nodes.value.map(node => ({
    id: node.id,
    type: 'custom',
    position: node.position,
    data: {
      label: node.name,
      description: node.description.length > 30 ? node.description.slice(0, 30) + '...' : node.description,
      duration: node.duration,
      type: node.type,
      mediaCount: node.mediaIds.length,
      selected: selectedNodeId.value === node.id
    },
    style: {
      borderLeft: `4px solid ${nodeTypeColors[node.type]}`,
      background: selectedNodeId.value === node.id ? '#ECF5FF' : '#fff'
    }
  }))
})

const vueFlowEdges = computed<Edge[]>(() => {
  return edges.value.map(edge => {
    const typeStyles: Record<string, { stroke: string; strokeDasharray?: string }> = {
      sequential: { stroke: '#409EFF' },
      parallel: { stroke: '#67C23A', strokeDasharray: '5,5' },
      branch: { stroke: '#E6A23C', strokeDasharray: '10,5' },
      loop: { stroke: '#F56C6C', strokeDasharray: '2,2' }
    }
    const style = typeStyles[edge.type] || typeStyles.sequential

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: edge.type === 'loop',
      style: {
        stroke: style.stroke,
        strokeWidth: 2,
        strokeDasharray: style.strokeDasharray
      },
      labelStyle: {
        fontSize: 12,
        fill: '#666'
      }
    }
  })
})

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
  return `${Math.floor(seconds / 3600)}时${Math.floor((seconds % 3600) / 60)}分`
}

const addNode = (type: StepNode['type'] = 'normal') => {
  const typeNames: Record<string, string> = {
    start: '开始',
    end: '结束',
    branch: '分支',
    loop: '循环',
    normal: '步骤'
  }

  const nodeCount = nodes.value.filter(n => n.type === type).length + 1

  const newNode = stepEditor.addNode({
    name: `${typeNames[type]}${nodeCount}`,
    description: '',
    duration: 0,
    keyTechniques: [],
    mediaIds: [],
    position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
    type,
    notes: ''
  })

  stepEditor.selectNode(newNode.id)
  emit('nodeSelect', newNode.id)
}

const deleteSelected = () => {
  if (selectedNodeId.value) {
    stepEditor.removeNode(selectedNodeId.value)
    emit('nodeSelect', null)
    ElMessage.success('节点已删除')
  }
}

const autoLayout = () => {
  stepEditor.autoLayout()
  ElMessage.success('自动布局完成')
}

const handleNodeClick = (event: { node: Node }) => {
  stepEditor.selectNode(event.node.id)
  emit('nodeSelect', event.node.id)
}

const handleEdgeClick = (event: { edge: Edge }) => {
  const edge = edges.value.find(e => e.id === event.edge.id)
  if (edge) {
    selectedEdgeId.value = edge.id
    editingEdgeType.value = edge.type
    editingEdgeLabel.value = edge.label || ''
    editingEdgeCondition.value = edge.condition || ''
    edgeDialogVisible.value = true
  }
}

const handleNodeDragStop = (event: { node: Node }) => {
  stepEditor.updateNode(event.node.id, {
    position: event.node.position
  })
}

const handleConnect = (connection: Connection) => {
  const sourceNode = nodes.value.find(n => n.id === connection.source)
  const targetNode = nodes.value.find(n => n.id === connection.target)

  if (!sourceNode || !targetNode) return

  if (sourceNode.type === 'end') {
    ElMessage.warning('结束节点不能作为起点')
    return
  }
  if (targetNode.type === 'start') {
    ElMessage.warning('开始节点不能作为终点')
    return
  }

  let edgeType: EdgeType = 'sequential'
  if (sourceNode.type === 'branch') {
    edgeType = 'branch'
  } else if (sourceNode.type === 'loop') {
    edgeType = 'loop'
  }

  stepEditor.addEdge({
    source: connection.source!,
    target: connection.target!,
    type: edgeType
  })
}

const handlePaneClick = () => {
  stepEditor.selectNode(null)
  emit('nodeSelect', null)
}

const handleMoveEnd = (event: { viewport: { x: number; y: number; zoom: number } }) => {
  stepEditor.setViewport(event.viewport)
}

const saveEdge = () => {
  if (selectedEdgeId.value) {
    stepEditor.updateEdge(selectedEdgeId.value, {
      type: editingEdgeType.value,
      label: editingEdgeLabel.value,
      condition: editingEdgeCondition.value
    })
    edgeDialogVisible.value = false
    ElMessage.success('连线属性已保存')
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  const mediaId = event.dataTransfer?.getData('mediaId')
  if (!mediaId || !vueFlowInstance.value) return

  const targetNode = (event.target as HTMLElement).closest('.vue-flow__node')
  if (targetNode) {
    const nodeId = targetNode.getAttribute('data-id')
    if (nodeId) {
      const success = stepEditor.addMediaToNode(nodeId, mediaId)
      if (success) {
        stepEditor.selectNode(nodeId)
        emit('nodeSelect', nodeId)
        ElMessage.success('素材已关联到步骤')
      }
      stepEditor.setDraggingMedia(null)
      return
    }
  }

  const position = vueFlowInstance.value.screenToFlowPosition({
    x: event.clientX,
    y: event.clientY
  })

  const type = editingEdgeType.value || 'normal'

  const newNode = stepEditor.addNode({
    name: '新步骤',
    description: '',
    duration: 0,
    keyTechniques: [],
    mediaIds: [mediaId],
    position,
    type,
    notes: ''
  })

  if (newNode) {
    stepEditor.selectNode(newNode.id)
    emit('nodeSelect', newNode.id)
    ElMessage.success('已创建新步骤并关联素材')
  }
  stepEditor.setDraggingMedia(null)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
    if (selectedNodeId.value) {
      deleteSelected()
    }
  }
}

onMounted(() => {
  if (vueFlowRef.value) {
    vueFlowInstance.value = (vueFlowRef.value as any).vueFlow as VueFlowStore
  }
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

defineExpose({
  addNode,
  autoLayout,
  deleteSelected
})
</script>

<style lang="scss" scoped>
.step-flow-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;

  .toolbar-left {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .node-count {
    font-size: 13px;
    color: #909399;
  }
}

.flow-canvas {
  flex: 1;
  width: 100%;
  background: #f5f7fa;
}

.custom-flow-node {
  min-width: 180px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.2s ease;

  &.is-selected {
    box-shadow: 0 2px 20px 0 rgba(64, 158, 255, 0.5);
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 14px;
    color: #303133;
    border-bottom: 1px solid #f0f0f0;

    .el-icon {
      font-size: 16px;
      color: #409EFF;
    }
  }

  .node-body {
    padding: 10px 12px;
    font-size: 12px;
    color: #606266;

    .node-desc {
      margin: 0 0 8px 0;
      line-height: 1.5;
      min-height: 18px;
    }

    .node-duration,
    .node-media {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #909399;
      margin-top: 4px;

      .el-icon {
        font-size: 12px;
      }
    }
  }
}

:deep(.vue-flow__handle) {
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
}

:deep(.vue-flow__edge-path) {
  stroke-width: 2;
}

:deep(.vue-flow__controls) {
  button {
    background: #fff;
    color: #606266;

    &:hover {
      background: #ecf5ff;
      color: #409EFF;
    }
  }
}

:deep(.vue-flow__minimap) {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}
</style>
