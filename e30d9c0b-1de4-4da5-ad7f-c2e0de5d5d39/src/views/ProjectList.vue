<template>
  <div class="project-list">
    <div class="page-header">
      <h1>非遗项目管理</h1>
      <div class="header-actions">
        <el-button @click="handleImport">
          <el-icon><Upload /></el-icon>
          导入数据
        </el-button>
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          导出数据
        </el-button>
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          新建项目
        </el-button>
        <input
          ref="importInput"
          type="file"
          accept=".json"
          style="display: none"
          @change="handleImportFile"
        />
      </div>
    </div>

    <div class="filter-section">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="类别">
          <el-select
            v-model="filters.category"
            placeholder="全部类别"
            clearable
            style="width: 140px"
            @change="applyFilters"
          >
            <el-option
              v-for="(label, key) in HERITAGE_CATEGORY_LABELS"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="批次">
          <el-select
            v-model="filters.batch"
            placeholder="全部批次"
            clearable
            style="width: 120px"
            @change="applyFilters"
          >
            <el-option
              v-for="batch in HERITAGE_BATCHES"
              :key="batch"
              :label="`第${batch}批`"
              :value="batch"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="地区">
          <el-select
            v-model="filters.region"
            placeholder="全部地区"
            clearable
            filterable
            style="width: 140px"
            @change="applyFilters"
          >
            <el-option
              v-for="region in REGIONS"
              :key="region"
              :label="region"
              :value="region"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="传承人">
          <el-input
            v-model="filters.inheritorName"
            placeholder="传承人姓名"
            clearable
            style="width: 140px"
            @input="applyFilters"
          />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            placeholder="搜索项目名称和描述"
            clearable
            style="width: 200px"
            @input="applyFilters"
          />
        </el-form-item>
        <el-form-item>
          <el-button @click="resetFilters">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="projects-grid">
      <div
        v-for="project in filteredProjects"
        :key="project.id"
        class="project-card"
        @click="handleCardClick(project)"
      >
        <div class="card-header">
          <span
            class="category-badge"
            :style="{ background: getCategoryColor(project.category) }"
          >
            {{ HERITAGE_CATEGORY_LABELS[project.category] }}
          </span>
          <span class="batch-badge">第{{ project.batch }}批</span>
        </div>
        <div class="card-body">
          <h3 class="project-name">{{ project.name }}</h3>
          <p class="project-region">
            <el-icon><Location /></el-icon>
            {{ project.region }}
          </p>
          <p class="project-desc">{{ project.description }}</p>
          <div class="inheritors">
            <el-avatar-group :max="3">
              <el-avatar
                v-for="inheritor in project.inheritors"
                :key="inheritor.id"
                :size="28"
                :style="{ background: getAvatarColor(inheritor.name) }"
              >
                {{ inheritor.name.slice(0, 1) }}
              </el-avatar>
            </el-avatar-group>
            <span class="inheritor-count">{{ project.inheritors.length }}位传承人</span>
          </div>
          <div class="project-meta">
            <span>
              <el-icon><SetUp /></el-icon>
              {{ project.stepFlow.nodes.length }}个步骤
            </span>
            <span>
              <el-icon><Picture /></el-icon>
              {{ project.mediaLib.length }}个素材
            </span>
          </div>
        </div>
        <div class="card-footer">
          <el-button size="small" type="primary" @click.stop="goToEditor(project.id)">
            编辑步骤
          </el-button>
          <el-button size="small" @click.stop="goToShowcase(project.id)">
            查看展示
          </el-button>
          <el-button
            size="small"
            type="danger"
            text
            @click.stop="handleDelete(project)"
          >
            删除
          </el-button>
        </div>
      </div>

      <el-empty v-if="filteredProjects.length === 0" description="暂无匹配的项目" />
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑项目' : '新建项目'"
      width="700px"
      destroy-on-close
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-row :gutter="16">
          <el-col :span="16">
            <el-form-item label="项目名称" prop="name">
              <el-input v-model="formData.name" placeholder="请输入项目名称" maxlength="100" show-word-limit />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="类别" prop="category">
              <el-select v-model="formData.category" placeholder="请选择类别" style="width: 100%">
                <el-option
                  v-for="(label, key) in HERITAGE_CATEGORY_LABELS"
                  :key="key"
                  :label="label"
                  :value="key"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="批次" prop="batch">
              <el-select v-model="formData.batch" placeholder="请选择批次" style="width: 100%">
                <el-option
                  v-for="batch in HERITAGE_BATCHES"
                  :key="batch"
                  :label="`第${batch}批`"
                  :value="batch"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="申报地区" prop="region">
              <el-select
                v-model="formData.region"
                placeholder="请选择地区"
                filterable
                style="width: 100%"
              >
                <el-option
                  v-for="region in REGIONS"
                  :key="region"
                  :label="region"
                  :value="region"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="保护单位" prop="protectionUnit">
          <el-input v-model="formData.protectionUnit" placeholder="请输入保护单位名称" />
        </el-form-item>
        <el-form-item label="项目描述" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="4"
            placeholder="请输入项目详细描述"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="传承人" prop="inheritors">
          <div class="inheritor-list">
            <div v-for="(inheritor, index) in formData.inheritors" :key="index" class="inheritor-item">
              <el-input
                v-model="inheritor.name"
                placeholder="姓名"
                size="small"
                style="width: 100px; margin-right: 8px"
              />
              <el-select
                v-model="inheritor.gender"
                placeholder="性别"
                size="small"
                style="width: 80px; margin-right: 8px"
              >
                <el-option label="男" value="male" />
                <el-option label="女" value="female" />
              </el-select>
              <el-input-number
                v-model="inheritor.age"
                :min="1"
                :max="150"
                size="small"
                style="width: 80px; margin-right: 8px"
              />
              <el-input
                v-model="inheritor.title"
                placeholder="头衔"
                size="small"
                style="width: 120px; margin-right: 8px"
              />
              <el-button
                size="small"
                type="danger"
                icon="Delete"
                circle
                @click="removeInheritor(index)"
              />
            </div>
            <el-button size="small" @click="addInheritor">
              <el-icon><Plus /></el-icon>
              添加传承人
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

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
        <div v-if="currentProject?.relations?.length > 0">
          <div
            v-for="rel in currentProject.relations"
            :key="rel.id"
            class="relation-item"
          >
            <div class="relation-info">
              <span class="relation-name">{{ getProjectName(rel.targetId) }}</span>
              <span
                class="relation-type"
                :style="{ color: RELATION_TYPE_COLORS[rel.type] }"
              >
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Upload, Download, Plus, Refresh, Location, SetUp, Picture, Delete } from '@element-plus/icons-vue'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '@/stores/project'
import { validateProject } from '@/utils/validator'
import {
  HERITAGE_CATEGORY_LABELS,
  HERITAGE_BATCHES,
  REGIONS,
  RELATION_TYPE_LABELS,
  RELATION_TYPE_COLORS
} from '@/types'
import type { HeritageProject, Inheritor, HeritageCategory, ProjectRelation, RelationType } from '@/types'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()

const importInput = ref<HTMLInputElement | null>(null)
const formRef = ref<FormInstance | null>(null)

const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<string | null>(null)

const relationDialogVisible = ref(false)

const filters = reactive({
  category: '' as HeritageCategory | '',
  batch: '' as number | '',
  region: '',
  inheritorName: '',
  keyword: ''
})

const formData = reactive({
  name: '',
  category: '' as HeritageCategory | '',
  batch: '' as number | '',
  region: '',
  protectionUnit: '',
  description: '',
  inheritors: [] as Inheritor[]
})

const newRelation = reactive({
  targetId: '',
  type: '' as RelationType | '',
  strength: 3,
  description: ''
})

const currentProject = computed(() => projectStore.currentProject)
const filteredProjects = computed(() => projectStore.filteredProjects)

const otherProjects = computed(() => {
  return projectStore.projects.filter(p => p.id !== currentProject.value?.id)
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

const formRules: FormRules = {
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { max: 100, message: '名称不能超过100个字符', trigger: 'blur' }
  ],
  category: [
    { required: true, message: '请选择项目类别', trigger: 'change' }
  ],
  batch: [
    { required: true, message: '请选择批次', trigger: 'change' }
  ],
  region: [
    { required: true, message: '请选择申报地区', trigger: 'change' }
  ],
  protectionUnit: [
    { required: true, message: '请输入保护单位', trigger: 'blur' }
  ],
  description: [
    { required: true, message: '请输入项目描述', trigger: 'blur' },
    { min: 10, message: '描述至少需要10个字符', trigger: 'blur' },
    { max: 500, message: '描述不能超过500个字符', trigger: 'blur' }
  ],
  inheritors: [
    {
      validator: (_rule, value, callback) => {
        if (!value || value.length === 0) {
          callback(new Error('至少添加一位传承人'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ]
}

const getCategoryColor = (category: HeritageCategory) => {
  return categoryColors[category] || '#909399'
}

const getAvatarColor = (name: string) => {
  const colors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#722ED1', '#13C2C2']
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}

const getProjectName = (id: string) => {
  return projectStore.getProjectById(id)?.name || '未知项目'
}

const applyFilters = () => {
  projectStore.setFilters({ ...filters })
  updateQueryParams()
}

const resetFilters = () => {
  filters.category = ''
  filters.batch = ''
  filters.region = ''
  filters.inheritorName = ''
  filters.keyword = ''
  projectStore.resetFilters()
  updateQueryParams()
}

const updateQueryParams = () => {
  const query: Record<string, string> = {}
  if (filters.category) query.category = filters.category
  if (filters.batch) query.batch = String(filters.batch)
  if (filters.region) query.region = filters.region
  if (filters.inheritorName) query.inheritorName = filters.inheritorName
  if (filters.keyword) query.keyword = filters.keyword
  router.replace({ query })
}

const loadFiltersFromQuery = () => {
  const { query } = route
  if (query.category) filters.category = query.category as HeritageCategory
  if (query.batch) filters.batch = Number(query.batch)
  if (query.region) filters.region = query.region as string
  if (query.inheritorName) filters.inheritorName = query.inheritorName as string
  if (query.keyword) filters.keyword = query.keyword as string
  projectStore.setFilters({ ...filters })
}

const openCreateDialog = () => {
  isEdit.value = false
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = (project: HeritageProject) => {
  isEdit.value = true
  editingId.value = project.id
  formData.name = project.name
  formData.category = project.category
  formData.batch = project.batch
  formData.region = project.region
  formData.protectionUnit = project.protectionUnit
  formData.description = project.description
  formData.inheritors = JSON.parse(JSON.stringify(project.inheritors))
  dialogVisible.value = true
}

const resetForm = () => {
  formData.name = ''
  formData.category = ''
  formData.batch = ''
  formData.region = ''
  formData.protectionUnit = ''
  formData.description = ''
  formData.inheritors = []
  formRef.value?.clearValidate()
}

const addInheritor = () => {
  formData.inheritors.push({
    id: uuidv4(),
    name: '',
    gender: 'male',
    age: 60,
    title: ''
  })
}

const removeInheritor = (index: number) => {
  formData.inheritors.splice(index, 1)
}

const handleSave = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    const projectData = {
      name: formData.name,
      category: formData.category as HeritageCategory,
      batch: formData.batch as number,
      region: formData.region,
      description: formData.description,
      protectionUnit: formData.protectionUnit,
      inheritors: formData.inheritors
    }

    const validation = validateProject(projectData)
    if (!validation.valid) {
      ElMessage.error(validation.errors[0])
      return
    }

    if (isEdit.value && editingId.value) {
      projectStore.updateProject(editingId.value, projectData)
      ElMessage.success('项目更新成功')
    } else {
      projectStore.createProject(projectData)
      ElMessage.success('项目创建成功')
    }

    dialogVisible.value = false
  } catch (_e) {
    ElMessage.error('请检查表单填写是否正确')
  }
}

const handleCardClick = (project: HeritageProject) => {
  projectStore.setCurrentProject(project.id)
}

const handleDelete = (project: HeritageProject) => {
  ElMessageBox.confirm(
    `确定要删除项目"${project.name}"吗？此操作不可恢复。`,
    '确认删除',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    projectStore.deleteProject(project.id)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

const goToEditor = (projectId: string) => {
  router.push(`/editor/${projectId}`)
}

const goToShowcase = (projectId: string) => {
  router.push(`/showcase/${projectId}`)
}

const openRelationDialog = (project: HeritageProject) => {
  projectStore.setCurrentProject(project.id)
  newRelation.targetId = ''
  newRelation.type = ''
  newRelation.strength = 3
  newRelation.description = ''
  relationDialogVisible.value = true
}

const addRelation = () => {
  if (!currentProject.value || !newRelation.targetId || !newRelation.type) return

  projectStore.addRelation(currentProject.value.id, {
    sourceId: currentProject.value.id,
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
  if (!currentProject.value) return
  projectStore.removeRelation(currentProject.value.id, relationId)
  ElMessage.success('关联已删除')
}

const handleImport = () => {
  importInput.value?.click()
}

const handleImportFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string
      const result = projectStore.importData(content)
      if (result.success) {
        ElMessage.success('数据导入成功')
      } else {
        ElMessage.error(`导入失败: ${result.errors.join(', ')}`)
      }
    } catch (_e) {
      ElMessage.error('文件解析失败')
    }
  }
  reader.readAsText(file)
  input.value = ''
}

const handleExport = () => {
  projectStore.downloadExport()
  ElMessage.success('数据导出成功')
}

onMounted(() => {
  loadFiltersFromQuery()
})

watch(() => route.query, () => {
  loadFiltersFromQuery()
})
</script>

<style lang="scss" scoped>
.project-list {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #303133;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

.filter-section {
  background: #fff;
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 0;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.project-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
}

.card-header {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  border-bottom: 1px solid #ebeef5;

  .category-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    color: #fff;
    font-weight: 500;
  }

  .batch-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    background: #fff;
    color: #606266;
    border: 1px solid #dcdfe6;
  }
}

.card-body {
  padding: 16px;

  .project-name {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }

  .project-region {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: #909399;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .project-desc {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: #606266;
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .inheritors {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    .inheritor-count {
      font-size: 12px;
      color: #909399;
    }
  }

  .project-meta {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: #909399;

    span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
}

.card-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #ebeef5;
  background: #fafafa;
}

.inheritor-list {
  .inheritor-item {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
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
</style>
