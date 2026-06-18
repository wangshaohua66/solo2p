import type { Driver } from '../models/Driver.js'
import { mockData } from '../data/mockData.js'

interface SubstituteCandidate {
  driver: Driver
  score: number
  reasons: string[]
}

interface SubstituteResult {
  absentDriverId: string
  absentDriverName: string
  lineId: string
  candidates: SubstituteCandidate[]
}

function calculateSubstituteScore(
  candidate: Driver,
  absentDriver: Driver,
  targetLineId: string
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  if (candidate.licenseType === absentDriver.licenseType) {
    score += 40
    reasons.push(`驾照类型匹配(${candidate.licenseType})`)
  } else if (
    (candidate.licenseType === 'A1' && absentDriver.licenseType === 'A3') ||
    (candidate.licenseType === 'A3' && absentDriver.licenseType === 'A1')
  ) {
    score += 25
    reasons.push(`驾照类型兼容(${candidate.licenseType}/${absentDriver.licenseType})`)
  }

  if (candidate.lineId === targetLineId) {
    score += 35
    reasons.push('本线路司机，熟悉线路')
  } else {
    const candidateLineTrips = mockData.trips.filter(t => t.lineId === candidate.lineId)
    const targetLineTrips = mockData.trips.filter(t => t.lineId === targetLineId)
    if (candidateLineTrips.length > 0 && targetLineTrips.length > 0) {
      const routeSimilarity = 1 - Math.abs(candidateLineTrips.length - targetLineTrips.length) /
        Math.max(candidateLineTrips.length, targetLineTrips.length)
      score += Math.round(15 * routeSimilarity)
      reasons.push('相邻线路经验')
    }
  }

  if (candidate.status === 'off') {
    score += 20
    reasons.push('当前休息状态，可调配')
  } else if (candidate.status === 'active') {
    const currentWork = candidate.dailyWorkMinutes
    if (currentWork < 360) {
      score += 10
      reasons.push(`当日工时${currentWork}分钟，有余量`)
    } else {
      score -= 10
      reasons.push(`当日工时${currentWork}分钟，余量不足`)
    }
  }

  if (candidate.dailyWorkMinutes < 420) {
    score += 5
    reasons.push('工时合规')
  }

  return { score, reasons }
}

export function findSubstitute(absentDriverId: string): SubstituteResult | null {
  const absentDriver = mockData.drivers.find(d => d.id === absentDriverId)
  if (!absentDriver) return null

  const targetLineId = absentDriver.lineId
  if (!targetLineId) return null

  const candidates: SubstituteCandidate[] = []

  for (const driver of mockData.drivers) {
    if (driver.id === absentDriverId) continue
    if (driver.status === 'leave') continue

    const { score, reasons } = calculateSubstituteScore(driver, absentDriver, targetLineId)
    if (score >= 25) {
      candidates.push({ driver, score, reasons })
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  return {
    absentDriverId,
    absentDriverName: absentDriver.name,
    lineId: targetLineId,
    candidates: candidates.slice(0, 5),
  }
}

export function findSubstitutesForLine(lineId: string): SubstituteResult[] {
  const absentDrivers = mockData.drivers.filter(
    d => d.lineId === lineId && d.status === 'leave'
  )

  return absentDrivers
    .map(d => findSubstitute(d.id))
    .filter((r): r is SubstituteResult => r !== null)
}

export function applySubstitute(absentDriverId: string, substituteDriverId: string): boolean {
  const absent = mockData.drivers.find(d => d.id === absentDriverId)
  const substitute = mockData.drivers.find(d => d.id === substituteDriverId)
  if (!absent || !substitute) return false

  substitute.lineId = absent.lineId
  substitute.status = 'active'
  return true
}
