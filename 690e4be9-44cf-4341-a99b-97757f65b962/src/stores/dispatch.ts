import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface VehiclePosition {
  id: string
  plate: string
  lineId: string
  lineName: string
  x: number
  y: number
  angle: number
  loadRate: number
  speed: number
  nextStop: string
  etaMinutes: number
  direction: 'up' | 'down'
  status: 'running' | 'stopped' | 'offline'
}

export interface AlertItem {
  id: string
  lineId: string
  lineName: string
  type: 'delay' | 'breakdown' | 'congestion' | 'deviation'
  reason: string
  suggestion: string
  time: string
  confirmed: boolean
}

export interface BusLine {
  id: string
  name: string
  color: string
  stops: { name: string; x: number; y: number }[]
  path: string
}

const mockLines: BusLine[] = [
  {
    id: '1',
    name: '1路',
    color: '#4A90D9',
    stops: [
      { name: '火车站', x: 80, y: 300 },
      { name: '人民广场', x: 200, y: 250 },
      { name: '市政府', x: 350, y: 220 },
      { name: '科技园', x: 520, y: 200 },
      { name: '大学城', x: 700, y: 180 },
      { name: '新区枢纽', x: 880, y: 160 },
    ],
    path: 'M80,300 Q140,260 200,250 Q275,230 350,220 Q435,205 520,200 Q610,188 700,180 Q790,168 880,160',
  },
  {
    id: '5',
    name: '5路',
    color: '#22C55E',
    stops: [
      { name: '东门', x: 100, y: 450 },
      { name: '中心医院', x: 250, y: 400 },
      { name: '体育馆', x: 420, y: 370 },
      { name: '商业街', x: 600, y: 350 },
      { name: '西门', x: 800, y: 320 },
    ],
    path: 'M100,450 Q175,415 250,400 Q335,378 420,370 Q510,355 600,350 Q700,332 800,320',
  },
  {
    id: '12',
    name: '12路',
    color: '#F59E0B',
    stops: [
      { name: '北郊', x: 300, y: 60 },
      { name: '文化宫', x: 320, y: 180 },
      { name: '南湖公园', x: 350, y: 320 },
      { name: '南郊', x: 380, y: 480 },
    ],
    path: 'M300,60 Q310,120 320,180 Q335,250 350,320 Q365,400 380,480',
  },
]

const mockVehicles: VehiclePosition[] = [
  { id: 'v1', plate: '京A·12345', lineId: '1', lineName: '1路', x: 180, y: 258, angle: -15, loadRate: 0.65, speed: 35, nextStop: '人民广场', etaMinutes: 3, direction: 'up', status: 'running' },
  { id: 'v2', plate: '京A·12346', lineId: '1', lineName: '1路', x: 480, y: 205, angle: -8, loadRate: 0.92, speed: 22, nextStop: '科技园', etaMinutes: 5, direction: 'up', status: 'running' },
  { id: 'v3', plate: '京A·12347', lineId: '1', lineName: '1路', x: 750, y: 172, angle: -10, loadRate: 0.45, speed: 40, nextStop: '新区枢纽', etaMinutes: 8, direction: 'up', status: 'running' },
  { id: 'v4', plate: '京B·56001', lineId: '5', lineName: '5路', x: 200, y: 415, angle: -12, loadRate: 0.78, speed: 30, nextStop: '中心医院', etaMinutes: 4, direction: 'up', status: 'running' },
  { id: 'v5', plate: '京B·56002', lineId: '5', lineName: '5路', x: 550, y: 358, angle: -6, loadRate: 1.05, speed: 12, nextStop: '商业街', etaMinutes: 2, direction: 'up', status: 'running' },
  { id: 'v6', plate: '京C·12001', lineId: '12', lineName: '12路', x: 315, y: 160, angle: 80, loadRate: 0.55, speed: 28, nextStop: '文化宫', etaMinutes: 1, direction: 'down', status: 'running' },
  { id: 'v7', plate: '京C·12002', lineId: '12', lineName: '12路', x: 365, y: 380, angle: 85, loadRate: 0.3, speed: 0, nextStop: '南郊', etaMinutes: 0, direction: 'down', status: 'stopped' },
]

const mockAlerts: AlertItem[] = [
  { id: 'a1', lineId: '5', lineName: '5路', type: 'congestion', reason: '商业街站客流爆满，满载率105%', suggestion: '增发1辆加班车至商业街区间', time: '08:15', confirmed: false },
  { id: 'a2', lineId: '1', lineName: '1路', type: 'delay', reason: '科技园站到站延迟8分钟', suggestion: '调整发车间隔为6分钟', time: '08:22', confirmed: false },
  { id: 'a3', lineId: '12', lineName: '12路', type: 'breakdown', reason: '京C·12002车辆故障停运', suggestion: '调配备用车京C·12999替班', time: '08:30', confirmed: false },
  { id: 'a4', lineId: '1', lineName: '1路', type: 'deviation', reason: '京A·12346偏离计划路线', suggestion: '联系司机确认路线', time: '08:35', confirmed: true },
]

export const useDispatchStore = defineStore('dispatch', () => {
  const vehicles = ref<VehiclePosition[]>(mockVehicles)
  const alerts = ref<AlertItem[]>(mockAlerts)
  const selectedLineId = ref<string>('1')
  const lines = ref<BusLine[]>(mockLines)
  const onlineCount = ref(6)
  const dispatchCount = ref(3)

  const currentLine = computed(() => lines.value.find(l => l.id === selectedLineId.value))
  const currentLineVehicles = computed(() => vehicles.value.filter(v => v.lineId === selectedLineId.value))
  const unconfirmedAlerts = computed(() => alerts.value.filter(a => !a.confirmed))
  const alertCount = computed(() => unconfirmedAlerts.value.length)

  function updateVehiclePosition(id: string, data: Partial<VehiclePosition>) {
    const idx = vehicles.value.findIndex(v => v.id === id)
    if (idx !== -1) {
      vehicles.value[idx] = { ...vehicles.value[idx], ...data }
    }
  }

  function confirmAlert(id: string) {
    const alert = alerts.value.find(a => a.id === id)
    if (alert) alert.confirmed = true
  }

  function addAlert(alert: AlertItem) {
    alerts.value.unshift(alert)
  }

  function selectLine(lineId: string) {
    selectedLineId.value = lineId
  }

  return {
    vehicles, alerts, selectedLineId, lines, onlineCount, dispatchCount,
    currentLine, currentLineVehicles, unconfirmedAlerts, alertCount,
    updateVehiclePosition, confirmAlert, addAlert, selectLine,
  }
})
