<script setup lang="ts">
import { ref, computed } from 'vue'
import { useScheduleStore } from '@/stores/schedule'
import type { ShiftItem } from '@/stores/schedule'
import { ElMessage } from 'element-plus'

const store = useScheduleStore()

const timeStart = 6
const timeEnd = 23
const totalHours = timeEnd - timeStart
const hourWidth = 100
const rowHeight = 56
const headerHeight = 36

const timeSlots = Array.from({ length: totalHours + 1 }, (_, i) => timeStart + i)

const vehicles = computed(() => {
  if (!store.currentSchedule) return []
  const plates = [...new Set(store.currentSchedule.shifts.map(s => s.vehiclePlate))]
  return plates.map((plate, idx) => {
    const shifts = store.currentSchedule!.shifts.filter(s => s.vehiclePlate === plate)
    return { plate, row: idx, driverName: shifts[0]?.driverName || '' }
  })
})

const canvasWidth = computed(() => totalHours * hourWidth + 160)

function shiftLeft(shift: ShiftItem) {
  return 160 + (shift.startTime - timeStart) * hourWidth
}

function shiftWidth(shift: ShiftItem) {
  return (shift.endTime - shift.startTime) * hourWidth
}

const dragging = ref<{ shiftId: string; startX: number; origStart: number; origEnd: number } | null>(null)

function onShiftMouseDown(e: MouseEvent, shift: ShiftItem) {
  e.preventDefault()
  dragging.value = { shiftId: shift.id, startX: e.clientX, origStart: shift.startTime, origEnd: shift.endTime }
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  if (!dragging.value) return
  const dx = e.clientX - dragging.value.startX
  const hourDelta = Math.round(dx / hourWidth * 2) / 2
  const newStart = Math.max(timeStart, Math.min(timeEnd - 0.5, dragging.value.origStart + hourDelta))
  const duration = dragging.value.origEnd - dragging.value.origStart
  store.updateShift(dragging.value.shiftId, { startTime: newStart, endTime: newStart + duration })
}

function onDragEnd() {
  dragging.value = null
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

const statusTagMap: Record<string, { type: 'info' | 'warning' | 'success' | 'danger'; label: string }> = {
  draft: { type: 'info', label: '草稿' },
  pending: { type: 'warning', label: '待审核' },
  approved: { type: 'success', label: '已通过' },
  rejected: { type: 'danger', label: '已驳回' },
}

const scheduleStatus = computed(() => statusTagMap[store.currentSchedule?.status || 'draft'])

function handleGenerate() {
  store.generateSchedule()
  ElMessage.success('排班计划已生成')
}

function handleApprove() {
  store.approveSchedule()
  ElMessage.success('排班计划已审核通过')
}

function handleReject() {
  store.rejectSchedule()
  ElMessage.warning('排班计划已驳回')
}
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <div class="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
      <el-select v-model="store.selectedLineId" placeholder="选择线路" style="width: 140px">
        <el-option label="1路" value="1" />
        <el-option label="5路" value="5" />
        <el-option label="12路" value="12" />
      </el-select>
      <el-date-picker v-model="store.selectedDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 160px" />
      <el-button type="primary" @click="handleGenerate">生成排班</el-button>
      <el-tag v-if="scheduleStatus" :type="scheduleStatus.type">{{ scheduleStatus.label }}</el-tag>
      <div class="ml-auto flex gap-2">
        <el-button type="success" :disabled="!store.currentSchedule || store.currentSchedule.status !== 'pending'" @click="handleApprove">审核通过</el-button>
        <el-button type="danger" :disabled="!store.currentSchedule || store.currentSchedule.status !== 'pending'" @click="handleReject">驳回</el-button>
      </div>
    </div>

    <div class="flex flex-1 gap-4 overflow-hidden">
      <div class="flex-1 bg-white rounded-lg shadow-sm overflow-auto">
        <div :style="{ width: canvasWidth + 'px', minHeight: '100%' }">
          <div class="sticky top-0 z-10 flex" style="height: 36px; background: #F8FAFC; border-bottom: 1px solid var(--color-border)">
            <div class="shrink-0 border-r" style="width: 160px; line-height: 36px; padding-left: 12px; font-size: 12px; color: var(--color-text-secondary)">车辆 / 司机</div>
            <div class="flex-1 relative">
              <div
                v-for="h in timeSlots"
                :key="h"
                class="absolute text-xs text-gray-400 font-num"
                :style="{ left: ((h - timeStart) * hourWidth - 12) + 'px', top: '10px' }"
              >{{ String(h).padStart(2, '0') }}:00</div>
            </div>
          </div>

          <div v-for="vehicle in vehicles" :key="vehicle.plate" class="flex" :style="{ height: rowHeight + 'px' }">
            <div class="shrink-0 border-r flex items-center px-3 gap-2" style="width: 160px; border-bottom: 1px solid #F1F5F9">
              <span class="text-xs font-medium truncate">{{ vehicle.plate }}</span>
              <span class="text-xs text-gray-400 truncate">{{ vehicle.driverName }}</span>
            </div>
            <div class="flex-1 relative" style="border-bottom: 1px solid #F1F5F9">
              <div
                v-for="h in timeSlots"
                :key="h"
                class="absolute top-0 bottom-0"
                :style="{ left: ((h - timeStart) * hourWidth) + 'px', borderLeft: '1px solid #F1F5F9' }"
              />
              <div
                v-for="shift in store.currentSchedule!.shifts.filter(s => s.vehiclePlate === vehicle.plate)"
                :key="shift.id"
                class="absolute top-2 bottom-2 rounded-lg flex items-center justify-center text-xs text-white font-medium cursor-move shadow-sm select-none"
                :style="{
                  left: shiftLeft(shift) + 'px',
                  width: shiftWidth(shift) + 'px',
                  background: shift.direction === 'up' ? 'var(--color-info)' : 'var(--color-success)',
                }"
                @mousedown="(e) => onShiftMouseDown(e, shift)"
              >
                {{ shift.direction === 'up' ? '上行' : '下行' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="w-72 bg-white rounded-lg shadow-sm p-4 overflow-auto shrink-0">
        <h3 class="text-sm font-semibold mb-3 flex items-center gap-2" style="color: var(--color-primary)">
          <el-icon :size="16"><Warning /></el-icon>
          约束冲突
          <el-tag v-if="store.errorCount" type="danger" size="small">{{ store.errorCount }} 错误</el-tag>
          <el-tag v-if="store.warningCount" type="warning" size="small">{{ store.warningCount }} 警告</el-tag>
        </h3>
        <div class="space-y-2">
          <div
            v-for="conflict in store.conflicts"
            :key="conflict.id"
            class="p-3 rounded-lg text-sm"
            :style="{
              background: conflict.severity === 'error' ? '#FEF2F2' : '#FFFBEB',
              borderLeft: `3px solid ${conflict.severity === 'error' ? 'var(--color-danger)' : 'var(--color-warning)'}`,
            }"
          >
            <div class="flex items-center gap-1 mb-1">
              <el-icon :size="14" :color="conflict.severity === 'error' ? 'var(--color-danger)' : 'var(--color-warning)'">
                <CircleCloseFilled v-if="conflict.severity === 'error'" /><WarningFilled v-else />
              </el-icon>
              <span class="font-medium">{{ conflict.type === 'overtime' ? '工时超标' : conflict.type === 'vehicle_overlap' ? '车辆冲突' : conflict.type === 'rest_insufficient' ? '休息不足' : '资质问题' }}</span>
            </div>
            <p class="text-gray-600 text-xs leading-relaxed">{{ conflict.description }}</p>
          </div>
          <div v-if="store.conflicts.length === 0" class="text-center text-gray-400 py-6 text-sm">
            无约束冲突
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
