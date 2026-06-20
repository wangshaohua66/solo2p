/**
 * TMS (Theater Management System) 影院管理系统对接接口层
 * 替换原有Mock数据，对接真实TMS系统（如GDC、中影巴可、辰星、火烈鸟等TMS）
 *
 * 核心能力：
 * 1. 影厅设备状态监控（服务器、投影机、服务器、音频处理器）
 * 2. DCP密钥/KDM下发与有效期管理
 * 3. 播放列表(SPL)编排与自动放映控制
 * 4. 场次计划与真实TMS排片同步
 * 5. 设备报警与故障工单
 * 6. 放映质量监控（亮度、对比度、色温）
 */

export interface TmsAuthConfig {
  baseUrl: string
  apiKey: string
  username: string
  password: string
  vendor: 'GDC' | 'BARCO' | 'CHENXING' | 'FLAMINGO' | 'OTHER'
}

export interface TmsDeviceStatus {
  deviceId: string
  deviceName: string
  deviceType: 'projector' | 'server' | 'audio_processor' | 'automation' | 'ups'
  hallId: string
  hallName: string
  status: 'online' | 'offline' | 'warning' | 'fault'
  lastHeartbeat: string
  temperature?: number
  lampHours?: number
  firmwareVersion?: string
  errorCode?: string
  errorMessage?: string
}

export interface TmsKdmKey {
  id: string
  movieId: string
  movieName: string
  hallId: string
  hallName: string
  serverId: string
  dcpName: string
  validFrom: string
  validTo: string
  status: 'valid' | 'expired' | 'pending' | 'invalid'
  daysRemaining: number
}

export interface TmsPlayList {
  id: string
  name: string
  hallId: string
  movieId: string
  movieName: string
  duration: number
  cplId: string
  status: 'draft' | 'approved' | 'scheduled' | 'played' | 'cancelled'
  items: Array<{
    type: 'trailer' | 'advertisement' | 'movie' | 'black_out' | 'test_pattern'
    name: string
    duration: number
    cplId?: string
    position: number
  }>
}

export interface TmsSessionSync {
  tmsSessionId: string
  scheduleId: string
  hallId: string
  startTime: string
  endTime: string
  playListId: string
  status: 'scheduled' | 'staging' | 'playing' | 'finished' | 'stopped'
  actualStartTime?: string
  actualEndTime?: string
}

export interface TmsAlarm {
  id: string
  deviceId: string
  deviceName: string
  hallId: string
  hallName: string
  level: 'critical' | 'warning' | 'info'
  category: string
  message: string
  occurredAt: string
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: string
}

export interface TmsProjectionQuality {
  hallId: string
  measuredAt: string
  screenWhiteLuminance: number
  screenLuminanceUniformity: number
  contrastRatio: number
  colorTemperature: number
  xCoordinate: number
  yCoordinate: number
}

export interface TmsApiResult<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
  timestamp: string
}

const DEFAULT_CONFIG: TmsAuthConfig = {
  baseUrl: 'https://tms.cinema.local:8443/api/v1',
  apiKey: '',
  username: '',
  password: '',
  vendor: 'GDC'
}

let authConfig: TmsAuthConfig = { ...DEFAULT_CONFIG }

export function setTmsConfig(cfg: Partial<TmsAuthConfig>) {
  authConfig = { ...DEFAULT_CONFIG, ...cfg }
}

async function tmsRequest<T>(path: string, options: RequestInit = {}): Promise<TmsApiResult<T>> {
  const url = `${authConfig.baseUrl}${path}`
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': authConfig.apiKey,
        Authorization: `Basic ${btoa(`${authConfig.username}:${authConfig.password}`)}`,
        ...(options.headers || {})
      }
    })
    const data = await res.json()
    return { success: res.ok, data, timestamp: new Date().toISOString() }
  } catch (e) {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: (e as Error).message },
      timestamp: new Date().toISOString()
    }
  }
}

// ============ 设备监控 ============
export const tmsDeviceApi = {
  getStatus: (hallId?: string) =>
    tmsRequest<TmsDeviceStatus[]>(`/device/status${hallId ? `?hallId=${hallId}` : ''}`),

  getDeviceById: (deviceId: string) =>
    tmsRequest<TmsDeviceStatus>(`/device/${deviceId}`),

  restartDevice: (deviceId: string) =>
    tmsRequest<{ jobId: string }>(`/device/${deviceId}/restart`, { method: 'POST' }),

  switchProjector: (deviceId: string, on: boolean) =>
    tmsRequest<{ jobId: string }>(`/device/${deviceId}/power`, {
      method: 'POST',
      body: JSON.stringify({ on })
    })
}

// ============ KDM密钥管理 ============
export const tmsKdmApi = {
  listKdm: (movieId?: string, hallId?: string) => {
    const params = new URLSearchParams()
    if (movieId) params.set('movieId', movieId)
    if (hallId) params.set('hallId', hallId)
    const qs = params.toString()
    return tmsRequest<TmsKdmKey[]>(`/kdm/list${qs ? `?${qs}` : ''}`)
  },

  uploadKdm: (payload: { movieId: string; hallId: string; kdmContent: string }) =>
    tmsRequest<{ id: string; validFrom: string; validTo: string }>('/kdm/upload', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getExpiringSoon: (days = 7) =>
    tmsRequest<TmsKdmKey[]>(`/kdm/expiring?days=${days}`)
}

// ============ 播放列表 SPL ============
export const tmsPlayListApi = {
  listPlayLists: (hallId?: string) =>
    tmsRequest<TmsPlayList[]>(`/playlist${hallId ? `?hallId=${hallId}` : ''}`),

  createPlayList: (payload: Partial<TmsPlayList>) =>
    tmsRequest<{ id: string }>('/playlist', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  approvePlayList: (playlistId: string) =>
    tmsRequest<{ status: 'approved' }>(`/playlist/${playlistId}/approve`, { method: 'POST' }),

  syncSchedule: (scheduleId: string, tmsSessionId: string) =>
    tmsRequest<TmsSessionSync>(`/playlist/sync`, {
      method: 'POST',
      body: JSON.stringify({ scheduleId, tmsSessionId })
    })
}

// ============ 场次同步 ============
export const tmsSessionApi = {
  getSessionById: (tmsSessionId: string) =>
    tmsRequest<TmsSessionSync>(`/session/${tmsSessionId}`),

  getRunningSessions: () =>
    tmsRequest<TmsSessionSync[]>('/session/running'),

  startSession: (tmsSessionId: string) =>
    tmsRequest<{ started: true }>(`/session/${tmsSessionId}/start`, { method: 'POST' }),

  stopSession: (tmsSessionId: string) =>
    tmsRequest<{ stopped: true }>(`/session/${tmsSessionId}/stop`, { method: 'POST' }),

  getSessionTimeline: (tmsSessionId: string) =>
    tmsRequest<{
      scheduleStart: string
      actualStart?: string
      currentPosition: number
      totalDuration: number
      currentSegment: string
      stage: 'idle' | 'ads' | 'trailers' | 'feature' | 'end'
    }>(`/session/${tmsSessionId}/timeline`)
}

// ============ 报警与工单 ============
export const tmsAlarmApi = {
  listAlarms: (acknowledged = false) =>
    tmsRequest<TmsAlarm[]>(`/alarm/list?acknowledged=${acknowledged}`),

  acknowledge: (alarmId: string, operator: string) =>
    tmsRequest<{ acknowledged: true }>(`/alarm/${alarmId}/ack`, {
      method: 'POST',
      body: JSON.stringify({ operator })
    }),

  getCriticalSummary: () =>
    tmsRequest<{ critical: number; warning: number; byHall: Array<{ hallId: string; count: number }> }>('/alarm/summary')
}

// ============ 放映质量检测 ============
export const tmsQualityApi = {
  getLatestReport: (hallId: string) =>
    tmsRequest<TmsProjectionQuality>(`/quality/latest?hallId=${hallId}`),

  runCheck: (hallId: string) =>
    tmsRequest<{ jobId: string }>(`/quality/check`, {
      method: 'POST',
      body: JSON.stringify({ hallId })
    })
}

export const tms = {
  device: tmsDeviceApi,
  kdm: tmsKdmApi,
  playlist: tmsPlayListApi,
  session: tmsSessionApi,
  alarm: tmsAlarmApi,
  quality: tmsQualityApi,
  setConfig: setTmsConfig
}

export default tms
