<script setup lang="ts">
import { ref, computed } from 'vue'
import { useScheduleStore } from '@/stores/schedule'
import { useVesselStore } from '@/stores/vessel'
import { VESSEL_STATUS_LABELS, CARGO_TYPE_LABELS, type Vessel } from '@/types'
import { Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import VesselTracker from '@/components/VesselTracker.vue'

const scheduleStore = useScheduleStore()
const vesselStore = useVesselStore()

const searchKeyword = ref('')
const statusFilter = ref<string[]>([])
const selectedVessel = ref<Vessel | null>(null)

const vesselStatuses = ['anchorage', 'entering', 'berthed', 'loading', 'unloading', 'leaving', 'departed']

const filteredVessels = computed(() => {
  return vesselStore.vessels.filter(v => {
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase()
      if (!v.name.toLowerCase().includes(kw) && !v.imo.includes(kw)) return false
    }
    if (statusFilter.value.length > 0) {
      if (!statusFilter.value.includes(v.status)) return false
    }
    return true
  }).slice(0, 50)
})

const statusCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const s of vesselStatuses) counts[s] = 0
  for (const v of vesselStore.vessels) counts[v.status] = (counts[v.status] || 0) + 1
  return counts
})

function statusTagType(s: string) {
  switch (s) {
    case 'anchorage': return 'warning'
    case 'entering':
    case 'leaving': return 'primary'
    case 'berthed':
    case 'loading':
    case 'unloading': return 'success'
    default: return 'info'
  }
}

function selectVessel(v: Vessel) {
  selectedVessel.value = v
}

function getVesselSchedule(v: Vessel) {
  return scheduleStore.schedules
    .filter(s => s.vesselId === v.id)
    .sort((a, b) => dayjs(a.arrivalTime).valueOf() - dayjs(b.arrivalTime).valueOf())
    .slice(0, 5)
}

function getBerthName(id: string) {
  return scheduleStore.getBerthById(id)?.name || id
}
</script>

<template>
  <div class="w-full h-full flex flex-col gap-3">
    <div class="grid grid-cols-7 gap-2 flex-shrink-0">
      <div
        v-for="s in vesselStatuses"
        :key="s"
        :class="[
          'flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-all',
          statusFilter.includes(s)
            ? 'bg-port-accent/20 border-port-accent'
            : 'bg-port-card/40 border-port-panel hover:border-port-accent/50'
        ]"
        @click="statusFilter = statusFilter.includes(s) ? statusFilter.filter(x => x !== s) : [...statusFilter, s]"
      >
        <el-tag size="small" :type="statusTagType(s as any)" effect="dark">
          {{ VESSEL_STATUS_LABELS[s as keyof typeof VESSEL_STATUS_LABELS] }}
        </el-tag>
        <span class="text-port-text text-sm font-bold">{{ statusCounts[s] }}</span>
      </div>
    </div>

    <div class="flex-1 min-h-0 grid grid-cols-12 gap-3">
      <div class="col-span-8 min-h-0">
        <VesselTracker :height="600" @select-vessel="selectVessel" />
      </div>

      <div class="col-span-4 flex flex-col gap-3 min-h-0">
        <div class="flex-shrink-0 bg-port-card/40 rounded-lg border border-port-panel p-3">
          <div class="relative">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索船名或IMO..."
              size="default"
              :prefix-icon="Search"
            />
          </div>
        </div>

        <div class="flex-1 min-h-0 bg-port-card/40 rounded-lg border border-port-panel flex flex-col overflow-hidden">
          <div class="px-4 py-2 border-b border-port-panel flex items-center justify-between bg-port-card/60">
            <h3 class="text-port-text text-sm font-semibold">船舶列表</h3>
            <span class="text-xs text-port-text-muted">{{ filteredVessels.length }} 艘</span>
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
            <div
              v-for="v in filteredVessels"
              :key="v.id"
              :class="[
                'p-2.5 rounded-lg border cursor-pointer transition-all',
                selectedVessel?.id === v.id
                  ? 'bg-port-accent/20 border-port-accent/60'
                  : 'bg-port-card/60 border-port-panel hover:border-port-accent/30 hover:bg-port-card/80'
              ]"
              @click="selectVessel(v)"
            >
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-port-text text-sm font-semibold truncate max-w-[55%]">{{ v.name }}</span>
                <el-tag size="small" :type="statusTagType(v.status)" effect="dark" class="!text-[10px] !h-4 !px-1.5">
                  {{ VESSEL_STATUS_LABELS[v.status] }}
                </el-tag>
              </div>
              <div class="grid grid-cols-2 gap-2 text-[10px] text-port-text-muted">
                <div class="flex items-center gap-1">
                  <el-icon :size="10"><Tickets /></el-icon>
                  IMO {{ v.imo }}
                </div>
                <div class="flex items-center gap-1">
                  <el-icon :size="10"><Box /></el-icon>
                  {{ CARGO_TYPE_LABELS[v.cargoType] }}
                </div>
                <div class="flex items-center gap-1">
                  <el-icon :size="10"><Aim /></el-icon>
                  {{ v.length }}m/{{ v.draft }}m
                </div>
                <div class="flex items-center gap-1 text-port-accent font-mono">
                  <el-icon :size="10"><Coin /></el-icon>
                  {{ (v.cargoWeight / 10000).toFixed(1) }}万t
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="selectedVessel"
      class="h-52 flex-shrink-0 bg-port-card/40 rounded-lg border border-port-panel overflow-hidden grid grid-cols-12"
    >
      <div class="col-span-3 border-r border-port-panel p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-port-text font-semibold flex items-center gap-2">
            <el-icon class="text-port-accent"><Ship /></el-icon>
            {{ selectedVessel.name }}
          </h3>
          <el-icon class="text-port-text-muted cursor-pointer hover:text-port-danger" @click="selectedVessel = null">
            <Close />
          </el-icon>
        </div>
        <div class="space-y-2 text-xs">
          <div class="flex justify-between">
            <span class="text-port-text-muted">IMO编号</span>
            <span class="text-port-text font-mono">{{ selectedVessel.imo }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-port-text-muted">船长 / 型宽</span>
            <span class="text-port-text">{{ selectedVessel.length }}m / 32m</span>
          </div>
          <div class="flex justify-between">
            <span class="text-port-text-muted">吃水 / 载重吨</span>
            <span class="text-port-text">{{ selectedVessel.draft }}m / {{ selectedVessel.cargoWeight }}t</span>
          </div>
          <div class="flex justify-between">
            <span class="text-port-text-muted">货类</span>
            <span class="text-port-text">{{ CARGO_TYPE_LABELS[selectedVessel.cargoType] }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-port-text-muted">预计到港</span>
            <span class="text-port-text font-mono">{{ dayjs(selectedVessel.eta).format('MM-DD HH:mm') }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-port-text-muted">预计离港</span>
            <span class="text-port-text font-mono">{{ selectedVessel.etd ? dayjs(selectedVessel.etd).format('MM-DD HH:mm') : '-' }}</span>
          </div>
        </div>
      </div>
      <div class="col-span-6 border-r border-port-panel p-4 overflow-hidden flex flex-col">
        <h4 class="text-port-text text-sm font-semibold mb-3 flex items-center gap-2">
          <el-icon class="text-port-success"><Calendar /></el-icon>
          靠泊作业记录
        </h4>
        <div class="flex-1 overflow-auto space-y-2">
          <div
            v-for="(s, idx) in getVesselSchedule(selectedVessel)"
            :key="s.id"
            class="bg-port-card/60 rounded p-2.5 border border-port-panel hover:border-port-accent/40 transition"
          >
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-port-text text-xs font-medium">{{ getBerthName(s.berthId) }}</span>
              <el-tag size="small" :type="s.status === 'conflict' ? 'warning' : s.status === 'completed' ? 'info' : 'success'" effect="dark" class="!text-[10px]">
                {{ s.status }}
              </el-tag>
            </div>
            <div class="grid grid-cols-2 gap-x-4 text-[10px] text-port-text-muted">
              <span>靠泊: {{ dayjs(s.arrivalTime).format('MM-DD HH:mm') }}</span>
              <span>离泊: {{ dayjs(s.departureTime).format('MM-DD HH:mm') }}</span>
            </div>
            <el-progress
              v-if="s.status === 'in_progress' || s.progress > 0"
              :percentage="s.progress"
              :stroke-width="4"
              :show-text="false"
              status="success"
              class="mt-2"
            />
          </div>
          <div
            v-if="getVesselSchedule(selectedVessel).length === 0"
            class="h-full flex items-center justify-center text-port-text-muted text-xs"
          >
            暂无作业记录
          </div>
        </div>
      </div>
      <div class="col-span-3 p-4 flex flex-col">
        <h4 class="text-port-text text-sm font-semibold mb-3 flex items-center gap-2">
          <el-icon class="text-port-warning"><Operation /></el-icon>
          操作面板
        </h4>
        <div class="space-y-2">
          <el-button type="primary" size="default" class="w-full justify-start">
            <el-icon class="mr-2"><Plus /></el-icon>新增靠泊计划
          </el-button>
          <el-button type="success" size="default" class="w-full justify-start">
            <el-icon class="mr-2"><Guide /></el-icon>安排引航任务
          </el-button>
          <el-button type="warning" size="default" class="w-full justify-start">
            <el-icon class="mr-2"><Bell /></el-icon>发送作业通知
          </el-button>
          <el-button type="info" size="default" class="w-full justify-start">
            <el-icon class="mr-2"><View /></el-icon>查看轨迹详情
          </el-button>
        </div>
        <div class="flex-1" />
        <div class="pt-3 border-t border-port-panel space-y-1.5 text-[10px] text-port-text-muted">
          <div class="flex justify-between">
            <span>位置更新</span>
            <span class="text-port-success">● 实时</span>
          </div>
          <div class="flex justify-between">
            <span>AIS信号</span>
            <span class="text-port-success">● 正常</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
