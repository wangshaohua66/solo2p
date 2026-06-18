<template>
  <div class="hospital-notification-page">
    <div class="page-header">
      <div class="header-left">
        <el-icon class="page-icon"><Bell /></el-icon>
        <div>
          <h2>医院预通知接收</h2>
          <p class="subtitle">实时接收急救转运患者预通知，及时准备接诊</p>
        </div>
      </div>
      <div class="header-right">
        <el-select v-model="selectedHospital" placeholder="选择医院" style="width: 220px;" @change="reconnectWebSocket">
          <el-option
            v-for="h in hospitalList"
            :key="h.id"
            :label="h.name"
            :value="h.id"
          />
        </el-select>
        <el-tag v-if="selectedHospital" type="success" effect="dark" round>
          已连接: {{ hospitalList.find(h => h.id === selectedHospital)?.name }}
        </el-tag>
      </div>
    </div>

    <div class="content-wrapper">
      <div class="notification-list-panel">
        <div class="panel-header">
          <h3>
            <el-icon><Document /></el-icon>
            预通知列表
            <span class="count-badge">{{ notifications.length }}</span>
          </h3>
          <div class="filter-buttons">
            <el-button-group>
              <el-button
                size="small"
                :type="activeFilter === 'ALL' ? 'primary' : 'default'"
                @click="activeFilter = 'ALL'"
              >全部</el-button>
              <el-button
                size="small"
                :type="activeFilter === 'PENDING' ? 'primary' : 'default'"
                @click="activeFilter = 'PENDING'"
              >待确认
                <el-badge v-if="pendingCount > 0" :value="pendingCount" class="pending-badge" />
              </el-button>
              <el-button
                size="small"
                :type="activeFilter === 'ACKNOWLEDGED' ? 'primary' : 'default'"
                @click="activeFilter = 'ACKNOWLEDGED'"
              >已处理</el-button>
            </el-button-group>
          </div>
        </div>

        <div class="notification-list" v-loading="loading">
          <div
            v-for="n in filteredNotifications"
            :key="n.id"
            :class="['notification-card', {
              selected: selectedNotification?.id === n.id,
              pending: !n.ackReceived,
              acknowledged: n.ackReceived,
              critical: n.conditionSeverity === 'CRITICAL'
            }]"
            @click="selectNotification(n)"
          >
            <div class="card-header">
              <div class="card-title">
                <el-tag
                  :style="{ backgroundColor: getSeverityBgColor(n.conditionSeverity), border: 'none' }"
                  effect="dark"
                  size="small"
                  round
                >
                  {{ getSeverityText(n.conditionSeverity) }}
                </el-tag>
                <span class="event-no">{{ n.eventNo }}</span>
              </div>
              <el-tag v-if="n.ackReceived" type="success" size="small" effect="light">
                已确认
              </el-tag>
              <el-tag v-else type="warning" size="small" effect="dark" class="pulse-tag">
                待确认
              </el-tag>
            </div>

            <div class="card-body">
              <div class="patient-info">
                <el-icon color="#3b82f6"><User /></el-icon>
                <span class="patient-name">{{ n.patientName }}</span>
                <span class="patient-meta">
                  {{ getGenderText(n.patientGender) }} · {{ n.patientAge || '--' }}岁
                </span>
              </div>
              <div class="complaint-row">
                <el-icon color="#ef4444"><Warning /></el-icon>
                <span>{{ n.chiefComplaint }}</span>
              </div>
              <div class="eta-row">
                <el-icon color="#f59e0b"><Clock /></el-icon>
                <span>预计到达: <strong>{{ n.etaMinutes }} 分钟</strong></span>
                <span class="create-time">{{ formatTime(n.createdAt) }}</span>
              </div>
            </div>
          </div>

          <div v-if="filteredNotifications.length === 0" class="empty-state">
            <el-icon :size="48" color="#d1d5db"><Inbox /></el-icon>
            <p>暂无{{ activeFilter === 'PENDING' ? '待处理' : activeFilter === 'ACKNOWLEDGED' ? '已处理' : '' }}预通知</p>
          </div>
        </div>
      </div>

      <div class="notification-detail-panel">
        <template v-if="selectedNotification">
          <div class="detail-header">
            <div class="detail-title">
              <h3>
                <el-icon :size="22" :color="getSeverityColor(selectedNotification.conditionSeverity)">
                  <Warning />
                </el-icon>
                患者预通知详情
              </h3>
              <el-tag size="large" effect="dark" round style="margin-left: 12px;">
                事件号: {{ selectedNotification.eventNo }}
              </el-tag>
            </div>
            <div class="eta-countdown" :class="{ urgent: remainingMinutes <= 5 }">
              <el-icon :size="20"><Timer /></el-icon>
              <span class="countdown-label">预计到达</span>
              <span class="countdown-value">{{ remainingMinutes }}</span>
              <span class="countdown-unit">分钟</span>
            </div>
          </div>

          <div class="detail-sections">
            <div class="info-section">
              <div class="section-header">
                <el-icon color="#3b82f6"><User /></el-icon>
                <h4>患者基本信息</h4>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">姓名</span>
                  <span class="info-value">{{ selectedNotification.patientName }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">性别</span>
                  <span class="info-value">{{ getGenderText(selectedNotification.patientGender) }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">年龄</span>
                  <span class="info-value">{{ selectedNotification.patientAge || '--' }} 岁</span>
                </div>
                <div class="info-item">
                  <span class="info-label">病情等级</span>
                  <span class="info-value" :style="{ color: getSeverityColor(selectedNotification.conditionSeverity), fontWeight: 'bold' }">
                    {{ getSeverityText(selectedNotification.conditionSeverity) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="info-section">
              <div class="section-header">
                <el-icon color="#ef4444"><Document /></el-icon>
                <h4>病情摘要</h4>
              </div>
              <div class="summary-content">
                <div class="summary-row">
                  <span class="summary-label">主诉</span>
                  <span class="summary-value">{{ selectedNotification.chiefComplaint }}</span>
                </div>
                <div class="summary-row" v-if="selectedNotification.preliminaryDiagnosis">
                  <span class="summary-label">初步诊断</span>
                  <span class="summary-value highlight">{{ selectedNotification.preliminaryDiagnosis }}</span>
                </div>
              </div>
            </div>

            <div class="info-section">
              <div class="section-header">
                <el-icon color="#f59e0b"><Monitor /></el-icon>
                <h4>生命体征</h4>
                <el-tag size="small" type="warning" effect="light">最近一次测量</el-tag>
              </div>
              <div class="vitals-grid">
                <div
                  v-for="(config, key) in vitalSignLabels"
                  :key="key"
                  :class="['vital-card', { abnormal: isAbnormal(key, selectedNotification.vitalSigns?.[key]) }]"
                >
                  <div class="vital-label">{{ config.label }}</div>
                  <div class="vital-value">
                    {{ selectedNotification.vitalSigns?.[key] || '--' }}
                    <span v-if="config.unit" class="vital-unit">{{ config.unit }}</span>
                  </div>
                  <div v-if="config.normalRange" class="vital-range">
                    正常: {{ config.normalRange }}
                  </div>
                </div>
              </div>
            </div>

            <div class="info-section" v-if="selectedNotification.treatmentMeasures?.length">
              <div class="section-header">
                <el-icon color="#10b981"><FirstAidKit /></el-icon>
                <h4>院前处置措施</h4>
              </div>
              <el-table :data="selectedNotification.treatmentMeasures" stripe>
                <el-table-column label="类型" width="120">
                  <template #default="{ row }">
                    <el-tag size="small">{{ row.measureType }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="measureName" label="措施名称" width="160" />
                <el-table-column prop="description" label="描述" />
                <el-table-column prop="operator" label="执行人" width="100" />
              </el-table>
            </div>
          </div>

          <div class="detail-actions" v-if="!selectedNotification.ackReceived">
            <el-dialog v-model="ackDialogVisible" :title="ackDialogType === 'accept' ? '确认接收患者' : '拒绝接收患者'">
              <el-form :model="ackForm" label-width="100px">
                <el-form-item label="接诊科室" v-if="ackDialogType === 'accept'">
                  <el-select v-model="ackForm.receivingDept" placeholder="请选择接诊科室" style="width: 100%;">
                    <el-option label="急诊科" value="急诊科" />
                    <el-option label="心内科" value="心内科" />
                    <el-option label="神经内科" value="神经内科" />
                    <el-option label="外科" value="外科" />
                    <el-option label="ICU" value="ICU" />
                    <el-option label="妇产科" value="妇产科" />
                    <el-option label="儿科" value="儿科" />
                  </el-select>
                </el-form-item>
                <el-form-item label="接诊医生" v-if="ackDialogType === 'accept'">
                  <el-input v-model="ackForm.receivingDoctor" placeholder="请输入接诊医生姓名" />
                </el-form-item>
                <el-form-item :label="ackDialogType === 'accept' ? '备注' : '拒绝原因'" required>
                  <el-input
                    v-model="ackForm.remark"
                    type="textarea"
                    :rows="3"
                    :placeholder="ackDialogType === 'accept' ? '可填写接诊准备信息...' : '请说明拒绝原因...'"
                  />
                </el-form-item>
              </el-form>
              <template #footer>
                <el-button @click="ackDialogVisible = false">取消</el-button>
                <el-button
                  :type="ackDialogType === 'accept' ? 'success' : 'danger'"
                  @click="submitAck"
                >
                  {{ ackDialogType === 'accept' ? '确认接收' : '确认拒绝' }}
                </el-button>
              </template>
            </el-dialog>

            <div class="action-buttons">
              <el-button size="large" type="success" @click="openAcceptDialog">
                <el-icon><Check /></el-icon>
                确认接收患者
              </el-button>
              <el-button size="large" type="danger" @click="openRejectDialog">
                <el-icon><Close /></el-icon>
                拒绝接收
              </el-button>
            </div>
            <p class="action-hint">
              <el-icon color="#f59e0b"><InfoFilled /></el-icon>
              请在收到预通知后尽快确认，以便急救车和医院做好交接准备
            </p>
          </div>

          <div v-else class="ack-info-panel">
            <el-result icon="success" title="已确认接收" sub-title="该预通知已于指定时间确认">
              <template #extra>
                <div class="ack-details">
                  <div class="ack-row"><span>确认时间:</span> <strong>{{ formatTime(selectedNotification.ackAt) }}</strong></div>
                  <div class="ack-row" v-if="selectedNotification.ackRemark"><span>备注:</span> <span>{{ selectedNotification.ackRemark }}</span></div>
                </div>
              </template>
            </el-result>
          </div>
        </template>

        <template v-else>
          <div class="empty-detail">
            <el-icon :size="64" color="#d1d5db"><Document /></el-icon>
            <h3>选择预通知查看详情</h3>
            <p>请从左侧列表中选择一条预通知</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElNotification as ElNotify } from 'element-plus'
import {
  Bell,
  Document,
  User,
  Warning,
  Clock,
  Inbox,
  Timer,
  Monitor,
  FirstAidKit,
  Check,
  Close,
  InfoFilled
} from '@element-plus/icons-vue'
import Stomp from 'stompjs'
import SockJS from 'sockjs-client'
import type { Client } from '@stomp/stompjs'
import type { HospitalNotificationItem, HospitalPreNotification } from '@/types/hospital'
import {
  severityText,
  severityColor,
  vitalSignLabels,
  genderText
} from '@/types/hospital'
import { acknowledgeHospitalNotification } from '@/api/hospital'
import dayjs from 'dayjs'

const hospitalList = ref([
  { id: 1, name: '市第一人民医院' },
  { id: 2, name: '市第二人民医院' },
  { id: 3, name: '市中医院' },
  { id: 4, name: '市妇幼保健院' }
])

const selectedHospital = ref<number | null>(null)
const notifications = ref<(HospitalNotificationItem & { notificationId: number })[]>([])
const selectedNotification = ref<(HospitalNotificationItem & { notificationId: number }) | null>(null)
const loading = ref(false)
const activeFilter = ref<'ALL' | 'PENDING' | 'ACKNOWLEDGED'>('ALL')

const ackDialogVisible = ref(false)
const ackDialogType = ref<'accept' | 'reject'>('accept')
const ackForm = reactive({
  receivingDept: '',
  receivingDoctor: '',
  remark: ''
})

const countdownTimers = new Map<number, number>()

let stompClient: Client | null = null

const pendingCount = computed(() => notifications.value.filter(n => !n.ackReceived).length)

const filteredNotifications = computed(() => {
  if (activeFilter.value === 'ALL') return notifications.value
  if (activeFilter.value === 'PENDING') return notifications.value.filter(n => !n.ackReceived)
  return notifications.value.filter(n => n.ackReceived)
})

const remainingMinutes = computed(() => {
  if (!selectedNotification.value) return 0
  const start = dayjs(selectedNotification.value.createdAt)
  const elapsed = dayjs().diff(start, 'minute')
  return Math.max(0, (selectedNotification.value.etaMinutes || 15) - elapsed)
})

function getSeverityText(severity: string) {
  return severityText[severity] || severity
}

function getSeverityColor(severity: string) {
  return severityColor[severity] || '#6b7280'
}

function getSeverityBgColor(severity: string) {
  const bgMap: Record<string, string> = {
    MINOR: '#22c55e',
    MODERATE: '#f59e0b',
    SEVERE: '#f97316',
    CRITICAL: '#dc2626'
  }
  return bgMap[severity] || '#6b7280'
}

function getGenderText(gender?: string) {
  if (!gender) return '--'
  return genderText[gender] || gender
}

function formatTime(time?: string) {
  if (!time) return '--'
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

function isAbnormal(key: string, value: any): boolean {
  if (value === undefined || value === null) return false
  const num = Number(value)
  if (isNaN(num)) return false
  switch (key) {
    case 'heartRate':
      return num < 60 || num > 100
    case 'bloodPressureSystolic':
      return num < 90 || num > 140
    case 'bloodPressureDiastolic':
      return num < 60 || num > 90
    case 'respiratoryRate':
      return num < 12 || num > 20
    case 'oxygenSaturation':
      return num < 95
    case 'temperature':
      return num < 36 || num > 37.3
    case 'bloodGlucose':
      return num < 3.9 || num > 6.1
    default:
      return false
  }
}

function selectNotification(n: HospitalNotificationItem & { notificationId: number }) {
  selectedNotification.value = n
}

function openAcceptDialog() {
  ackDialogType.value = 'accept'
  ackForm.receivingDept = '急诊科'
  ackForm.receivingDoctor = ''
  ackForm.remark = ''
  ackDialogVisible.value = true
}

function openRejectDialog() {
  ackDialogType.value = 'reject'
  ackForm.receivingDept = ''
  ackForm.receivingDoctor = ''
  ackForm.remark = ''
  ackDialogVisible.value = true
}

async function submitAck() {
  if (!selectedNotification.value) return

  if (ackDialogType.value === 'reject' && !ackForm.remark.trim()) {
    ElMessage.warning('请填写拒绝原因')
    return
  }

  try {
    await acknowledgeHospitalNotification({
      notificationId: selectedNotification.value.notificationId,
      accepted: ackDialogType.value === 'accept',
      remark: ackForm.remark || undefined,
      receivingDept: ackForm.receivingDept || undefined
    })

    selectedNotification.value.ackReceived = true
    selectedNotification.value.ackAt = dayjs().toISOString()
    selectedNotification.value.ackRemark = ackForm.remark
    selectedNotification.value.status = 'ACKNOWLEDGED'

    ackDialogVisible.value = false
    ElMessage.success(ackDialogType.value === 'accept' ? '已确认接收患者' : '已拒绝接收')
  } catch (e) {
    ElMessage.error('操作失败，请重试')
  }
}

function handleIncomingPreNotification(data: HospitalPreNotification) {
  const notification: HospitalNotificationItem & { notificationId: number } = {
    id: Date.now(),
    notificationId: Date.now(),
    notificationNo: `NT${dayjs().format('YYYYMMDDHHmmss')}`,
    eventId: data.eventId,
    eventNo: data.eventNo,
    patientName: data.patientName,
    patientGender: data.patientGender,
    patientAge: data.patientAge,
    chiefComplaint: data.chiefComplaint,
    conditionSeverity: data.conditionSeverity,
    vitalSigns: data.vitalSigns,
    preliminaryDiagnosis: data.preliminaryDiagnosis,
    status: 'PENDING',
    ackReceived: false,
    ackAt: undefined,
    createdAt: dayjs().toISOString(),
    etaMinutes: data.etaMinutes
  }
  ;(notification as any).treatmentMeasures = data.treatmentMeasures

  notifications.value.unshift(notification)

  ElNotify({
    title: `⚠️ 新的患者预通知 - ${getSeverityText(data.conditionSeverity)}`,
    message: `患者 ${data.patientName}，预计 ${data.etaMinutes} 分钟到达 ${data.hospitalName}`,
    type: data.conditionSeverity === 'CRITICAL' ? 'error' : 'warning',
    duration: 10000,
    onClick: () => selectNotification(notification)
  })

  if (typeof Audio !== 'undefined') {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.frequency.value = 880
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5)
      oscillator.start(audioCtx.currentTime)
      oscillator.stop(audioCtx.currentTime + 0.5)
    } catch (e) {
      // ignore audio errors
    }
  }
}

function connectWebSocket() {
  if (!selectedHospital.value) return

  try {
    if (stompClient) {
      stompClient.disconnect(() => {})
    }

    const socket = new SockJS('/ws/ems')
    stompClient = Stomp.over(socket) as Client
    stompClient.debug = () => {}

    stompClient.connect({}, () => {
      stompClient!.subscribe(`/topic/hospital/${selectedHospital.value}/pre-notification`, (message) => {
        const data: HospitalPreNotification = JSON.parse(message.body)
        handleIncomingPreNotification(data)
      })
      ElMessage.success(`已连接至 ${hospitalList.value.find(h => h.id === selectedHospital.value)?.name} 通知通道`)
    })
  } catch (e) {
    console.error('WebSocket connect error:', e)
    ElMessage.error('WebSocket连接失败，将仅使用演示数据')
  }
}

function reconnectWebSocket() {
  connectWebSocket()
}

function loadMockData() {
  const mockData: (HospitalNotificationItem & { notificationId: number; treatmentMeasures?: any[] })[] = [
    {
      id: 1,
      notificationId: 1001,
      notificationNo: 'NT20260615093001',
      eventId: 5001,
      eventNo: 'EMS20260615001',
      patientName: '张三',
      patientGender: 'MALE',
      patientAge: 65,
      chiefComplaint: '突发胸痛2小时，伴大汗、呼吸困难',
      conditionSeverity: 'CRITICAL',
      vitalSigns: {
        heartRate: 115,
        bloodPressureSystolic: 98,
        bloodPressureDiastolic: 62,
        respiratoryRate: 28,
        oxygenSaturation: 91,
        consciousness: '清醒'
      },
      preliminaryDiagnosis: '急性心肌梗死（STEMI）',
      status: 'PENDING',
      ackReceived: false,
      createdAt: dayjs().subtract(3, 'minute').toISOString(),
      etaMinutes: 8,
      treatmentMeasures: [
        { measureType: '给药', measureName: '阿司匹林300mg嚼服', description: '已完成', operator: '李医生' },
        { measureType: '给药', measureName: '硝酸甘油0.5mg舌下含服', description: '已完成', operator: '李医生' },
        { measureType: '生命支持', measureName: '鼻导管吸氧', description: '流量5L/min', operator: '王护士' }
      ]
    },
    {
      id: 2,
      notificationId: 1002,
      notificationNo: 'NT20260615091501',
      eventId: 5002,
      eventNo: 'EMS20260615002',
      patientName: '李芳',
      patientGender: 'FEMALE',
      patientAge: 42,
      chiefComplaint: '车祸致腹部撞击伤，腹痛明显',
      conditionSeverity: 'SEVERE',
      vitalSigns: {
        heartRate: 125,
        bloodPressureSystolic: 88,
        bloodPressureDiastolic: 55,
        respiratoryRate: 22,
        oxygenSaturation: 94,
        temperature: 36.8,
        consciousness: '嗜睡'
      },
      preliminaryDiagnosis: '腹腔内出血待查，失血性休克早期',
      status: 'PENDING',
      ackReceived: false,
      createdAt: dayjs().subtract(8, 'minute').toISOString(),
      etaMinutes: 12,
      treatmentMeasures: [
        { measureType: '建立通路', measureName: '双路静脉通路', description: '18G套管针', operator: '张护士' },
        { measureType: '生命支持', measureName: '快速补液', description: '生理盐水1000ml快速滴注', operator: '张护士' }
      ]
    },
    {
      id: 3,
      notificationId: 1003,
      notificationNo: 'NT20260615084501',
      eventId: 4998,
      eventNo: 'EMS20260614098',
      patientName: '王小明',
      patientGender: 'MALE',
      patientAge: 8,
      chiefComplaint: '发热39.5℃伴惊厥1次',
      conditionSeverity: 'MODERATE',
      vitalSigns: {
        heartRate: 135,
        bloodPressureSystolic: 102,
        bloodPressureDiastolic: 68,
        respiratoryRate: 32,
        oxygenSaturation: 97,
        temperature: 39.2,
        consciousness: '清醒'
      },
      preliminaryDiagnosis: '急性上呼吸道感染，高热惊厥',
      status: 'ACKNOWLEDGED',
      ackReceived: true,
      ackAt: dayjs().subtract(20, 'minute').toISOString(),
      ackRemark: '已安排儿科急诊接诊，准备降温设备',
      createdAt: dayjs().subtract(25, 'minute').toISOString(),
      etaMinutes: 0
    }
  ]
  notifications.value = mockData
}

watch(selectedHospital, (newVal) => {
  if (newVal && !stompClient) {
    loadMockData()
  }
})

onMounted(() => {
  loadMockData()
  selectedHospital.value = 1
  setTimeout(() => connectWebSocket(), 500)
})

onUnmounted(() => {
  if (stompClient) {
    stompClient.disconnect(() => {})
    stompClient = null
  }
  countdownTimers.forEach(t => clearInterval(t))
  countdownTimers.clear()
})
</script>

<style scoped lang="scss">
.hospital-notification-page {
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, #f0f4f8 0%, #e6edf5 100%);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 20px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .page-icon {
      font-size: 40px;
      color: #3b82f6;
    }

    h2 {
      margin: 0;
      font-size: 22px;
      color: #1f2937;
    }

    .subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: #6b7280;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.content-wrapper {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 20px;
  min-height: calc(100vh - 160px);
}

.notification-list-panel,
.notification-detail-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f3f4f6;

  h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    color: #1f2937;

    .count-badge {
      margin-left: 6px;
      padding: 2px 8px;
      background: #eff6ff;
      color: #3b82f6;
      border-radius: 10px;
      font-size: 12px;
      font-weight: normal;
    }
  }

  .filter-buttons {
    margin-top: 12px;
  }

  .pending-badge {
    margin-left: 4px;
  }
}

.notification-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.notification-card {
  padding: 14px;
  margin-bottom: 12px;
  border-radius: 10px;
  border: 2px solid transparent;
  background: #fafafa;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #93c5fd;
    background: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  &.selected {
    border-color: #3b82f6;
    background: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  }

  &.pending {
    background: linear-gradient(135deg, #fefce8 0%, #fffbeb 100%);
  }

  &.critical {
    border-left: 4px solid #dc2626;
    animation: card-pulse 2s infinite;
  }
}

@keyframes card-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.15); }
  50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;

  .card-title {
    display: flex;
    align-items: center;
    gap: 8px;

    .event-no {
      font-size: 12px;
      color: #6b7280;
      font-family: 'SF Mono', Monaco, monospace;
    }
  }

  .pulse-tag {
    animation: pulse-tag 1.5s infinite;
  }
}

@keyframes pulse-tag {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.card-body {
  .patient-info {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;

    .patient-name {
      font-weight: 600;
      color: #1f2937;
      font-size: 15px;
    }

    .patient-meta {
      font-size: 12px;
      color: #6b7280;
      margin-left: auto;
    }
  }

  .complaint-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 13px;
    color: #4b5563;
    margin-bottom: 6px;
    line-height: 1.4;
  }

  .eta-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #6b7280;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed #e5e7eb;

    strong {
      color: #f59e0b;
    }

    .create-time {
      margin-left: auto;
    }
  }
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: #9ca3af;

  p {
    margin-top: 12px;
  }
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-bottom: 1px solid #e0e7ff;

  .detail-title {
    display: flex;
    align-items: center;

    h3 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      color: #1e3a8a;
    }
  }

  .eta-countdown {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);

    .countdown-label {
      font-size: 13px;
      color: #6b7280;
    }

    .countdown-value {
      font-size: 32px;
      font-weight: 700;
      color: #3b82f6;
      line-height: 1;
    }

    .countdown-unit {
      font-size: 13px;
      color: #6b7280;
    }

    &.urgent {
      background: #fef2f2;

      .countdown-value {
        color: #dc2626;
      }

      animation: urgent-pulse 1s infinite;
    }
  }
}

@keyframes urgent-pulse {
  0%, 100% { box-shadow: 0 2px 8px rgba(220, 38, 38, 0.15); }
  50% { box-shadow: 0 2px 16px rgba(220, 38, 38, 0.35); }
}

.detail-sections {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.info-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;

    h4 {
      margin: 0;
      font-size: 15px;
      color: #1f2937;
    }

    .el-tag {
      margin-left: auto;
    }
  }
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;

  .info-item {
    padding: 12px 14px;
    background: #f9fafb;
    border-radius: 8px;

    .info-label {
      display: block;
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .info-value {
      display: block;
      font-size: 15px;
      font-weight: 600;
      color: #1f2937;
    }
  }
}

.summary-content {
  padding: 16px;
  background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
  border-radius: 10px;
  border-left: 4px solid #f59e0b;

  .summary-row {
    display: flex;
    margin-bottom: 10px;

    &:last-child {
      margin-bottom: 0;
    }

    .summary-label {
      width: 90px;
      font-size: 13px;
      color: #6b7280;
      flex-shrink: 0;
    }

    .summary-value {
      flex: 1;
      font-size: 14px;
      color: #1f2937;
      line-height: 1.5;

      &.highlight {
        font-weight: 600;
        color: #92400e;
      }
    }
  }
}

.vitals-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;

  .vital-card {
    padding: 14px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    text-align: center;
    transition: all 0.2s;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    &.abnormal {
      background: #fef2f2;
      border-color: #fecaca;

      .vital-value {
        color: #dc2626;
      }
    }

    .vital-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 6px;
    }

    .vital-value {
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
      line-height: 1.2;

      .vital-unit {
        font-size: 12px;
        font-weight: 400;
        color: #6b7280;
        margin-left: 2px;
      }
    }

    .vital-range {
      margin-top: 6px;
      font-size: 11px;
      color: #9ca3af;
    }
  }
}

.detail-actions {
  padding: 20px 24px;
  border-top: 1px solid #f3f4f6;
  background: #fafafa;

  .action-buttons {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;

    .el-button {
      flex: 1;
      height: 52px;
      font-size: 16px;
    }
  }

  .action-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 12px;
    color: #6b7280;
  }
}

.ack-info-panel {
  padding: 30px;

  .ack-details {
    max-width: 400px;
    margin: 0 auto;
    text-align: left;

    .ack-row {
      display: flex;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;

      &:last-child {
        border-bottom: none;
      }

      span:first-child {
        color: #6b7280;
        min-width: 80px;
      }
    }
  }
}

.empty-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;

  h3 {
    margin: 20px 0 8px;
    font-size: 18px;
    color: #6b7280;
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}
</style>
