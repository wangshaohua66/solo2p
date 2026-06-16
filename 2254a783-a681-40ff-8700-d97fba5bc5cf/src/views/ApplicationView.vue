<template>
  <div class="space-y-4">
    <div class="bg-port-card rounded-xl p-5 border border-port-card-border">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <el-icon :size="22" color="#2979ff"><DocumentAdd /></el-icon>
          <h2 class="text-lg font-semibold text-white">靠泊申请</h2>
        </div>
        <el-tag type="info" effect="plain" round>{{ USER_ROLE_LABELS[currentUser.role] }}</el-tag>
      </div>

      <el-form :model="form" label-width="100px" label-position="right" class="grid grid-cols-2 gap-x-8">
        <el-form-item label="船名" required>
          <el-input v-model="form.vesselName" placeholder="请输入船舶名称" size="large" />
        </el-form-item>
        <el-form-item label="IMO编号" required>
          <el-input v-model="form.imo" placeholder="7位IMO编号" size="large" maxlength="7" />
        </el-form-item>
        <el-form-item label="船长(m)" required>
          <el-input-number v-model="form.length" :min="50" :max="400" size="large" class="!w-full" />
        </el-form-item>
        <el-form-item label="吃水(m)" required>
          <el-input-number v-model="form.draft" :min="5" :max="20" :step="0.1" size="large" class="!w-full" />
        </el-form-item>
        <el-form-item label="货类" required>
          <el-select v-model="form.cargoType" placeholder="请选择货类" size="large" class="!w-full">
            <el-option v-for="(label, key) in CARGO_TYPE_LABELS" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="货量(吨)" required>
          <el-input-number v-model="form.cargoWeight" :min="100" :max="200000" size="large" class="!w-full" />
        </el-form-item>
        <el-form-item label="ETA到港" required>
          <el-date-picker v-model="form.eta" type="datetime" placeholder="选择预计到港时间" size="large"
            class="!w-full" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="作业类型" required>
          <el-radio-group v-model="form.operationType" size="large">
            <el-radio-button value="load">装货</el-radio-button>
            <el-radio-button value="unload">卸货</el-radio-button>
            <el-radio-button value="both">装卸都有</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="申请人" required>
          <el-input v-model="form.applicant" placeholder="请输入申请人姓名" size="large" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="1" placeholder="选填" size="large" />
        </el-form-item>
      </el-form>

      <div class="flex justify-end gap-3 mt-2">
        <el-button size="large" @click="resetForm">重置</el-button>
        <el-button size="large" type="primary" @click="matchRecommendation">
          <el-icon class="mr-1"><MagicStick /></el-icon>智能匹配泊位
        </el-button>
      </div>
    </div>

    <transition name="fade">
      <div v-if="showRecommendation" class="bg-port-card rounded-xl p-5 border border-port-accent">
        <div class="flex items-center gap-2 mb-4">
          <el-icon :size="22" color="#00c853"><CircleCheckFilled /></el-icon>
          <h3 class="text-lg font-semibold text-white">推荐靠泊方案</h3>
        </div>

        <div v-if="recommendedBerths.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div v-for="(rec, idx) in recommendedBerths.slice(0, 3)" :key="rec.berth.id"
            class="rounded-lg p-4 border transition-all cursor-pointer"
            :class="selectedRecIndex === idx ? 'bg-port-accent/15 border-port-accent' : 'bg-port-panel/50 border-port-card-border hover:border-port-accent/60'"
            @click="selectRecommendation(idx)">
            <div class="flex justify-between items-start mb-2">
              <div>
                <div class="text-white font-medium text-base">{{ rec.berth.name }}</div>
                <div class="text-gray-400 text-xs mt-1">
                  {{ ports.find(p => p.id === rec.berth.portId)?.name }}
                </div>
              </div>
              <el-tag size="small" effect="dark" :type="idx === 0 ? 'success' : 'info'" round>
                {{ idx === 0 ? '最优' : '备选' + idx }}
              </el-tag>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs mt-3">
              <div class="flex justify-between">
                <span class="text-gray-400">泊位长度</span>
                <span class="text-white">{{ rec.berth.length }}m</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">泊位水深</span>
                <span class="text-white">{{ rec.berth.depth }}m</span>
              </div>
              <div class="flex justify-between col-span-2">
                <span class="text-gray-400">兼容货类</span>
                <span class="text-port-accent">{{ rec.berth.cargoTypes.map(c => CARGO_TYPE_LABELS[c]).join('/') }}</span>
              </div>
            </div>
            <el-divider class="my-3 !border-port-card-border" />
            <div class="text-xs space-y-1">
              <div class="flex justify-between">
                <span class="text-gray-400">推荐靠泊</span>
                <span class="text-port-success font-medium">{{ formatTime(rec.time.start) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">预计离泊</span>
                <span class="text-port-warning font-medium">{{ formatTime(rec.time.end) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">作业时长</span>
                <span class="text-white">{{ rec.durationHours.toFixed(1) }} 小时</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-10 text-gray-400">
          <el-icon :size="48" class="mb-2"><Warning /></el-icon>
          <div>未找到匹配的泊位或潮汐窗口，请调整参数</div>
        </div>

        <div class="flex justify-end gap-3">
          <el-button size="large" @click="showRecommendation = false">取消</el-button>
          <el-button size="large" type="primary" :disabled="selectedRecIndex < 0" @click="submitApplication">
            <el-icon class="mr-1"><Promotion /></el-icon>提交申请
          </el-button>
        </div>
      </div>
    </transition>

    <div class="bg-port-card rounded-xl p-5 border border-port-card-border">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <el-icon :size="22" color="#2979ff"><List /></el-icon>
          <h2 class="text-lg font-semibold text-white">我的申请记录</h2>
        </div>
        <el-tag effect="plain" round>共 {{ myApplications.length }} 条</el-tag>
      </div>
      <el-table :data="myApplications" stripe style="width: 100%" size="large"
        :header-cell-style="{ background: '#1e3a5f', color: '#fff', border: 'none' }"
        :cell-style="{ background: 'transparent', color: '#e5e7eb', borderBottom: '1px solid #2a3f5f' }">
        <el-table-column prop="vesselName" label="船名" min-width="120" />
        <el-table-column prop="imo" label="IMO" width="110" />
        <el-table-column label="尺度" width="130">
          <template #default="{ row }">{{ row.length }}m / {{ row.draft }}m</template>
        </el-table-column>
        <el-table-column label="货类/货量" width="160">
          <template #default="{ row }">
            {{ CARGO_TYPE_LABELS[row.cargoType as keyof typeof CARGO_TYPE_LABELS] || row.cargoType }} / {{ row.cargoWeight.toLocaleString() }}t
          </template>
        </el-table-column>
        <el-table-column label="ETA" width="170">
          <template #default="{ row }">{{ formatTime(row.eta) }}</template>
        </el-table-column>
        <el-table-column label="作业类型" width="100">
          <template #default="{ row }">
            {{ row.operationType === 'load' ? '装货' : row.operationType === 'unload' ? '卸货' : '装卸' }}
          </template>
        </el-table-column>
        <el-table-column prop="applicant" label="申请人" width="100" />
        <el-table-column label="提交时间" width="170">
          <template #default="{ row }">{{ formatTime(row.submittedAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default>
            <el-tag size="small" type="warning" effect="dark" round>待审核</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DocumentAdd, MagicStick, CircleCheckFilled, Warning, Promotion, List
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useScheduleStore } from '@/stores/schedule'
import { useVesselStore } from '@/stores/vessel'
import type { CargoType, OperationType, Berth, TideWindow } from '@/types'
import { CARGO_TYPE_LABELS, USER_ROLE_LABELS } from '@/types'
import { findTideWindows } from '@/utils/tide'

const scheduleStore = useScheduleStore()
const vesselStore = useVesselStore()

const { berths, addApplication, pendingApplications } = scheduleStore
const { currentUser, ports, tideForecast48h } = vesselStore

interface Recommendation {
  berth: Berth
  time: { start: Date; end: Date }
  window: TideWindow
  durationHours: number
  score: number
}

const form = reactive({
  vesselName: '',
  imo: '',
  length: 220,
  draft: 12.5,
  cargoType: 'container' as CargoType,
  cargoWeight: 50000,
  eta: dayjs().add(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
  operationType: 'unload' as OperationType,
  applicant: currentUser.name,
  remark: ''
})

const showRecommendation = ref(false)
const recommendedBerths = ref<Recommendation[]>([])
const selectedRecIndex = ref(-1)

const myApplications = computed(() => pendingApplications.filter(a => a.applicant === form.applicant))

function resetForm() {
  form.vesselName = ''
  form.imo = ''
  form.length = 220
  form.draft = 12.5
  form.cargoType = 'container'
  form.cargoWeight = 50000
  form.eta = dayjs().add(2, 'day').format('YYYY-MM-DD HH:mm:ss')
  form.operationType = 'unload'
  form.remark = ''
  showRecommendation.value = false
  selectedRecIndex.value = -1
}

function matchRecommendation() {
  if (!form.vesselName || !form.imo) {
    ElMessage.warning('请先填写船名和IMO编号')
    return
  }

  const etaDate = dayjs(form.eta).toDate()
  const requiredDepth = form.draft + 0.5
  const durationHours = Math.max(4, Math.round(form.cargoWeight / 10000) * 4)
  const recs: Recommendation[] = []

  for (const berth of berths) {
    if (berth.status === 'maintenance') continue
    if (!berth.cargoTypes.includes(form.cargoType)) continue
    if (berth.length < form.length) continue

    const windows = findTideWindows(tideForecast48h, requiredDepth, berth.depth)
    const validWindows = windows.filter(w =>
      dayjs(w.startTime).isAfter(etaDate) &&
      dayjs(w.endTime).diff(w.startTime, 'hour') >= durationHours
    )

    for (const w of validWindows.slice(0, 2)) {
      let score = 0
      score += berth.cargoTypes.length === 1 ? 20 : 10
      score += berth.length - form.length > 30 ? 15 : 8
      score += berth.depth - requiredDepth > 2 ? 15 : 8
      score += dayjs(w.startTime).diff(etaDate, 'hour') < 12 ? 30 : 10
      recs.push({
        berth,
        time: { start: w.startTime, end: dayjs(w.startTime).add(durationHours, 'hour').toDate() },
        window: w,
        durationHours,
        score
      })
    }
  }

  recs.sort((a, b) => b.score - a.score)
  recommendedBerths.value = recs
  selectedRecIndex.value = recs.length > 0 ? 0 : -1
  showRecommendation.value = true

  if (recs.length > 0) {
    ElMessage.success(`找到 ${recs.length} 个推荐方案`)
  } else {
    ElMessage.warning('未找到合适的靠泊方案，请调整参数')
  }
}

function selectRecommendation(idx: number) {
  selectedRecIndex.value = idx
}

function submitApplication() {
  if (selectedRecIndex.value < 0) {
    ElMessage.warning('请选择一个推荐方案')
    return
  }
  const rec = recommendedBerths.value[selectedRecIndex.value]
  addApplication({
    vesselName: form.vesselName,
    imo: form.imo,
    length: form.length,
    draft: form.draft,
    cargoType: form.cargoType,
    cargoWeight: form.cargoWeight,
    eta: dayjs(form.eta).toDate(),
    operationType: form.operationType,
    applicant: form.applicant,
    recommendedBerthId: rec.berth.id,
    recommendedTime: rec.time
  })
  ElMessage.success('靠泊申请已提交，等待调度员审核')
  showRecommendation.value = false
  resetForm()
}

function formatTime(d: string | Date) {
  return dayjs(d).format('MM-DD HH:mm')
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: all 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
