<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 border-b border-color bg-secondary">
      <div>
        <div class="text-lg font-semibold text-primary">巡检任务管理</div>
        <div class="text-xs text-muted">基于管网健康评分自动生成巡检计划</div>
      </div>
      <div class="flex gap-2">
        <select v-model="statusFilter" class="select w-32">
          <option value="">全部状态</option>
          <option value="Pending">待执行</option>
          <option value="InProgress">进行中</option>
          <option value="Completed">已完成</option>
          <option value="ExceptionReported">异常上报</option>
        </select>
        <button class="btn btn-primary" @click="generatePlan">自动生成计划</button>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <div class="w-2/5 min-w-[420px] flex flex-col border-r border-color">
        <div class="flex-1 overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-tertiary z-10">
              <tr class="text-left text-muted text-xs">
                <th class="px-3 py-2 font-medium">任务编号</th>
                <th class="px-3 py-2 font-medium">标题</th>
                <th class="px-3 py-2 font-medium">巡检员</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">计划时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in mockTasks" :key="t.id" class="border-t border-color cursor-pointer hover:bg-hover" :class="{ 'bg-accent-primary/10': selectedTaskId === t.id }" @click="selectedTaskId = t.id">
                <td class="px-3 py-2.5 font-mono text-xs text-primary">{{ t.taskNo }}</td>
                <td class="px-3 py-2.5">{{ t.title }}</td>
                <td class="px-3 py-2.5 text-secondary">{{ t.inspectorName || '-' }}</td>
                <td class="px-3 py-2.5"><span class="badge" :class="taskStatusBadge(t.status)">{{ getStatusLabel(t.status) }}</span></td>
                <td class="px-3 py-2.5 text-xs text-muted">{{ formatDateTime(t.planStartTime) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex-1 flex flex-col">
        <div class="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
          <div class="card p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="text-base font-semibold text-primary">管网健康评估总览</div>
              <div class="text-xs text-muted">共 {{ dispatch.pipes.length }} 根管段</div>
            </div>
            <div class="grid grid-cols-4 gap-3">
              <div class="p-3 rounded-md bg-success/10 text-center">
                <div class="text-2xl font-bold text-success">{{ riskPipes(1) }}</div>
                <div class="text-xs text-muted">低风险 ≥80分</div>
              </div>
              <div class="p-3 rounded-md bg-warning/10 text-center">
                <div class="text-2xl font-bold text-warning">{{ riskPipes(2) }}</div>
                <div class="text-xs text-muted">中风险 60-79分</div>
              </div>
              <div class="p-3 rounded-md bg-[#f97316]/10 text-center">
                <div class="text-2xl font-bold" style="color:#f97316">{{ riskPipes(3) }}</div>
                <div class="text-xs text-muted">较高风险 40-59分</div>
              </div>
              <div class="p-3 rounded-md bg-danger/10 text-center">
                <div class="text-2xl font-bold text-danger">{{ riskPipes(4) }}</div>
                <div class="text-xs text-muted">高风险 <40分</div>
              </div>
            </div>
          </div>

          <div class="card p-4 flex-1">
            <div class="flex items-center justify-between mb-3">
              <div class="text-base font-semibold text-primary">预防性维护建议清单</div>
              <button class="btn btn-secondary btn-sm">导出建议</button>
            </div>
            <div class="overflow-auto max-h-[360px]">
              <table class="w-full text-sm">
                <thead class="bg-tertiary/60 text-xs text-muted">
                  <tr>
                    <th class="text-left px-3 py-2 font-medium">管段编号</th>
                    <th class="text-left px-3 py-2 font-medium">材质</th>
                    <th class="text-left px-3 py-2 font-medium">管龄</th>
                    <th class="text-left px-3 py-2 font-medium">维修次数</th>
                    <th class="text-left px-3 py-2 font-medium">健康评分</th>
                    <th class="text-left px-3 py-2 font-medium">建议</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in highRiskPipes" :key="p.id" class="border-t border-color">
                    <td class="px-3 py-2 font-mono text-xs text-primary">{{ p.code }}</td>
                    <td class="px-3 py-2 text-secondary">{{ p.material }}</td>
                    <td class="px-3 py-2 text-secondary">{{ 2025 - p.installYear }}年</td>
                    <td class="px-3 py-2">{{ p.repairCount }}</td>
                    <td class="px-3 py-2">
                      <div class="flex items-center gap-2">
                        <div class="w-16 h-1.5 bg-tertiary rounded-full overflow-hidden">
                          <div class="h-full rounded-full" :style="{ width: p.healthScore + '%', background: p.healthScore >= 60 ? '#eab308' : '#ef4444' }"></div>
                        </div>
                        <span class="text-xs" :class="p.healthScore >= 60 ? 'text-warning' : 'text-danger'">{{ p.healthScore.toFixed(1) }}</span>
                      </div>
                    </td>
                    <td class="px-3 py-2 text-xs" :class="p.healthScore < 50 ? 'text-danger' : 'text-warning'">{{ maintenanceSuggestion(p) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDispatchStore } from '~/stores/dispatch'
import { getStatusLabel, formatDateTime } from '~/utils/api'
import type { Pipe, InspectionTask } from '~/types'

const dispatch = useDispatchStore()
const statusFilter = ref('')
const selectedTaskId = ref<string | null>(null)

const mockTasks: InspectionTask[] = [
  { id: 't-1', taskNo: 'XJ20250615001', title: '东城区建国门片区高危管段巡检', status: 'InProgress', inspectorId: 'u-3', inspectorName: '李巡检员', targetPipeIds: ['pipe-1', 'pipe-5'], routePoints: [], planStartTime: new Date(Date.now() - 3600000).toISOString(), planEndTime: new Date(Date.now() + 3600000 * 2).toISOString(), actualStartTime: new Date(Date.now() - 3600000).toISOString(), actualEndTime: null, remark: null, reports: [], relatedLeakEventId: null, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 't-2', taskNo: 'XJ20250615002', title: '西城区西直门老旧管网排查', status: 'Pending', inspectorId: null, inspectorName: null, targetPipeIds: ['pipe-3', 'pipe-12'], routePoints: [], planStartTime: new Date(Date.now() + 3600000).toISOString(), planEndTime: new Date(Date.now() + 3600000 * 5).toISOString(), actualStartTime: null, actualEndTime: null, remark: null, reports: [], relatedLeakEventId: null, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), updatedAt: new Date().toISOString() },
  { id: 't-3', taskNo: 'XJ20250614003', title: '朝阳区高碑店片区常规巡检', status: 'Completed', inspectorId: 'u-4', inspectorName: '王巡检员', targetPipeIds: ['pipe-22'], routePoints: [], planStartTime: new Date(Date.now() - 86400000).toISOString(), planEndTime: new Date(Date.now() - 86400000 + 3600000 * 3).toISOString(), actualStartTime: new Date(Date.now() - 86400000).toISOString(), actualEndTime: new Date(Date.now() - 86400000 + 3600000 * 2.5).toISOString(), remark: '一切正常', reports: [], relatedLeakEventId: null, createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), updatedAt: new Date().toISOString() },
  { id: 't-4', taskNo: 'XJ20250614004', title: '海淀区中关村异常确认', status: 'ExceptionReported', inspectorId: 'u-4', inspectorName: '王巡检员', targetPipeIds: ['pipe-15'], routePoints: [], planStartTime: new Date(Date.now() - 86400000 * 2).toISOString(), planEndTime: new Date(Date.now() - 86400000 * 2 + 3600000 * 2).toISOString(), actualStartTime: new Date(Date.now() - 86400000 * 2).toISOString(), actualEndTime: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(), remark: '发现管段接口渗漏', reports: [], relatedLeakEventId: 'leak-2', createdAt: new Date(Date.now() - 86400000 * 4).toISOString(), updatedAt: new Date().toISOString() }
]

const highRiskPipes = computed(() =>
  [...dispatch.pipes]
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 15)
)

function riskPipes(level: number) { return dispatch.pipes.filter(p => p.riskLevel === level).length }

function maintenanceSuggestion(p: Pipe): string {
  if (p.healthScore < 40) return '立即更换管段'
  if (p.healthScore < 55) return '优先纳入更换计划'
  if (p.healthScore < 70) return '加强巡检频次'
  return '常规巡检'
}

function taskStatusBadge(s: string) {
  return s === 'Pending' ? 'badge-default' : s === 'InProgress' ? 'badge-info' : s === 'Completed' ? 'badge-success' : 'badge-danger'
}

function generatePlan() {
  dispatch.addToast({ type: 'success', title: '计划已生成', message: '根据管网健康评分生成了 ' + highRiskPipes.value.length + ' 项巡检任务' })
}
</script>
