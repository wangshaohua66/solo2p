<template>
  <div class="equipment-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>设备管理</span>
          <el-button
            v-if="isTechDirector"
            type="primary"
            @click="handleCreate"
          >
            <el-icon><Plus /></el-icon>
            新增设备
          </el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="全部" name="all" />
        <el-tab-pane label="灯光" name="lighting" />
        <el-tab-pane label="音响" name="sound" />
        <el-tab-pane label="舞美" name="stage" />
      </el-tabs>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="类别">
          <el-select v-model="filters.category" placeholder="请选择类别" clearable>
            <el-option label="灯光" value="lighting" />
            <el-option label="音响" value="sound" />
            <el-option label="舞美" value="stage" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="请选择状态" clearable>
            <el-option label="可用" value="available" />
            <el-option label="使用中" value="in_use" />
            <el-option label="维修中" value="maintenance" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="equipments" stripe border>
        <el-table-column prop="ID" label="ID" width="80" />
        <el-table-column prop="Name" label="名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="ModelName" label="型号" min-width="140" show-overflow-tooltip />
        <el-table-column label="类别" width="100">
          <template #default="{ row }">
            <el-tag :type="categoryTagType(row.Category)">{{ categoryText(row.Category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.Status)">{{ statusText(row.Status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="Location" label="位置" width="140" show-overflow-tooltip />
        <el-table-column prop="SerialNumber" label="编号" width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleViewHistory(row)">使用记录</el-button>
            <el-button
              v-if="isTechDirector"
              link
              type="primary"
              @click="handleEdit(row)"
            >编辑</el-button>
            <el-button
              v-if="isTechDirector && row.Status !== 'maintenance'"
              link
              type="warning"
              @click="handleMaintenance(row)"
            >标记维修</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="560px"
      @close="resetForm"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="设备名称" prop="Name">
          <el-input v-model="form.Name" placeholder="请输入设备名称" />
        </el-form-item>
        <el-form-item label="类别" prop="Category">
          <el-select v-model="form.Category" placeholder="请选择类别" style="width: 100%">
            <el-option label="灯光" value="lighting" />
            <el-option label="音响" value="sound" />
            <el-option label="舞美" value="stage" />
          </el-select>
        </el-form-item>
        <el-form-item label="型号" prop="ModelName">
          <el-input v-model="form.ModelName" placeholder="请输入型号" />
        </el-form-item>
        <el-form-item label="状态" prop="Status">
          <el-select v-model="form.Status" placeholder="请选择状态" style="width: 100%">
            <el-option label="可用" value="available" />
            <el-option label="使用中" value="in_use" />
            <el-option label="维修中" value="maintenance" />
          </el-select>
        </el-form-item>
        <el-form-item label="位置" prop="Location">
          <el-input v-model="form.Location" placeholder="请输入存放位置" />
        </el-form-item>
        <el-form-item label="编号" prop="SerialNumber">
          <el-input v-model="form.SerialNumber" placeholder="请输入设备编号" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.Description"
            type="textarea"
            :rows="3"
            placeholder="请输入设备描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="historyVisible" title="设备使用记录" size="500px">
      <template v-if="currentEquipment">
        <el-descriptions :column="1" border class="equipment-info">
          <el-descriptions-item label="设备名称">{{ currentEquipment.Name }}</el-descriptions-item>
          <el-descriptions-item label="型号">{{ currentEquipment.ModelName }}</el-descriptions-item>
          <el-descriptions-item label="编号">{{ currentEquipment.SerialNumber }}</el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">使用记录</el-divider>
        <el-empty v-if="!usageHistory.length" description="暂无使用记录" />
        <el-timeline v-else>
          <el-timeline-item
            v-for="(record, index) in usageHistory"
            :key="index"
            :timestamp="record.time"
          >
            <el-card shadow="never">
              <div class="record-title">{{ record.title }}</div>
              <div class="record-desc">{{ record.description }}</div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import {
  getEquipments,
  createEquipment,
  updateEquipment,
  setEquipmentMaintenance
} from '@/api/resource'
import type { Equipment, EquipmentCategory, EquipmentStatus } from '@/types'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const historyVisible = ref(false)
const formRef = ref<FormInstance>()
const isEdit = ref(false)
const activeTab = ref('all')
const equipments = ref<Equipment[]>([])
const currentEquipment = ref<Equipment | null>(null)
const usageHistory = ref<{ time: string; title: string; description: string }[]>([])

const isTechDirector = computed(() => userStore.hasRole('tech_director'))

const filters = reactive({
  category: undefined as string | undefined,
  status: undefined as string | undefined
})

const form = reactive<Partial<Equipment>>({
  Name: '',
  Category: 'lighting',
  ModelName: '',
  Status: 'available',
  Location: '',
  SerialNumber: '',
  Description: ''
})

const rules: FormRules = {
  Name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
  Category: [{ required: true, message: '请选择类别', trigger: 'change' }],
  ModelName: [{ required: true, message: '请输入型号', trigger: 'blur' }],
  Status: [{ required: true, message: '请选择状态', trigger: 'change' }],
  Location: [{ required: true, message: '请输入存放位置', trigger: 'blur' }],
  SerialNumber: [{ required: true, message: '请输入设备编号', trigger: 'blur' }]
}

const dialogTitle = computed(() => (isEdit.value ? '编辑设备' : '新增设备'))

const categoryText = (category: EquipmentCategory) => {
  const map: Record<EquipmentCategory, string> = {
    lighting: '灯光',
    sound: '音响',
    stage: '舞美'
  }
  return map[category] || category
}

const categoryTagType = (category: EquipmentCategory) => {
  const map: Record<EquipmentCategory, 'primary' | 'success' | 'warning'> = {
    lighting: 'primary',
    sound: 'success',
    stage: 'warning'
  }
  return map[category] || 'info'
}

const statusText = (status: EquipmentStatus) => {
  const map: Record<EquipmentStatus, string> = {
    available: '可用',
    in_use: '使用中',
    maintenance: '维修中'
  }
  return map[status] || status
}

const statusTagType = (status: EquipmentStatus) => {
  const map: Record<EquipmentStatus, 'success' | 'warning' | 'danger'> = {
    available: 'success',
    in_use: 'warning',
    maintenance: 'danger'
  }
  return map[status] || 'info'
}

const fetchData = async () => {
  loading.value = true
  try {
    const params: { category?: string; status?: string } = {}
    if (activeTab.value !== 'all') {
      params.category = activeTab.value
    } else if (filters.category) {
      params.category = filters.category
    }
    if (filters.status) {
      params.status = filters.status
    }
    equipments.value = await getEquipments(params)
  } catch (e) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const handleTabChange = () => {
  fetchData()
}

const handleReset = () => {
  filters.category = undefined
  filters.status = undefined
  fetchData()
}

const resetForm = () => {
  Object.assign(form, {
    Name: '',
    Category: 'lighting',
    ModelName: '',
    Status: 'available',
    Location: '',
    SerialNumber: '',
    Description: ''
  })
  formRef.value?.resetFields()
}

const handleCreate = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row: Equipment) => {
  isEdit.value = true
  Object.assign(form, {
    ID: row.ID,
    Name: row.Name,
    Category: row.Category,
    ModelName: row.ModelName,
    Status: row.Status,
    Location: row.Location,
    SerialNumber: row.SerialNumber,
    Description: row.Description
  })
  dialogVisible.value = true
}

const handleMaintenance = (row: Equipment) => {
  ElMessageBox.confirm(`确认将设备"${row.Name}"标记为维修中？`, '确认操作', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      await setEquipmentMaintenance(row.ID)
      ElMessage.success('已标记为维修中')
      fetchData()
    })
    .catch(() => {})
}

const handleViewHistory = (row: Equipment) => {
  currentEquipment.value = row
  usageHistory.value = [
    {
      time: '2026-06-10 14:00:00',
      title: '用于《天鹅湖》演出',
      description: '档期ID: 12, 演出时间: 2026-06-10 19:30'
    },
    {
      time: '2026-06-05 10:00:00',
      title: '归还入库',
      description: '设备归还至A区-03货架，状态检查正常'
    },
    {
      time: '2026-06-01 09:00:00',
      title: '用于《雷雨》排练',
      description: '档期ID: 8, 排练时间: 2026-06-01 ~ 2026-06-03'
    }
  ]
  historyVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async valid => {
    if (!valid) return
    submitting.value = true
    try {
      if (isEdit.value && form.ID) {
        await updateEquipment(form.ID, form)
        ElMessage.success('更新成功')
      } else {
        await createEquipment(form)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      resetForm()
      fetchData()
    } catch (e) {
      ElMessage.error('操作失败')
    } finally {
      submitting.value = false
    }
  })
}

onMounted(fetchData)
</script>

<style scoped lang="scss">
.equipment-manage {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .filter-form {
    margin-bottom: 16px;
  }

  .equipment-info {
    margin-bottom: 16px;
  }

  .record-title {
    font-weight: 600;
    margin-bottom: 4px;
  }

  .record-desc {
    font-size: 13px;
    color: #606266;
  }
}
</style>
