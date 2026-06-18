import type { AnomalyRecord } from '../models/AnomalyRecord.js'
import { mockData } from '../data/mockData.js'

interface AnomalyDetectionResult {
  anomalies: AnomalyRecord[]
  recommendations: AnomalyRecommendation[]
}

interface AnomalyRecommendation {
  lineId: string
  lineName: string
  type: string
  description: string
  action: string
  priority: string
}

export function detectAnomalies(): AnomalyDetectionResult {
  const anomalies: AnomalyRecord[] = []
  const recommendations: AnomalyRecommendation[] = []

  detectOverloadAnomalies(anomalies, recommendations)
  detectDelayAnomalies(anomalies, recommendations)

  return { anomalies, recommendations }
}

function detectOverloadAnomalies(
  anomalies: AnomalyRecord[],
  recommendations: AnomalyRecommendation[]
): void {
  const lineTripRidership = new Map<string, Map<string, number[]>>()

  for (const rec of mockData.ridershipRecords) {
    const trip = mockData.trips.find(t => t.id === rec.tripId)
    if (!trip) continue

    if (!lineTripRidership.has(trip.lineId)) {
      lineTripRidership.set(trip.lineId, new Map())
    }
    const lineMap = lineTripRidership.get(trip.lineId)!
    const factors = lineMap.get(trip.direction.toString()) || []
    factors.push(rec.loadFactor)
    lineMap.set(trip.direction.toString(), factors)
  }

  for (const [lineId, dirMap] of lineTripRidership) {
    for (const [direction, factors] of dirMap) {
      const sorted = factors.sort((a, b) => a - b)
      const topThree = sorted.slice(-3)
      if (topThree.length >= 3 && topThree.every(f => f > 0.9)) {
        const line = mockData.lines.find(l => l.id === lineId)
        const anomaly: AnomalyRecord = {
          id: `anm_overload_${lineId}_${direction}`,
          type: 'overload',
          lineId,
          tripId: undefined,
          vehicleId: undefined,
          driverId: undefined,
          description: `${line?.name || lineId}方向${direction}连续3班满载率超90%`,
          severity: 'high',
          timestamp: Date.now(),
          resolved: false,
          recommendation: '建议加密该时段班次，缩短发车间距',
        }
        anomalies.push(anomaly)
        recommendations.push({
          lineId,
          lineName: line?.name || lineId,
          type: 'overload',
          description: `连续3班满载率超90%`,
          action: `将高峰发车间距从${line?.peakInterval || 5}分钟缩短至${Math.max(2, (line?.peakInterval || 5) - 2)}分钟，增加${Math.ceil(3 / Math.max(1, line?.vehicleCount || 1))}个班次`,
          priority: 'high',
        })
      }
    }
  }
}

function detectDelayAnomalies(
  anomalies: AnomalyRecord[],
  recommendations: AnomalyRecommendation[]
): void {
  for (const trip of mockData.trips) {
    if (trip.delayMinutes > 5 && trip.status !== 'completed') {
      const line = mockData.lines.find(l => l.id === trip.lineId)
      const anomaly: AnomalyRecord = {
        id: `anm_delay_${trip.id}`,
        type: 'delay',
        lineId: trip.lineId,
        tripId: trip.id,
        vehicleId: trip.vehicleId,
        driverId: trip.driverId,
        description: `${line?.name || trip.lineId}班次${trip.id}晚点${trip.delayMinutes}分钟`,
        severity: trip.delayMinutes > 10 ? 'high' : 'medium',
        timestamp: Date.now(),
        resolved: false,
        recommendation: '建议调整发车间距或增派车辆',
      }
      anomalies.push(anomaly)

      if (anomalies.filter(a => a.lineId === trip.lineId && a.type === 'delay').length <= 3) {
        recommendations.push({
          lineId: trip.lineId,
          lineName: line?.name || trip.lineId,
          type: 'delay',
          description: `班次${trip.id}晚点${trip.delayMinutes}分钟`,
          action: `增派1辆备用车辆至${line?.name || trip.lineId}，调整后续班次发车时间`,
          priority: trip.delayMinutes > 10 ? 'high' : 'medium',
        })
      }
    }
  }
}

export function getActiveAnomalies(): AnomalyRecord[] {
  return mockData.anomalyRecords.filter(a => !a.resolved)
}

export function resolveAnomaly(anomalyId: string): boolean {
  const anomaly = mockData.anomalyRecords.find(a => a.id === anomalyId)
  if (!anomaly) return false
  anomaly.resolved = true
  return true
}

export function getAnomaliesByLine(lineId: string): AnomalyRecord[] {
  return mockData.anomalyRecords.filter(a => a.lineId === lineId)
}
