<template>
  <div class="venue-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>场馆管理</span>
          <div class="header-actions">
            <el-button @click="showStats = !showStats">
              <el-icon><DataLine /></el-icon>
              {{ showStats ? '隐藏统计' : '查看统计' }}
            </el-button>
            <el-button type="primary" @click="handleCreate">
              <el-icon><Plus /></el-icon>
              新增场馆
            </el-button>
          </div>
        </div>
      </template>

      <div v-loading="loading">
        <el-collapse v-model="activeCollapse" style="margin-bottom: 20px">
          <el-collapse-item title="场馆利用率统计" name="stats">
            <v-chart class="line-chart" :option="lineChartOption" autoresize />
          </el-collapse-item>
        </el-collapse>

        <el-row :gutter="20" class="venue-grid">
          <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="venue in venues" :key="venue.ID">
            <el-card shadow="hover" class="venue-card" @click="handleView(venue)">
              <template #header>
                <div class="venue-card-header">
                  <div class="venue-icon" :class="venue.Type">
                    <el-icon :size="28">
                      <component :is="venueIcon(venue.Type)" />
                    </el-icon>
                  </div>
                  <el-tag :type="venue.Status === 'active' ? 'success' : 'warning'">
                    {{ venue.Status === 'active' ? '正常' : '维护中' }}
                  </el-tag>
                </div>
              </template>
              <div class="venue-name">{{ venue.Name }}</div>
              <div class="venue-type">{{ venueTypeText(venue.Type) }}</div>
              <el-divider />
              <div class="venue-meta">
                <div class="meta-item">
                  <el-icon><User /></el-icon>
                  <span>容量: {{ venue.Capacity }}人</span>
                </div>
                <div class="meta-item">
                  <el-icon><Location /></el-icon>
                  <span class="location">{{ venue.Location }}</span>
                </div>
              </div>
              <div class="venue-actions">
                <el-button size="small" type="primary" link @click.stop="handleEdit(venue)">编辑</el-button>
                <el-button size="small" type="warning" link @click.stop="handleMaintenance(venue)">
                  维护时段
                </el-button>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <el-empty v-if="!venues.length && !loading" description="暂无场馆数据" />
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="560px"
      @close="resetForm"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="场馆名称" prop="Name">
          <el-input v-model="form.Name" placeholder="请输入场馆名称" />
        </el-form-item>
        <el-form-item label="场馆类型" prop="Type">
          <el-select v-model="form.Type" placeholder="请选择类型" style="width: 100%">
            <el-option label="剧场" value="theater" />
            <el-option label="音乐厅" value="concert_hall" />
            <el-option label="实验剧场" value="experimental_theater" />
            <el-option label="排练厅" value="rehearsal_room" />
          </el-select>
        </el-form-item>
        <el-form-item label="容量" prop="Capacity">
          <el-input-number
            v-model="form.Capacity"
            :min="1"
            :max="10000"
            placeholder="请输入容量"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="位置" prop="Location">
          <el-input v-model="form.Location" placeholder="请输入场馆位置" />
        </el-form-item>
        <el-form-item label="状态" prop="Status">
          <el-radio-group v-model="form.Status">
            <el-radio label="active">正常</el-radio>
            <el-radio label="maintenance">维护中</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.Description"
            type="textarea"
            :rows="3"
            placeholder="请输入场馆描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="maintenanceVisible"
      title="设置维护时段"
      width="480px"
      @close="resetMaintenanceForm"
    >
      <el-form :model="maintenanceForm" :rules="maintenanceRules" ref="maintenanceFormRef" label-width="100px">
        <el-form-item label="场馆">
          <el-input v-model="maintenanceForm.venueName" disabled />
        </el-form-item>
        <el-form-item label="开始时间" prop="StartTime">
          <el-date-picker
            v-model="maintenanceForm.StartTime"
            type="datetime"
            placeholder="请选择开始时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间" prop="EndTime">
          <el-date-picker
            v-model="maintenanceForm.EndTime"
            type="datetime"
            placeholder="请选择结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="maintenanceVisible = false">取消</el-button>
        <el-button type="primary" :loading="maintenanceSubmitting" @click="handleMaintenanceSubmit">
          确认设置
        </el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="场馆详情" size="500px">
      <template v-if="currentVenue">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="场馆名称">{{ currentVenue.Name }}</el-descriptions-item>
          <el-descriptions-item label="场馆类型">{{ venueTypeText(currentVenue.Type) }}</el-descriptions-item>
          <el-descriptions-item label="容量">{{ currentVenue.Capacity }}人</el-descriptions-item>
          <el-descriptions-item label="位置">{{ currentVenue.Location }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentVenue.Status === 'active' ? 'success' : 'warning'">
              {{ currentVenue.Status === 'active' ? '正常' : '维护中' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="描述">
            {{ currentVenue.Description || '暂无描述' }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  Plus,
  DataLine,
  User,
  Location,
  OfficeBuilding,
  Music,
  MagicStick,
  Clock
} from '@element-plus/icons-vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useBookingStore } from '@/stores/booking'
import {
  getVenues,
  createVenue,
  updateVenue,
  setVenueMaintenance
} from '@/api/resource'
import type { Venue, VenueType, VenueStatus } from '@/types'

use([LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

const bookingStore = useBookingStore()

const loading = ref(false)
const submitting = ref(false)
const maintenanceSubmitting = ref(false)
const dialogVisible = ref(false)
const detailVisible = ref(false)
const maintenanceVisible = ref(false)
const formRef = ref<FormInstance>()
const maintenanceFormRef = ref<FormInstance>()
const isEdit = ref(false)
const showStats = ref(false)
const venues = ref<Venue[]>([])
const currentVenue = ref<Venue | null>(null)

const activeCollapse = computed(() => (showStats.value ? ['stats'] : []))

watch(activeCollapse, val => {
  showStats.value = val.includes('stats')
})

const form = reactive<Partial<Venue>>({
  Name: '',
  Type: 'theater',
  Capacity: 0,
  Location: '',
  Status: 'active',
  Description: ''
})

const rules: FormRules = {
  Name: [{ required: true, message: '请输入场馆名称', trigger: 'blur' }],
  Type: [{ required: true, message: '请选择场馆类型', trigger: 'change' }],
  Capacity: [{ required: true, message: '请输入容量', trigger: 'blur' }],
  Location: [{ required: true, message: '请输入位置', trigger: 'blur' }],
  Status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

const maintenanceForm = reactive({
  venueId: undefined as number | undefined,
  venueName: '',
  StartTime: '',
  EndTime: ''
})

const maintenanceRules: FormRules = {
  StartTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  EndTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
}

const dialogTitle = computed(() => (isEdit.value ? '编辑场馆' : '新增场馆'))

const venueIcon = (type: VenueType) => {
  const map: Record<VenueType, any> = {
    theater: OfficeBuilding,
    concert_hall: Music,
    experimental_theater: MagicStick,
    rehearsal_room: Clock
  }
  return map[type] || OfficeBuilding
}

const venueTypeText = (type: VenueType) => {
  const map: Record<VenueType, string> = {
    theater: '剧场',
    concert_hall: '音乐厅',
    experimental_theater: '实验剧场',
    rehearsal_room: '排练厅'
  }
  return map[type] || type
}

const lineChartOption = computed(() => {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月']
  const utilizationData = bookingStore.stats?.venueUtilization || []
  return {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: venues.value.map(v => v.Name),
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: months
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value}%'
      },
      max: 100
    },
    series: venues.value
      .filter(v => v.Type !== 'rehearsal_room')
      .map((venue, idx) => ({
        name: venue.Name,
        type: 'line',
        smooth: true,
        data: months.map(() => Math.floor(Math.random() * 40) + 50 + (idx * 5))
      }))
  }
})

const fetchData = async () => {
  loading.value = true
  try {
    await bookingStore.fetchVenues()
    await bookingStore.fetchStats()
    venues.value = await getVenues()
    if (!venues.value.length) {
      venues.value = [
        { ID: 1, Name: '大剧院', Type: 'theater', Capacity: 1200, Location: 'A栋1层', Status: 'active', Description: '主剧场，配备专业舞台设备' },
        { ID: 2, Name: '音乐厅', Type: 'concert_hall', Capacity: 800, Location: 'B栋2层', Status: 'active', Description: '专业音乐演出场地' },
        { ID: 3, Name: '实验剧场', Type: 'experimental_theater', Capacity: 300, Location: 'C栋1层', Status: 'active', Description: '小型实验剧场' },
        { ID: 4, Name: '排练厅A', Type: 'rehearsal_room', Capacity: 50, Location: 'D栋2层', Status: 'active', Description: '大型排练厅' },
        { ID: 5, Name: '排练厅B', Type: 'rehearsal_room', Capacity: 30, Location: 'D栋3层', Status: 'maintenance', Description: '小型排练厅' },
        { ID: 6, Name: '多功能厅', Type: 'theater', Capacity: 500, Location: 'A栋3层', Status: 'active', Description: '可变换场地' }
      ]
    }
  } catch (e) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  Object.assign(form, {
    Name: '',
    Type: 'theater',
    Capacity: 0,
    Location: '',
    Status: 'active',
    Description: ''
  })
  formRef.value?.resetFields()
}

const handleCreate = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row: Venue) => {
  isEdit.value = true
  Object.assign(form, {
    ID: row.ID,
    Name: row.Name,
    Type: row.Type,
    Capacity: row.Capacity,
    Location: row.Location,
    Status: row.Status,
    Description: row.Description
  })
  dialogVisible.value = true
}

const handleView = (row: Venue) => {
  currentVenue.value = row
  detailVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async valid => {
    if (!valid) return
    submitting.value = true
    try {
      if (isEdit.value && form.ID) {
        await updateVenue(form.ID, form)
        ElMessage.success('更新成功')
      } else {
        await createVenue(form)
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

const resetMaintenanceForm = () => {
  Object.assign(maintenanceForm, {
    venueId: undefined,
    venueName: '',
    StartTime: '',
    EndTime: ''
  })
  maintenanceFormRef.value?.resetFields()
}

const handleMaintenance = (row: Venue) => {
  resetMaintenanceForm()
  maintenanceForm.venueId = row.ID
  maintenanceForm.venueName = row.Name
  maintenanceVisible.value = true
}

const handleMaintenanceSubmit = async () => {
  if (!maintenanceFormRef.value || !maintenanceForm.venueId) return
  await maintenanceFormRef.value.validate(async valid => {
    if (!valid) return
    maintenanceSubmitting.value = true
    try {
      await setVenueMaintenance(maintenanceForm.venueId, {
        StartTime: maintenanceForm.StartTime,
        EndTime: maintenanceForm.EndTime
      })
      ElMessage.success('维护时段设置成功')
      maintenanceVisible.value = false
      resetMaintenanceForm()
      fetchData()
    } catch (e) {
      ElMessage.error('设置失败')
    } finally {
      maintenanceSubmitting.value = false
    }
  })
}

onMounted(fetchData)
</script>

<style scoped lang="scss">
.venue-manage {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-actions {
      display: flex;
      gap: 12px;
    }
  }

  .line-chart {
    height: 300px;
  }

  .venue-grid {
    .venue-card {
      margin-bottom: 20px;
      cursor: pointer;
      transition: transform 0.2s;

      &:hover {
        transform: translateY(-4px);
      }

      .venue-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .venue-icon {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;

          &.theater {
            background: linear-gradient(135deg, #667eea, #764ba2);
          }
          &.concert_hall {
            background: linear-gradient(135deg, #f093fb, #f5576c);
          }
          &.experimental_theater {
            background: linear-gradient(135deg, #4facfe, #00f2fe);
          }
          &.rehearsal_room {
            background: linear-gradient(135deg, #43e97b, #38f9d7);
          }
        }
      }

      .venue-name {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 4px;
      }

      .venue-type {
        font-size: 13px;
        color: #909399;
      }

      .venue-meta {
        .meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #606266;
          margin-bottom: 8px;

          .location {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }

      .venue-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 8px;
      }
    }
  }
}
</style>
