import { Router, type Request, type Response } from 'express'
import { mockData } from '../data/mockData.js'
import { generateScheduleForLine, generateAllSchedules, detectConflicts } from '../services/dispatchEngine.js'

const router = Router()

const MAX_PAGE_SIZE = 200

router.get('/', (req: Request, res: Response): void => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 20))
  const lineId = req.query.lineId as string | undefined
  const date = req.query.date as string | undefined

  let filtered = [...mockData.trips]
  if (lineId) filtered = filtered.filter(t => t.lineId === lineId)
  if (date) filtered = filtered.filter(t => t.departureTime.startsWith(date))

  const total = filtered.length
  const items = filtered.slice((page - 1) * pageSize, page * pageSize)

  res.json({ success: true, data: { items, total, page, pageSize } })
})

router.get('/lines', (req: Request, res: Response): void => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 20))

  const total = mockData.lines.length
  const items = mockData.lines.slice((page - 1) * pageSize, page * pageSize)

  res.json({ success: true, data: { items, total, page, pageSize } })
})

router.get('/lines/:lineId', (req: Request, res: Response): void => {
  const line = mockData.lines.find(l => l.id === req.params.lineId)
  if (!line) {
    res.status(404).json({ success: false, error: '线路不存在' })
    return
  }
  res.json({ success: true, data: line })
})

router.get('/lines/:lineId/routes', (req: Request, res: Response): void => {
  const routes = mockData.routes.filter(r => r.lineId === req.params.lineId)
  res.json({ success: true, data: routes })
})

router.post('/generate', (req: Request, res: Response): void => {
  const { lineId, date } = req.body
  if (!date) {
    res.status(400).json({ success: false, error: '缺少日期参数' })
    return
  }

  if (lineId) {
    const schedule = generateScheduleForLine(lineId, date)
    const conflicts = detectConflicts(schedule)
    res.json({ success: true, data: { schedule, conflicts } })
  } else {
    const schedules = generateAllSchedules(date)
    const results = schedules.map(s => ({
      schedule: s,
      conflicts: detectConflicts(s),
    }))
    res.json({ success: true, data: results })
  }
})

router.get('/:tripId', (req: Request, res: Response): void => {
  const trip = mockData.trips.find(t => t.id === req.params.tripId)
  if (!trip) {
    res.status(404).json({ success: false, error: '班次不存在' })
    return
  }
  res.json({ success: true, data: trip })
})

router.put('/:tripId', (req: Request, res: Response): void => {
  const trip = mockData.trips.find(t => t.id === req.params.tripId)
  if (!trip) {
    res.status(404).json({ success: false, error: '班次不存在' })
    return
  }

  const { vehicleId, driverId, departureTime, status, delayMinutes } = req.body
  if (vehicleId) trip.vehicleId = vehicleId
  if (driverId) trip.driverId = driverId
  if (departureTime) trip.departureTime = departureTime
  if (status) trip.status = status
  if (delayMinutes !== undefined) trip.delayMinutes = delayMinutes

  res.json({ success: true, data: trip })
})

export default router
