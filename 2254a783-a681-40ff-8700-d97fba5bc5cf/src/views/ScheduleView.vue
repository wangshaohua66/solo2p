<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useScheduleStore } from '@/stores/schedule'
import { useVesselStore } from '@/stores/vessel'
import dayjs from 'dayjs'
import { CARGO_TYPE_LABELS, type BerthSchedule, type PendingApplication } from '@/types'
import BerthGantt from '@/components/BerthGantt.vue'

const scheduleStore = useScheduleStore()
const vesselStore = useVesselStore()

const viewDays = ref(7)
const selectedSchedule = ref<BerthSchedule | null>(null)
const showApplicationPanel = ref(true)
const selectedApplication = ref<PendingApplication | null>(null)

const pendingList = computed(() => scheduleStore.pendingApplications)

function handleSelectSchedule(s: BerthSchedule) {
  selectedSchedule.value = s
}

function approveApplication(app: PendingApplication) {
  const recommendedBerth = scheduleStore.berths.find(b =>
    b.cargoTypes.includes(app.cargoType) && b.depth >= app.draft && b.length >= app.length
  )
  const updated: PendingApplication = {
    ...app,
    recommendedBerthId: recommendedBerth?.id,
    recommendedTime: {
      start: app.eta,
      end: dayjs(app.eta).add(Math.ceil(app.cargoWeight / 10000) * 4, 'hour').toDate()
    }
  }
  Object.assign(app, updated)
  selectedApplication.value = updated

  scheduleStore.approveApplication(app.id)
  selectedApplication.value = null
}

function formatWeight(w: number) {
  return (w / 10000).toFixed(1) + '万t'
}

function getBerthName(id?: string) {
  if (!id) return '-'
  return scheduleStore.getBerthById(id)?.name || id
}

function operationTypeLabel(t: string) {
  const map: Record<string, string> = { load: '装货', unload: '卸货', both: '装卸' }
  return map[t] || t
}

watch(selectedApplication, (app) => {
  if (app && !app.recommendedBerthId) {
    const recommendedBerth = scheduleStore.berths.find(b =>
      b.cargoTypes.includes(app.cargoType) && b.depth >= app.draft && b.length >= app.length
    )
    if (recommendedBerth) {
      app.recommendedBerthId = recommendedBerth.id
      app.recommendedTime = {
        start: app.eta,
        end: dayjs(app.eta).add(Math.ceil(app.cargoWeight / 10000) * 4, 'hour').toDate()
      }
    }
  }
})
</script>

<template>
  <div class="w-full h-full flex flex-col gap-3">
    <div class="flex items-center justify-between px-4 py-2 bg-port-card/40 rounded-lg border border-port-panel">
      <div class="flex items-center gap-4">
        <h2 class="text-port-text font-semibold flex items-center gap-2">
          <el-icon class="text-port-accent" :size="18"><Calendar /></el-icon>
          靠泊计划编排
        </h2>
        <el-tag size="small" type="warning" effect="dark" v-if="scheduleStore.conflictSchedules.length > 0">
          {{ scheduleStore.conflictSchedules.length }} 条冲突待处理
        </el-tag>
        <el-tag size="small" type="info" effect="dark">
          {{ pendingList.length }} 条申请待审核
        </el-tag>
      </div>
      <div class="flex items-center gap-3">
        <el-radio-group v-model="viewDays" size="default">
          <el-radio-button :value="1">今日</el-radio-button>
          <el-radio-button :value="3">3天</el-radio-button>
          <el-radio-button :value="7">7天</el-radio-button>
          <el-radio-button :value="14">2周</el-radio-button>
          <el-radio-button :value="30">月度</el-radio-button>
        </el-radio-group>
        <el-button type="primary">
          <el-icon class="mr-1"><Download /></el-icon>导出排程
        </el-button>
      </div>
    </div>

    <div class="flex-1 min-h-0 flex flex-col gap-3">
      <div class="flex-1 min-h-0">
        <BerthGantt :editable="true" :days="viewDays" @select-schedule="handleSelectSchedule" />
      </div>

      <transition name="fade">
        <div
          v-if="showApplicationPanel"
          class="h-64 flex-shrink-0 bg-port-card/40 rounded-lg border border-port-panel flex flex-col overflow-hidden"
        >
          <div class="flex items-center justify-between px-4 py-2 border-b border-port-panel bg-port-card/60">
            <div class="flex items-center gap-3">
              <h3 class="text-port-text text-sm font-semibold flex items-center gap-2">
                <el-icon class="text-port-warning"><Document /></el-icon>
                靠泊申请审核
              </h3>
              <el-badge :value="pendingList.length" class="ml-2" type="warning" :max="99" />
            </div>
            <el-button size="small" text @click="showApplicationPanel = false">
              <el-icon><ArrowDown /></el-icon> 收起
            </el-button>
          </div>
          <div class="flex-1 overflow-auto p-3">
            <el-table
              :data="pendingList"
              size="small"
              stripe
              :header-cell-style="{ background: '#1e3a5f', color: '#e8eaf6', borderColor: '#2a3f5f' }"
              :row-style="{ background: 'transparent', color: '#e8eaf6' }"
              style="width: 100%; --el-table-border-color: #1e3a5f; --el-table-tr-bg-color: transparent;"
            >
              <el-table-column prop="vesselName" label="船名" min-width="140">
                <template #default="{ row }">
                  <span class="font-medium text-port-accent">{{ row.vesselName }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="imo" label="IMO" width="100" />
              <el-table-column label="尺度" width="130">
                <template #default="{ row }">
                  <span class="text-port-text-muted text-xs">{{ row.length }}m / {{ row.draft }}m</span>
                </template>
              </el-table-column>
              <el-table-column label="货类/货量" width="150">
                <template #default="{ row }">
                  <div class="text-xs">
                    <span class="text-port-text">{{ CARGO_TYPE_LABELS[row.cargoType as keyof typeof CARGO_TYPE_LABELS] || row.cargoType }}</span>
                    <span class="text-port-text-muted ml-2">{{ formatWeight(row.cargoWeight) }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="ETA" width="150">
                <template #default="{ row }">
                  <span class="font-mono text-xs text-port-text">{{ dayjs(row.eta).format('YYYY-MM-DD HH:mm') }}</span>
                </template>
              </el-table-column>
              <el-table-column label="作业类型" width="80">
                <template #default="{ row }">
                  <el-tag size="small" effect="dark" :type="row.operationType === 'load' ? 'success' : row.operationType === 'unload' ? 'primary' : 'warning'">
                    {{ operationTypeLabel(row.operationType) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="applicant" label="申请人" width="100">
                <template #default="{ row }">
                  <span class="text-xs text-port-text-muted">{{ row.applicant }}</span>
                </template>
              </el-table-column>
              <el-table-column label="推荐泊位" width="160">
                <template #default="{ row }">
                  <div>
                    <el-select
                      :model-value="row.recommendedBerthId"
                      @update:model-value="(v: string) => row.recommendedBerthId = v"
                      size="small"
                      class="w-full"
                      placeholder="选择泊位"
                    >
                      <el-option
                        v-for="b in scheduleStore.berths.filter(bb => bb.cargoTypes.includes(row.cargoType))"
                        :key="b.id"
                        :label="`${b.name} (${b.depth}m/${b.length}m)`"
                        :value="b.id"
                      />
                    </el-select>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="180" fixed="right">
                <template #default="{ row }">
                  <div class="flex items-center gap-1">
                    <el-button
                      size="small"
                      type="success"
                      @click="approveApplication(row)"
                    >
                      <el-icon class="mr-1"><Check /></el-icon>采纳
                    </el-button>
                    <el-button
                      size="small"
                      type="info"
                      @click="selectedApplication = row"
                    >
                      <el-icon class="mr-1"><Edit /></el-icon>调整
                    </el-button>
                    <el-button
                      size="small"
                      type="danger"
                      plain
                      @click="scheduleStore.rejectApplication(row.id)"
                    >
                      <el-icon><Close /></el-icon>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </transition>

      <transition name="fade">
        <div
          v-if="!showApplicationPanel"
          class="h-8 flex-shrink-0 bg-port-card/40 rounded-lg border border-port-panel flex items-center justify-center cursor-pointer hover:bg-port-card/60 transition"
          @click="showApplicationPanel = true"
        >
          <el-icon class="text-port-accent mr-1"><ArrowUp /></el-icon>
          <span class="text-port-text-muted text-xs">展开靠泊申请 ({{ pendingList.length }} 条待审核)</span>
        </div>
      </transition>
    </div>
  </div>
</template>
