import { Router, type Request, type Response } from 'express'
import { generateDailyReport, generateLineReport } from '../services/reportGenerator.js'
import { detectAnomalies, getActiveAnomalies, getAnomaliesByLine, resolveAnomaly } from '../services/anomalyDetector.js'

const router = Router()

router.get('/daily', (req: Request, res: Response): void => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0]
  const report = generateDailyReport(date)
  res.json({ success: true, data: report })
})

router.get('/daily/:date', (req: Request, res: Response): void => {
  const report = generateDailyReport(req.params.date)
  res.json({ success: true, data: report })
})

router.get('/line/:lineId', (req: Request, res: Response): void => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0]
  const report = generateLineReport(req.params.lineId, date)
  if (!report) {
    res.status(404).json({ success: false, error: '线路不存在' })
    return
  }
  res.json({ success: true, data: report })
})

router.get('/anomalies', (req: Request, res: Response): void => {
  const active = req.query.active === 'true'
  if (active) {
    const anomalies = getActiveAnomalies()
    res.json({ success: true, data: anomalies })
  } else {
    const { anomalies, recommendations } = detectAnomalies()
    res.json({ success: true, data: { anomalies, recommendations } })
  }
})

router.get('/anomalies/:lineId', (req: Request, res: Response): void => {
  const anomalies = getAnomaliesByLine(req.params.lineId)
  res.json({ success: true, data: anomalies })
})

router.put('/anomalies/:anomalyId/resolve', (req: Request, res: Response): void => {
  const success = resolveAnomaly(req.params.anomalyId)
  if (!success) {
    res.status(404).json({ success: false, error: '异常记录不存在' })
    return
  }
  res.json({ success: true, data: { message: '异常已标记为已解决' } })
})

export default router
