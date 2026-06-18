import { Router, type Request, type Response } from 'express'
import { mockData } from '../data/mockData.js'
import { predictArrival, predictArrivalsForLine, predictArrivalsForStop } from '../services/arrivalPredictor.js'

const router = Router()

const MAX_PAGE_SIZE = 200

router.post('/report', (req: Request, res: Response): void => {
  const { vehicleId, lineId, tripId, latitude, longitude, speed, heading } = req.body
  if (!vehicleId || !lineId || latitude === undefined || longitude === undefined) {
    res.status(400).json({ success: false, error: '缺少必要参数' })
    return
  }

  const record = {
    id: `gps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    vehicleId,
    lineId,
    tripId: tripId || undefined,
    latitude,
    longitude,
    speed: speed || 0,
    heading: heading || 0,
    timestamp: Date.now(),
  }
  mockData.gpsRecords.push(record)

  if (mockData.gpsRecords.length > 10000) {
    mockData.gpsRecords.splice(0, mockData.gpsRecords.length - 5000)
  }

  res.status(201).json({ success: true, data: record })
})

router.get('/track/:vehicleId', (req: Request, res: Response): void => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 50))
  const vehicleId = req.params.vehicleId

  const filtered = mockData.gpsRecords
    .filter(g => g.vehicleId === vehicleId)
    .sort((a, b) => b.timestamp - a.timestamp)

  const total = filtered.length
  const items = filtered.slice((page - 1) * pageSize, page * pageSize)

  res.json({ success: true, data: { items, total, page, pageSize } })
})

router.get('/latest/:vehicleId', (req: Request, res: Response): void => {
  const latest = mockData.gpsRecords
    .filter(g => g.vehicleId === req.params.vehicleId)
    .sort((a, b) => b.timestamp - a.timestamp)[0]

  if (!latest) {
    res.status(404).json({ success: false, error: '无GPS记录' })
    return
  }
  res.json({ success: true, data: latest })
})

router.get('/line/:lineId', (req: Request, res: Response): void => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 50))

  const filtered = mockData.gpsRecords
    .filter(g => g.lineId === req.params.lineId)
    .sort((a, b) => b.timestamp - a.timestamp)

  const total = filtered.length
  const items = filtered.slice((page - 1) * pageSize, page * pageSize)

  res.json({ success: true, data: { items, total, page, pageSize } })
})

router.get('/predict/:vehicleId/:stopId', (req: Request, res: Response): void => {
  const prediction = predictArrival(req.params.vehicleId, req.params.stopId)
  if (!prediction) {
    res.status(404).json({ success: false, error: '无法预测，请检查车辆和站点ID' })
    return
  }
  res.json({ success: true, data: prediction })
})

router.get('/predict/line/:lineId/stop/:stopId', (req: Request, res: Response): void => {
  const predictions = predictArrivalsForLine(req.params.lineId, req.params.stopId)
  res.json({ success: true, data: predictions })
})

router.get('/predict/stop/:stopId', (req: Request, res: Response): void => {
  const predictions = predictArrivalsForStop(req.params.stopId)
  res.json({ success: true, data: predictions })
})

export default router
