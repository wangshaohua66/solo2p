<template>
  <div class="step-editor">
    <div class="editor-header">
      <div class="header-left">
        <el-button @click="goBack" :icon="ArrowLeft">
          返回
        </el-button>
        <h2>{{ project?.name || '加载中...' }}</h2>
        <el-tag v-if="project" :style="{ background: getCategoryColor(project.category) }">
          {{ HERITAGE_CATEGORY_LABELS[project.category] }}
        </el-tag>
      </div>
      <div class="header-right">
        <el-button @click="saveFlow" type="primary" :icon="Check">
          保存流程
        </el-button>
        <el-button @click="openRelationDialog" :icon="Connection">
          管理关联
        </el-button>
      </div>
    </div>

    <div class="editor-body">
      <div class="media-panel" :class="{ 'is-collapsed': mediaPanelCollapsed }">
        <div class="panel-toggle" @click="toggleMediaPanel">
          <el-icon><ArrowLeft v-if="!mediaPanelCollapsed" /><ArrowRight v-else /></el-icon>
        </div>
        <div v-show="!mediaPanelCollapsed" class="panel-content">
          <MediaPicker
            :media-list="project?.mediaLib || []"
            :selected-media-ids="selectedNode?.mediaIds || []"
            :project-id="projectId"
            @add-media="handleAddMedia"
            @remove-media="handleRemoveMedia"
            @update-media="handleUpdateMedia"
            @select-media="handleSelectMedia"
          />
        </div>
      </div>

      <div class="canvas-container">
        <StepFlowEditor
          ref="flowEditorRef"
          :project-id="projectId"
          @node-select="handleNodeSelect"
        />
      </div>

      <div class="properties-panel" v-if="selectedNode">
        <div class="panel-header">
          <h3>节点属性</h3>
          <el-button size="small" text @click="closeProperties">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <div class="panel-body">
          <el-form label-width="80px" size="small">
            <el-form-item label="节点类型">
              <el-select v-model="selectedNode.type" @change="updateNodeData">
                <el-option label="普通步骤" value="normal" />
                <el-option label="开始节点" value="start" />
                <el-option label="结束节点" value="end" />
                <el-option label="分支节点" value="branch" />
                <el-option label="循环节点" value="loop" />
              </el-select>
            </el-form-item>
            <el-form-item label="步骤名称" required>
              <el-input
                v-model="selectedNode.name"
                placeholder="请输入步骤名称"
                maxlength="50"
                show-word-limit
                @blur="updateNodeData"
              />
            </el-form-item>
            <el-form-item label="步骤描述">
              <el-input
                v-model="selectedNode.description"
                type="textarea"
                :rows="3"
                placeholder="请输入步骤描述"
                maxlength="500"
                show-word-limit
                @blur="updateNodeData"
              />
            </el-form-item>
            <el-form-item label="时长">
              <el-input-number
                v-model="selectedNode.duration"
                :min="0"
                :max="86400"
                :step="1"
                style="width: 100%"
                @change="updateNodeData"
              />
              <span class="unit">秒</span>
            </el-form-item>
            <el-form-item label="关键手法">
              <div class="techniques-list">
                <div
                  v-for="(technique, index) in selectedNode.keyTechniques"
                  :key="index"
                  class="technique-item"
                >
                  <el-tag closable @close="removeTechnique(index)">
                    {{ technique }}
                  </el-tag>
                </div>
                <div class="add-technique">
                  <el-input
                    v-model="newTechnique"
                    placeholder="添加关键手法"
                    size="small"
                    @keyup.enter="addTechnique"
                  />
                  <el-button size="small" @click="addTechnique">
                    <el-icon><Plus /></el-icon>
                  </el-button>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="关联素材">
              <div class="associated-media">
                <div
                  v-for="media in getNodeMedia(selectedNode.mediaIds)"
                  :key="media.id"
                  class="media-thumb"
                >
                  <img
                    v-if="media.type === 'image'"
                    :src="media.thumbnail || media.url"
                    :alt="media.name"
                  />
                  <el-icon v-else class="video-icon"><VideoCamera /></el-icon>
                  <div class="media-info">
                    <span class="media-name">{{ media.name }}</span>
                    <el-button
                      size="small"
                      type="danger"
                      text
                      @click="removeMediaFromNode(media.id)"
                    >
                      移除
                    </el-button>
                  </div>
                </div>
                <el-empty
                  v-if="selectedNode.mediaIds.length === 0"
                  description="从左侧素材库拖拽素材到节点或画布"
                  :image-size="40"
                />
              </div>
            </el-form-item>
            <el-form-item label="备注">
              <el-input
                v-model="selectedNode.notes"
                type="textarea"
                :rows="2"
                placeholder="可选备注信息"
                @blur="updateNodeData"
              />
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="relationDialogVisible"
      title="管理项目关联"
      width="600px"
      destroy-on-close
    >
      <el-form label-width="100px">
        <el-form-item label="关联项目">
          <el-select v-model="newRelation.targetId" placeholder="选择关联项目" filterable style="width: 100%">
            <el-option
              v-for="p in otherProjects"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关联类型">
          <el-select v-model="newRelation.type" placeholder="选择关联类型" style="width: 100%">
            <el-option
              v-for="(label, key) in RELATION_TYPE_LABELS"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关联强度">
          <el-slider v-model="newRelation.strength" :min="1" :max="5" :step="1" show-stops />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="newRelation.description"
            type="textarea"
            :rows="2"
            placeholder="请输入关联描述"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="addRelation" :disabled="!canAddRelation">
            添加关联
          </el-button>
        </el-form-item>
      </el-form>
      <div class="existing-relations">
        <h4>已有关联</h4>
        <div v-if="project?.relations?.length > 0">
          <div
            v-for="rel in project.relations"
            :key="rel.id"
            class="relation-item"
          >
            <div class="relation-info">
              <span class="relation-name">{{ getProjectName(rel.targetId) }}</span>
              <span class="relation-type" :style="{ color: RELATION_TYPE_COLORS[rel.type] }">
                {{ RELATION_TYPE_LABELS[rel.type] }}
              </span>
              <span class="relation-strength">强度: {{ rel.strength }}</span>
            </div>
            <el-button size="small" type="danger" text @click="removeRelation(rel.id)">
              删除
            </el-button>
          </div>
        </div>
        <el-empty v-else description="暂无关联" :image-size="60" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, Check, Connection, Close, Plus, VideoCamera } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useStepEditorStore } from '@/stores/step-editor'
import { HERITAGE_CATEGORY_LABELS, RELATION_TYPE_LABELS, RELATION_TYPE_COLORS } from '@/types'
import type { MediaItem, HeritageCategory, RelationType, StepNode } from '@/types'
import StepFlowEditor from '@/components/StepFlowEditor.vue'
import MediaPicker from '@/components/MediaPicker.vue'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const stepEditor = useStepEditorStore()

const projectId = computed(() => route.params.projectId as string)
const project = computed(() => projectStore.getProjectById(projectId.value))

const flowEditorRef = ref<InstanceType<typeof StepFlowEditor> | null>(null)
const mediaPanelCollapsed = ref(false)
const newTechnique = ref('')
const relationDialogVisible = ref(false)

const newRelation = reactive({
  targetId: '',
  type: '' as RelationType | '',
  strength: 3,
  description: ''
})

const selectedNode = computed<StepNode | null>(() => {
  if (!stepEditor.selectedNodeId) return null
  const node = stepEditor.nodes.find(n => n.id === stepEditor.selectedNodeId)
  return node || null
})

const otherProjects = computed(() => {
  return projectStore.projects.filter(p => p.id !== projectId.value)
})

const canAddRelation = computed(() => {
  return newRelation.targetId && newRelation.type
})

const categoryColors: Record<string, string> = {
  traditional_skill: '#409EFF',
  traditional_music: '#67C23A',
  traditional_dance: '#E6A23C',
  traditional_drama: '#F56C6C',
  folk_custom: '#909399'
}

const getCategoryColor = (category: HeritageCategory) => {
  return categoryColors[category] || '#909399'
}

const getProjectName = (id: string) => {
  return projectStore.getProjectById(id)?.name || '未知项目'
}

const getNodeMedia = (mediaIds: string[]) => {
  if (!project.value) return []
  return project.value.mediaLib.filter(m => mediaIds.includes(m.id))
}

const toggleMediaPanel = () => {
  mediaPanelCollapsed.value = !mediaPanelCollapsed.value
}

const goBack = () => {
  router.push('/projects')
}

const closeProperties = () => {
  stepEditor.selectNode(null)
}

const updateNodeData = () => {
  if (selectedNode.value) {
    stepEditor.updateNode(selectedNode.value.id, { ...selectedNode.value })
  }
}

const addTechnique = () => {
  if (newTechnique.value.trim() && selectedNode.value) {
    stepEditor.addKeyTechnique(selectedNode.value.id, newTechnique.value.trim())
    newTechnique.value = ''
  }
}

const removeTechnique = (index: number) => {
  if (selectedNode.value) {
    stepEditor.removeKeyTechnique(selectedNode.value.id, index)
  }
}

const removeMediaFromNode = (mediaId: string) => {
  if (selectedNode.value) {
    stepEditor.removeMediaFromNode(selectedNode.value.id, mediaId)
  }
}

const handleNodeSelect = (nodeId: string | null) => {
  stepEditor.selectNode(nodeId)
}

const handleAddMedia = (media: MediaItem) => {
  projectStore.addMedia(projectId.value, media)
}

const handleRemoveMedia = (mediaId: string) => {
  projectStore.removeMedia(projectId.value, mediaId)
}

const handleUpdateMedia = (media: MediaItem) => {
  if (!project.value) return
  const index = project.value.mediaLib.findIndex(m => m.id === media.id)
  if (index !== -1) {
    const newMediaLib = [...project.value.mediaLib]
    newMediaLib[index] = media
    projectStore.updateProject(projectId.value, { mediaLib: newMediaLib })
  }
}

const handleSelectMedia = (mediaId: string) => {
  if (selectedNode.value) {
    if (selectedNode.value.mediaIds.includes(mediaId)) {
      stepEditor.removeMediaFromNode(selectedNode.value.id, mediaId)
    } else {
      stepEditor.addMediaToNode(selectedNode.value.id, mediaId)
    }
  }
}

const saveFlow = () => {
  const flow = stepEditor.getFlow()
  projectStore.updateStepFlow(projectId.value, flow)
  ElMessage.success('流程已保存')
}

const openRelationDialog = () => {
  newRelation.targetId = ''
  newRelation.type = ''
  newRelation.strength = 3
  newRelation.description = ''
  relationDialogVisible.value = true
}

const addRelation = () => {
  if (!newRelation.targetId || !newRelation.type) return

  projectStore.addRelation(projectId.value, {
    sourceId: projectId.value,
    targetId: newRelation.targetId,
    type: newRelation.type as RelationType,
    strength: newRelation.strength,
    description: newRelation.description
  })

  newRelation.targetId = ''
  newRelation.type = ''
  newRelation.strength = 3
  newRelation.description = ''

  ElMessage.success('关联已添加')
}

const removeRelation = (relationId: string) => {
  projectStore.removeRelation(projectId.value, relationId)
  ElMessage.success('关联已删除')
}

onMounted(() => {
  if (!projectId.value) {
    router.push('/projects')
    return
  }

  if (project.value) {
    nextTick(() => {
      stepEditor.loadFlow(project.value!.stepFlow)
    })
  } else {
    ElMessage.error('项目不存在')
    router.push('/projects')
  }
})

watch(() => project.value?.stepFlow, (newFlow) => {
  if (newFlow && stepEditor.nodes.length === 0) {
    stepEditor.loadFlow(newFlow)
  }
}, { deep: true })
</script>

<style lang="scss" scoped>
.step-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }

  .header-right {
    display: flex;
    gap: 8px;
  }
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.media-panel {
  width: 300px;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-shrink: 0;
  position: relative;
  background: #fff;

  &.is-collapsed {
    width: 40px;
  }

  .panel-toggle {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 60px;
    background: #f5f7fa;
    border: 1px solid #e4e7ed;
    border-left: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    transition: all 0.2s;

    &:hover {
      background: #ecf5ff;
      color: #409EFF;
    }
  }

  .panel-content {
    flex: 1;
    overflow: hidden;
  }
}

.canvas-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.properties-panel {
  width: 320px;
  border-left: 1px solid #e4e7ed;
  background: #fff;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #e4e7ed;

    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #303133;
    }
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;

    .unit {
      margin-left: 4px;
      font-size: 12px;
      color: #909399;
    }
  }
}

.techniques-list {
  .technique-item {
    display: inline-block;
    margin-right: 8px;
    margin-bottom: 8px;
  }

  .add-technique {
    display: flex;
    gap: 4px;
    margin-top: 8px;
  }
}

.associated-media {
  max-height: 200px;
  overflow-y: auto;

  .media-thumb {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    background: #f5f7fa;
    border-radius: 4px;
    margin-bottom: 6px;

    img {
      width: 40px;
      height: 40px;
      object-fit: cover;
      border-radius: 4px;
    }

    .video-icon {
      width: 40px;
      height: 40px;
      background: #e4e7ed;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #909399;
    }

    .media-info {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;

      .media-name {
        font-size: 12px;
        color: #303133;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 140px;
      }
    }
  }
}

.existing-relations {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #303133;
  }

  .relation-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;
    margin-bottom: 8px;

    .relation-info {
      display: flex;
      gap: 12px;
      align-items: center;

      .relation-name {
        font-size: 14px;
        color: #303133;
        font-weight: 500;
      }

      .relation-type {
        font-size: 12px;
        font-weight: 500;
      }

      .relation-strength {
        font-size: 12px;
        color: #909399;
      }
    }
  }
}

@media (max-width: 1366px) {
  .media-panel {
    width: 0;
    overflow: hidden;
    border: none;

    &.is-collapsed {
      width: 0;
    }

    .panel-toggle {
      left: 0;
      right: auto;
      border-left: 1px solid #e4e7ed;
      border-right: none;
    }
  }

  .properties-panel {
    width: 280px;
  }
}

@media (max-width: 768px) {
  .editor-body {
    flex-direction: column;
  }

  .media-panel {
    width: 100%;
    height: 200px;
    border-right: none;
    border-bottom: 1px solid #e4e7ed;

    &.is-collapsed {
      height: 40px;
      width: 100%;
    }

    .panel-toggle {
      top: auto;
      bottom: 0;
      right: 10px;
      left: auto;
      transform: none;
      width: 60px;
      height: 20px;
    }
  }

  .properties-panel {
    width: 100%;
    height: 300px;
    border-left: none;
    border-top: 1px solid #e4e7ed;
  }
}
</style>
