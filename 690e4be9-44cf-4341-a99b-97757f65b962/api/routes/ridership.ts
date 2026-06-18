import { Router, type Request, type Response } from 'express'
import { mockData } from '../data/mockData.js'

const router = Router()

const MAX_PAGE_SIZE = 200

router.get('/', (req: Request, res: Response): void => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 20))
  const tripId = req.query.tripId as string | undefined
  const stopId = req.query.stopId as string | undefined

  let filtered = [...mockData.ridershipRecords]
  if (tripId) filtered = filtered.filter(r => r.tripId === tripId)
  if (stopId) filtered = filtered.filter(r => r.stopId === stopId)

  filtered.sort((a, b) => b.timestamp - a.timestamp)

  const total = filtered.length
  const items = filtered.slice((page - 1) * pageSize, page * pageSize)

  res.json({ success: true, data: { items, total, page, pageSize } })
})

router.post('/', (req: Request, res: Response): void => {
  const { tripId, stopId, boarding, alighting, onboardCount, loadFactor } = req.body
  if (!tripId || !stopId) {
    res.status(400).json({ success: false, error: '缺少必要参数' })
    return
  }

  const record = {
    id: `rid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tripId,
    stopId,
    boarding: boarding || 0,
    alighting: alighting || 0,
    onboardCount: onboardCount || 0,
    loadFactor: loadFactor || 0,
    timestamp: Date.now(),
  }
  mockData.ridershipRecords.push(record)

  res.status(201).json({ success: true, data: record })
})

router.get('/trip/:tripId', (req: Request, res: Response): void => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 50))

  const filtered = mockData.ridershipRecords
    .filter(r => r.tripId === req.params.tripId)
    .sort((a, b) => a.timestamp - b.timestamp)

  const total = filtered.length
  const items = filtered.slice((page - 1) * pageSize, page * pageSize)

  res.json({ success: true, data: { items, total, page, pageSize } })
})

router.get('/stop/:stopId', (req: Request, res: Response): void => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 50))

  const filtered = mockData.ridershipRecords
    .filter(r => r.stopId === req.params.stopId)
    .sort((a, b) => b.timestamp - a.timestamp)

  const total = filtered.length
  const items = filtered.slice((page - 1) * pageSize, page * pageSize)

  res.json({ success: true, data: { items, total, page, pageSize } })
})

router.get('/stats', (req: Request, res: Response): void => {
  const totalBoarding = mockData.ridershipRecords.reduce((s, r) => s + r.boarding, 0)
  const totalAlighting = mockData.ridershipRecords.reduce((s, r) => s + r.alighting, 0)
  const avgLoadFactor = mockData.ridershipRecords.length > 0
    ? mockData.ridershipRecords.reduce((s, r) => s + r.loadFactor, 0) / mockData.ridershipRecords.length
    : 0
  const maxLoadRecord = mockData.ridershipRecords.reduce(
    (max, r) => r.loadFactor > max.loadFactor ? r : max,
    { loadFactor: 0 } as typeof mockData.ridershipRecords[0]
  )

  res.json({
    success: true,
    data: {
      totalRecords: mockData.ridershipRecords.length,
      totalBoarding,
      totalAlighting,
      averageLoadFactor: Math.round(avgLoadFactor * 1000) / 1000,
      peakLoadFactor: maxLoadRecord.loadFactor,
    },
  })
})

export default router
